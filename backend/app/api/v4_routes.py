"""
V4 API Routes - Unified Research Discovery API
Provides endpoints for:
- Insight management
- Innovation discovery (6 paradigms)
- Agent Society streaming
- GraphRAG queries
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

from app.database.local_graph import LocalGraphDB, get_local_graph_db
from app.database.local_vector import LocalVectorDB, get_local_vector_db
from app.agents.orchestrator import AgentOrchestrator
from app.discovery.engine import InnovationDiscoveryEngine, ParadigmType
from app.graphrag.engine import GraphRAGEngine

router = APIRouter(prefix="/v4", tags=["v4_research_brain"])


@router.get("/health")
async def v4_health():
    """V4 API health check."""
    return {"status": "ok", "version": "4.0.0", "services": ["insights", "discovery", "graphrag"]}


def get_orchestrator(graph_db: LocalGraphDB = Depends(get_local_graph_db)):
    """Get AgentOrchestrator with LLM client."""
    try:
        from app.services.kimi_client import KimiExtractor
        extractor = KimiExtractor()
        return AgentOrchestrator(llm_client=extractor.client, graph_db=graph_db)
    except Exception as e:
        logger.warning(f"LLM client not available: {e}")
        return AgentOrchestrator(llm_client=None, graph_db=graph_db)


def get_discovery_engine(
    graph_db: LocalGraphDB = Depends(get_local_graph_db),
    vector_db: LocalVectorDB = Depends(get_local_vector_db)
):
    return InnovationDiscoveryEngine(graph_db=graph_db, vector_db=vector_db)


# ============================================================================
# INSIGHTS
# ============================================================================

@router.get("/insights")
async def list_insights(
    paradigm: Optional[str] = None,
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=200),
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """List all innovation insights with optional filtering."""
    insights = graph_db.get_all_insights(
        paradigm=paradigm,
        min_score=min_score,
        limit=limit
    )
    return {
        "insights": insights,
        "total": len(insights),
        "filters": {"paradigm": paradigm, "min_score": min_score}
    }


@router.get("/insights/{insight_id}")
async def get_insight(
    insight_id: str,
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """Get a single insight with full details."""
    insight = graph_db.get_insight(insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    return insight


@router.post("/insights/{insight_id}/status")
async def update_insight_status(
    insight_id: str,
    status: str,
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """Update insight status (hypothesis -> validated -> published)."""
    valid_statuses = ['hypothesis', 'validated', 'rejected', 'published']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    graph_db.update_insight_status(insight_id, status)
    return {"insight_id": insight_id, "status": status}


# ============================================================================
# DISCOVERY
# ============================================================================

class DiscoverRequest(BaseModel):
    paradigm: Optional[str] = None
    seed_node_id: Optional[str] = None
    limit: int = 20


@router.post("/discover")
async def run_discovery(
    req: DiscoverRequest,
    engine: InnovationDiscoveryEngine = Depends(get_discovery_engine)
):
    """
    Run innovation discovery engine with specified paradigm.

    paradigms: cdt, shf, mc, tf, ch, rgi (or null for all)
    """
    ptype = None
    if req.paradigm:
        try:
            ptype = ParadigmType(req.paradigm.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid paradigm. Choose from: cdt, shf, mc, tf, ch, rgi"
            )

    opportunities = engine.discover(
        paradigm=ptype,
        seed_node_id=req.seed_node_id,
        limit=req.limit
    )

    return {
        "opportunities": opportunities,
        "paradigm": req.paradigm or "all",
        "count": len(opportunities)
    }


@router.get("/discover/opportunities")
async def list_opportunities(
    paradigm: Optional[str] = None,
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=200),
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """List stored opportunities (from insights table)."""
    # For now, map insights to opportunities format
    insights = graph_db.get_all_insights(
        paradigm=paradigm,
        min_score=min_score,
        limit=limit
    )

    opportunities = []
    for ins in insights:
        opportunities.append({
            "opportunity_id": ins.get('id'),
            "target_problem_id": ins.get('source_node_ids', [''])[0] if ins.get('source_node_ids') else '',
            "candidate_method_ids": ins.get('source_node_ids', [])[1:] if len(ins.get('source_node_ids', [])) > 1 else [],
            "rationale": ins.get('rationale', ''),
            "innovation_type": ins.get('type', 'cdt'),
            "feasibility_score": ins.get('confidence', 0),
            "composite_score": ins.get('composite_score', 0),
            "title": ins.get('title', 'Untitled')
        })

    return {
        "opportunities": opportunities,
        "total": len(opportunities)
    }


# ============================================================================
# AGENT SOCIETY STREAMING
# ============================================================================

@router.post("/insights/generate")
async def generate_insight(
    opportunity: Dict[str, Any],
    orchestrator: AgentOrchestrator = Depends(get_orchestrator)
):
    """
    Trigger Agent Society to generate a deep insight from an opportunity.
    Returns the final insight after the full debate.
    """
    try:
        result = await orchestrator.run_innovation_pipeline(opportunity)
        return {
            "session_id": result['session_id'],
            "insight": result['insight'],
            "debate_rounds": len([d for d in result['debate_log'] if d['agent'] == 'Critic'])
        }
    except Exception as e:
        logger.error(f"Insight generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/insights/generate-stream")
async def generate_insight_stream(
    opportunity: Dict[str, Any],
    orchestrator: AgentOrchestrator = Depends(get_orchestrator)
):
    """
    Stream Agent Society debate in real-time via SSE.
    Each event contains one agent's output.
    """
    async def sse_generator():
        # Phase 1: Hypothesizer
        yield f"data: {json.dumps({'agent': 'Hypothesizer', 'stage': 'start', 'message': 'Generating initial hypothesis...'})}\n\n"
        await asyncio.sleep(0.5)

        try:
            result = await orchestrator.run_innovation_pipeline(opportunity)

            # Stream each debate entry
            for entry in result['debate_log']:
                payload = {
                    'agent': entry['agent'],
                    'stage': entry['stage'],
                    'content': entry.get('content', '')[:500],
                    'structured': entry.get('structured', {})
                }
                yield f"data: {json.dumps(payload)}\n\n"
                await asyncio.sleep(0.3)

            # Final result
            final_payload = {
                'agent': 'Reviewer',
                'stage': 'completed',
                'insight': result['insight'],
                'session_id': result['session_id']
            }
            yield f"data: {json.dumps(final_payload)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'agent': 'System', 'stage': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


# ============================================================================
# PAPERS — Token-Saving Extraction
# ============================================================================

class ExtractRequest(BaseModel):
    paper_id: str
    text: str
    query: str = "extract scientific claims"
    top_k_chunks: int = 5


@router.post("/papers/extract-token-saving")
async def extract_paper_token_saving(
    req: ExtractRequest,
    orchestrator: AgentOrchestrator = Depends(get_orchestrator)
):
    """
    Extract claims from paper text using local embedding pre-filtering.
    Saves ~85-90% LLM tokens vs sending full text.
    """
    try:
        result = await orchestrator.run_token_saving_extraction_pipeline(
            paper_id=req.paper_id,
            full_text=req.text,
            query=req.query,
            top_k_chunks=req.top_k_chunks
        )
        return {
            "paper_id": req.paper_id,
            "claims": result.get('claims', []),
            "claim_count": result.get('claim_count', 0),
            "token_savings": result.get('token_savings', {}),
            "session_id": result.get('session_id', '')
        }
    except Exception as e:
        logger.error(f"Token-saving extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/papers/{paper_id}/chunks")
async def get_paper_chunks(
    paper_id: str,
    vector_db: LocalVectorDB = Depends(get_local_vector_db)
):
    """Get all vector-stored chunks for a paper."""
    all_chunks = []
    # Search with empty-ish vector to get all chunks for this paper
    # (LocalVectorDB doesn't have list-all, so we use a trick: filter by paper_id)
    # Actually, let's just read from the collection directly
    coll = vector_db._collection("paper_chunks")
    for item_id, data in coll.items():
        payload = data.get('payload', {})
        if payload.get('paper_id') == paper_id:
            all_chunks.append({
                "chunk_id": item_id,
                "index": payload.get('index'),
                "text": payload.get('text', '')[:200] + "...",
                "char_count": payload.get('char_count'),
                "section_hint": payload.get('section_hint', '')
            })
    all_chunks.sort(key=lambda x: x.get('index', 0))
    return {"paper_id": paper_id, "chunks": all_chunks, "total": len(all_chunks)}


# ============================================================================
# NODES
# ============================================================================

@router.get("/nodes/{node_id}/insights")
async def get_node_insights(
    node_id: str,
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """Get all insights related to a specific node."""
    all_insights = graph_db.get_all_insights(limit=200)
    related = []
    for ins in all_insights:
        source_ids = ins.get('source_node_ids', [])
        if node_id in source_ids:
            related.append(ins)

    return {
        "node_id": node_id,
        "insights": related,
        "count": len(related)
    }


# ============================================================================
# DOMAIN MAP (V3 compatible)
# ============================================================================

@router.get("/nodes/{node_id}/subtree")
async def get_node_subtree(
    node_id: str,
    node_type: str = Query("problem", enum=["problem", "method"]),
    max_depth: int = Query(3, ge=1, le=5),
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """Get hierarchical subtree rooted at a node."""
    from app.agents.tree_ontology import TreeOntologyManager
    tree_mgr = TreeOntologyManager(graph_db=graph_db)
    subtree = tree_mgr.get_subtree(node_id, node_type=node_type, max_depth=max_depth)
    return {"root_id": node_id, "node_type": node_type, "subtree": subtree}


@router.get("/nodes/{node_id}/value-score")
async def get_node_value_score(
    node_id: str,
    node_type: str = Query("problem", enum=["problem", "method"]),
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """Compute real valueScore for a node (not hardcoded 50)."""
    from app.agents.tree_ontology import TreeOntologyManager
    tree_mgr = TreeOntologyManager(graph_db=graph_db)
    score = tree_mgr.compute_value_score(node_id, node_type)
    return {"node_id": node_id, "node_type": node_type, "value_score": score}


@router.get("/domain-map")
async def get_domain_map_v4(
    graph_db: LocalGraphDB = Depends(get_local_graph_db)
):
    """
    V4 Domain Map - same as V3 but with value_score computed dynamically.
    """
    from app.models.domain_schema import DomainMapDTO, Problem, Method, EvidenceLink

    raw_probs = graph_db.get_all_problems()
    raw_meths = graph_db.get_all_methods()

    problems = []
    for rp in raw_probs:
        problems.append(Problem(
            canonical_id=rp.get('id', ''),
            name=rp.get('name', 'Unknown'),
            domain=rp.get('domain', 'General'),
            definition=rp.get('definition', ''),
            resolution_status=rp.get('resolution_status', 'unsolved'),
            year_identified=rp.get('year'),
            description=rp.get('description', ''),
            development_progress=rp.get('development_progress', ''),
            value_score=rp.get('value_score')
        ))

    methods = []
    for rm in raw_meths:
        methods.append(Method(
            canonical_id=rm.get('id', ''),
            name=rm.get('name', 'Unknown'),
            domain=rm.get('domain', 'General'),
            mechanism=rm.get('mechanism', ''),
            complexity=rm.get('complexity', 'Unknown'),
            description=rm.get('description', ''),
            development_progress=rm.get('development_progress', ''),
            value_score=rm.get('value_score')
        ))

    relations = []
    for source, target, data in graph_db.graph.edges(data=True):
        if data.get("type") in ["SOLVES", "ADDRESSES_PROBLEM", "USES_METHOD", "IMPROVES_UPON", "SUB_TYPE_OF", "SUB_PROBLEM_OF"]:
            relations.append(EvidenceLink(
                source_canonical_id=source,
                target_canonical_id=target,
                relation_type=data.get("type", ""),
                effectiveness=data.get("effectiveness"),
                limitations=data.get("limitations"),
                supporting_claims=[]
            ))

    return DomainMapDTO(problems=problems, methods=methods, relations=relations)


# ============================================================================
# GRAPH RAG (Basic)
# ============================================================================

def get_graphrag_engine(
    graph_db: LocalGraphDB = Depends(get_local_graph_db),
    vector_db: LocalVectorDB = Depends(get_local_vector_db)
):
    """Get GraphRAGEngine with LLM client if available."""
    try:
        from app.services.kimi_client import KimiExtractor
        extractor = KimiExtractor()
        return GraphRAGEngine(graph_db=graph_db, vector_db=vector_db, llm_client=extractor)
    except Exception as e:
        logger.warning(f"LLM client not available for GraphRAG: {e}")
        return GraphRAGEngine(graph_db=graph_db, vector_db=vector_db)


@router.post("/query")
async def graphrag_query(
    query: Dict[str, Any],
    engine: GraphRAGEngine = Depends(get_graphrag_engine)
):
    """
    GraphRAG query endpoint.
    Accepts a natural language query and returns relevant subgraph context + synthesized answer.
    """
    q = query.get("query", "")
    if not q:
        raise HTTPException(status_code=400, detail="Query is required")

    result = await engine.answer(q)

    return {
        "query": q,
        "intent": result.intent,
        "confidence": result.confidence,
        "answer": result.answer,
        "subgraph": {
            "nodes": [{"id": n.get("id"), "name": n.get("name") or n.get("title"), "type": n.get("type")} for n in result.subgraph.nodes],
            "edges": result.subgraph.edges
        },
        "sources": result.sources,
        "evidence_spans": [
            {"node_id": e.node_id, "node_name": e.node_name, "text": e.text, "confidence": e.confidence}
            for e in result.evidence_spans
        ]
    }


@router.post("/query-stream")
async def graphrag_query_stream(
    query: Dict[str, Any],
    engine: GraphRAGEngine = Depends(get_graphrag_engine)
):
    """
    GraphRAG streaming query endpoint via SSE.
    Yields events: intent, retrieving, subgraph, answer, evidence, done
    """
    q = query.get("query", "")
    if not q:
        raise HTTPException(status_code=400, detail="Query is required")

    async def sse_generator():
        # Stage 1: Intent classification
        intent = engine._identify_intent(q)
        yield f"event: intent\ndata: {json.dumps({'intent': intent, 'confidence': 0.9})}\n\n"
        await asyncio.sleep(0.1)

        # Stage 2: Retrieve subgraph
        yield f"event: retrieving\ndata: {json.dumps({'stage': 'subgraph', 'message': 'Searching knowledge graph...'})}\n\n"
        try:
            subgraph = await engine._retrieve_subgraph(q, intent)
            nodes_preview = [{"id": n.get("id"), "name": n.get("name") or n.get("title"), "type": n.get("type")} for n in subgraph.nodes[:20]]
            yield f"event: subgraph\ndata: {json.dumps({'nodes': nodes_preview, 'edges': subgraph.edges[:30], 'node_count': len(subgraph.nodes), 'edge_count': len(subgraph.edges)})}\n\n"
        except Exception as e:
            logger.error(f"Subgraph retrieval failed: {e}")
            yield f"event: error\ndata: {json.dumps({'message': f'Retrieval failed: {str(e)}'})}\n\n"
            return

        # Stage 3: Synthesize answer
        yield f"event: retrieving\ndata: {json.dumps({'stage': 'synthesis', 'message': 'Synthesizing answer with LLM...'})}\n\n"
        try:
            sources = engine._extract_sources(subgraph)
            if engine.llm_client:
                answer, evidence_spans = await engine._llm_synthesize(q, subgraph, intent)
                confidence = 0.85
            else:
                answer = engine._structured_answer(q, subgraph, intent)
                evidence_spans = []
                confidence = 0.6

            # Stream answer as a single chunk (LLM doesn't support token streaming yet)
            yield f"event: answer\ndata: {json.dumps({'chunk': answer, 'done': True})}\n\n"

            # Stream evidence
            if evidence_spans:
                yield f"event: evidence\ndata: {json.dumps({'spans': [{'node_id': e.node_id, 'node_name': e.node_name, 'text': e.text, 'confidence': e.confidence} for e in evidence_spans]})}\n\n"

            # Stream sources
            if sources:
                yield f"event: sources\ndata: {json.dumps({'sources': sources})}\n\n"

            yield f"event: done\ndata: {json.dumps({'intent': intent, 'confidence': confidence})}\n\n"

        except Exception as e:
            logger.error(f"Answer synthesis failed: {e}")
            yield f"event: error\ndata: {json.dumps({'message': f'Synthesis failed: {str(e)}'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.get("/debug/kimi")
async def debug_kimi():
    """Debug endpoint to test Kimi LLM connectivity."""
    try:
        from app.services.kimi_client import KimiExtractor
        extractor = KimiExtractor()
        resp = await extractor.client.messages.create(
            model="kimi-for-coding",
            max_tokens=50,
            messages=[{"role": "user", "content": "Hello"}]
        )
        return {"status": "ok", "response": resp.content[0].text}
    except Exception as e:
        logger.error(f"Kimi debug failed: {e}")
        return {"status": "error", "detail": str(e)}
