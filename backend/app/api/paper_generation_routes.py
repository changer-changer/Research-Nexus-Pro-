"""
Paper Generation API Routes
Handles paper generation requests and SSE streaming
"""

import asyncio
import uuid
import json
import logging
from typing import Optional, List, Dict, Any, AsyncGenerator
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
import sqlite3
import os

# Import new paper writing engine
try:
    from app.paper_writing.engine import PaperWritingEngine
    from app.paper_writing.models import ResearchSpec, GeneratedPaper, PaperStatus, ExperimentData
    from app.paper_writing.iteration_engine import IterationEngine
    from app.paper_writing.data_injector import DataInjector
    PAPER_WRITING_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Paper writing engine not available: {e}")
    PAPER_WRITING_AVAILABLE = False

# Import paper generation components (legacy)
try:
    from app.services.paper_generation import (
        PaperGenerationEngine as LegacyPaperGenerationEngine,
        ExperimentFeasibilityEvaluator,
        evaluate_experiment_feasibility,
        stream_generation
    )
    from app.services.paper_generation.experiment_guide_generator import (
        ExperimentGuideGenerator,
        generate_experiment_guide
    )
    from app.services.kimi_client import KimiExtractor
    PAPER_GEN_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Paper generation not available: {e}")
    PAPER_GEN_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter(tags=["paper-generation"])

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "research_graph.db")


async def _sse_with_heartbeat(source_gen: AsyncGenerator[str, None], heartbeat_interval: float = 5.0) -> AsyncGenerator[str, None]:
    """Wrap an SSE generator with periodic heartbeat events to keep connections alive."""
    last_event_time = datetime.now().timestamp()
    heartbeat_event = json.dumps({"type": "heartbeat", "timestamp": int(datetime.now().timestamp() * 1000)})

    try:
        async for event in source_gen:
            last_event_time = datetime.now().timestamp()
            yield event
    finally:
        pass

    # Note: true concurrent heartbeat requires more complex asyncio plumbing.
    # For now we rely on the client-side timeout and the fact that each stage
    # yields at least one event.  If stages are very long, the client will
    # reconnect automatically.

# Global engine instances (initialized on first use)
_legacy_engine: Optional[Any] = None
_writing_engine: Optional[PaperWritingEngine] = None
_iteration_engine: Optional[IterationEngine] = None
_data_injector: Optional[DataInjector] = None


def get_legacy_engine() -> Any:
    """Get or create legacy paper generation engine"""
    global _legacy_engine
    if _legacy_engine is None and PAPER_GEN_AVAILABLE:
        try:
            kimi = KimiExtractor()
            _legacy_engine = LegacyPaperGenerationEngine(llm_client=kimi.client)
        except Exception as e:
            logger.warning(f"Could not initialize Kimi client: {e}")
            _legacy_engine = LegacyPaperGenerationEngine(llm_client=None)
    return _legacy_engine


def get_writing_engine() -> PaperWritingEngine:
    """Get or create the new paper writing engine"""
    global _writing_engine
    if _writing_engine is None and PAPER_WRITING_AVAILABLE:
        _writing_engine = PaperWritingEngine()
    return _writing_engine


def get_iteration_engine() -> IterationEngine:
    """Get or create iteration engine"""
    global _iteration_engine
    if _iteration_engine is None and PAPER_WRITING_AVAILABLE:
        _iteration_engine = IterationEngine()
    return _iteration_engine


def get_data_injector() -> DataInjector:
    """Get or create data injector"""
    global _data_injector
    if _data_injector is None and PAPER_WRITING_AVAILABLE:
        _data_injector = DataInjector()
    return _data_injector


@router.post("/generate/{innovation_id}")
async def generate_paper(
    innovation_id: str,
    target_venue: str = Query("NeurIPS", description="Target conference venue"),
    background_tasks: BackgroundTasks = None
):
    """
    Generate a paper from an innovation opportunity.
    
    Returns immediately with task ID. Check status endpoint for progress.
    """
    if not PAPER_GEN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper generation not available")
    
    task_id = str(uuid.uuid4())
    
    # For async processing, would store task in DB and process in background
    # For now, return task ID for SSE streaming
    
    return {
        "task_id": task_id,
        "innovation_id": innovation_id,
        "target_venue": target_venue,
        "status": "accepted",
        "stream_url": f"/api/v3/stream/{task_id}?innovation_id={innovation_id}&target_venue={target_venue}"
    }


@router.get("/stream/{task_id}")
async def stream_paper_generation(
    task_id: str,
    innovation_id: str,
    target_venue: str = Query("NeurIPS")
):
    """
    Stream paper generation progress via SSE.
    
    Events:
    - data: {"stage": "title", "progress": 10, "message": "..."}
    - data: {"stage": "complete", "progress": 100, "paper_path": "..."}
    """
    if not PAPER_GEN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper generation not available")
    
    engine = get_legacy_engine()

    async def event_generator():
        async for event in stream_generation(task_id, innovation_id, target_venue, engine):
            yield event
    
    return StreamingResponse(
        _sse_with_heartbeat(event_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/evaluate-feasibility")
async def evaluate_feasibility(experiment_design: dict):
    """
    Evaluate experiment design feasibility.
    
    Input: {
        "slots": [...],
        "resources": {...},
        "dependencies": [...]
    }
    
    Returns: Feasibility report with scores and recommendations
    """
    if not PAPER_GEN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper generation not available")
    
    try:
        result = evaluate_experiment_feasibility(experiment_design)
        return result
    except Exception as e:
        logger.error(f"Feasibility evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_generation_status(task_id: str):
    """Get current status of a paper generation task"""
    # In production, query from database
    # For now, return mock status
    return {
        "task_id": task_id,
        "status": "generating",
        "progress": 50,
        "current_stage": "methodology",
        "message": "Generating methodology section..."
    }


@router.get("/templates")
async def list_prompt_templates():
    """List available prompt templates"""
    if not PAPER_GEN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper generation not available")
    
    engine = get_legacy_engine()
    return {
        "templates": list(engine.prompts.keys()),
        "venues": ["NeurIPS", "ICML", "ICLR", "AAAI", "IJCAI"]
    }


# ==================== Experiment Guide API ====================

@router.post("/experiment-guide/generate")
async def generate_experiment_guide_endpoint(body: dict):
    """
    Generate detailed experiment guide from innovation opportunity.
    
    Input: {
        "innovation_id": "...",
        "target_problem": {...},
        "candidate_methods": [...],
        "rationale": "...",
        "feasibility_score": 0.75,
        "novelty_score": 0.6
    }
    
    Returns: Complete experiment guide with procedures, materials, validation criteria
    """
    if not PAPER_GEN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper generation not available")
    
    try:
        result = generate_experiment_guide(
            innovation_id=body.get("innovation_id", "unknown"),
            target_problem=body.get("target_problem", {}),
            candidate_methods=body.get("candidate_methods", []),
            rationale=body.get("rationale", ""),
            feasibility_score=body.get("feasibility_score", 0.5),
            novelty_score=body.get("novelty_score", 0.5)
        )
        return result
    except Exception as e:
        logger.error(f"Experiment guide generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Check if paper generation service is healthy"""
    llm_ready = False
    if _writing_engine and _writing_engine.llm:
        llm_ready = _writing_engine.llm._client is not None

    return {
        "status": "healthy" if PAPER_WRITING_AVAILABLE else "degraded",
        "paper_writing_available": PAPER_WRITING_AVAILABLE,
        "paper_generation_available": PAPER_GEN_AVAILABLE,
        "llm_client_available": llm_ready,
        "services": {
            "writing_engine": _writing_engine is not None,
            "iteration_engine": _iteration_engine is not None,
            "data_injector": _data_injector is not None,
        }
    }


# ==================== V3 API (Frontend Compatible) ====================
# These routes match the frontend's expected API structure at /api/v3/*

# In-memory storage for tasks, papers, and favorites (in production, use database)
_tasks_db: dict = {}
_papers_db: dict = {}  # serialized dicts for API responses
_paper_objects: Dict[str, GeneratedPaper] = {}  # actual GeneratedPaper objects
_experiment_slots_db: dict = {}
_favorites_db: dict = {}  # user_id -> list of favorites
_iterations_db: Dict[str, List[Dict[str, Any]]] = {}  # task_id -> iteration records


class CreateTaskRequest(BaseModel):
    innovationId: str
    targetVenue: str


class RefineRequest(BaseModel):
    sectionName: str
    feedback: str


class ExperimentDataRequest(BaseModel):
    metrics: Dict[str, float] = {}
    tables: List[Dict[str, Any]] = []
    figures: List[str] = []
    notes: str = ""


def _build_spec_from_task(task: dict) -> ResearchSpec:
    """Build a ResearchSpec from task data (with DB fallback for full innovation data)"""
    innovation_id = task.get("innovationId", "unknown")
    target_venue = task.get("targetVenue", "NeurIPS")

    # Try to load full innovation data from DB
    problem = ""
    solution = ""
    impact = ""
    domain = "cross_domain"
    related_papers: List[Dict[str, Any]] = []

    try:
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "data", "research_graph.db"
        )
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Try innovation_opportunities table
        cursor.execute(
            "SELECT * FROM innovation_opportunities WHERE id = ?",
            (innovation_id,),
        )
        row = cursor.fetchone()
        if row:
            row_dict = dict(row)
            problem = row_dict.get("problem_statement", "") or row_dict.get("description", "")
            solution = row_dict.get("proposed_solution", "") or ""
            impact = row_dict.get("expected_impact", "") or ""
            domain = row_dict.get("domain", "cross_domain")

            # Try to parse related papers
            papers_json = row_dict.get("related_papers", "[]")
            if isinstance(papers_json, str):
                try:
                    related_papers = json.loads(papers_json)
                except json.JSONDecodeError:
                    related_papers = []

        conn.close()
    except Exception as e:
        logger.warning(f"Could not load innovation from DB: {e}")

    return ResearchSpec(
        innovation_id=innovation_id,
        title_hint=task.get("problemName", ""),
        problem_statement=problem,
        proposed_solution=solution,
        expected_impact=impact,
        domain=domain,
        target_venue=target_venue,
        related_papers=related_papers,
    )

class CreateTaskRequest(BaseModel):
    innovationId: str
    targetVenue: str


class FavoriteItem(BaseModel):
    innovationId: Optional[str] = None
    problemName: Optional[str] = None
    methodName: Optional[str] = None
    noveltyScore: Optional[float] = 0.0
    feasibilityScore: Optional[float] = 0.0
    rationale: Optional[str] = None
    notes: Optional[str] = ""


# ==================== Favorites API ====================

@router.get("/favorites")
async def get_favorites(user_id: str = "default"):
    """Get user's favorite innovations from database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, innovation_id, notes, created_at, status 
            FROM innovation_favorites 
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,))
        
        rows = cursor.fetchall()
        favorites = []
        
        for row in rows:
            # Parse innovation JSON
            innovation_data = {}
            try:
                innovation_data = json.loads(row["innovation_id"]) if row["innovation_id"] else {}
            except:
                innovation_data = {"id": row["innovation_id"], "name": "Unknown"}
            
            favorites.append({
                "id": row["id"],
                "innovationId": innovation_data.get("id", ""),
                "problemName": innovation_data.get("problemName", ""),
                "methodName": innovation_data.get("methodName", ""),
                "noveltyScore": innovation_data.get("noveltyScore", 0),
                "feasibilityScore": innovation_data.get("feasibilityScore", 0),
                "rationale": innovation_data.get("rationale", ""),
                "notes": row["notes"] or "",
                "createdAt": row["created_at"],
                "tags": innovation_data.get("tags", [])
            })
        
        conn.close()
        return {"favorites": favorites, "total": len(favorites)}
        
    except Exception as e:
        logger.error(f"Error fetching favorites: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/favorites")
async def add_favorite(item: FavoriteItem, user_id: str = "default"):
    """Add an innovation to favorites"""
    if user_id not in _favorites_db:
        _favorites_db[user_id] = []
    
    fav_id = f"fav_{uuid.uuid4().hex[:8]}"
    favorite = {
        "id": fav_id,
        **item.dict(),
        "createdAt": datetime.now().isoformat()
    }
    _favorites_db[user_id].append(favorite)
    
    return {"success": True, "id": fav_id, "message": "Added to favorites"}


@router.delete("/favorites/{fav_id}")
async def remove_favorite(fav_id: str, user_id: str = "default"):
    """Remove an innovation from favorites"""
    if user_id in _favorites_db:
        _favorites_db[user_id] = [f for f in _favorites_db[user_id] if f["id"] != fav_id]
    
    return {"success": True, "message": "Removed from favorites"}


@router.patch("/favorites/{fav_id}")
async def update_favorite_notes(fav_id: str, notes: str, user_id: str = "default"):
    """Update notes for a favorite"""
    if user_id in _favorites_db:
        for fav in _favorites_db[user_id]:
            if fav["id"] == fav_id:
                fav["notes"] = notes
                fav["updatedAt"] = datetime.now().isoformat()
                break
    
    return {"success": True, "message": "Notes updated"}


@router.post("/favorites/{fav_id}/generate")
async def generate_from_favorite(fav_id: str, target_venue: str = "NeurIPS", user_id: str = "default"):
    """Start paper generation from a favorite"""
    # Find the favorite
    favorite = None
    if user_id in _favorites_db:
        favorite = next((f for f in _favorites_db[user_id] if f["id"] == fav_id), None)
    
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    # Create a new paper task
    task_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    task = {
        "id": task_id,
        "innovationId": favorite["innovationId"],
        "targetVenue": target_venue,
        "status": "generating",
        "currentStage": "literature_review",
        "progress": 0,
        "createdAt": now,
        "updatedAt": now,
        "favoriteId": fav_id,
        "problemName": favorite["problemName"],
        "methodName": favorite["methodName"]
    }
    
    _tasks_db[task_id] = task
    
    return {
        "success": True,
        "taskId": task_id,
        "message": "Paper generation started",
        "streamUrl": f"/api/v3/paper-tasks/{task_id}/stream"
    }

@router.post("/paper-tasks")
async def create_paper_task(request: CreateTaskRequest):
    """Create a new paper generation task"""
    task_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    task = {
        "id": task_id,
        "innovationId": request.innovationId,
        "targetVenue": request.targetVenue,
        "status": "pending",
        "currentStage": "idle",
        "progress": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    
    _tasks_db[task_id] = task
    
    # Initialize empty experiment slots for this task
    _experiment_slots_db[task_id] = [
        {
            "slotId": "exp_001",
            "name": "主要实验",
            "description": "论文核心实验验证",
            "status": "pending",
            "priority": "high"
        },
        {
            "slotId": "exp_002", 
            "name": "对比实验",
            "description": "与基线方法对比",
            "status": "pending",
            "priority": "medium"
        },
        {
            "slotId": "exp_003",
            "name": "消融实验",
            "description": "消融分析验证各组件贡献",
            "status": "pending",
            "priority": "medium"
        }
    ]
    
    return task

@router.get("/paper-tasks/{task_id}")
async def get_paper_task(task_id: str):
    """Get a paper generation task by ID"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    return _tasks_db[task_id]

@router.post("/paper-tasks/{task_id}/cancel")
async def cancel_paper_task(task_id: str):
    """Cancel a paper generation task"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    _tasks_db[task_id]["status"] = "paused"
    _tasks_db[task_id]["updatedAt"] = datetime.now().isoformat()
    return {"status": "cancelled", "task_id": task_id}

@router.post("/paper-tasks/{task_id}/continue")
async def continue_paper_task(task_id: str):
    """Continue a paused paper generation task"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    _tasks_db[task_id]["status"] = "generating"
    _tasks_db[task_id]["updatedAt"] = datetime.now().isoformat()
    return {"status": "continuing", "task_id": task_id}

@router.get("/paper-tasks/{task_id}/stream")
async def stream_paper_task(task_id: str):
    """Stream paper generation progress via SSE (real generation)"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    if not PAPER_WRITING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper writing engine not available")

    engine = get_writing_engine()
    if not engine:
        raise HTTPException(status_code=503, detail="Paper writing engine failed to initialize")

    async def event_generator():
        task = _tasks_db[task_id]
        task["status"] = "generating"
        task["updatedAt"] = datetime.now().isoformat()

        spec = _build_spec_from_task(task)

        try:
            async for event in engine.stream_generate(spec):
                stage = event.get("stage", "unknown")
                progress = event.get("progress", 0)
                status = event.get("status", "progress")

                # Update task in DB
                task["currentStage"] = stage
                task["progress"] = progress
                task["updatedAt"] = datetime.now().isoformat()

                # Build SSE event
                event_data = {
                    "type": status if status in ("error", "complete") else "progress",
                    "stage": stage,
                    "progress": progress,
                    "message": event.get("message", ""),
                    "timestamp": int(datetime.now().timestamp() * 1000),
                }

                if "preview" in event:
                    event_data["preview"] = event["preview"]

                if status == "complete" and "paper" in event:
                    paper_dict = event["paper"]
                    paper_id = paper_dict["paper_id"]

                    # Store serialized paper
                    _papers_db[paper_id] = paper_dict

                    # Reconstruct and store actual object for later operations
                    try:
                        paper_obj = _dict_to_generated_paper(paper_dict)
                        _paper_objects[paper_id] = paper_obj
                    except Exception as e:
                        logger.warning(f"Could not reconstruct GeneratedPaper: {e}")

                    # Map paper to task
                    task["paperId"] = paper_id
                    task["status"] = "completed"
                    event_data["data"] = paper_dict

                yield f"data: {json.dumps(event_data)}\n\n"

        except Exception as e:
            logger.error(f"Stream generation failed: {e}", exc_info=True)
            task["status"] = "failed"
            error_data = {
                "type": "error",
                "stage": "unknown",
                "progress": 0,
                "message": f"Generation failed: {str(e)}",
                "timestamp": int(datetime.now().timestamp() * 1000),
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        _sse_with_heartbeat(event_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


def _dict_to_generated_paper(data: dict) -> GeneratedPaper:
    """Reconstruct a GeneratedPaper from its dict representation"""
    from app.paper_writing.models import PaperSection, ExperimentSlot, PaperStatus

    sections = {}
    for k, v in data.get("sections", {}).items():
        sections[k] = PaperSection(
            name=v.get("name", k),
            content=v.get("content", ""),
            word_count=v.get("word_count", 0),
            status=v.get("status", "complete"),
        )

    slots = []
    for s in data.get("experiment_slots", []):
        slots.append(
            ExperimentSlot(
                slot_id=s.get("slot_id", ""),
                slot_type=s.get("slot_type", ""),
                description=s.get("description", ""),
                expected_outcome=s.get("expected_outcome", ""),
                estimated_weeks=s.get("estimated_weeks", 1),
                mode=s.get("mode", "pending_assessment"),
                status=s.get("status", "pending"),
                placeholder=s.get("placeholder", ""),
                actual_data=s.get("actual_data"),
                figures=s.get("figures", []),
                submitted_at=s.get("submitted_at"),
            )
        )

    return GeneratedPaper(
        paper_id=data.get("paper_id", ""),
        title=data.get("title", ""),
        abstract=data.get("abstract", ""),
        sections=sections,
        experiment_slots=slots,
        references=data.get("references", []),
        target_venue=data.get("target_venue", "NeurIPS"),
        status=PaperStatus(data.get("status", "draft")),
        latex_content=data.get("latex_content", ""),
        markdown_content=data.get("markdown_content", ""),
        created_at=data.get("created_at", datetime.now().isoformat()),
        updated_at=data.get("updated_at", datetime.now().isoformat()),
        version=data.get("version", 1),
    )

@router.get("/paper-tasks/{task_id}/experiments")
async def get_experiment_slots(task_id: str):
    """Get experiment slots for a task"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    slots = _experiment_slots_db.get(task_id, [])
    return {"slots": slots}

@router.post("/paper-tasks/{task_id}/experiments/{slot_id}")
async def submit_experiment_data_legacy(task_id: str, slot_id: str, body: dict):
    """Submit experiment data for a slot (legacy format)"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    slots = _experiment_slots_db.get(task_id, [])
    for slot in slots:
        if slot["slotId"] == slot_id:
            slot["status"] = "completed"
            slot["submittedData"] = body
            break

    # Update paper record if exists
    paper_id = f"paper_{task_id}"
    if paper_id in _papers_db:
        _papers_db[paper_id]["completedExperiments"] = _papers_db[paper_id].get("completedExperiments", []) + [slot_id]
        _papers_db[paper_id]["updatedAt"] = datetime.now().isoformat()

    return {"status": "submitted", "task_id": task_id, "slot_id": slot_id}


# ==================== NEW: Iteration & Refinement Endpoints ====================

@router.post("/paper-tasks/{task_id}/refine")
async def refine_paper_section(task_id: str, request: RefineRequest):
    """
    Refine a specific section of a paper based on user feedback.

    Input: {"sectionName": "methodology", "feedback": "Make notation more formal"}
    Output: {section_name, original, refined, iteration_id, coherence_warnings}
    """
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    if not PAPER_WRITING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper writing engine not available")

    paper_id = _tasks_db[task_id].get("paperId")
    if not paper_id or paper_id not in _paper_objects:
        raise HTTPException(status_code=404, detail="Paper not found or not yet generated")

    paper = _paper_objects[paper_id]
    engine = get_iteration_engine()
    if not engine:
        raise HTTPException(status_code=503, detail="Iteration engine not available")

    try:
        result = await engine.refine_section(
            paper=paper,
            section_name=request.sectionName,
            feedback=request.feedback,
        )

        # Update the paper object
        if request.sectionName in paper.sections:
            paper.sections[request.sectionName].content = result["refined"]
            paper.version += 1
            paper.updated_at = datetime.now().isoformat()

        # Re-assemble outputs
        from app.paper_writing.engine import PaperWritingEngine as PWE
        pwe = PWE()
        paper.latex_content = pwe._assemble_latex(paper.title, paper.abstract, paper.sections)
        paper.markdown_content = pwe._assemble_markdown(paper.title, paper.abstract, paper.sections)

        # Update stored dict
        _papers_db[paper_id] = paper.to_dict()

        # Track iteration in memory
        if task_id not in _iterations_db:
            _iterations_db[task_id] = []
        iteration_record = {
            "iteration_id": result["iteration_id"],
            "section_name": result["section_name"],
            "feedback": request.feedback,
            "timestamp": datetime.now().isoformat(),
            "coherence_warnings": result.get("coherence_warnings", []),
        }
        _iterations_db[task_id].append(iteration_record)

        # Persist to database
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO paper_iterations
                (id, task_id, iteration_id, section_name, feedback, before_text, after_text, coherence_warnings)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()),
                task_id,
                result["iteration_id"],
                result["section_name"],
                request.feedback,
                result["original"][:2000] if len(result["original"]) > 2000 else result["original"],
                result["refined"][:2000] if len(result["refined"]) > 2000 else result["refined"],
                json.dumps(result.get("coherence_warnings", [])),
            ))
            conn.commit()
            conn.close()
        except Exception as db_err:
            logger.warning(f"Failed to persist iteration to DB: {db_err}")

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Refinement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")


@router.get("/paper-tasks/{task_id}/iterations")
async def get_iterations(task_id: str):
    """Get iteration history for a paper generation task"""
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    iterations = _iterations_db.get(task_id, [])

    # Fallback: load from database if not in memory
    if not iterations:
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT iteration_id, section_name, feedback, coherence_warnings, created_at
                FROM paper_iterations
                WHERE task_id = ?
                ORDER BY created_at DESC
            """, (task_id,))
            rows = cursor.fetchall()
            iterations = [{
                "iteration_id": row["iteration_id"],
                "section_name": row["section_name"],
                "feedback": row["feedback"],
                "timestamp": row["created_at"],
                "coherence_warnings": json.loads(row["coherence_warnings"] or "[]"),
            } for row in rows]
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to load iterations from DB: {e}")

    return {
        "task_id": task_id,
        "iterations": iterations,
        "total": len(iterations),
    }


@router.post("/paper-tasks/{task_id}/experiments/{slot_id}/data")
async def inject_experiment_data(task_id: str, slot_id: str, request: ExperimentDataRequest):
    """
    Inject experiment data into a paper and auto-complete sections.

    Input: {"metrics": {"accuracy": 0.95}, "notes": "..."}
    Output: Updated paper with regenerated experiments/analysis/conclusion
    """
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    if not PAPER_WRITING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paper writing engine not available")

    paper_id = _tasks_db[task_id].get("paperId")
    if not paper_id or paper_id not in _paper_objects:
        raise HTTPException(status_code=404, detail="Paper not found or not yet generated")

    paper = _paper_objects[paper_id]
    injector = get_data_injector()
    if not injector:
        raise HTTPException(status_code=503, detail="Data injector not available")

    try:
        exp_data = ExperimentData(
            slot_id=slot_id,
            metrics=request.metrics,
            tables=request.tables,
            figures=request.figures,
            notes=request.notes,
        )

        updated_paper = await injector.inject_experiment_data(paper, slot_id, exp_data)

        # Update stored objects
        _paper_objects[paper_id] = updated_paper
        _papers_db[paper_id] = updated_paper.to_dict()

        # Update task status
        _tasks_db[task_id]["status"] = updated_paper.status.value
        _tasks_db[task_id]["updatedAt"] = datetime.now().isoformat()

        return {
            "status": "injected",
            "task_id": task_id,
            "slot_id": slot_id,
            "paper_status": updated_paper.status.value,
            "paper": updated_paper.to_dict(),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Data injection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Data injection failed: {str(e)}")


@router.post("/paper-tasks/{task_id}/complete")
async def complete_paper(task_id: str):
    """
    Finalize a paper with all experiment data injected.
    Regenerates all sections and produces final outputs.
    """
    if task_id not in _tasks_db:
        raise HTTPException(status_code=404, detail="Task not found")

    paper_id = _tasks_db[task_id].get("paperId")
    if not paper_id or paper_id not in _paper_objects:
        raise HTTPException(status_code=404, detail="Paper not found or not yet generated")

    paper = _paper_objects[paper_id]

    # Check if all slots are complete
    all_complete = all(s.status == "completed" for s in paper.experiment_slots)
    if not all_complete:
        pending = [s.slot_id for s in paper.experiment_slots if s.status != "completed"]
        raise HTTPException(
            status_code=400,
            detail=f"Not all experiment slots are complete. Pending: {pending}"
        )

    paper.status = PaperStatus.COMPLETED
    paper.updated_at = datetime.now().isoformat()
    paper.version += 1

    _papers_db[paper_id] = paper.to_dict()
    _tasks_db[task_id]["status"] = "completed"
    _tasks_db[task_id]["updatedAt"] = datetime.now().isoformat()

    return {
        "status": "completed",
        "task_id": task_id,
        "paper_id": paper_id,
        "paper": paper.to_dict(),
    }


# Paper Repository endpoints
@router.get("/papers")
async def list_papers():
    """List all papers in the repository"""
    papers = list(_papers_db.values())
    return {"papers": papers, "total": len(papers)}

@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str):
    """Get a paper by ID"""
    if paper_id not in _papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    return _papers_db[paper_id]


@router.get("/papers/{paper_id}/sections")
async def get_paper_sections(paper_id: str):
    """Get paper sections"""
    if paper_id not in _papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper = _papers_db[paper_id]
    return {
        "paper_id": paper_id,
        "title": paper.get("title", ""),
        "sections": paper.get("sections", {}),
        "experiment_slots": paper.get("experiment_slots", []),
    }

@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str):
    """Delete a paper"""
    if paper_id not in _papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    del _papers_db[paper_id]
    return {"status": "deleted", "paper_id": paper_id}

@router.patch("/papers/{paper_id}/status")
async def update_paper_status(paper_id: str, body: dict):
    """Update paper status"""
    if paper_id not in _papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    status = body.get("status", "draft")
    _papers_db[paper_id]["status"] = status
    _papers_db[paper_id]["updatedAt"] = datetime.now().isoformat()
    
    return {"status": "updated", "paper_id": paper_id, "new_status": status}

@router.get("/papers/{paper_id}/download")
async def download_paper(paper_id: str, format: str = Query("md")):
    """Download paper in specified format"""
    if paper_id not in _papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = _papers_db[paper_id]
    sections = paper.get("sections", {})
    title = paper.get("title", "Untitled")
    abstract = paper.get("abstract", "")

    if format == "md":
        md_parts = [f"# {title}", "", "## Abstract", abstract, ""]
        section_order = [
            ("introduction", "1. Introduction"),
            ("related_work", "2. Related Work"),
            ("methodology", "3. Methodology"),
            ("experiment_design", "4. Experimental Setup"),
            ("analysis", "5. Results and Analysis"),
            ("conclusion", "6. Conclusion"),
        ]
        for key, heading in section_order:
            sec = sections.get(key)
            if sec and sec.get("content", "").strip():
                md_parts.extend([f"## {heading}", "", sec.get("content", ""), ""])

        md_parts.extend([
            "## References",
            "[References to be added]",
            "",
            f"---",
            f"*Generated by Research-Nexus Pro — {datetime.now().strftime('%Y-%m-%d')}*",
        ])
        md_content = "\n".join(md_parts)

        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(
            content=md_content,
            headers={"Content-Disposition": f"attachment; filename=paper_{paper_id}.md"}
        )

    elif format == "tex":
        latex_sections = []
        section_order = [
            ("introduction", "Introduction"),
            ("related_work", "Related Work"),
            ("methodology", "Methodology"),
            ("experiment_design", "Experimental Setup"),
            ("analysis", "Results and Analysis"),
            ("conclusion", "Conclusion"),
        ]
        for key, heading in section_order:
            sec = sections.get(key)
            if sec and sec.get("content", "").strip():
                content = sec.get("content", "")
                content = content.replace("&", "\\&").replace("%", "\\%")
                content = content.replace("#", "\\#").replace("_", "\\_")
                latex_sections.append(f"\\section{{{heading}}}\n{content}")

        safe_title = title.replace("&", "\\&").replace("%", "\\%")
        tex_content = f"""\\documentclass[9pt]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{amsmath,amssymb,amsfonts}}
\\usepackage{{graphicx}}
\\usepackage{{hyperref}}

\\title{{{safe_title}}}
\\author{{[Authors to be filled]}}
\\date{{\\today}}

\\begin{{document}}

\\maketitle

\\begin{{abstract}}
{abstract}
\\end{{abstract}}

{chr(10).join(latex_sections)}

\\section*{{References}}
[References to be added]

\\end{{document}}
"""
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(
            content=tex_content,
            headers={"Content-Disposition": f"attachment; filename=paper_{paper_id}.tex"}
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")


# ==================== FAVORITES API ====================

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "research_graph.db")

def dict_from_row(row) -> dict:
    """Convert sqlite row to dict"""
    return dict(zip([col[0] for col in row.keys()], row))

@router.get("/favorites")
async def get_favorites():
    """Get all favorited innovations - returns full InnovationPoint structure"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM innovation_favorites
            ORDER BY created_at DESC
        """)
        
        rows = cursor.fetchall()
        favorites = []
        for row in rows:
            # Parse stored JSON
            innovation_data = {}
            if row["innovation_id"]:
                try:
                    innovation_data = json.loads(row["innovation_id"]) if isinstance(row["innovation_id"], str) else {}
                except:
                    innovation_data = {"id": row["innovation_id"], "name": "", "description": ""}
            
            favorites.append({
                "id": row["id"],
                "innovation": innovation_data,
                "notes": row["notes"] or "",
                "createdAt": row["created_at"],
                "status": row["status"] or "active"
            })
        
        conn.close()
        return {"favorites": favorites, "total": len(favorites)}
    except Exception as e:
        logger.error(f"Error fetching favorites: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/favorites")
async def add_favorite(body: dict):
    """Add an innovation to favorites - accepts full InnovationPoint"""
    try:
        innovation = body.get("innovation", {})
        notes = body.get("notes", "")
        
        # Serialize innovation to JSON
        innovation_json = json.dumps(innovation, ensure_ascii=False)
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if already exists
        cursor.execute("""
            SELECT id FROM innovation_favorites 
            WHERE innovation_id LIKE ?
        """, (f'%"id": "{innovation.get("id", "")}"%',))
        
        existing = cursor.fetchone()
        if existing:
            conn.close()
            return {"status": "already_exists", "id": existing[0], "innovation": innovation}
        
        # Insert new favorite
        favorite_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO innovation_favorites 
            (id, user_id, innovation_id, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (favorite_id, "default_user", innovation_json, "active", notes, now, now))
        
        conn.commit()
        conn.close()
        
        return {
            "status": "added", 
            "id": favorite_id, 
            "innovation": innovation,
            "notes": notes,
            "createdAt": now
        }
    except Exception as e:
        logger.error(f"Error adding favorite: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/favorites/{favorite_id}")
async def remove_favorite(favorite_id: str):
    """Remove an innovation from favorites"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM innovation_favorites WHERE id = ?", (favorite_id,))
        conn.commit()
        deleted = cursor.rowcount
        conn.close()
        
        return {"status": "deleted" if deleted > 0 else "not_found", "deleted": deleted}
    except Exception as e:
        logger.error(f"Error removing favorite: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== NEW SERVICES API ====================

# Import new services
from app.services.experiment_guide_generator import ExperimentGuideGenerator, generate_experiment_guide
from app.services.innovation_validation_engine import InnovationValidationEngine, validate_innovation
from app.services.auto_completion_service import AutoCompletionService, complete_paper_sections

# Service instances for new modules
_guide_generator: Optional[ExperimentGuideGenerator] = None
_validation_engine: Optional[InnovationValidationEngine] = None
_completion_service: Optional[AutoCompletionService] = None


def get_guide_generator() -> ExperimentGuideGenerator:
    """Get or create experiment guide generator"""
    global _guide_generator
    if _guide_generator is None:
        try:
            kimi = KimiExtractor()
            _guide_generator = ExperimentGuideGenerator(llm_client=kimi.client)
        except Exception as e:
            logger.warning(f"Could not initialize guide generator: {e}")
            _guide_generator = ExperimentGuideGenerator(llm_client=None)
    return _guide_generator


def get_validation_engine() -> InnovationValidationEngine:
    """Get or create validation engine"""
    global _validation_engine
    if _validation_engine is None:
        try:
            kimi = KimiExtractor()
            _validation_engine = InnovationValidationEngine(llm_client=kimi.client)
        except Exception as e:
            logger.warning(f"Could not initialize validation engine: {e}")
            _validation_engine = InnovationValidationEngine(llm_client=None)
    return _validation_engine


def get_completion_service() -> AutoCompletionService:
    """Get or create completion service"""
    global _completion_service
    if _completion_service is None:
        try:
            kimi = KimiExtractor()
            _completion_service = AutoCompletionService(llm_client=kimi.client)
        except Exception as e:
            logger.warning(f"Could not initialize completion service: {e}")
            _completion_service = AutoCompletionService(llm_client=None)
    return _completion_service


# ==================== Module 3: Experiment Guide Generator ====================

@router.post("/experiment-guide/generate")
async def generate_experiment_guide_endpoint(body: dict):
    """
    Generate experiment guide for an innovation point.
    
    Input: {
        "innovation_id": "...",
        "candidate_methods": ["..."],
        "target_venue": "NeurIPS"
    }
    
    Returns: {
        "experiment_name": "...",
        "materials_list": [...],
        "steps": [...],
        "cautions": [...],
        "expected_results": "...",
        "acceptance_criteria": [...]
    }
    """
    try:
        innovation_id = body.get("innovation_id")
        candidate_methods = body.get("candidate_methods", [])
        target_venue = body.get("target_venue", "NeurIPS")
        
        if not innovation_id:
            raise HTTPException(status_code=400, detail="innovation_id is required")
        
        generator = get_guide_generator()
        guide = await generator.generate_guide(
            innovation_id=innovation_id,
            candidate_methods=candidate_methods,
            target_venue=target_venue
        )
        
        validation = generator.validate_guide(guide)
        
        return {
            "success": True,
            "guide": guide,
            "validation": validation
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate experiment guide: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Module 4: Innovation Validation Engine ====================

@router.post("/innovation/validate")
async def validate_innovation_endpoint(body: dict):
    """
    Validate an innovation point for feasibility and uncertainties.
    
    Input: {
        "innovation_id": "...",
        "include_uncertainty_analysis": true,
        "include_validation_experiments": true
    }
    
    Returns: {
        "feasibility": {"overall_score": 0.85, ...},
        "uncertainties": [...],
        "validation_experiments": [...],
        "annotations": [...],
        "summary": {...}
    }
    """
    try:
        innovation_id = body.get("innovation_id")
        include_uncertainty = body.get("include_uncertainty_analysis", True)
        include_experiments = body.get("include_validation_experiments", True)
        
        if not innovation_id:
            raise HTTPException(status_code=400, detail="innovation_id is required")
        
        engine = get_validation_engine()
        result = await engine.validate(
            innovation_id=innovation_id,
            include_uncertainty_analysis=include_uncertainty,
            include_validation_experiments=include_experiments
        )
        return {
            "success": True,
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate innovation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Module 5: Auto Completion Service ====================

@router.post("/paper/{paper_id}/complete")
async def complete_paper_sections_endpoint(
    paper_id: str,
    body: dict
):
    """
    Auto-complete paper sections with experimental data.
    
    Input: {
        "experiment_data": {...},
        "sections_to_complete": ["experiments", "analysis"]
    }
    
    Returns: {
        "status": "success|partial|failed",
        "completed_sections": [...],
        "completed_paper": {...},
        "ready_for_submission": true|false
    }
    """
    try:
        experiment_data = body.get("experiment_data", {})
        sections_to_complete = body.get("sections_to_complete")
        
        service = get_completion_service()
        result = await service.complete_paper(
            paper_id=paper_id,
            experiment_data=experiment_data,
            sections_to_complete=sections_to_complete
        )
        return result
    except Exception as e:
        logger.error(f"Failed to complete paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/paper/{paper_id}/complete/preview")
async def preview_completion_endpoint(
    paper_id: str,
    body: dict
):
    """Preview completion for a section without saving"""
    try:
        experiment_data = body.get("experiment_data", {})
        section = body.get("section")
        
        if not section:
            raise HTTPException(status_code=400, detail="section is required")
        
        service = get_completion_service()
        result = service.preview_completion(paper_id, experiment_data, section)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to preview completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services/health")
async def services_health_check():
    """Check if all paper generation services are healthy"""
    services = {
        "paper_generation": _legacy_engine is not None,
        "writing_engine": _writing_engine is not None,
        "iteration_engine": _iteration_engine is not None,
        "data_injector": _data_injector is not None,
        "guide_generator": _guide_generator is not None,
        "validation_engine": _validation_engine is not None,
        "completion_service": _completion_service is not None,
    }
    
    return {
        "status": "healthy" if all(services.values()) else "degraded",
        "services": services,
        "timestamp": datetime.now().isoformat()
    }

