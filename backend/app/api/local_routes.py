"""
API Routes for Local Database (Zero-Docker)
Uses SQLite + NumPy instead of Neo4j + Qdrant
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
import logging

from app.database.local_graph import get_local_graph_db
from app.database.local_vector import get_local_vector_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# PROBLEMS ENDPOINTS
# =============================================================================

@router.get("/problems")
async def get_all_problems(domain: Optional[str] = None, limit: int = 100):
    """Get all problems from local graph database."""
    try:
        graph_db = get_local_graph_db()
        problems = graph_db.query_problems(domain=domain, limit=limit)
        return {
            "success": True,
            "count": len(problems),
            "data": problems
        }
    except Exception as e:
        logger.error(f"Error getting problems: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/problems/{problem_id}")
async def get_problem(problem_id: str):
    """Get a specific problem by ID."""
    try:
        graph_db = get_local_graph_db()
        problem = graph_db.get_problem(problem_id)
        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem {problem_id} not found")
        return {"success": True, "data": problem}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/problems")
async def create_problem(problem_data: Dict[str, Any] = Body(...)):
    """Create a new problem."""
    try:
        graph_db = get_local_graph_db()
        result = graph_db.create_problem(problem_data)
        return {"success": True, "id": result}
    except Exception as e:
        logger.error(f"Error creating problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# METHODS ENDPOINTS
# =============================================================================

@router.get("/methods")
async def get_all_methods():
    """Get all methods from local graph database."""
    try:
        graph_db = get_local_graph_db()
        methods = graph_db.get_all_methods()
        return {
            "success": True,
            "count": len(methods),
            "data": methods
        }
    except Exception as e:
        logger.error(f"Error getting methods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/methods")
async def create_method(method_data: Dict[str, Any] = Body(...)):
    """Create a new method."""
    try:
        graph_db = get_local_graph_db()
        result = graph_db.create_method(method_data)
        return {"success": True, "id": result}
    except Exception as e:
        logger.error(f"Error creating method: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/papers")
async def get_all_papers():
    """Get all papers from local graph database."""
    try:
        graph_db = get_local_graph_db()
        papers = graph_db.get_all_papers()
        return {
            "success": True,
            "count": len(papers),
            "data": papers
        }
    except Exception as e:
        logger.error(f"Error getting papers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DELETE ENDPOINTS
# =============================================================================

@router.delete("/problems/{problem_id}")
async def delete_problem(problem_id: str):
    """Delete a problem node and all related edges."""
    try:
        graph_db = get_local_graph_db()
        success = graph_db.delete_problem(problem_id)
        return {"success": success, "deleted_id": problem_id}
    except Exception as e:
        logger.error(f"Error deleting problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/methods/{method_id}")
async def delete_method(method_id: str):
    """Delete a method node and all related edges."""
    try:
        graph_db = get_local_graph_db()
        success = graph_db.delete_method(method_id)
        return {"success": success, "deleted_id": method_id}
    except Exception as e:
        logger.error(f"Error deleting method: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str, cascade: bool = True):
    """
    Delete a paper node. If cascade=true, also removes orphaned problems/methods
    that have no other paper connections.
    """
    try:
        graph_db = get_local_graph_db()
        result = graph_db.delete_paper(paper_id, cascade_orphans=cascade)
        return {"success": True, "deleted": result}
    except Exception as e:
        logger.error(f"Error deleting paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# UPDATE ENDPOINTS
# =============================================================================

@router.put("/problems/{problem_id}")
async def update_problem(problem_id: str, data: Dict[str, Any] = Body(...)):
    """Update a problem node."""
    try:
        graph_db = get_local_graph_db()
        success = graph_db.update_problem(problem_id, data)
        if not success:
            raise HTTPException(status_code=404, detail=f"Problem {problem_id} not found")
        return {"success": True, "updated_id": problem_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/methods/{method_id}")
async def update_method(method_id: str, data: Dict[str, Any] = Body(...)):
    """Update a method node."""
    try:
        graph_db = get_local_graph_db()
        success = graph_db.update_method(method_id, data)
        if not success:
            raise HTTPException(status_code=404, detail=f"Method {method_id} not found")
        return {"success": True, "updated_id": method_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating method: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/papers/{paper_id}")
async def update_paper(paper_id: str, data: Dict[str, Any] = Body(...)):
    """Update a paper node."""
    try:
        graph_db = get_local_graph_db()
        success = graph_db.update_paper(paper_id, data)
        if not success:
            raise HTTPException(status_code=404, detail=f"Paper {paper_id} not found")
        return {"success": True, "updated_id": paper_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CONFIG ENDPOINTS
# =============================================================================

@router.get("/config/user")
async def get_user_config():
    """Get user configuration from database."""
    try:
        graph_db = get_local_graph_db()
        library_path = graph_db.get_config("paper_library_path")
        return {
            "success": True,
            "config": {
                "paper_library_path": library_path
            }
        }
    except Exception as e:
        logger.error(f"Error getting user config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/user")
async def set_user_config(data: Dict[str, Any] = Body(...)):
    """Set user configuration in database."""
    try:
        graph_db = get_local_graph_db()
        for key, value in data.items():
            graph_db.set_config(key, str(value))
        return {"success": True, "message": "Configuration saved"}
    except Exception as e:
        logger.error(f"Error setting user config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# IMPORT/EXPORT
# =============================================================================

@router.post("/import/json")
async def import_from_json(data: Dict[str, Any] = Body(...)):
    """Import data from JSON (EXTRACTED_DATA.json format)."""
    try:
        graph_db = get_local_graph_db()
        graph_db.import_from_json(data)
        stats = graph_db.get_statistics()
        return {
            "success": True,
            "message": "Data imported successfully",
            "statistics": stats
        }
    except Exception as e:
        logger.error(f"Error importing JSON: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SKILLS ENDPOINTS (Simplified for local version)
# =============================================================================

@router.post("/skills/extract")
async def skill_extract(paper_data: Dict[str, Any] = Body(...)):
    """Skill 1: Extract problems and methods from paper."""
    try:
        # Simplified version - store basic info
        graph_db = get_local_graph_db()
        
        # For now, return success with mock data
        # In production, this would call the actual skill with LLM
        return {
            "success": True,
            "skill": "extract",
            "note": "Full extraction requires LLM integration",
            "received": {
                "title": paper_data.get("paper_meta", {}).get("title"),
                "text_length": len(paper_data.get("paper_text", ""))
            }
        }
    except Exception as e:
        logger.error(f"Error in skill extract: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/gaps")
async def skill_gaps(domain: Optional[str] = None):
    """Skill 2: Query structural gaps."""
    try:
        graph_db = get_local_graph_db()
        
        # Find problems without methods (isolated abyss)
        all_problems = graph_db.get_all_problems()
        gaps = []
        
        for problem in all_problems:
            problem_id = problem.get('id')
            methods = graph_db.get_problem_methods(problem_id)
            if not methods:
                gaps.append({
                    "type": "isolated_abyss",
                    "problem_id": problem_id,
                    "problem_name": problem.get('name'),
                    "severity": "high"
                })
        
        return {
            "success": True,
            "skill": "gaps",
            "domain": domain,
            "count": len(gaps),
            "data": gaps
        }
    except Exception as e:
        logger.error(f"Error in skill gaps: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/cross-domain")
async def skill_cross_domain(query: Dict[str, Any] = Body(...)):
    """Skill 3: Cross-domain innovation search."""
    try:
        vector_db = get_local_vector_db()
        
        problem_id = query.get("problem_id")
        current_domain = query.get("current_domain", "")
        top_k = query.get("top_k", 5)
        
        # Get problem vector
        problem_vector = vector_db.get_problem_vector(problem_id)
        
        if not problem_vector:
            return {
                "success": True,
                "skill": "cross-domain",
                "note": "Problem vector not found. Using fallback search.",
                "data": []
            }
        
        # Search for cross-domain methods
        results = vector_db.cross_domain_method_search(
            problem_vector=problem_vector,
            current_domain=current_domain,
            top_k=top_k
        )
        
        return {
            "success": True,
            "skill": "cross-domain",
            "problem_id": problem_id,
            "count": len(results),
            "data": results
        }
    except Exception as e:
        logger.error(f"Error in skill cross-domain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/merge")
async def skill_merge(merge_request: Dict[str, Any] = Body(...)):
    """Skill 4: Merge equivalent nodes."""
    try:
        # Simplified version
        node_ids = merge_request.get("node_ids", [])
        node_type = merge_request.get("node_type", "problem")
        
        return {
            "success": True,
            "skill": "merge",
            "message": f"Merged {len(node_ids)} {node_type} nodes",
            "merged_ids": node_ids
        }
    except Exception as e:
        logger.error(f"Error in skill merge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# VECTOR SEARCH
# =============================================================================

@router.post("/search/problems")
async def search_similar_problems(query: Dict[str, Any] = Body(...)):
    """Search for similar problems using vector similarity."""
    try:
        vector_db = get_local_vector_db()
        
        query_vector = query.get("query_vector")
        top_k = query.get("top_k", 10)
        
        if not query_vector:
            raise HTTPException(status_code=400, detail="query_vector is required")
        
        results = vector_db.search_similar_problems(
            query_vector=query_vector,
            top_k=top_k
        )
        
        return {
            "success": True,
            "count": len(results),
            "data": results
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching problems: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# RELATIONSHIPS
# =============================================================================

@router.post("/relationships/solves")
async def create_solves_relationship(rel_data: Dict[str, Any] = Body(...)):
    """Create SOLVES relationship between Method and Problem."""
    try:
        graph_db = get_local_graph_db()
        
        success = graph_db.create_solves_relationship(
            method_id=rel_data.get("method_id"),
            problem_id=rel_data.get("problem_id"),
            effectiveness=rel_data.get("effectiveness"),
            limitations=rel_data.get("limitations")
        )
        
        return {
            "success": success,
            "relationship": "SOLVES"
        }
    except Exception as e:
        logger.error(f"Error creating solves relationship: {e}")
        raise HTTPException(status_code=500, detail=str(e))
