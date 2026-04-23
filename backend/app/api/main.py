"""
Research-Nexus Backend API
FastAPI application entry point
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from .v3_graph_routes import router as v3_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Research-Nexus API",
    description="AI-powered research paper analysis and knowledge graph API",
    version="3.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(v3_router, prefix="/api")
# We can still include old routes if needed, but they might crash if neo4j is down
# app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Research-Nexus API V3 (Local Graph + Vector DB)",
        "version": "3.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return JSONResponse(
        content={
            "status": "ok",
            "databases": {"sqlite": True, "local_vector": True}
        }
    )

@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("Research-Nexus API V3 starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    logger.info("Research-Nexus API V3 shutting down...")

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "app.api.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
