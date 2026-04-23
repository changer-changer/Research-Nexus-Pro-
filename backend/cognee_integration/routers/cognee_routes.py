"""
FastAPI Routes for Cognee Integration

Provides endpoints:
- POST /cognee/papers - Process a paper
- POST /cognee/papers/batch - Process multiple papers
- GET /cognee/search - Search knowledge graph
- GET /cognee/stats - Get graph statistics
- POST /cognee/reset - Reset knowledge graph
- GET /cognee/export/reactflow - Export for ReactFlow visualization
"""

import os
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Body, Query
from fastapi.responses import JSONResponse

from ..schemas import (
    ProcessPaperRequest, ProcessPaperResponse,
    SearchRequest, SearchResponse, GraphStatistics
)
from ..pipeline import ResearchPaperProcessor, CogneePipeline
from ..adapter import to_reactflow, CogneeToResearchNexusAdapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cognee", tags=["cognee"])

# Global pipeline instance
_pipeline: Optional[CogneePipeline] = None


def get_pipeline() -> CogneePipeline:
    """Get or create pipeline instance."""
    global _pipeline
    if _pipeline is None:
        _pipeline = CogneePipeline()
    return _pipeline


@router.post("/papers", response_model=ProcessPaperResponse)
async def process_paper(request: ProcessPaperRequest):
    """
    Process a single research paper and add to knowledge graph.
    
    Extracts:
    - Research problems addressed
    - Methods used/proposed
    - Hierarchical relationships
    - Citations
    """
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        result = await pipeline.processor.process_paper(
            paper_text=request.paper_text,
            paper_meta=request.paper_meta
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing paper: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/papers/batch")
async def process_papers_batch(
    papers: List[Dict[str, Any]] = Body(..., description="List of papers to process"),
    continue_on_error: bool = Query(True, description="Continue if individual paper fails")
):
    """
    Process multiple papers in batch.
    
    Each paper should have:
    - text: Full paper text or abstract
    - meta: Paper metadata (title, authors, year, etc.)
    """
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        results = []
        errors = []
        
        for i, paper_data in enumerate(papers):
            try:
                result = await pipeline.processor.process_paper(
                    paper_text=paper_data.get("text", ""),
                    paper_meta=paper_data.get("meta", {})
                )
                results.append({
                    "index": i,
                    "success": result.success,
                    "paper_id": result.paper_id,
                    "extracted_problems": result.extracted_problems,
                    "extracted_methods": result.extracted_methods
                })
            except Exception as e:
                logger.error(f"Error processing paper {i}: {e}")
                errors.append({"index": i, "error": str(e)})
                if not continue_on_error:
                    break
        
        return {
            "success": True,
            "processed": len(results),
            "errors": len(errors),
            "results": results,
            "error_details": errors if errors else None
        }
        
    except Exception as e:
        logger.error(f"Error in batch processing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=SearchResponse)
async def search_knowledge_graph(
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, ge=1, le=100),
    node_type: Optional[str] = Query(None, description="Filter by node type (problem|method|paper)")
):
    """
    Search the knowledge graph with natural language query.
    
    Examples:
    - "tactile perception methods"
    - "papers about slip detection"
    - "CNN-based approaches"
    """
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        result = await pipeline.search(query=q, limit=limit)
        return result
        
    except Exception as e:
        logger.error(f"Error searching: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search/advanced")
async def advanced_search(request: SearchRequest):
    """
    Advanced search with filters.
    
    Supports filtering by:
    - Node types (problem, method, paper)
    - Relationship inclusion
    - Result limit
    """
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        result = await pipeline.processor.search(
            query=request.query,
            limit=request.limit,
            node_types=request.node_types
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in advanced search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_statistics():
    """Get statistics about the knowledge graph."""
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        stats = await pipeline.processor.get_statistics()
        return {
            "success": True,
            "data": stats.model_dump()
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_knowledge_graph(
    confirm: bool = Query(False, description="Must be true to confirm reset")
):
    """
    Reset the knowledge graph (delete all data).
    
    ⚠️ This action cannot be undone!
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Must set confirm=true to reset the knowledge graph"
        )
    
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        success = await pipeline.reset()
        
        return {
            "success": success,
            "message": "Knowledge graph has been reset" if success else "Reset failed"
        }
        
    except Exception as e:
        logger.error(f"Error resetting graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/reactflow")
async def export_for_reactflow(
    paper_id: Optional[str] = Query(None, description="Export specific paper's knowledge")
):
    """
    Export knowledge graph in ReactFlow format for visualization.
    
    Returns nodes and edges compatible with ReactFlow.
    """
    try:
        # This would fetch actual data from the graph
        # For now, return empty structure
        return {
            "success": True,
            "data": {
                "nodes": [],
                "edges": []
            },
            "note": "Full export not yet implemented - requires graph query implementation"
        }
        
    except Exception as e:
        logger.error(f"Error exporting: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/extracted-data")
async def import_from_extracted_data(
    data: Dict[str, Any] = Body(..., description="EXTRACTED_DATA.json format data")
):
    """
    Import data from EXTRACTED_DATA.json format.
    
    Converts and processes all papers in the extracted data.
    """
    try:
        from ..adapter import ResearchNexusToCogneeAdapter
        
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        # Convert to Cognee format
        papers = ResearchNexusToCogneeAdapter.adapt_full_extracted_data(data)
        
        # Process in batch
        results = []
        for paper_input in papers[:5]:  # Limit to first 5 for testing
            result = await pipeline.processor.process_paper(
                paper_text=paper_input["text"],
                paper_meta=paper_input["meta"]
            )
            results.append({
                "success": result.success,
                "paper_id": result.paper_id
            })
        
        return {
            "success": True,
            "total_papers": len(papers),
            "processed": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error importing data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for Cognee integration."""
    try:
        pipeline = get_pipeline()
        await pipeline.initialize()
        
        return {
            "status": "healthy",
            "cognee_initialized": pipeline.processor._initialized,
            "config": pipeline.processor.config.to_dict()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )
