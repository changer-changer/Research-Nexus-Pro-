"""
Research-Nexus Pro Paper Writing Engine (Layer 3)

Independent paper writing module that takes a Research Spec + optional Experiment Data
and produces conference-ready academic papers.

Usage:
    from app.paper_writing import PaperWritingEngine, ResearchSpec

    engine = PaperWritingEngine()
    spec = ResearchSpec(...)
    paper = await engine.generate(spec)

Features:
- Real LLM-driven generation (Kimi via Anthropic SDK)
- Multi-stage pipeline: title → abstract → intro → related_work → methodology
  → experiment_design → analysis → conclusion → quality_check
- Experiment-aware: generates placeholder experiment sections when no data
- Iterative refinement support
- LaTeX / Markdown export
"""

from .engine import PaperWritingEngine, ResearchSpec, PaperSection, GeneratedPaper
from .models import (
    ExperimentSlot,
    ExperimentData,
    PaperVersion,
    IterationRecord,
    QualityReport,
)

__all__ = [
    "PaperWritingEngine",
    "ResearchSpec",
    "PaperSection",
    "GeneratedPaper",
    "ExperimentSlot",
    "ExperimentData",
    "PaperVersion",
    "IterationRecord",
    "QualityReport",
]
