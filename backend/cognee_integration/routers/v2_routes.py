"""
FastAPI Routes for Cognee Native Graph API
Direct exposure of cognee graph for Research-Nexus Pro V2
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os

# Import cognee backend (use relative imports for proper module resolution)
import sys
import os

# Add project root to path if needed
if os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from cognee_integration.graph_backend import get_backend, initialize_backend, CogneeConfig
from cognee_integration.schemas import PaperInput, GraphData

router = APIRouter(prefix="/cognee", tags=["cognee"])

# 自动推导项目根目录，支持任意部署路径
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Initialize on startup
@router.on_event("startup")
async def startup():
    """Initialize cognee backend on API startup"""
    api_key = os.environ.get("COGNEE_LLM_API_KEY", "")
    if api_key:
        await initialize_backend(api_key)


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "cognee_available": True,
        "version": "2.0.0-native"
    }


@router.post("/papers")
async def add_paper(paper: PaperInput):
    """
    Add a paper to the knowledge graph
    """
    try:
        backend = get_backend()
        result = await backend.add_paper(paper)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/papers/batch")
async def add_papers_batch(papers: List[PaperInput]):
    """
    Add multiple papers to the knowledge graph
    """
    try:
        backend = get_backend()
        results = []
        for paper in papers:
            result = await backend.add_paper(paper)
            results.append(result)
        return {"added": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/graph/build")
async def build_graph():
    """
    Build knowledge graph from added papers
    Returns native cognee graph format
    """
    try:
        backend = get_backend()
        graph = await backend.cognify()
        return {
            "status": "success",
            "nodes_count": len(graph.nodes),
            "edges_count": len(graph.edges),
            "graph": {
                "nodes": [node.dict() for node in graph.nodes],
                "edges": [edge.dict() for edge in graph.edges]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph")
async def get_graph():
    """
    Get full knowledge graph in native cognee format
    """
    try:
        backend = get_backend()
        graph = await backend.get_graph()
        return {
            "nodes": [node.dict() for node in graph.nodes],
            "edges": [edge.dict() for edge in graph.edges]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_graph(q: str = Query(..., description="Search query")):
    """
    Search the knowledge graph
    """
    try:
        backend = get_backend()
        results = await backend.search(q)
        return {"query": q, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search/advanced")
async def advanced_search(
    query: str,
    node_types: Optional[List[str]] = None,
    relationship_types: Optional[List[str]] = None
):
    """
    Advanced search with filters
    """
    try:
        backend = get_backend()
        # TODO: Implement advanced filtering
        results = await backend.search(query)
        return {
            "query": query,
            "filters": {
                "node_types": node_types,
                "relationship_types": relationship_types
            },
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats():
    """
    Get graph statistics
    """
    try:
        backend = get_backend()
        graph = await backend.get_graph()
        
        paper_count = len([n for n in graph.nodes if n.type == "Paper"])
        problem_count = len([n for n in graph.nodes if n.type == "Problem"])
        method_count = len([n for n in graph.nodes if n.type == "Method"])
        
        return {
            "nodes": {
                "total": len(graph.nodes),
                "papers": paper_count,
                "problems": problem_count,
                "methods": method_count
            },
            "edges": {
                "total": len(graph.edges),
                "by_type": {}
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_graph():
    """
    Reset the knowledge graph
    """
    try:
        backend = get_backend()
        await backend.reset()
        return {"status": "reset", "message": "Graph has been reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/reactflow")
async def export_reactflow():
    """
    Export graph in ReactFlow format
    """
    try:
        backend = get_backend()
        graph = await backend.get_graph()
        
        # Convert to ReactFlow format
        from cognee_integration.adapter import graph_to_reactflow
        reactflow_data = graph_to_reactflow(graph)
        
        return reactflow_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TIMELINE API - Returns papers grouped by year
# =============================================================================

@router.get("/timeline")
async def get_timeline():
    """
    Get papers grouped by year for timeline visualization.
    Returns year-based aggregation with paper details.
    """
    try:
        import json
        import os
        
        project_root = _PROJECT_ROOT
        data_path = os.path.join(project_root, "EXTRACTED_DATA.json")
        
        if not os.path.exists(data_path):
            raise HTTPException(status_code=404, detail="EXTRACTED_DATA.json not found")
        
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        # Build timeline data
        timeline = []
        papers_by_year = data.get("papers_by_year", {})
        
        for year in sorted(papers_by_year.keys(), key=int):
            papers = papers_by_year[year]
            timeline.append({
                "year": int(year),
                "count": len(papers),
                "papers": [
                    {
                        "id": p.get("id"),
                        "title": p.get("title"),
                        "venue": p.get("venue"),
                        "authorityScore": p.get("authorityScore"),
                        "problems": p.get("problems", []),
                        "methods": p.get("methods", [])
                    }
                    for p in papers
                ]
            })
        
        return {
            "success": True,
            "total_years": len(timeline),
            "total_papers": sum(y["count"] for y in timeline),
            "timeline": timeline
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# IMPACT SCORES API - Returns paper influence scores
# =============================================================================

@router.get("/papers/scores")
async def get_paper_scores():
    """
    Get influence/authority scores for all papers.
    Returns papers sorted by impact score.
    """
    try:
        import json
        import os
        
        project_root = _PROJECT_ROOT
        data_path = os.path.join(project_root, "EXTRACTED_DATA.json")
        
        if not os.path.exists(data_path):
            raise HTTPException(status_code=404, detail="EXTRACTED_DATA.json not found")
        
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        # Collect all papers with scores
        papers_with_scores = []
        papers_by_year = data.get("papers_by_year", {})
        
        for year, papers in papers_by_year.items():
            for p in papers:
                score = p.get("authorityScore")
                papers_with_scores.append({
                    "id": p.get("id"),
                    "title": p.get("title"),
                    "year": int(year) if year else None,
                    "venue": p.get("venue"),
                    "authorityScore": score,
                    "problems": p.get("problems", []),
                    "methods": p.get("methods", [])
                })
        
        # Sort by score (descending)
        papers_with_scores.sort(key=lambda x: x.get("authorityScore") or 0, reverse=True)
        
        return {
            "success": True,
            "total_papers": len(papers_with_scores),
            "papers": papers_with_scores
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# METHOD TREE API - Returns hierarchical method structure
# =============================================================================

@router.get("/methods/tree")
async def get_method_tree():
    """
    Get hierarchical method tree structure.
    Returns methods organized by parent-child relationships.
    """
    try:
        import json
        import os
        
        project_root = _PROJECT_ROOT
        data_path = os.path.join(project_root, "EXTRACTED_DATA.json")
        
        if not os.path.exists(data_path):
            raise HTTPException(status_code=404, detail="EXTRACTED_DATA.json not found")
        
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        # Build method hierarchy
        methods_by_approach = data.get("methods_by_approach", {})
        all_methods = []
        
        for approach, methods in methods_by_approach.items():
            for m in methods:
                all_methods.append({
                    "id": m.get("id"),
                    "name": m.get("name"),
                    "approach": approach,
                    "level": m.get("level", 0),
                    "parent": m.get("parent"),
                    "targets": m.get("targets", [])
                })
        
        # Build tree structure
        method_map = {m["id"]: m for m in all_methods}
        root_methods = []
        
        for m in all_methods:
            parent_id = m.get("parent")
            if parent_id is None or parent_id not in method_map:
                root_methods.append(m)
        
        return {
            "success": True,
            "total_methods": len(all_methods),
            "root_methods": len(root_methods),
            "methods": all_methods,
            "by_approach": {
                approach: [
                    {"id": m.get("id"), "name": m.get("name"), "parent": m.get("parent")}
                    for m in methods
                ]
                for approach, methods in methods_by_approach.items()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PROBLEM TREE API - Returns hierarchical problem structure
# =============================================================================

@router.get("/problems/tree")
async def get_problem_tree():
    """
    Get hierarchical problem tree structure.
    Returns problems organized by parent-child relationships.
    """
    try:
        import json
        import os
        
        project_root = _PROJECT_ROOT
        data_path = os.path.join(project_root, "EXTRACTED_DATA.json")
        
        if not os.path.exists(data_path):
            raise HTTPException(status_code=404, detail="EXTRACTED_DATA.json not found")
        
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        # Build problem hierarchy
        problems_by_branch = data.get("problems_by_branch", {})
        all_problems = []
        
        for branch, problems in problems_by_branch.items():
            for p in problems:
                all_problems.append({
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "branch": branch,
                    "level": p.get("level", 0),
                    "parent": p.get("parent"),
                    "year": p.get("year"),
                    "status": p.get("status", "active")
                })
        
        # Build tree structure
        problem_map = {p["id"]: p for p in all_problems}
        root_problems = []
        
        for p in all_problems:
            parent_id = p.get("parent")
            if parent_id is None or parent_id not in problem_map:
                root_problems.append(p)
        
        return {
            "success": True,
            "total_problems": len(all_problems),
            "root_problems": len(root_problems),
            "problems": all_problems,
            "by_branch": {
                branch: [
                    {"id": p.get("id"), "name": p.get("name"), "parent": p.get("parent"), "level": p.get("level")}
                    for p in problems
                ]
                for branch, problems in problems_by_branch.items()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CITATION NETWORK API - Returns CITES relationships
# =============================================================================

@router.get("/citations/network")
async def get_citation_network():
    """
    Get citation network with CITES relationships.
    Returns nodes (papers) and edges (citations).
    """
    try:
        import json
        import os
        
        project_root = _PROJECT_ROOT
        data_path = os.path.join(project_root, "EXTRACTED_DATA.json")
        
        if not os.path.exists(data_path):
            raise HTTPException(status_code=404, detail="EXTRACTED_DATA.json not found")
        
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        # Build citation edges
        edges = []
        papers_by_year = data.get("papers_by_year", {})
        all_papers = {}
        
        for year, papers in papers_by_year.items():
            for p in papers:
                paper_id = p.get("id")
                all_papers[paper_id] = {
                    "id": paper_id,
                    "title": p.get("title"),
                    "year": int(year) if year else None,
                    "venue": p.get("venue"),
                    "authorityScore": p.get("authorityScore")
                }
                
                # Add citation edges
                cites = p.get("cites", [])
                for target_id in cites:
                    edges.append({
                        "source": paper_id,
                        "target": target_id,
                        "type": "CITES"
                    })
        
        return {
            "success": True,
            "nodes": list(all_papers.values()),
            "edges": edges,
            "total_nodes": len(all_papers),
            "total_edges": len(edges)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/extracted-data")
async def import_extracted_data():
    """
    Import data from EXTRACTED_DATA.json
    """
    try:
        import json
        import os
        
        # Load EXTRACTED_DATA.json
        project_root = _PROJECT_ROOT
        data_path = os.path.join(project_root, "EXTRACTED_DATA.json")
        
        if not os.path.exists(data_path):
            raise HTTPException(status_code=404, detail="EXTRACTED_DATA.json not found")
        
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        backend = get_backend()
        
        # Import papers
        papers_by_year = data.get("papers_by_year", {})
        imported_count = 0
        
        for year, papers in papers_by_year.items():
            for paper in papers:
                paper_input = PaperInput(
                    id=paper.get("id", f"paper_{imported_count}"),
                    title=paper.get("title", "Unknown"),
                    authors=paper.get("authors", []),
                    year=int(year) if year else None,
                    venue=paper.get("venue", ""),
                    abstract=paper.get("abstract", ""),
                    problems=paper.get("problems", []),
                    methods=paper.get("methods", []),
                    contribution=paper.get("core_contribution", "")
                )
                await backend.add_paper(paper_input)
                imported_count += 1
        
        # Build graph
        await backend.cognify()
        
        return {
            "success": True,
            "imported_papers": imported_count,
            "message": f"Successfully imported {imported_count} papers"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
