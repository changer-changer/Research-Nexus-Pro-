from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
import os
import shutil
from typing import Dict, Any, List, Optional
import uuid
import logging
import json
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

from app.models.domain_schema import (
    InnovationBoardDTO, InnovationOpportunity, Problem, Method,
    EvidencePanelDTO, EvidenceSpan, Paper, ProblemTimelineDTO, DomainMapDTO, PaperClaim, EvidenceLink,
    NodeDetailDTO, InnovationInsightDTO, CanonicalNode, SearchResultsDTO, SearchResultDTO
)
from app.services.ingestion_pipeline import IngestionPipeline
from app.database.local_graph import LocalGraphDB
from app.database.local_vector import LocalVectorDB
from app.services.kimi_client import KimiExtractor

router = APIRouter(prefix="/v3", tags=["v3_graph_dto"])

# Dependency to get graph DB instance
def get_graph_db():
    return LocalGraphDB()

# Dependency to get vector DB instance
def get_vector_db():
    return LocalVectorDB()

@router.post("/ingest")
async def ingest_paper(
    file: UploadFile = File(..., description="The PDF file of the academic paper"), 
    paper_id: str = Form(..., description="Unique identifier for the paper (e.g., arXiv ID)"),
    title: str = Form(None, description="Title of the paper (optional)"),
    authors: str = Form(None, description="Comma-separated authors (optional)"),
    year: str = Form(None, description="Publication year (optional)"),
    venue: str = Form(None, description="Publication venue (optional)"),
    graph_db: LocalGraphDB = Depends(get_graph_db),
    vector_db: LocalVectorDB = Depends(get_vector_db)
):
    """
    Ingest a new PDF paper into the Knowledge Graph using the Kimi Extractor Pipeline.
    Designed for external agent Harvester integration.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)
        meta = {
            "paper_id": paper_id,
            "title": title or file.filename,
            "authors": authors.split(',') if authors else ["Unknown"],
            "year": year or "2024",
            "venue": venue or "ArXiv"
        }
        
        # 1. Register Paper in Graph DB first
        graph_db.create_paper({
            "id": meta["paper_id"],
            "title": meta["title"],
            "authors": meta["authors"],
            "year": meta["year"],
            "venue": meta["venue"],
            "arxiv_id": meta["paper_id"] if "arxiv" in meta["paper_id"].lower() else None
        })

        # 2. Run Pipeline
        result = await pipeline.process_paper(file_path, meta)
        
        # Add friendly response for Agent
        return {
            "status": "success",
            "message": f"Successfully ingested paper '{meta['title']}'",
            "paper_id": meta["paper_id"],
            "claims_extracted": result.get("claims_extracted", 0)
        }
    except Exception as e:
        logger.error(f"Ingestion failed for {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@router.get("/domain-map", response_model=DomainMapDTO)
async def get_domain_map(graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [Query-Driven] Get canonical domain map with evidence-backed relations.
    Preserves true hierarchical parent-child relationships from database.
    """
    raw_probs = graph_db.get_all_problems()
    raw_meths = graph_db.get_all_methods()

    # Helper: infer parent from SUB_PROBLEM_OF / SUB_TYPE_OF / IMPROVES_UPON edges
    def _infer_parent_from_edges(node_id: str, node_type: str) -> Optional[str]:
        for source, target, data in graph_db.graph.edges(data=True):
            if source == node_id and data.get("type") in ("SUB_PROBLEM_OF", "SUB_TYPE_OF", "IMPROVES_UPON"):
                return target
        return None

    # ========== PROBLEMS: Preserve true hierarchy ==========
    problems = []
    problem_id_map = {}

    for rp in raw_probs:
        pid = rp.get("id")
        canonical_id = rp.get("canonical_id") or pid
        problem_id_map[pid] = canonical_id

        # 1. Check explicit parent_id in node data
        parent_id = rp.get("parent_id") or rp.get("parentId") or rp.get("parent")
        # 2. Fall back to edge-based inference
        if not parent_id:
            parent_id = _infer_parent_from_edges(pid, "problem")
        # 3. Normalize parent to canonical id
        if parent_id and parent_id in problem_id_map:
            parent_id = problem_id_map[parent_id]

        problems.append(Problem(
            canonical_id=canonical_id,
            name=rp.get("name", "Unknown Problem"),
            domain=rp.get("domain", "General"),
            definition=rp.get("definition", ""),
            resolution_status=rp.get("resolution_status", "unsolved"),
            description=rp.get("description", "No detailed description generated yet."),
            development_progress=rp.get("development_progress", "No progress history generated yet."),
            value_score=rp.get("value_score"),
            parent_id=parent_id
        ))

    # ========== METHODS: Preserve true hierarchy ==========
    methods = []
    method_id_map = {}

    for rm in raw_meths:
        mid = rm.get("id")
        canonical_id = rm.get("canonical_id") or mid
        method_id_map[mid] = canonical_id

        # 1. Check explicit parent_id in node data
        parent_id = rm.get("parent_id") or rm.get("parentId") or rm.get("parent")
        # 2. Fall back to edge-based inference
        if not parent_id:
            parent_id = _infer_parent_from_edges(mid, "method")
        # 3. Normalize parent to canonical id
        if parent_id and parent_id in method_id_map:
            parent_id = method_id_map[parent_id]

        methods.append(Method(
            canonical_id=canonical_id,
            name=rm.get("name", "Unknown Method"),
            domain=rm.get("domain", "General"),
            mechanism=rm.get("mechanism", ""),
            complexity=rm.get("complexity", "Unknown"),
            description=rm.get("description", "No detailed description generated yet."),
            development_progress=rm.get("development_progress", "No progress history generated yet."),
            value_score=rm.get("value_score"),
            parent_id=parent_id
        ))
        
    # Get relations from the NetworkX in-memory graph
    relations = []
    for source, target, data in graph_db.graph.edges(data=True):
        if data.get("type") in ["ADDRESSES_PROBLEM", "SOLVES", "USES_METHOD"]:
            # Map source/target to canonical IDs
            source_id = problem_id_map.get(source) or method_id_map.get(source) or source
            target_id = problem_id_map.get(target) or method_id_map.get(target) or target
            
            relations.append(EvidenceLink(
                source_canonical_id=source_id,
                target_canonical_id=target_id,
                relation_type=data.get("type"),
                supporting_claims=[]
            ))
            
    return DomainMapDTO(problems=problems, methods=methods, relations=relations)

@router.get("/search", response_model=SearchResultsDTO)
async def search_nodes(
    q: str,
    node_type: Optional[str] = None,
    limit: int = 20,
    graph_db: LocalGraphDB = Depends(get_graph_db)
):
    """
    [Query-Driven] Full-text search across problems, methods, and papers using FTS5.
    """
    raw_results = graph_db.search_nodes(q, node_type=node_type, limit=limit)
    
    results = []
    for item in raw_results:
        node_id = item.get("id", "")
        ntype = "unknown"
        if node_id.startswith("prob_"):
            ntype = "problem"
        elif node_id.startswith("meth_"):
            ntype = "method"
        elif node_id.startswith("paper_"):
            ntype = "paper"
        
        results.append(SearchResultDTO(
            node_id=node_id,
            node_type=ntype,
            title=item.get("name") or item.get("title", "Unknown"),
            domain=item.get("domain"),
            description=item.get("description")
        ))
    
    return SearchResultsDTO(
        query=q,
        results=results,
        total=len(results)
    )

@router.get("/innovation-board", response_model=InnovationBoardDTO)
async def get_innovation_board(
    page: int = 1,
    page_size: int = 12,
    q: Optional[str] = None,
    graph_db: LocalGraphDB = Depends(get_graph_db)
):
    """
    [Query-Driven] Get system-reasoned innovation opportunities from SQLite.
    Supports pagination and keyword filtering.
    """
    raw_innovations = graph_db.get_all_innovations()
    
    opportunities = []
    problems_index = {}
    methods_index = {}
    
    for row in raw_innovations:
        # Map DB columns to model fields; normalize scores to 0-1 range
        target_problem = row.get("target_problem", "")
        candidate_method = row.get("candidate_method", "")
        opp = InnovationOpportunity(
            opportunity_id=row.get("id", ""),
            target_problem_id=target_problem if target_problem else "unknown",
            candidate_method_ids=[candidate_method] if candidate_method else [],
            rationale=row.get("core_insight", row.get("description", "")),
            supporting_evidence_ids=[],
            risks=[],
            feasibility_score=min((row.get("feasibility_score") or 0.0) / 10.0, 1.0),
            novelty_score=min((row.get("novelty_score") or 0.0) / 10.0, 1.0),
        )
        opportunities.append(opp)

        # Hydrate target problem
        prob_id = target_problem if target_problem else None
        if prob_id and prob_id not in problems_index:
            p_data = graph_db.get_problem(prob_id)
            if p_data:
                problems_index[prob_id] = Problem(
                    canonical_id=prob_id,
                    name=p_data.get("name", ""),
                    domain=p_data.get("domain", ""),
                    definition=p_data.get("definition", ""),
                    resolution_status=p_data.get("resolution_status", "unsolved"),
                    description=p_data.get("description", "No detailed description generated yet."),
                    development_progress=p_data.get("development_progress", "No progress history generated yet."),
                    value_score=p_data.get("value_score")
                )

        # Hydrate candidate methods
        for m_id in ([candidate_method] if candidate_method else []):
            if m_id and m_id not in methods_index:
                m_data = graph_db.get_method(m_id)
                if m_data:
                    methods_index[m_id] = Method(
                        canonical_id=m_id,
                        name=m_data.get("name", ""),
                        domain=m_data.get("domain", ""),
                        mechanism=m_data.get("mechanism", ""),
                        complexity=m_data.get("complexity", "Unknown"),
                        description=m_data.get("description", "No detailed description generated yet."),
                        development_progress=m_data.get("development_progress", "No progress history generated yet."),
                        value_score=m_data.get("value_score")
                    )

    # Apply search filter
    if q and q.strip():
        query = q.strip().lower()
        filtered = []
        for opp in opportunities:
            target_problem = problems_index.get(opp.target_problem_id)
            target_name = (target_problem.name if target_problem else "").lower()
            method_names = " ".join(
                (methods_index.get(mid).name if methods_index.get(mid) else "").lower()
                for mid in opp.candidate_method_ids
            )
            rationale = (opp.rationale or "").lower()
            if query in target_name or query in method_names or query in rationale:
                filtered.append(opp)
        opportunities = filtered

    total = len(opportunities)

    # Normalize pagination params
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    start = (page - 1) * page_size
    end = start + page_size

    # Slice for current page
    paginated = opportunities[start:end]

    return InnovationBoardDTO(
        opportunities=paginated,
        problems_index=problems_index,
        methods_index=methods_index,
        total_opportunities=total
    )

@router.get("/evidence/{claim_id}", response_model=EvidencePanelDTO)
async def get_evidence(claim_id: str, graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [Query-Driven] Get source evidence for any claim or relation from SQLite.
    """
    claim_data = graph_db.get_claim(claim_id)
    if not claim_data:
        raise HTTPException(status_code=404, detail="Claim not found")
        
    paper_id = claim_data.get("paper_id")
    paper_data = None
    if paper_id:
        paper_data = graph_db.graph.nodes.get(paper_id, {})
        
    paper = Paper(
        canonical_id=paper_id or "unknown_paper", 
        name=paper_data.get("title", "Source Paper") if paper_data else "Source Paper",
        title=paper_data.get("title", "Source Paper") if paper_data else "Source Paper", 
        authors=paper_data.get("authors", ["Unknown"]) if paper_data else ["Unknown"], 
        year=int(paper_data.get("year", 2026)) if paper_data and str(paper_data.get("year", "")).isdigit() else 2026, 
        venue=paper_data.get("venue", "Unknown") if paper_data else "Unknown", 
        abstract=paper_data.get("abstract", "") if paper_data else "",
        arxiv_id=paper_data.get("arxiv_id") if paper_data else None
    )
    
    spans = [
        EvidenceSpan(
            paper_id=ev.get("paper_id", paper_id),
            section=ev.get("section", ""),
            snippet=ev.get("snippet", ""),
            confidence=ev.get("confidence", 1.0),
            page_num=ev.get("page_num")
        ) for ev in claim_data.get("evidence", [])
    ]
    
    return EvidencePanelDTO(
        claim_id=claim_id,
        claim_text=claim_data.get("text", ""),
        evidence=spans,
        paper=paper
    )

@router.get("/node/{node_id}/details", response_model=NodeDetailDTO)
async def get_node_details(node_id: str, graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [Drill-down] Get all related papers, specific evidence claims, and sub-nodes for a canonical node.
    """
    node_data = graph_db.get_problem(node_id)
    node_type = "Problem"
    if not node_data:
        node_data = graph_db.get_method(node_id)
        node_type = "Method"
    
    if not node_data:
        raise HTTPException(status_code=404, detail="Node not found")
        
    canonical_node = CanonicalNode(
        canonical_id=node_id,
        name=node_data.get("name", "Unknown"),
        aliases=[]
    )
    
    # Inject the actual node implementation so frontend can access description
    if node_type == "Problem":
        canonical_node = Problem(
            canonical_id=node_id,
            name=node_data.get("name", "Unknown"),
            aliases=[],
            domain=node_data.get("domain", "Unknown"),
            definition=node_data.get("definition", ""),
            resolution_status=node_data.get("resolution_status", "unsolved"),
            description=node_data.get("description", "No detailed description generated yet."),
            development_progress=node_data.get("development_progress", "No progress history generated yet."),
            value_score=node_data.get("value_score")
        )
    else:
        canonical_node = Method(
            canonical_id=node_id,
            name=node_data.get("name", "Unknown"),
            aliases=[],
            domain=node_data.get("domain", "Unknown"),
            mechanism=node_data.get("mechanism", ""),
            complexity=node_data.get("complexity", "Unknown"),
            description=node_data.get("description", "No detailed description generated yet."),
            development_progress=node_data.get("development_progress", "No progress history generated yet."),
            value_score=node_data.get("value_score")
        )
    
    # 1. Fetch all claims aligned to this canonical node
    claims_data = graph_db.get_claims_by_canonical(node_id)
    
    specific_claims = []
    paper_ids = set()
    for c in claims_data:
        spans = [
            EvidenceSpan(
                paper_id=ev.get("paper_id", c["paper_id"]),
                section=ev.get("section", ""),
                snippet=ev.get("snippet", ""),
                confidence=ev.get("confidence", 1.0)
            ) for ev in c.get("evidence", [])
        ]
        specific_claims.append(PaperClaim(
            claim_id=c["claim_id"],
            canonical_id=node_id,
            claim_type=c["claim_type"],
            text=c["text"],
            evidence=spans
        ))
        paper_ids.add(c["paper_id"])
        
    # 2. Mock hydrating papers (In real DB we would fetch Paper nodes)
    related_papers = []
    for pid in paper_ids:
        paper_node = graph_db.graph.nodes.get(pid, {})
        related_papers.append(Paper(
            canonical_id=pid,
            name=paper_node.get("title", f"Source Paper {pid[-6:]}"),
            title=paper_node.get("title", f"Source Paper {pid[-6:]}"),
            authors=paper_node.get("authors", ["Unknown"]),
            year=int(paper_node.get("year", 2026)) if str(paper_node.get("year", "")).isdigit() else 2026,
            venue=paper_node.get("venue", "Unknown"),
            abstract=paper_node.get("abstract", ""),
            arxiv_id=paper_node.get("arxiv_id")
        ))
        
    return NodeDetailDTO(
        node=canonical_node,
        node_type=node_type,
        related_papers=related_papers,
        specific_claims=specific_claims,
        sub_nodes=[] # Could be fetched via graph.edges where type=SUB_PROBLEM_OF
    )

@router.get("/domains")
async def get_domains(graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [Query-Driven] Get all unique domains from the graph nodes with their color configurations.
    Domains are extracted from nodes.data->domain field.
    """
    import sqlite3
    import json
    
    try:
        conn = sqlite3.connect(graph_db.db_path)
        cursor = conn.cursor()
        
        # Extract unique domains from nodes.data->domain
        cursor.execute("""
            SELECT DISTINCT json_extract(data, '$.domain') as domain
            FROM nodes
            WHERE json_extract(data, '$.domain') IS NOT NULL
        """)
        
        raw_domains = [row[0] for row in cursor.fetchall() if row[0]]
        conn.close()
        
        # Default color palette for domains
        color_palette = [
            '#6366f1',  # Indigo (b_root)
            '#8b5cf6',  # Violet (b_perception)
            '#ec4899',  # Pink (b_policy)
            '#f59e0b',  # Amber (b_tactile)
            '#22c55e',  # Green (b_diffusion)
            '#3b82f6',  # Blue (b_vla)
            '#14b8a6',  # Teal (b_fusion)
            '#f97316',  # Orange (b_manipulation)
            '#ef4444',  # Red
            '#84cc16',  # Lime
            '#06b6d4',  # Cyan
            '#a855f7',  # Purple
        ]
        
        # Build domain configurations
        domains = []
        seen_domains = set()
        color_idx = 0
        
        for domain in raw_domains:
            if domain and domain not in seen_domains:
                seen_domains.add(domain)
                color = color_palette[color_idx % len(color_palette)]
                domains.append({
                    "id": domain,
                    "name": domain.replace('b_', '').replace('_', ' ').title(),
                    "color": color,
                })
                color_idx += 1
        
        return {
            "domains": domains,
            "total": len(domains)
        }
        
    except Exception as e:
        logger.error(f"Failed to get domains: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get domains: {str(e)}")


@router.get("/config")
async def get_config(graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [Query-Driven] Get complete application configuration including:
    - domains: List of all domains with colors
    - statusColors: Color mappings for different statuses
    - nodeTypes: Available node types
    """
    import sqlite3
    
    try:
        conn = sqlite3.connect(graph_db.db_path)
        cursor = conn.cursor()
        
        # Extract unique domains from nodes
        cursor.execute("""
            SELECT DISTINCT json_extract(data, '$.domain') as domain
            FROM nodes
            WHERE json_extract(data, '$.domain') IS NOT NULL
        """)
        
        raw_domains = [row[0] for row in cursor.fetchall() if row[0]]
        conn.close()
        
        # Default color palette
        color_palette = [
            '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
            '#22c55e', '#3b82f6', '#14b8a6', '#f97316',
            '#ef4444', '#84cc16', '#06b6d4', '#a855f7',
        ]
        
        # Build domain configurations
        domains = []
        seen_domains = set()
        for idx, domain in enumerate(raw_domains):
            if domain and domain not in seen_domains:
                seen_domains.add(domain)
                color = color_palette[len(domains) % len(color_palette)]
                domains.append({
                    "id": domain,
                    "name": domain.replace('b_', '').replace('_', ' ').title(),
                    "color": color,
                    "fill": color,
                    "border": color,
                    "glow": color + "50",
                })
        
        # If no domains found in DB or only General, use the 5 real domains
        if not domains or all(d.get('id') == 'General' for d in domains):
            domains = [
                {
                    "id": "multi_agent",
                    "name": "多智能体协作",
                    "nameKey": "domains.multi_agent",
                    "color": "#6366f1",
                    "fill": "#6366f1",
                    "border": "#6366f1",
                    "glow": "#6366f150",
                    "description": "多智能体系统、协作机制、通信协议"
                },
                {
                    "id": "agent_memory",
                    "name": "智能体记忆",
                    "nameKey": "domains.agent_memory",
                    "color": "#8b5cf6",
                    "fill": "#8b5cf6",
                    "border": "#8b5cf6",
                    "glow": "#8b5cf650",
                    "description": "长期记忆、短期记忆、记忆检索"
                },
                {
                    "id": "agent_tools",
                    "name": "智能体工具调用",
                    "nameKey": "domains.agent_tools",
                    "color": "#ec4899",
                    "fill": "#ec4899",
                    "border": "#ec4899",
                    "glow": "#ec489950",
                    "description": "工具学习、API调用、函数执行"
                },
                {
                    "id": "llm_reasoning",
                    "name": "LLM推理",
                    "nameKey": "domains.llm_reasoning",
                    "color": "#f59e0b",
                    "fill": "#f59e0b",
                    "border": "#f59e0b",
                    "glow": "#f59e0b50",
                    "description": "链式思考、推理路径、逻辑推导"
                },
                {
                    "id": "embodied_ai",
                    "name": "具身智能",
                    "nameKey": "domains.embodied_ai",
                    "color": "#22c55e",
                    "fill": "#22c55e",
                    "border": "#22c55e",
                    "glow": "#22c55e50",
                    "description": "机器人、物理交互、环境感知"
                }
            ]
        
        # Status color configurations
        status_colors = {
            "solved": {"fill": "#22c55e", "ring": "#22c55e40", "text": "#4ade80", "label": "Solved"},
            "partial": {"fill": "#f59e0b", "ring": "#f59e0b40", "text": "#fbbf24", "label": "Partial"},
            "active": {"fill": "#3b82f6", "ring": "#3b82f640", "text": "#60a5fa", "label": "Active"},
            "unsolved": {"fill": "#ef4444", "ring": "#ef444440", "text": "#f87171", "label": "Unsolved"},
            "verified": {"fill": "#22c55e", "ring": "#22c55e40", "text": "#4ade80", "label": "Verified"},
            "failed": {"fill": "#ef4444", "ring": "#ef444440", "text": "#f87171", "label": "Failed"},
            "untested": {"fill": "#3b82f6", "ring": "#3b82f640", "text": "#60a5fa", "label": "Untested"},
        }
        
        return {
            "domains": domains,
            "statusColors": status_colors,
            "nodeTypes": ["problem", "method", "paper", "claim"],
            "version": "3.0",
        }
        
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        # Return default config on error - using 5 real domains
        return {
            "domains": [
                {"id": "multi_agent", "name": "多智能体协作", "nameKey": "domains.multi_agent", "color": "#6366f1", "fill": "#6366f1", "border": "#6366f1", "glow": "#6366f150"},
                {"id": "agent_memory", "name": "智能体记忆", "nameKey": "domains.agent_memory", "color": "#8b5cf6", "fill": "#8b5cf6", "border": "#8b5cf6", "glow": "#8b5cf650"},
                {"id": "agent_tools", "name": "智能体工具调用", "nameKey": "domains.agent_tools", "color": "#ec4899", "fill": "#ec4899", "border": "#ec4899", "glow": "#ec489950"},
                {"id": "llm_reasoning", "name": "LLM推理", "nameKey": "domains.llm_reasoning", "color": "#f59e0b", "fill": "#f59e0b", "border": "#f59e0b", "glow": "#f59e0b50"},
                {"id": "embodied_ai", "name": "具身智能", "nameKey": "domains.embodied_ai", "color": "#22c55e", "fill": "#22c55e", "border": "#22c55e", "glow": "#22c55e50"},
            ],
            "statusColors": {
                "solved": {"fill": "#22c55e", "ring": "#22c55e40", "text": "#4ade80", "label": "Solved"},
                "unsolved": {"fill": "#ef4444", "ring": "#ef444440", "text": "#f87171", "label": "Unsolved"},
            },
            "nodeTypes": ["problem", "method", "paper"],
            "version": "3.0",
            "error": str(e)
        }


async def generate_node_description(node_id: str, graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [AI Action] Uses Kimi LLM to generate a comprehensive description for a Problem or Method node,
    including its definition, essence, sub-components, and development progress.
    """
    node_data = graph_db.get_problem(node_id)
    node_type = "Problem"
    if not node_data:
        node_data = graph_db.get_method(node_id)
        node_type = "Method"
    
    if not node_data:
        raise HTTPException(status_code=404, detail="Node not found")
        
    # Gather Context
    claims_data = graph_db.get_claims_by_canonical(node_id)
    claims_text = "\n".join([f"- {c['text']}" for c in claims_data])
    
    # Get relations context (sub-nodes, solved-by)
    relations_context = []
    if node_type == "Problem":
        methods = graph_db.get_problem_methods(node_id)
        for m in methods:
            relations_context.append(f"Addressed by method: {m.get('name')} (Effectiveness: {m.get('effectiveness')})")
    
    system_prompt = f"""
你是一个顶级的AI科研架构师。
你的任务是为 {node_type} 节点："{node_data.get('name')}" 生成全面、高度洞察的中文概述。

来自知识图谱的上下文（声明和关系）：
{claims_text}
{chr(10).join(relations_context)}

请以合法的JSON格式生成两个部分（必须使用中文输出，请不要使用Markdown标题符号如###，可以直接分段）：
1. "description": 详细的中文描述（2-3段），解释这个 {node_type} 是什么，它的核心本质，底层原理，以及它的子组件或主要分类（例如，如果是神经网络，提及大语言模型、扩散模型等）。
2. "development_progress": 详细的中文描述（1-2段），说明目前的解决现状，历史发展过程，以及在领域内的解决程度。

输出严格的合法JSON，包含键 "description" 和 "development_progress"。
"""

    try:
        from app.services.kimi_client import KimiExtractor
        extractor = KimiExtractor()
        # Kimi For Coding via Anthropic SDK
        response = await extractor.client.messages.create(
            model=extractor.model,
            system=system_prompt,
            messages=[
                {"role": "user", "content": "请现在生成JSON描述。"}
            ],
            temperature=0.7,
            max_tokens=2048
        )
        # Extract text content from Anthropic response block
        import json
        
        # Helper to extract JSON safely from potential markdown blocks
        def extract_json(text):
            if "```json" in text: return text.split("```json")[1].split("```")[0].strip()
            elif "```" in text: return text.split("```")[1].split("```")[0].strip()
            return text.strip()
            
        result_text = extract_json(response.content[0].text)
        
        try:
            parsed = json.loads(result_text)
        except json.JSONDecodeError:
            logger.warning("Description LLM returned invalid JSON. Attempting to repair.")
            # Simple repair attempt: remove trailing commas or incomplete strings
            import re
            result_text = re.sub(r',\s*}', '}', result_text)
            try:
                parsed = json.loads(result_text)
            except:
                raise ValueError("Unrecoverable JSON error from Description LLM.")
                
        new_desc = parsed.get("description", "Generation failed.")
        new_prog = parsed.get("development_progress", "Generation failed.")
        
        # Update Database
        import sqlite3
        conn = sqlite3.connect(graph_db.db_path)
        cursor = conn.cursor()
        
        # We need to load the existing data JSON, update it, and save it back
        cursor.execute("SELECT data FROM nodes WHERE id = ?", (node_id,))
        row = cursor.fetchone()
        if row:
            data_dict = json.loads(row[0])
            data_dict['description'] = new_desc
            data_dict['development_progress'] = new_prog
            cursor.execute(
                "UPDATE nodes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(data_dict), node_id)
            )
            conn.commit()
            
            # Update in-memory graph
            if node_id in graph_db.graph:
                graph_db.graph.nodes[node_id]['description'] = new_desc
                graph_db.graph.nodes[node_id]['development_progress'] = new_prog
                
        conn.close()
    except Exception as e:
        logger.error(f"Failed to generate description for {node_id}: {e}")
        # Fallback for demo/testing without valid API key
        import random
        from datetime import datetime
        
        templates_desc = [
            f"【核心本质】\n{node_data.get('name')} 是该领域中的核心节点。从本质上讲，它代表了解决或描述该方向技术瓶颈的底层逻辑。\n\n【关键子节点与分类】\n通过跨文献分析，我们发现该节点通常可以被进一步细分为多个子领域（如硬件适配、软件算法、模型变体等），并有 {len(claims_data)} 条关键的学术主张直接支撑该论点。",
            f"【基本定义】\n关于 {node_data.get('name')} 的研究构成了当前科研的关键方向。这涉及突破传统方法的固有约束。\n\n【结构与派生】\n本节点包含 {len(claims_data)} 条具体主张。学术界倾向于将其分解为算法级优化和系统级重构两大类别进行探索。",
            f"【概念内核】\n在知识图谱中，{node_data.get('name')} 是连接多个研究路线的枢纽，其根本在于提升整体效率与准确度。\n\n【知识聚类】\n我们提取了 {len(claims_data)} 条局部主张。这些主张涵盖了多种变体机制，显示出该方向的复杂性。"
        ]
        
        templates_prog = [
            f"【解决现状】\n目前该方向正处于快速演进阶段。该节点在多数基准测试中已经实现了初步到中等程度的解决。\n\n【演进历史】\n从早期文献提出至今，该节点的受关注度不断上升，越来越多的衍生方法被提出以克服其在极端条件下的局限性。",
            f"【最新进展】\n研究热度居高不下。尽管完全解决仍有距离，但近期多项技术融合使得该领域的性能指标大幅提升。\n\n【发展脉络】\n早期主要依赖经验模型，而现阶段已转向数据驱动与自动化范式，展现出极强的演进活力。",
            f"【攻坚状态】\n该节点被视为领域的“硬骨头”。目前已有部分方法取得了突破，但泛化性问题仍未完全克服。\n\n【历史追溯】\n历经多年的迭代，学者们逐渐从单一视角的解决思路，转向了跨领域的综合性突破方案。"
        ]
        
        new_desc = random.choice(templates_desc) + f"\n\n*(注意: 因API Key无效，此为模拟生成的随机文本，生成时间: {datetime.now().strftime('%H:%M:%S')})*"
        new_prog = random.choice(templates_prog) + f"\n\n*(注意: 因API Key无效，此为模拟生成的随机文本，生成时间: {datetime.now().strftime('%H:%M:%S')})*"
        
        import sqlite3
        import json
        conn = sqlite3.connect(graph_db.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM nodes WHERE id = ?", (node_id,))
        row = cursor.fetchone()
        if row:
            data_dict = json.loads(row[0])
            data_dict['description'] = new_desc
            data_dict['development_progress'] = new_prog
            cursor.execute(
                "UPDATE nodes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(data_dict), node_id)
            )
            conn.commit()
            if node_id in graph_db.graph:
                graph_db.graph.nodes[node_id]['description'] = new_desc
                graph_db.graph.nodes[node_id]['development_progress'] = new_prog
        conn.close()

    # Reuse existing detail fetching logic to return updated DTO
    return await get_node_details(node_id, graph_db)

@router.get("/innovation/{opp_id}/generate-insight-stream")
async def generate_insight_stream(opp_id: str, graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [AI Action] Uses Multi-Agent Debate to generate a top-tier paper proposal.
    Streams Server-Sent Events (SSE) so the frontend can display the 'thinking process'
    before the final JSON result arrives.
    """
    # Collect contexts (same as before)
    opps = graph_db.get_all_innovations()
    target_opp = next((o for o in opps if o["id"] == opp_id), None)
    if not target_opp:
        raise HTTPException(status_code=404, detail="Innovation Opportunity not found")
        
    prob_id = target_opp.get("target_problem", "")
    meth_ids = [target_opp.get("candidate_method", "")] if target_opp.get("candidate_method") else []
    
    prob_claims = graph_db.get_claims_by_canonical(prob_id)
    meth_claims = []
    for mid in meth_ids:
        meth_claims.extend(graph_db.get_claims_by_canonical(mid))
        
    prob_text_block = "\n".join([f"- {c['text']}" for c in prob_claims])
    meth_text_block = "\n".join([f"- {c['text']}" for c in meth_claims])

    prob_node = graph_db.get_problem(prob_id)
    meth_node = graph_db.get_method(meth_ids[0]) if meth_ids else None

    async def sse_generator():
        # Phase 0: Start
        yield f"data: {json.dumps({'status': 'generating_draft', 'message': 'Agent 1 (Generator) is synthesizing the core idea...'})}\n\n"
        
        generator_prompt = f"""
        你是一个世界顶级的AI科学家（如NeurIPS/Nature的资深审稿人）。
        你的任务是基于知识图谱碎片，生成一个【能够发表顶会论文的Research Proposal】的初稿。
        
        目标问题域上下文: {prob_text_block}
        候选方法域上下文: {meth_text_block}
        
        请仔细分析这两个概念，进行思想碰撞。必须包含以下字段（全部使用中文）：
        1. "paper_title": 论文题目
        2. "innovation_type": 创新类型（如 "跨领域方法迁移", "机制组合创新", "新场景边界突破" 等）
        3. "abstract": 摘要（300字内，一针见血说明Problem, Method, and Impact）
        4. "motivation_gap": 核心动机与研究空白（为什么现有的解法都不行？）
        5. "methodology_design": 核心方法论与架构设计（数学或物理本质，如何结合？）
        6. "expected_experiments": 预期实验设置（字符串数组，描述数据集与对比基准）
        7. "ablation_study": 消融实验设计（如何证明你的核心模块有效？）
        8. "impact_statement": 预期影响（这篇论文为什么配得上顶会？）
        
        请严格输出 JSON 格式。
        """
        
        try:
            from app.services.kimi_client import KimiExtractor
            extractor = KimiExtractor()
            
            # Phase 1: Generator Agent
            gen_response = await extractor.client.messages.create(
                model=extractor.model,
                system=generator_prompt,
                messages=[{"role": "user", "content": "请立刻生成JSON格式的顶会论文初稿。"}],
                temperature=0.8,
                max_tokens=3000
            )
            gen_text = gen_response.content[0].text
            
            # Phase 2: Devil's Advocate
            review_msg = "Agent 2 (Devil's Advocate) is reviewing and critiquing the draft against physical constraints..."
            yield f"data: {json.dumps({'status': 'peer_review', 'message': review_msg})}\n\n"
            
            advocate_prompt = f"""
            你是一位极其严苛的 NeurIPS 恶魔审稿人 (Devil's Advocate)。
            你的任务是审视另一位科学家提出的 Research Proposal，寻找其【方法假设】与【问题物理约束】之间的矛盾，并对其进行强制修正。
            
            原始 Proposal:
            {gen_text}
            
            问题物理约束: {prob_node.get('constraints', '未知')}
            方法前提假设: {meth_node.get('assumptions', '未知')}
            
            请找出 Proposal 中不够 rigorous 的地方，修正它，并返回【最终版】的 JSON Proposal。格式字段必须与原版完全一致。
            """
            
            final_response = await extractor.client.messages.create(
                model=extractor.model,
                system=advocate_prompt,
                messages=[{"role": "user", "content": "请进行严苛审查，并输出最终版JSON。"}],
                temperature=0.4,
                max_tokens=3000
            )
            
            result_text = final_response.content[0].text
            
            # Parse JSON
            def extract_json(text):
                if "```json" in text: return text.split("```json")[1].split("```")[0].strip()
                elif "```" in text: return text.split("```")[1].split("```")[0].strip()
                return text.strip()
                
            clean_json_str = extract_json(result_text)
            
            try:
                parsed = json.loads(clean_json_str)
            except json.JSONDecodeError:
                # Graceful fallback to gen_text
                try:
                    parsed = json.loads(extract_json(gen_text))
                    parsed["impact_statement"] = parsed.get("impact_statement", "") + " (Note: Peer-review failed to parse, falling back to draft)."
                except Exception:
                    parsed = {}
                
            # Phase 3: Complete
            final_dto = {
                "opportunity_id": opp_id,
                "target_problem_name": prob_node.get("name", "Unknown") if prob_node else "Unknown",
                "candidate_method_name": meth_node.get("name", "Unknown") if meth_node else "Unknown",
                "paper_title": parsed.get("paper_title", "未命名论文"),
                "innovation_type": parsed.get("innovation_type", "未知类型"),
                "abstract": parsed.get("abstract", "无"),
                "motivation_gap": parsed.get("motivation_gap", "无"),
                "methodology_design": parsed.get("methodology_design", "无"),
                "expected_experiments": parsed.get("expected_experiments", ["无"]),
                "ablation_study": parsed.get("ablation_study", "无"),
                "impact_statement": parsed.get("impact_statement", "无"),
                "supporting_evidence_texts": [c["text"] for c in prob_claims + meth_claims],
                "status": "completed"
            }
            
            yield f"data: {json.dumps(final_dto)}\n\n"
            
        except Exception as e:
            logger.error(f"SSE Generation Error: {e}")
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/innovation/{opp_id}/generate-insight", response_model=InnovationInsightDTO)
async def generate_insight(opp_id: str, graph_db: LocalGraphDB = Depends(get_graph_db)):
    """
    [AI Action] Uses Kimi to read the raw claims behind an InnovationOpportunity and write an Action Plan.
    """
    # 1. Fetch opportunity
    opps = graph_db.get_all_innovations()
    opp_data = next((o for o in opps if o.get("id") == opp_id), None)
    if not opp_data:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    prob_id = opp_data.get("target_problem", "")
    meth_ids = [opp_data.get("candidate_method", "")] if opp_data.get("candidate_method") else []
    
    # 2. Gather Evidence from DB
    prob_claims = graph_db.get_claims_by_canonical(prob_id)
    meth_claims = []
    for mid in meth_ids:
        meth_claims.extend(graph_db.get_claims_by_canonical(mid))
        
    prob_text_block = "\n".join([f"- {c['text']}" for c in prob_claims])
    meth_text_block = "\n".join([f"- {c['text']}" for c in meth_claims])
    
    # 3. Call LLM to generate the Action Plan
    generator_prompt = f"""
    你是一个世界顶级的AI科学家与科研产品经理（如NeurIPS/CVPR/Nature的资深审稿人）。
    你深知科研的本质：创新往往来自于“方法的跨领域迁移”、“旧方法的组合”、或“将旧问题置于新场景中”。
    你的任务是基于知识图谱中的底层文献碎片，通过“创新卡片”的形式，生成一个【能够发表顶会论文的Research Proposal】的初稿。
    
    目标问题域上下文 (Target Problem Claims):
    {prob_text_block}
    
    候选方法域上下文 (Candidate Method Claims):
    {meth_text_block}
    
    请仔细分析这两个看似不相关（或未被充分结合）的概念，进行思想碰撞。并严格以JSON格式输出你的顶会论文Idea。必须包含以下字段（全部使用中文）：
    1. "paper_title": 论文题目
    2. "innovation_type": 创新类型（如 "跨领域方法迁移", "机制组合创新", "新场景边界突破" 等）
    3. "abstract": 摘要（300字内，一针见血说明Problem, Method, and Impact）
    4. "motivation_gap": 核心动机与研究空白
    5. "methodology_design": 核心方法论与架构设计
    6. "expected_experiments": 预期实验设置（字符串数组）
    7. "ablation_study": 消融实验设计
    8. "impact_statement": 预期影响
    """
    
    prob_node = graph_db.get_problem(prob_id)
    meth_node = graph_db.get_method(meth_ids[0]) if meth_ids else None
    
    try:
        from app.services.kimi_client import KimiExtractor
        extractor = KimiExtractor()
        
        # Phase 1: Generator Agent
        gen_response = await extractor.client.messages.create(
            model=extractor.model,
            system=generator_prompt,
            messages=[{"role": "user", "content": "请立刻生成JSON格式的顶会论文Research Proposal初稿。"}],
            temperature=0.8,
            max_tokens=3000
        )
        gen_text = gen_response.content[0].text
        if "```json" in gen_text: gen_text = gen_text.split("```json")[1].split("```")[0].strip()
        elif "```" in gen_text: gen_text = gen_text.split("```")[1].split("```")[0].strip()
        
        # Phase 2: Devil's Advocate Agent (Critique & Refine)
        advocate_prompt = f"""
        你是一位极其严苛的 NeurIPS 恶魔审稿人 (Devil's Advocate)。
        你的任务是审视另一位科学家提出的 Research Proposal，寻找其【方法假设】与【问题物理约束】之间的矛盾，并对其进行强制修正和升华。
        
        原始 Proposal:
        {gen_text}
        
        问题物理约束 (Constraints): {prob_node.get('constraints', '未知')}
        方法前提假设 (Assumptions): {meth_node.get('assumptions', '未知')}
        
        请找出 Proposal 中不够 rigorous 的地方，修正它，并返回【最终版】的 JSON Proposal。
        JSON 格式与原版完全一致，但内容必须经过你恶魔审稿人的严苛提纯与逻辑补全。
        """
        
        final_response = await extractor.client.messages.create(
            model=extractor.model,
            system=advocate_prompt,
            messages=[{"role": "user", "content": "请进行恶魔审查，并输出最终版的JSON Proposal。"}],
            temperature=0.4,
            max_tokens=3000
        )
        
        result_text = final_response.content[0].text
        if "```json" in result_text: result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text: result_text = result_text.split("```")[1].split("```")[0].strip()
            
        try:
            # First attempt: Try to parse as valid JSON
            import json
            parsed = json.loads(result_text)
        except json.JSONDecodeError:
            # Fallback: Sometimes LLM refuses to write valid JSON despite prompt, or truncates it
            logger.warning("Devil's Advocate returned invalid JSON. Attempting graceful degradation.")
            # Fallback to the generator's JSON if the advocate broke it
            try:
                parsed = json.loads(gen_text)
                parsed["novelty_statement"] += " (Note: Peer-review synthesis encountered formatting issues, falling back to draft generation)."
            except Exception:
                # Absolute worst-case fallback
                parsed = {
                    "paper_title": "AI 生成中断 (Generation Interrupted)",
                    "innovation_type": "格式错误 (Formatting Error)",
                    "core_problem": "大模型未能返回标准的 JSON 格式。",
                    "proposed_method": "请尝试再次点击生成。",
                    "architecture_design": result_text[:500] + "...",  # Show raw text as fallback
                    "expected_experiments": ["系统错误，无法解析实验"],
                    "novelty_statement": "大模型对抗阶段超时或格式崩溃。"
                }
                
        paper_title = parsed.get("paper_title", "未命名顶会论文 Idea")
        innovation_type = parsed.get("innovation_type", "跨域迁移")
        abstract = parsed.get("abstract", "生成失败")
        motivation_gap = parsed.get("motivation_gap", "生成失败")
        methodology_design = parsed.get("methodology_design", "生成失败")
        expected_experiments = parsed.get("expected_experiments", ["实验设计生成失败"])
        ablation_study = parsed.get("ablation_study", "生成失败")
        impact_statement = parsed.get("impact_statement", "生成失败")
        
    except Exception as e:
        logger.error(f"Failed to generate insight: {e}")
        # Fallback if API fails
        paper_title = f"基于 {meth_node.get('name', 'Method') if meth_node else 'Method'} 的 {prob_node.get('name', 'Problem') if prob_node else 'Problem'} 突破性框架"
        innovation_type = "跨领域方法迁移 (Fallback)"
        abstract = "生成失败"
        motivation_gap = f"当前 {prob_node.get('name', 'Problem') if prob_node else 'Problem'} 领域存在核心瓶颈，传统方案无法克服边界条件限制。"
        methodology_design = f"本研究创造性地引入了 {meth_node.get('name', 'Method') if meth_node else 'Method'} 的底层机制，通过结构同构性实现降维打击。"
        expected_experiments = ["基准对比实验 (vs SOTA)", "核心机制消融实验", "泛化性/鲁棒性压力测试"]
        ablation_study = "核心模块有效性验证"
        impact_statement = "首次证明了这两种机制的同源性，预期可将系统性能提升一个数量级，具备极高的学术价值与应用潜力。"

    return InnovationInsightDTO(
        opportunity_id=opp_id,
        target_problem_name=prob_node.get("name", "Unknown") if prob_node else "Unknown",
        candidate_method_name=meth_node.get("name", "Unknown") if meth_node else "Unknown",
        paper_title=paper_title,
        innovation_type=innovation_type,
        abstract=abstract,
        motivation_gap=motivation_gap,
        methodology_design=methodology_design,
        expected_experiments=expected_experiments,
        ablation_study=ablation_study,
        impact_statement=impact_statement,
        supporting_evidence_texts=[c["text"] for c in prob_claims + meth_claims]
    )
