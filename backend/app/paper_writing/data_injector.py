"""
Experiment Data Injector — Auto-complete paper with experiment data

When a user submits experiment results, this module:
1. Analyzes the data
2. Auto-generates figures and tables
3. Injects content into experiment/analysis sections
4. Re-generates conclusion to reflect actual results
5. Produces a completed paper ready for submission

Usage:
    injector = DataInjector()
    completed_paper = await injector.inject_experiment_data(
        paper=draft_paper,
        slot_id="exp_1",
        data=experiment_data,
    )
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .engine import LLMClient
from .models import (
    ExperimentData,
    ExperimentMode,
    ExperimentSlot,
    GeneratedPaper,
    PaperSection,
    PaperStatus,
)

logger = logging.getLogger(__name__)


class DataInjector:
    """Inject experiment data into a paper and auto-complete it"""

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client or LLMClient()

    async def inject_experiment_data(
        self,
        paper: GeneratedPaper,
        slot_id: str,
        data: ExperimentData,
    ) -> GeneratedPaper:
        """
        Inject experiment data into a paper.

        Args:
            paper: The draft paper (with placeholder experiment sections)
            slot_id: Which experiment slot this data belongs to
            data: The experiment data

        Returns:
            Updated paper with filled experiment content
        """
        # Find the slot
        slot = None
        for s in paper.experiment_slots:
            if s.slot_id == slot_id:
                slot = s
                break

        if not slot:
            raise ValueError(f"Experiment slot '{slot_id}' not found in paper")

        # Update slot
        slot.status = "completed"
        slot.actual_data = data.to_dict()
        slot.submitted_at = datetime.now().isoformat()

        # Auto-generate figures description from data
        figures_desc = self._describe_figures(data)
        slot.figures = figures_desc

        # Check if all slots are now complete
        all_complete = all(s.status == "completed" for s in paper.experiment_slots)

        # Re-generate experiment section with real data
        experiment_section = await self._regenerate_experiments_section(paper)
        paper.sections["experiment_design"] = PaperSection(
            name="experiment_design",
            content=experiment_section,
            status="complete",
        )

        # Re-generate analysis section with real data
        analysis_section = await self._regenerate_analysis_section(paper)
        paper.sections["analysis"] = PaperSection(
            name="analysis",
            content=analysis_section,
            status="complete",
        )

        # Update conclusion if all experiments are done
        if all_complete:
            conclusion = await self._regenerate_conclusion(paper)
            paper.sections["conclusion"] = PaperSection(
                name="conclusion",
                content=conclusion,
            )
            paper.status = PaperStatus.COMPLETED

        # Update assembled outputs
        from .engine import PaperWritingEngine
        engine = PaperWritingEngine(llm_client=self.llm)
        paper.latex_content = engine._assemble_latex(
            paper.title, paper.abstract, paper.sections
        )
        paper.markdown_content = engine._assemble_markdown(
            paper.title, paper.abstract, paper.sections
        )
        paper.updated_at = datetime.now().isoformat()
        paper.version += 1

        logger.info(
            f"Injected data into paper {paper.paper_id}, slot {slot_id}. "
            f"All complete: {all_complete}"
        )
        return paper

    async def inject_all_experiments(
        self,
        paper: GeneratedPaper,
        data_map: Dict[str, ExperimentData],
    ) -> GeneratedPaper:
        """Inject data for all experiment slots at once"""
        for slot_id, data in data_map.items():
            paper = await self.inject_experiment_data(paper, slot_id, data)
        return paper

    async def _regenerate_experiments_section(self, paper: GeneratedPaper) -> str:
        """Re-generate the experiments section with actual data"""
        # Build a summary of all completed experiments
        completed = [s for s in paper.experiment_slots if s.status == "completed"]
        pending = [s for s in paper.experiment_slots if s.status != "completed"]

        experiment_summaries = []
        for slot in completed:
            data = slot.actual_data or {}
            metrics = data.get("metrics", {})
            metrics_text = ", ".join(f"{k}={v:.4f}" for k, v in metrics.items())
            experiment_summaries.append(
                f"### {slot.slot_id}: {slot.description}\n"
                f"- Status: Completed\n"
                f"- Key Metrics: {metrics_text}\n"
                f"- Notes: {data.get('notes', 'N/A')}\n"
            )

        for slot in pending:
            experiment_summaries.append(
                f"### {slot.slot_id}: {slot.description}\n"
                f"- Status: Pending\n"
                f"- {slot.placeholder}\n"
            )

        prompt = f"""# Task: Write the Experimental Results Section

Paper Title: {paper.title}
Abstract: {paper.abstract[:400]}

## Completed Experiments

{chr(10).join(experiment_summaries)}

## Instructions

Write a complete "Experimental Setup and Results" section for this paper. Include:
1. Dataset and evaluation protocol description
2. Baseline methods used
3. Main results with quantitative metrics
4. Ablation study results (if available)
5. Any statistical significance tests

Use the actual metrics provided above. Be specific with numbers.
If an experiment is still pending, mark it clearly.

Output ONLY the section text (no markdown fences, no explanations).
"""

        response = await self.llm.generate(prompt, temperature=0.4, max_tokens=4096)
        return response.text.strip()

    async def _regenerate_analysis_section(self, paper: GeneratedPaper) -> str:
        """Re-generate the analysis section with actual data"""
        completed = [s for s in paper.experiment_slots if s.status == "completed"]

        # Extract key findings
        findings = []
        for slot in completed:
            data = slot.actual_data or {}
            metrics = data.get("metrics", {})
            for k, v in metrics.items():
                findings.append(f"- {slot.slot_type}: {k} = {v:.4f}")

        prompt = f"""# Task: Write the Results and Analysis Section

Paper Title: {paper.title}

## Key Findings from Experiments

{chr(10).join(findings) if findings else "[Experiment data to be analyzed]"}

## Instructions

Write a compelling "Results and Analysis" section that:
1. Leads with the main findings
2. Discusses what the numbers mean
3. Connects results to the methodology
4. Discusses limitations honestly
5. Suggests implications for the field

Be specific and evidence-based. Every claim must be supported by the data.

Output ONLY the section text (no markdown fences, no explanations).
"""

        response = await self.llm.generate(prompt, temperature=0.4, max_tokens=4096)
        return response.text.strip()

    async def _regenerate_conclusion(self, paper: GeneratedPaper) -> str:
        """Re-generate conclusion with actual results"""
        completed = [s for s in paper.experiment_slots if s.status == "completed"]
        key_results = []
        for slot in completed:
            data = slot.actual_data or {}
            metrics = data.get("metrics", {})
            for k, v in metrics.items():
                key_results.append(f"- {slot.slot_type}: {k} = {v:.4f}")

        methodology = paper.sections.get("methodology", PaperSection(name="methodology", content="")).content[:300]

        prompt = f"""# Task: Write the Conclusion Section

Paper Title: {paper.title}
Abstract: {paper.abstract[:300]}

## Key Results Achieved

{chr(10).join(key_results) if key_results else "[Results pending]"}

## Methodology Summary

{methodology}

## Instructions

Write a strong conclusion that:
1. Summarizes the problem and approach
2. States the concrete results achieved (use numbers!)
3. Lists 2-3 specific contributions
4. Acknowledges limitations honestly
5. Suggests 2-3 future research directions

Output ONLY the conclusion text (no markdown fences, no explanations).
"""

        response = await self.llm.generate(prompt, temperature=0.5, max_tokens=2048)
        return response.text.strip()

    def _describe_figures(self, data: ExperimentData) -> List[str]:
        """Auto-generate figure descriptions from experiment data"""
        figures = []

        if data.tables:
            for i, table in enumerate(data.tables):
                figures.append(f"Table {i+1}: {table.get('caption', 'Results table')}")

        if data.figures:
            for i, fig_path in enumerate(data.figures):
                figures.append(f"Figure {i+1}: Chart from {fig_path}")

        if data.metrics:
            # Suggest a figure for key metrics
            figures.append(
                f"Figure: Bar chart comparing key metrics: {', '.join(data.metrics.keys())}"
            )

        return figures

    def generate_figure_from_data(
        self,
        data: ExperimentData,
        output_dir: str = "/tmp/paper_figures",
    ) -> List[str]:
        """
        Auto-generate matplotlib figures from experiment data.

        Returns list of saved figure paths.
        """
        import os

        os.makedirs(output_dir, exist_ok=True)
        paths = []

        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except ImportError:
            logger.warning("matplotlib not available for figure generation")
            return paths

        # Generate bar chart for metrics
        if data.metrics:
            fig, ax = plt.subplots(figsize=(8, 5))
            labels = list(data.metrics.keys())
            values = list(data.metrics.values())
            bars = ax.bar(labels, values)
            ax.set_ylabel("Value")
            ax.set_title(f"Experiment Metrics — {data.slot_id}")
            for bar, val in zip(bars, values):
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height(),
                       f"{val:.3f}", ha="center", va="bottom")
            path = f"{output_dir}/{data.slot_id}_metrics.png"
            plt.tight_layout()
            plt.savefig(path, dpi=150)
            plt.close()
            paths.append(path)

        return paths
