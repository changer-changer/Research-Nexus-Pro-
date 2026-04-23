"""
FastAPI Main Application - Zero-Docker Edition with Cognee V2
Uses SQLite + NetworkX instead of Neo4j, NumPy instead of Qdrant
Includes Cognee Native Graph API for Research-Nexus Pro V2
"""

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import local database connectors (No Docker required!)
from app.database.local_graph import get_local_graph_db
from app.database.local_vector import get_local_vector_db

# Import Cognee V2 integration
try:
    from cognee_integration.routers.v2_routes import router as cognee_v2_router
    COGNEE_V2_AVAILABLE = True
except ImportError:
    COGNEE_V2_AVAILABLE = False
    print("Warning: Cognee V2 not available")

# Import Paper Generation routes
from app.api.paper_generation_routes import router as paper_generation_router
PAPER_GENERATION_AVAILABLE = True

# Import AutoResearchClaw routes
try:
    from app.api.autoresearch_routes import router as autoresearch_router
    AUTORESEARCH_AVAILABLE = True
except ImportError:
    AUTORESEARCH_AVAILABLE = False
    print("Warning: AutoResearchClaw routes not available")


# Import Innovation routes
try:
    from app.api.innovation_routes import router as innovation_router
    INNOVATION_AVAILABLE = True
except ImportError:
    INNOVATION_AVAILABLE = False
    print("Warning: Innovation routes not available")

# Import AutoResearchClaw integration routes
try:
    from app.api.autoresearch_claw_routes import router as autoresearch_claw_router
    AUTORESEARCH_CLAW_AVAILABLE = True
except ImportError as e:
    AUTORESEARCH_CLAW_AVAILABLE = False
    print(f"Warning: AutoResearchClaw integration routes not available: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("🚀 Starting Research-Nexus API (Zero-Docker Mode)...")
    
    try:
        # Initialize local graph database
        graph_db = get_local_graph_db()
        if graph_db.health_check():
            logger.info("✅ Local GraphDB (SQLite+NetworkX) ready")
        else:
            logger.warning("⚠️ GraphDB health check failed")
    except Exception as e:
        logger.error(f"❌ GraphDB initialization error: {e}")
    
    try:
        # Initialize local vector database
        vector_db = get_local_vector_db()
        if vector_db.health_check():
            logger.info("✅ Local VectorDB (NumPy) ready")
        else:
            logger.warning("⚠️ VectorDB health check failed")
    except Exception as e:
        logger.error(f"❌ VectorDB initialization error: {e}")
    
    # Initialize Cognee V2
    if COGNEE_V2_AVAILABLE:
        try:
            from cognee_integration.graph_backend import initialize_backend
            import os
            api_key = os.environ.get("COGNEE_LLM_API_KEY", "")
            if api_key:
                await initialize_backend(api_key)
                logger.info("✅ Cognee V2 backend initialized")
            else:
                logger.warning("⚠️ COGNEE_LLM_API_KEY not set, Cognee V2 running in mock mode")
        except Exception as e:
            logger.error(f"❌ Cognee V2 initialization error: {e}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Research-Nexus API...")


def create_app() -> FastAPI:
    """Application factory."""
    
    app = FastAPI(
        title="Research-Nexus Pro API (Zero-Docker + Cognee V2)",
        description="Intelligent research paper analysis - No Docker Required! Native Cognee Graph Support",
        version="2.1.0",
        lifespan=lifespan
    )
    
    # Configure CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3004",
            "http://localhost:3005",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5183",
            "http://localhost:5184",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3002",
            "http://127.0.0.1:3003",
            "http://127.0.0.1:3004",
            "http://127.0.0.1:3005",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5183",
            "http://127.0.0.1:5184",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Import and include routes
    from app.api.local_routes import router
    app.include_router(router, prefix="/api")
    
    # Include V3 Strict Schema routes (Domain Map, Evidence Panel, Innovation Board)
    from app.api.v3_graph_routes import router as v3_router
    app.include_router(v3_router, prefix="/api")
    
    # Include Cognee V2 routes
    if COGNEE_V2_AVAILABLE:
        app.include_router(cognee_v2_router, prefix="/api")
        logger.info("✅ Cognee V2 routes registered at /api/cognee")
    
    # Include Paper Generation routes at /api/v3 to match frontend
    app.include_router(paper_generation_router, prefix="/api/v3")
    logger.info("✅ Paper Generation routes registered at /api/v3")
    
    # Include AutoResearchClaw routes
    if AUTORESEARCH_AVAILABLE:
        app.include_router(autoresearch_router, prefix="/api/v3")
        logger.info("✅ AutoResearchClaw routes registered at /api/v3/autoresearch")
    
    # Include Innovation routes
    if INNOVATION_AVAILABLE:
        app.include_router(innovation_router, prefix="/api/innovation")
        logger.info("✅ Innovation routes registered at /api/innovation")

    # Include AutoResearchClaw full pipeline integration routes
    if AUTORESEARCH_CLAW_AVAILABLE:
        app.include_router(autoresearch_claw_router, prefix="/api/v3")
        logger.info("✅ AutoResearchClaw integration routes registered at /api/v3/autoresearch")

    # Include Paper Library routes
    from app.api.paper_library_routes import router as paper_library_router
    app.include_router(paper_library_router, prefix="/api")
    logger.info("✅ Paper Library routes registered at /api/library")

    # Include V4 Research Brain routes
    from app.api.v4_routes import router as v4_router
    app.include_router(v4_router, prefix="/api")
    logger.info("✅ V4 Research Brain routes registered at /api/v4")

    return app


# Create application instance
app = create_app()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Research-Nexus Pro API (Zero-Docker + Cognee V2 + Innovation + AutoResearchClaw)",
        "version": "2.3.0",
        "description": "No Docker required - runs on SQLite + NumPy + Cognee Native Graph + Innovation Discovery + AutoResearchClaw 23-Stage Pipeline",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": {
            "problems": "/api/problems",
            "methods": "/api/methods",
            "skills": "/api/skills/{extract|gaps|cross-domain|merge}",
            "innovation": {
                "select_papers": "/api/innovation/papers/select",
                "generate_innovation": "/api/innovation/generate",
                "backtest": "/api/innovation/backtest/run",
                "history": "/api/innovation/backtest/history"
            },
            "cognee_v2": "/api/cognee/health" if COGNEE_V2_AVAILABLE else "not available",
            "autoresearch_claw": {
                "health": "/api/v3/autoresearch/health",
                "run_pipeline": "POST /api/v3/autoresearch/run",
                "stream_progress": "GET /api/v3/autoresearch/tasks/{task_id}/stream",
                "task_status": "GET /api/v3/autoresearch/tasks/{task_id}",
                "list_tasks": "GET /api/v3/autoresearch/tasks",
                "gate_response": "POST /api/v3/autoresearch/tasks/{task_id}/gate/{stage}/respond",
                "artifacts": "GET /api/v3/autoresearch/tasks/{task_id}/artifacts",
            } if AUTORESEARCH_CLAW_AVAILABLE else "not available"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    status = {
        "status": "ok",
        "mode": "zero-docker",
        "cognee_v2": COGNEE_V2_AVAILABLE,
        "autoresearch_claw": AUTORESEARCH_CLAW_AVAILABLE,
        "databases": {}
    }
    
    # Check GraphDB
    try:
        graph_db = get_local_graph_db()
        stats = graph_db.get_statistics()
        status["databases"]["graph_db"] = {
            "status": "ok",
            "type": "SQLite+NetworkX",
            **stats
        }
    except Exception as e:
        status["databases"]["graph_db"] = {"status": "error", "error": str(e)}
        status["status"] = "degraded"
    
    # Check VectorDB
    try:
        vector_db = get_local_vector_db()
        stats = vector_db.get_statistics()
        status["databases"]["vector_db"] = {
            "status": "ok", 
            "type": "NumPy",
            **stats
        }
    except Exception as e:
        status["databases"]["vector_db"] = {"status": "error", "error": str(e)}
        status["status"] = "degraded"
    
    # Overall status
    if status["status"] != "ok":
        return JSONResponse(content=status, status_code=503)
    
    return status


@app.get("/stats")
async def get_stats():
    """Get system statistics."""
    try:
        graph_db = get_local_graph_db()
        vector_db = get_local_vector_db()
        
        return {
            "graph_database": graph_db.get_statistics(),
            "vector_database": vector_db.get_statistics(),
            "cognee_v2_available": COGNEE_V2_AVAILABLE,
            "mode": "zero-docker"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info", loop="asyncio")
