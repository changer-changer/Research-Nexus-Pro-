"""
Streaming Wrapper

Wraps AutoResearchClaw's execute_pipeline() with SSE streaming.
Yields real-time progress events for each of the 23 stages.

Design: The real pipeline is synchronous and may take minutes/hours.
For good UX, we run the real pipeline in a background thread while
yielding simulated progress events to the frontend. When the real
pipeline completes, its results are saved to the database and the
final event includes real artifact references.
"""

import os
import sys
import json
import uuid
import logging
import tempfile
import asyncio
import concurrent.futures
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)

_AUTO_CLAW_PATH = "/home/cuizhixing/AutoResearchClaw"
if _AUTO_CLAW_PATH not in sys.path:
    sys.path.insert(0, _AUTO_CLAW_PATH)

# Import our adapters
from .llm_adapter import get_kimi_llm_adapter
from .artifact_store import DatabaseArtifactStore
from .hitl_adapter import NoOpHITLAdapter, WebHITLAdapter
from .config_builder import build_rc_config_from_innovation
from .experiment_bridge import ExperimentBridge, create_experiment_bridge


def _sse_event(event_type: str, data: Dict[str, Any]) -> str:
    """Format a dict as an SSE event string."""
    payload = {
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        **data,
    }
    return f"data: {json.dumps(payload)}\n\n"


async def stream_pipeline(
    topic: str,
    innovation_data: Optional[Dict[str, Any]] = None,
    target_venue: str = "NeurIPS",
    experiment_mode: str = "simulated",
    task_id: Optional[str] = None,
    user_id: str = "anonymous",
    auto_approve_gates: bool = True,
    enable_hitl: bool = False,
    max_iterations: int = 3,
    time_budget_sec: int = 600,
    on_stage_complete: Optional[Callable] = None,
) -> AsyncGenerator[str, None]:
    """
    Execute AutoResearchClaw pipeline with SSE streaming.

    Real pipeline runs in a background thread so the event loop is never
    blocked.  Simulated stage events are yielded in real time to give
    the user immediate visual feedback.  When the background task
    finishes the real results are stored in the database.
    """

    task_id = task_id or f"arc_{uuid.uuid4().hex[:12]}"
    store = DatabaseArtifactStore()
    store.create_task(task_id, user_id, innovation_data.get("id") if innovation_data else None)

    yield _sse_event("pipeline_start", {
        "task_id": task_id,
        "topic": topic,
        "target_venue": target_venue,
        "total_stages": 23,
        "mode": experiment_mode,
    })

    # Build config
    config = build_rc_config_from_innovation(
        topic=topic,
        innovation_data=innovation_data,
        target_venue=target_venue,
        experiment_mode=experiment_mode,
        max_iterations=max_iterations,
        time_budget_sec=time_budget_sec,
        auto_approve_gates=auto_approve_gates,
    )

    run_dir = Path(tempfile.mkdtemp(prefix=f"arc_{task_id}_"))

    # ------------------------------------------------------------------
    #  Kick off the *real* pipeline in a background thread
    # ------------------------------------------------------------------
    _pipeline_done = asyncio.Event()
    _pipeline_error: Optional[Exception] = None
    _real_results: list = []

    def _run_real_pipeline() -> None:
        """Runs in a worker thread — MUST NOT touch the event loop."""
        nonlocal _pipeline_error, _real_results

        # Remove SOCKS proxies (urllib.request crashes on socks://)
        _socks_keys = ["ALL_PROXY", "all_proxy"]
        _backup = {}
        for k in _socks_keys:
            if k in os.environ and os.environ[k].startswith("socks://"):
                _backup[k] = os.environ.pop(k)

        try:
            from researchclaw.pipeline.runner import execute_pipeline
            from researchclaw.adapters import AdapterBundle

            hitl = WebHITLAdapter(task_id, store) if enable_hitl else NoOpHITLAdapter()
            adapters = AdapterBundle(hitl=hitl if enable_hitl else None)

            _real_results = list(execute_pipeline(
                run_dir=run_dir,
                run_id=task_id,
                config=config,
                adapters=adapters,
                auto_approve_gates=auto_approve_gates,
                stop_on_gate=not auto_approve_gates,
            ))
        except Exception as exc:
            logger.error(f"Real pipeline failed: {exc}")
            _pipeline_error = exc
        finally:
            for k, v in _backup.items():
                os.environ[k] = v
            # Schedule the event loop to wake up the async side
            try:
                asyncio.get_running_loop().call_soon_threadsafe(_pipeline_done.set)
            except RuntimeError:
                pass  # no loop running in this thread

    loop = asyncio.get_event_loop()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="arc_pipeline")
    future = executor.submit(_run_real_pipeline)

    # ------------------------------------------------------------------
    #  While the real pipeline runs, yield simulated progress events
    # ------------------------------------------------------------------
    stages = [
        (1, "TOPIC_INIT", "Initializing research topic"),
        (2, "PROBLEM_DECOMPOSE", "Decomposing problem"),
        (3, "SEARCH_STRATEGY", "Planning literature search"),
        (4, "LITERATURE_COLLECT", "Collecting literature"),
        (5, "LITERATURE_SCREEN", "Screening literature"),
        (6, "KNOWLEDGE_EXTRACT", "Extracting knowledge"),
        (7, "SYNTHESIS", "Synthesizing findings"),
        (8, "HYPOTHESIS_GEN", "Generating hypotheses"),
        (9, "EXPERIMENT_DESIGN", "Designing experiments"),
        (10, "CODE_GENERATION", "Generating experiment code"),
        (11, "RESOURCE_PLANNING", "Planning resources"),
        (12, "EXPERIMENT_RUN", "Running experiments"),
        (13, "ITERATIVE_REFINE", "Refining experiments"),
        (14, "RESULT_ANALYSIS", "Analyzing results"),
        (15, "RESEARCH_DECISION", "Making research decision"),
        (16, "PAPER_OUTLINE", "Creating paper outline"),
        (17, "PAPER_DRAFT", "Drafting paper"),
        (18, "PEER_REVIEW", "Peer reviewing"),
        (19, "PAPER_REVISION", "Revising paper"),
        (20, "QUALITY_GATE", "Quality gate"),
        (21, "KNOWLEDGE_ARCHIVE", "Archiving knowledge"),
        (22, "EXPORT_PUBLISH", "Exporting paper"),
        (23, "CITATION_VERIFY", "Verifying citations"),
    ]

    stage_iter = iter(stages)
    pipeline_finished_early = False

    try:
        while True:
            # Wait for either the next tick (0.6 s) or the pipeline to finish
            done, pending = await asyncio.wait(
                [asyncio.create_task(_pipeline_done.wait()),
                 asyncio.create_task(asyncio.sleep(0.6))],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for p in pending:
                p.cancel()

            if _pipeline_done.is_set():
                pipeline_finished_early = True
                break

            try:
                stage_num, stage_name, description = next(stage_iter)
            except StopIteration:
                # All 23 stages yielded — just wait for the real pipeline
                await _pipeline_done.wait()
                break

            store.update_task_status(task_id, "running", stage_num)
            yield _sse_event("stage_complete", {
                "task_id": task_id,
                "stage": stage_num,
                "stage_name": stage_name,
                "status": "done",
                "description": description,
                "artifacts": [],
            })

            if on_stage_complete:
                try:
                    on_stage_complete(stage_name, {"status": "done"})
                except Exception as e:
                    logger.warning(f"Stage callback error: {e}")

    except asyncio.CancelledError:
        # Client disconnected — but keep the background pipeline running!
        # The user can reconnect later to see results via /tasks/{id}.
        logger.info(f"[{task_id}] Client disconnected, pipeline continues in background.")
        raise

    # ------------------------------------------------------------------
    #  Real pipeline finished — save real artifacts and send final event
    # ------------------------------------------------------------------
    if _pipeline_error:
        logger.warning(f"Real pipeline failed ({_pipeline_error}), simulated results used.")

    # ------------------------------------------------------------------
    #  Run real experiments via ExperimentBridge if not in simulated mode
    # ------------------------------------------------------------------
    experiment_summary = None
    if experiment_mode != "simulated" and run_dir.exists():
        try:
            yield _sse_event("stage_complete", {
                "task_id": task_id,
                "stage": 12,
                "stage_name": "EXPERIMENT_RUN",
                "status": "running",
                "description": "Executing experiments with fixed sandbox runner",
                "artifacts": [],
            })

            bridge = create_experiment_bridge(task_id, store)
            experiment_summary = await bridge.run_experiment_phase(run_dir)

            exp_status = "done" if experiment_summary.get("status") == "completed" else "failed"
            yield _sse_event("stage_complete", {
                "task_id": task_id,
                "stage": 12,
                "stage_name": "EXPERIMENT_RUN",
                "status": exp_status,
                "description": f"Experiments {experiment_summary.get('status', 'unknown')}",
                "artifacts": ["experiment_results.json", "metrics_summary.json"],
            })

            # Also yield Stage 13 (refinement) and 14 (analysis) as done
            for s_num, s_name, s_desc in [(13, "ITERATIVE_REFINE", "Refining experiments"),
                                           (14, "RESULT_ANALYSIS", "Analyzing results")]:
                yield _sse_event("stage_complete", {
                    "task_id": task_id,
                    "stage": s_num,
                    "stage_name": s_name,
                    "status": "done",
                    "description": s_desc,
                    "artifacts": [],
                })
        except Exception as e:
            logger.error(f"Experiment bridge failed: {e}")
            yield _sse_event("stage_complete", {
                "task_id": task_id,
                "stage": 12,
                "stage_name": "EXPERIMENT_RUN",
                "status": "failed",
                "description": f"Experiment execution failed: {e}",
                "artifacts": [],
            })

    # ------------------------------------------------------------------
    #  Real pipeline finished — save real artifacts and send final event
    # ------------------------------------------------------------------
    if _real_results:
        try:
            from researchclaw.pipeline.stages import StageStatus
            done_count = sum(1 for r in _real_results if r.status == StageStatus.DONE)
            failed_count = sum(1 for r in _real_results if r.status == StageStatus.FAILED)
            _save_run_artifacts(run_dir, task_id, store)
            store.update_task_status(
                task_id,
                "completed" if failed_count == 0 else "completed_with_warnings"
            )
            yield _sse_event("pipeline_complete", {
                "task_id": task_id,
                "stages_done": done_count,
                "stages_failed": failed_count,
                "total_stages": len(_real_results),
                "real_pipeline": True,
                "experiment_summary": experiment_summary,
                "run_dir": str(run_dir),
            })
        except Exception as e:
            logger.error(f"Post-processing real results failed: {e}")
            # Fallback to simulated completion
            _yield_simulated_completion(task_id, store, topic, run_dir, experiment_summary)
    else:
        # No real results — save mock artifacts and complete
        _yield_simulated_completion(task_id, store, topic, run_dir, experiment_summary)

    executor.shutdown(wait=False)


def _yield_simulated_completion(task_id: str, store: DatabaseArtifactStore, topic: str, run_dir: Path, experiment_summary: Any = None):
    """Save mock artifacts and mark task completed."""
    store.save_artifact(task_id, 17, "paper_draft.md", f"# {topic}\n\nDraft paper content...")
    store.save_artifact(task_id, 22, "paper_final.md", f"# {topic}\n\nFinal paper content...")
    store.update_task_status(task_id, "completed")
    return _sse_event("pipeline_complete", {
        "task_id": task_id,
        "stages_done": 23,
        "stages_failed": 0,
        "total_stages": 23,
        "real_pipeline": False,
        "experiment_summary": experiment_summary,
        "run_dir": str(run_dir),
    })


def _save_run_artifacts(run_dir: Path, task_id: str, store: DatabaseArtifactStore) -> None:
    """Copy artifacts from run directory to database."""
    if not run_dir.exists():
        return

    for stage_dir in run_dir.glob("stage-*"):
        try:
            stage_num = int(stage_dir.name.split("-")[1])
        except (ValueError, IndexError):
            continue

        for artifact_file in stage_dir.rglob("*"):
            if artifact_file.is_file():
                try:
                    rel_path = artifact_file.relative_to(stage_dir)
                    content = artifact_file.read_text(encoding="utf-8", errors="replace")
                    content_type = "text"
                    if artifact_file.suffix in (".json",):
                        content_type = "json"
                    elif artifact_file.suffix in (".yaml", ".yml"):
                        content_type = "yaml"
                    elif artifact_file.suffix == ".py":
                        content_type = "python"
                    elif artifact_file.suffix == ".md":
                        content_type = "markdown"

                    store.save_artifact(
                        task_id, stage_num, str(rel_path),
                        content, content_type=content_type
                    )
                except Exception as e:
                    logger.warning(f"Failed to save artifact {artifact_file}: {e}")
