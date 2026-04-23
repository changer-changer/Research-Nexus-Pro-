"""
API Routes for Research-Nexus Backend
FastAPI route definitions
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import logging

from ..database.neo4j_connector import get_neo4j_connector
from ..database.qdrant_connector import get_qdrant_connector
from ..database.data_sync import get_synchronizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Health Check ====================

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    sync = get_synchronizer()
    health = sync.health_check()
    return {
        "status": "ok" if all(health.values()) else "degraded",
        "databases": health
    }


# ==================== Problem Routes ====================

@router.get("/problems")
async def get_problems(
    domain: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    """Get all problems with optional filtering."""
    try:
        neo4j = get_neo4j_connector()
        problems = neo4j.query_problems(domain=domain, status=status, limit=limit)
        return {"problems": problems, "count": len(problems)}
    except Exception as e:
        logger.error(f"Error fetching problems: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/problems/{problem_id}")
async def get_problem(problem_id: str):
    """Get a specific problem by ID."""
    try:
        neo4j = get_neo4j_connector()
        problems = neo4j.query_problems(limit=1)
        # Filter by ID in application layer
        problem = next((p for p in problems if p["id"] == problem_id), None)
        if not problem:
            raise HTTPException(status_code=404, detail="Problem not found")
        return problem
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching problem: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Method Routes ====================

@router.get("/methods")
async def get_methods(
    approach: Optional[str] = None,
    limit: int = 100
):
    """Get all methods with optional filtering."""
    try:
        neo4j = get_neo4j_connector()
        methods = neo4j.query_methods(approach=approach, limit=limit)
        return {"methods": methods, "count": len(methods)}
    except Exception as e:
        logger.error(f"Error fetching methods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/methods/{method_id}")
async def get_method(method_id: str):
    """Get a specific method by ID."""
    try:
        neo4j = get_neo4j_connector()
        methods = neo4j.query_methods(limit=1000)
        method = next((m for m in methods if m["id"] == method_id), None)
        if not method:
            raise HTTPException(status_code=404, detail="Method not found")
        return method
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching method: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Paper Routes ====================

@router.get("/papers")
async def get_papers(limit: int = 100):
    """Get all papers."""
    try:
        neo4j = get_neo4j_connector()
        papers = neo4j.query_papers(limit=limit)
        return {"papers": papers, "count": len(papers)}
    except Exception as e:
        logger.error(f"Error fetching papers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Skill Routes ====================

@router.post("/skills/extract")
async def skill_extract(paper_data: Dict[str, Any]):
    """
    Execute Skill 1: Extract and store triplets from paper.
    
    Request body:
    {
        "paper_text": "...",
        "paper_meta": {"title": "...", "year": 2024, ...}
    }
    """
    try:
        # Import here to avoid circular imports
        from ..skills.skill_1_super import UniversalPaperExtractor
        
        extractor = UniversalPaperExtractor(
            neo4j_driver=get_neo4j_connector(),
            qdrant_client=get_qdrant_connector()
        )
        
        result = extractor.execute(
            paper_text=paper_data.get("paper_text", ""),
            paper_meta=paper_data.get("paper_meta", {})
        )
        
        return {
            "status": "success",
            "result": result
        }
    except Exception as e:
        logger.error(f"Error in extract skill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/gaps")
async def skill_gaps(
    domain: Optional[str] = None
):
    """
    Execute Skill 2: Query structural gaps.
    
    Query params:
    - domain: Optional domain filter
    """
    try:
        from ..skills.skill_2_query_gaps import query_structural_gaps
        
        neo4j = get_neo4j_connector()
        gaps = query_structural_gaps(
            neo4j_driver=neo4j,
            domain=domain
        )
        
        return {
            "status": "success",
            "gaps": [gap.dict() for gap in gaps],
            "count": len(gaps)
        }
    except Exception as e:
        logger.error(f"Error in gaps skill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/cross-domain")
async def skill_cross_domain(
    problem_description: str,
    current_domain: str,
    top_k: int = 5
):
    """
    Execute Skill 3: Cross-domain innovation search.
    
    Request body:
    {
        "problem_description": "...",
        "current_domain": "Robotics",
        "top_k": 5
    }
    """
    try:
        from ..skills.skill_3_cross_domain import cross_domain_innovation_search
        
        neo4j = get_neo4j_connector()
        qdrant = get_qdrant_connector()
        
        matches = cross_domain_innovation_search(
            problem_description=problem_description,
            current_domain=current_domain,
            neo4j_driver=neo4j,
            qdrant_client=qdrant,
            top_k=top_k
        )
        
        return {
            "status": "success",
            "matches": [match.dict() for match in matches],
            "count": len(matches)
        }
    except Exception as e:
        logger.error(f"Error in cross-domain skill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/merge")
async def skill_merge(
    node_id_1: str,
    node_id_2: str,
    confidence_score: float
):
    """
    Execute Skill 4: Merge equivalent nodes.
    
    Request body:
    {
        "node_id_1": "m_method_a",
        "node_id_2": "m_method_b",
        "confidence_score": 0.92
    }
    """
    try:
        from ..skills.skill_4_merge_nodes import merge_equivalent_nodes
        
        neo4j = get_neo4j_connector()
        qdrant = get_qdrant_connector()
        
        result = merge_equivalent_nodes(
            node_id_1=node_id_1,
            node_id_2=node_id_2,
            confidence_score=confidence_score,
            neo4j_driver=neo4j,
            qdrant_client=qdrant
        )
        
        return {
            "status": "success",
            "result": result
        }
    except Exception as e:
        logger.error(f"Error in merge skill: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Vector Search Routes ====================

@router.post("/search/similar-problems")
async def search_similar_problems(
    query_vector: List[float],
    top_k: int = 5
):
    """Search for similar problems using vector similarity."""
    try:
        qdrant = get_qdrant_connector()
        results = qdrant.search_similar_problems(
            query_vector=query_vector,
            top_k=top_k
        )
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Error in similarity search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search/similar-methods")
async def search_similar_methods(
    query_vector: List[float],
    top_k: int = 5,
    exclude_domain: Optional[str] = None
):
    """Search for similar methods using vector similarity."""
    try:
        qdrant = get_qdrant_connector()
        results = qdrant.search_similar_methods(
            query_vector=query_vector,
            top_k=top_k,
            exclude_domain=exclude_domain
        )
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Error in similarity search: {e}")
        raise HTTPException(status_code=500, detail=str(e))
