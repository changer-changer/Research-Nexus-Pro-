"""
AutoResearchClaw Integration API Routes

Provides endpoints for running the full 23-stage research pipeline
with real-time SSE streaming, web-based HITL gates, and artifact retrieval.
"""

import uuid
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["autoresearch-claw"])

# Import integration package
try:
    from app.autoresearch_claw_integration import (
        stream_pipeline,
        DatabaseArtifactStore,
        WebHITLAdapter,
    )
    ARC_INTEGRATION_AVAILABLE = True
except ImportError as e:
    logger.warning(f"AutoResearchClaw integration not available: {e}")
    ARC_INTEGRATION_AVAILABLE = False


# ──────────────────────────── Request/Response Models ────────────────────────────

class RunPipelineRequest(BaseModel):
    topic: str
    innovation_id: Optional[str] = None
    target_venue: str = "NeurIPS"
    experiment_mode: str = "simulated"
    auto_approve_gates: bool = True
    enable_hitl: bool = False
    max_iterations: int = 3
    time_budget_sec: int = 600


class GateResponseRequest(BaseModel):
    decision: str  # "approve", "reject", "abort"
    feedback: Optional[str] = None


class TaskStatusResponse(BaseModel):
    id: str
    status: str
    current_stage: int
    total_stages: int = 23
    topic: Optional[str] = None
    target_venue: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


# ──────────────────────────── In-memory task tracking ────────────────────────────

# Maps task_id -> {topic, target_venue, active_hitl_adapter}
_active_tasks: Dict[str, Dict[str, Any]] = {}


# ──────────────────────────── Endpoints ────────────────────────────


@router.post("/autoresearch/run")
async def run_pipeline(request: RunPipelineRequest):
    """
    Start a new AutoResearchClaw pipeline run.

    Returns task_id which can be used to stream progress via /stream endpoint.
    """
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    task_id = f"arc_{uuid.uuid4().hex[:12]}"

    # Load innovation data if provided
    innovation_data = None
    if request.innovation_id:
        try:
            from app.database.local_graph import get_local_graph_db
            graph_db = get_local_graph_db()
            innovation_data = graph_db.get_innovation(request.innovation_id)
        except Exception as e:
            logger.warning(f"Could not load innovation {request.innovation_id}: {e}")

    # Store task metadata
    _active_tasks[task_id] = {
        "topic": request.topic,
        "target_venue": request.target_venue,
        "experiment_mode": request.experiment_mode,
        "innovation_data": innovation_data,
        "request": request.dict(),
        "started_at": datetime.now().isoformat(),
    }

    return {
        "task_id": task_id,
        "status": "started",
        "topic": request.topic,
        "total_stages": 23,
        "stream_url": f"/api/v3/autoresearch/tasks/{task_id}/stream",
    }


@router.get("/autoresearch/tasks/{task_id}/stream")
async def stream_task_progress(task_id: str):
    """
    SSE stream of pipeline progress for a task.

    Connect to this endpoint after calling /run to receive real-time updates.
    """
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    task_meta = _active_tasks.get(task_id)
    if not task_meta:
        # Try to get from database
        store = DatabaseArtifactStore()
        task = store.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        task_meta = {
            "topic": task.get("config_json", {}).get("topic", "Unknown"),
            "target_venue": "NeurIPS",
            "experiment_mode": "simulated",
            "innovation_data": None,
            "request": {},
        }

    request_data = task_meta.get("request", {})

    async def event_generator():
        async for event in stream_pipeline(
            topic=task_meta["topic"],
            innovation_data=task_meta.get("innovation_data"),
            target_venue=task_meta["target_venue"],
            experiment_mode=task_meta.get("experiment_mode", "simulated"),
            task_id=task_id,
            auto_approve_gates=request_data.get("auto_approve_gates", True),
            enable_hitl=request_data.get("enable_hitl", False),
            max_iterations=request_data.get("max_iterations", 3),
            time_budget_sec=request_data.get("time_budget_sec", 600),
        ):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/autoresearch/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get the current status of a pipeline task."""
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    store = DatabaseArtifactStore()
    task = store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Get artifact count
    artifacts = store.list_artifacts(task_id)

    return {
        "id": task["id"],
        "status": task["status"],
        "current_stage": task["current_stage"],
        "total_stages": 23,
        "innovation_id": task.get("innovation_id"),
        "started_at": task.get("started_at"),
        "completed_at": task.get("completed_at"),
        "artifact_count": len(artifacts),
        "artifacts_preview": [
            {"stage": a["stage"], "filename": a["filename"], "type": a["content_type"]}
            for a in artifacts[:10]
        ],
    }


@router.post("/autoresearch/tasks/{task_id}/gate/{stage}/respond")
async def respond_to_gate(task_id: str, stage: int, request: GateResponseRequest):
    """
    Respond to a HITL gate decision.

    Called by the frontend when the user approves/rejects a gate stage.
    """
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    task_meta = _active_tasks.get(task_id)
    if not task_meta:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Get the HITL adapter for this task
    hitl = task_meta.get("hitl_adapter")
    if not hitl:
        # Create a new adapter and provide the decision
        hitl = WebHITLAdapter(task_id, DatabaseArtifactStore())

    hitl.provide_decision(stage, request.decision, request.feedback)

    return {
        "task_id": task_id,
        "stage": stage,
        "decision": request.decision,
        "status": "recorded",
    }


@router.get("/autoresearch/tasks/{task_id}/artifacts")
async def list_task_artifacts(
    task_id: str,
    stage: Optional[int] = Query(None, description="Filter by stage number"),
):
    """List all artifacts for a task."""
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    store = DatabaseArtifactStore()
    artifacts = store.list_artifacts(task_id, stage)

    return {
        "task_id": task_id,
        "artifacts": artifacts,
        "total": len(artifacts),
    }


@router.get("/autoresearch/tasks/{task_id}/artifacts/{stage}/{filename:path}")
async def get_artifact_content(task_id: str, stage: int, filename: str):
    """Get the content of a specific artifact."""
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    store = DatabaseArtifactStore()
    content = store.load_artifact(task_id, stage, filename)

    if content is None:
        raise HTTPException(
            status_code=404,
            detail=f"Artifact {filename} not found for stage {stage}"
        )

    # Try to detect content type
    content_type = "text/plain"
    if filename.endswith(".json"):
        content_type = "application/json"
        try:
            return JSONResponse(content=json.loads(content))
        except json.JSONDecodeError:
            pass
    elif filename.endswith(".md"):
        content_type = "text/markdown"
    elif filename.endswith(".py"):
        content_type = "text/x-python"
    elif filename.endswith((".yaml", ".yml")):
        content_type = "text/yaml"

    return JSONResponse({
        "task_id": task_id,
        "stage": stage,
        "filename": filename,
        "content": content,
        "content_type": content_type,
    })


@router.get("/autoresearch/tasks")
async def list_tasks(
    user_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List recent pipeline tasks."""
    if not ARC_INTEGRATION_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoResearchClaw integration not available")

    # Query from database
    import sqlite3
    from app.autoresearch_claw_integration.artifact_store import DB_PATH

    conn = sqlite3.connect(str(DB_PATH))
    try:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("""
                SELECT id, user_id, innovation_id, current_stage, status,
                       started_at, completed_at
                FROM autoresearch_tasks
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, (user_id, limit, offset))
        else:
            cursor.execute("""
                SELECT id, user_id, innovation_id, current_stage, status,
                       started_at, completed_at
                FROM autoresearch_tasks
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))

        rows = cursor.fetchall()
        tasks = [
            {
                "id": r[0],
                "user_id": r[1],
                "innovation_id": r[2],
                "current_stage": r[3],
                "status": r[4],
                "started_at": r[5],
                "completed_at": r[6],
            }
            for r in rows
        ]

        return {"tasks": tasks, "total": len(tasks), "limit": limit, "offset": offset}
    finally:
        conn.close()


@router.get("/autoresearch/health")
async def health_check():
    """Check if AutoResearchClaw integration is healthy."""
    status = {
        "integration_available": ARC_INTEGRATION_AVAILABLE,
        "kimi_api_key_set": bool(__import__("os").environ.get("KIMI_API_KEY")),
    }

    # Check AutoResearchClaw availability
    if ARC_INTEGRATION_AVAILABLE:
        try:
            import sys
            if "/home/cuizhixing/AutoResearchClaw" in sys.path:
                from researchclaw.pipeline.stages import Stage
                status["stages_count"] = len(list(Stage))
                status["autoresearchclaw_path"] = "/home/cuizhixing/AutoResearchClaw"
        except Exception as e:
            status["error"] = str(e)

    return status
