"""
Experiment Bridge

Connects Research-Nexus Pro's fixed experiment_runner.py to AutoResearchClaw's
23-stage pipeline. AutoResearchClaw's built-in experiment runner has critical bugs
(markdown fence injection, dummy Docker results, hardcoded timeouts). This bridge:

1. Configures AutoResearchClaw to use "simulated" experiment mode
2. After Stage 10 (CODE_GENERATION), extracts generated code from artifacts
3. Runs our fixed ExperimentRunner with proper sanitization and sandboxing
4. Injects results back into the pipeline artifacts for Stage 14 (RESULT_ANALYSIS)
5. Connects data_injector.py to auto-complete paper sections with real results

Usage:
    from .experiment_bridge import ExperimentBridge
    bridge = ExperimentBridge(task_id, store)
    bridge.run_experiment_phase(run_dir)  # Called after Stage 10 completes
"""

import os
import sys
import json
import logging
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Import our fixed experiment runner
from app.autoresearch_claw.experiment_runner import (
    ExperimentRunner,
    ExperimentConfig,
    ExperimentStatus,
    get_runner,
)

# Import data injector for post-experiment paper completion
try:
    from app.paper_writing.data_injector import DataInjector
    from app.paper_writing.models import ExperimentData
    DATA_INJECTOR_AVAILABLE = True
except ImportError:
    DATA_INJECTOR_AVAILABLE = False
    logger.warning("DataInjector not available, paper auto-completion disabled")


class ExperimentBridge:
    """
    Bridges AutoResearchClaw's pipeline with our fixed experiment execution.

    AutoResearchClaw is configured with experiment_mode="simulated" so it
    generates experiment designs and code but doesn't execute. This bridge
    takes over at Stage 12 to run experiments safely, then at Stage 14
    to inject results into the paper.
    """

    def __init__(
        self,
        task_id: str,
        artifact_store: Any,
        workspace_dir: Optional[str] = None,
        feasibility_result: Optional[Dict[str, Any]] = None,
    ):
        self.task_id = task_id
        self.store = artifact_store
        self.feasibility = feasibility_result or {}
        self.workspace_dir = workspace_dir or f"/tmp/arc_bridge_{task_id}"

        # Initialize our fixed runner
        config = ExperimentConfig(
            timeout_sec=3600,
            max_retries=3,
            metric_key="accuracy",
            workspace_dir=self.workspace_dir,
        )
        self.runner = ExperimentRunner(config=config)
        self.results: List[Dict[str, Any]] = []

        if DATA_INJECTOR_AVAILABLE:
            self.data_injector = DataInjector()
        else:
            self.data_injector = None

    async def run_experiment_phase(self, run_dir: Path) -> Dict[str, Any]:
        """
        Execute the experiment phase (Stages 12-13) using our fixed runner.

        This should be called after AutoResearchClaw completes Stage 10
        (CODE_GENERATION) and before Stage 14 (RESULT_ANALYSIS).

        Args:
            run_dir: The pipeline run directory where AutoResearchClaw wrote
                     stage artifacts (e.g., run_dir/stage-10/experiment/main.py)

        Returns:
            Summary dict with experiment results and status
        """
        logger.info(f"[{self.task_id}] Experiment bridge starting experiment phase")

        # 1. Extract generated code from Stage 10 artifacts
        code = self._extract_code_from_artifacts(run_dir)
        if not code:
            logger.warning(f"[{self.task_id}] No code found in Stage 10 artifacts, skipping experiment")
            return {
                "status": "skipped",
                "reason": "no_code_found",
                "results": [],
            }

        # 2. Extract requirements if any
        requirements = self._extract_requirements(run_dir)

        # 3. Run experiment with our fixed runner
        logger.info(f"[{self.task_id}] Running experiment with fixed runner")
        result = await self.runner.run_experiment(
            code=code,
            requirements=requirements,
            experiment_id=f"{self.task_id}_exp",
            feasibility_result=self.feasibility,
        )

        self.results.append(result.to_dict())

        # 4. Save results as artifacts for later stages
        self._save_experiment_artifacts(run_dir, result)

        # 5. Determine status
        status = "completed" if result.status == ExperimentStatus.COMPLETED else "failed"

        summary = {
            "status": status,
            "run_id": result.run_id,
            "primary_metric": result.primary_metric,
            "metrics": result.metrics,
            "elapsed_sec": result.elapsed_sec,
            "stdout_preview": result.stdout[:500] if result.stdout else "",
            "stderr_preview": result.stderr[:500] if result.stderr else "",
            "error": result.error,
            "output_files": result.output_files,
        }

        logger.info(
            f"[{self.task_id}] Experiment phase complete: status={status}, "
            f"metric={result.primary_metric}, elapsed={result.elapsed_sec:.1f}s"
        )

        return summary

    async def inject_results_into_paper(
        self,
        paper: Any,
        slot_id: str = "exp_001",
    ) -> Optional[Any]:
        """
        Inject experiment results into a paper using DataInjector.

        Called after experiments complete to auto-fill the
        experiments/results/analysis sections with real data.

        Args:
            paper: A GeneratedPaper object
            slot_id: The experiment slot to fill

        Returns:
            Updated paper object, or None if data injector unavailable
        """
        if not self.data_injector or not self.results:
            logger.warning("DataInjector not available or no results to inject")
            return None

        latest = self.results[-1]
        metrics = latest.get("metrics", {})

        exp_data = ExperimentData(
            slot_id=slot_id,
            metrics=metrics,
            tables=[],
            figures=latest.get("output_files", []),
            notes=latest.get("stdout", "")[:2000],
        )

        try:
            updated_paper = await self.data_injector.inject_experiment_data(
                paper=paper,
                slot_id=slot_id,
                data=exp_data,
            )
            logger.info(f"[{self.task_id}] Results injected into paper {paper.paper_id}")
            return updated_paper
        except Exception as e:
            logger.error(f"[{self.task_id}] Failed to inject results: {e}")
            return None

    def _extract_code_from_artifacts(self, run_dir: Path) -> Optional[str]:
        """Extract generated Python code from Stage 10 artifacts."""
        # Try various locations where AutoResearchClaw might write code
        possible_paths = [
            run_dir / "stage-10" / "experiment" / "main.py",
            run_dir / "stage-10" / "main.py",
            run_dir / "stage-10" / "code.py",
            run_dir / "stage-10" / "experiment.py",
            run_dir / "stage-12" / "experiment" / "main.py",
            run_dir / "stage-12" / "main.py",
        ]

        for path in possible_paths:
            if path.exists():
                code = path.read_text(encoding="utf-8")
                logger.info(f"[{self.task_id}] Found code at {path}")
                return code

        # Fallback: try to get from database artifact store
        try:
            content = self.store.load_artifact(self.task_id, 10, "experiment/main.py")
            if content:
                return content
        except Exception:
            pass

        # Last resort: scan for any .py file in stage-10
        stage10_dir = run_dir / "stage-10"
        if stage10_dir.exists():
            for py_file in stage10_dir.rglob("*.py"):
                return py_file.read_text(encoding="utf-8")

        return None

    def _extract_requirements(self, run_dir: Path) -> Optional[List[str]]:
        """Extract requirements from Stage 10 artifacts."""
        req_paths = [
            run_dir / "stage-10" / "experiment" / "requirements.txt",
            run_dir / "stage-10" / "requirements.txt",
        ]

        for path in req_paths:
            if path.exists():
                text = path.read_text(encoding="utf-8").strip()
                return [line.strip() for line in text.split("\n") if line.strip()]

        return None

    def _save_experiment_artifacts(self, run_dir: Path, result: Any) -> None:
        """Save experiment results as pipeline artifacts."""
        # Create stage-12 and stage-14 directories if needed
        stage12_dir = run_dir / "stage-12"
        stage14_dir = run_dir / "stage-14"
        stage12_dir.mkdir(parents=True, exist_ok=True)
        stage14_dir.mkdir(parents=True, exist_ok=True)

        # Save raw results
        results_json = stage12_dir / "experiment_results.json"
        results_json.write_text(
            json.dumps(result.to_dict(), indent=2, default=str),
            encoding="utf-8"
        )

        # Save stdout log
        if result.stdout:
            stdout_file = stage12_dir / "stdout.txt"
            stdout_file.write_text(result.stdout, encoding="utf-8")

        # Save stderr log
        if result.stderr:
            stderr_file = stage12_dir / "stderr.txt"
            stderr_file.write_text(result.stderr, encoding="utf-8")

        # Save metrics summary for Stage 14
        metrics_summary = stage14_dir / "metrics_summary.json"
        metrics_summary.write_text(
            json.dumps({
                "primary_metric": result.primary_metric,
                "metrics": result.metrics,
                "status": result.status.value,
                "elapsed_sec": result.elapsed_sec,
            }, indent=2),
            encoding="utf-8"
        )

        # Also save to database artifact store
        try:
            self.store.save_artifact(
                self.task_id, 12, "experiment_results.json",
                json.dumps(result.to_dict(), indent=2, default=str),
                content_type="json"
            )
            self.store.save_artifact(
                self.task_id, 14, "metrics_summary.json",
                json.dumps({"metrics": result.metrics, "status": result.status.value}),
                content_type="json"
            )
        except Exception as e:
            logger.warning(f"[{self.task_id}] Failed to save artifacts to DB: {e}")

    async def run_sandbox_test(self, code: str) -> Dict[str, Any]:
        """
        Quick sandbox test for validating generated code before full execution.

        Runs the code with a short timeout to check for syntax errors
        and basic runtime issues.

        Returns:
            Dict with success/failure status and any errors
        """
        test_config = ExperimentConfig(
            timeout_sec=30,
            max_retries=1,
            workspace_dir=f"{self.workspace_dir}_test",
        )
        test_runner = ExperimentRunner(config=test_config)

        result = await test_runner.run_experiment(
            code=code,
            experiment_id=f"{self.task_id}_test",
        )

        return {
            "success": result.status == ExperimentStatus.COMPLETED,
            "status": result.status.value,
            "error": result.error,
            "stdout_preview": result.stdout[:300] if result.stdout else "",
        }


# Convenience function for use in streaming wrapper
def create_experiment_bridge(
    task_id: str,
    artifact_store: Any,
    feasibility_result: Optional[Dict[str, Any]] = None,
) -> ExperimentBridge:
    """Factory function to create an ExperimentBridge instance."""
    return ExperimentBridge(
        task_id=task_id,
        artifact_store=artifact_store,
        feasibility_result=feasibility_result,
    )
