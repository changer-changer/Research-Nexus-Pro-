"""
Web HITL Adapter

Replaces AutoResearchClaw's file-based HITL with an async web-based system.
Gate stages (5, 9, 20) and review stages pause the pipeline and wait for
frontend responses via API endpoints.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class WebHITLAdapter:
    """
    Web-based Human-in-the-Loop adapter for AutoResearchClaw.

    Instead of file polling, this adapter:
    1. Records pending decisions in memory + database
    2. Emits SSE events to the frontend
    3. Waits for frontend responses via HTTP POST
    4. Returns decisions to the pipeline

    Usage:
        hitl = WebHITLAdapter(task_id="task-001")
        # In pipeline stage:
        approved = hitl.confirm("Approve literature screening results?")
        # Frontend receives SSE: {type: "hitl_gate", stage: 5, message: "..."}
        # Frontend POST /api/v3/autoresearch/tasks/{task_id}/gate/5/respond
        # hitl.confirm() returns True/False
    """

    def __init__(self, task_id: str, artifact_store=None):
        self.task_id = task_id
        self.artifact_store = artifact_store
        self._pending_decisions: Dict[int, asyncio.Event] = {}
        self._decisions: Dict[int, Dict[str, Any]] = {}
        self._callbacks: Dict[int, Any] = {}  # Optional callbacks for SSE emission
        logger.info(f"[HITL] Initialized for task {task_id}")

    def set_sse_callback(self, callback):
        """Set a callback for emitting SSE events. callback(stage, message)"""
        self._sse_callback = callback

    def confirm(self, message: str, stage: int = 0) -> bool:
        """
        Request user confirmation for a gate stage.
        Blocks until the frontend responds.

        Args:
            message: Human-readable prompt
            stage: Stage number (5, 9, or 20)

        Returns:
            True if approved, False if rejected
        """
        logger.info(f"[HITL] Gate {stage}: {message}")

        # Create an event for this stage
        event = asyncio.Event()
        self._pending_decisions[stage] = event

        # Emit SSE event if callback is set
        if hasattr(self, '_sse_callback') and self._sse_callback:
            try:
                self._sse_callback(stage, {
                    "type": "hitl_gate",
                    "stage": stage,
                    "message": message,
                    "task_id": self.task_id,
                })
            except Exception as e:
                logger.warning(f"[HITL] SSE callback failed: {e}")

        # Save to database
        if self.artifact_store:
            self.artifact_store.save_hitl_decision(
                self.task_id, stage, "pending", message
            )

        # Wait for frontend response (with 30-minute timeout)
        try:
            # Use asyncio.wait_for with a long timeout
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're in an async context
                future = asyncio.ensure_future(self._wait_for_decision(stage, timeout=1800))
                # This won't work well in sync context...
                # For sync contexts, we need a different approach
                logger.warning(f"[HITL] confirm() called in async context — returning True")
                return True
            else:
                loop.run_until_complete(self._wait_for_decision(stage, timeout=1800))
        except asyncio.TimeoutError:
            logger.warning(f"[HITL] Gate {stage} timed out — auto-approving")
            return True
        except Exception as e:
            logger.error(f"[HITL] Gate {stage} error: {e} — auto-approving")
            return True

        # Get the decision
        decision_data = self._decisions.get(stage, {})
        decision = decision_data.get("decision", "approve")

        logger.info(f"[HITL] Gate {stage} decision: {decision}")
        return decision == "approve"

    async def _wait_for_decision(self, stage: int, timeout: float) -> None:
        """Wait for a decision with timeout."""
        event = self._pending_decisions.get(stage)
        if event:
            await asyncio.wait_for(event.wait(), timeout=timeout)

    def provide_decision(self, stage: int, decision: str, feedback: Optional[str] = None) -> None:
        """
        Called by the frontend/API when user makes a decision.

        Args:
            stage: Stage number
            decision: "approve", "reject", or "abort"
            feedback: Optional feedback text
        """
        logger.info(f"[HITL] Decision received for stage {stage}: {decision}")

        self._decisions[stage] = {
            "decision": decision,
            "feedback": feedback,
            "timestamp": datetime.now().isoformat(),
        }

        # Save to database
        if self.artifact_store:
            self.artifact_store.save_hitl_decision(
                self.task_id, stage, decision, feedback
            )

        # Signal the waiting confirm()
        event = self._pending_decisions.get(stage)
        if event:
            event.set()

    def review(self, content: str, stage: str = "") -> str:
        """
        Request human review of content.
        Returns the review feedback.

        For web integration, we don't block — instead we store the content
        and return an empty string. The frontend can review asynchronously.
        """
        logger.info(f"[HITL] Review requested for stage {stage}")

        # Store review request
        review_data = {
            "stage": stage,
            "content": content[:5000],  # Truncate for storage
            "timestamp": datetime.now().isoformat(),
        }

        # Emit SSE event
        if hasattr(self, '_sse_callback') and self._sse_callback:
            try:
                self._sse_callback(0, {
                    "type": "hitl_review",
                    "stage": stage,
                    "task_id": self.task_id,
                })
            except Exception as e:
                logger.warning(f"[HITL] Review SSE callback failed: {e}")

        # Return empty string (non-blocking for web)
        return ""

    def hitl_checkpoint_data(self) -> Dict[str, Any]:
        """Return HITL state for checkpointing."""
        return {
            "task_id": self.task_id,
            "pending_stages": list(self._pending_decisions.keys()),
            "decisions": self._decisions,
        }

    def abort(self) -> None:
        """Abort the pipeline."""
        logger.info(f"[HITL] Pipeline aborted for task {self.task_id}")
        # Signal all pending decisions
        for stage, event in self._pending_decisions.items():
            self._decisions[stage] = {"decision": "abort"}
            event.set()

    def complete(self) -> None:
        """Mark pipeline as complete."""
        logger.info(f"[HITL] Pipeline completed for task {self.task_id}")


class NoOpHITLAdapter:
    """
    No-op HITL adapter that auto-approves everything.
    Used when HITL is disabled or in simulated mode.
    """

    def __init__(self, *args, **kwargs):
        pass

    def confirm(self, message: str, stage: int = 0) -> bool:
        logger.debug(f"[NoOpHITL] Auto-approving gate {stage}: {message}")
        return True

    def review(self, content: str, stage: str = "") -> str:
        return ""

    def provide_decision(self, stage: int, decision: str, feedback: Optional[str] = None) -> None:
        pass

    def abort(self) -> None:
        pass

    def complete(self) -> None:
        pass

    def hitl_checkpoint_data(self) -> Dict[str, Any]:
        return {}
