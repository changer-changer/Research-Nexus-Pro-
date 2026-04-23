"""
Paper Writing Engine — Data Models

Defines the core data structures for the paper generation pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class PaperStatus(str, Enum):
    """Paper lifecycle status"""
    DRAFT = "draft"                    # Initial generation, no experiments
    IN_EXPERIMENT = "in_experiment"    # Experiments in progress
    PENDING_REVIEW = "pending_review"  # Awaiting human review
    COMPLETED = "completed"            # All experiments done, paper finalized


class ExperimentMode(str, Enum):
    """How an experiment slot should be executed"""
    AI_AUTO = "ai_auto"                # AI runs automatically
    HUMAN_GUIDED = "human_guided"      # Human follows detailed guide
    HYBRID = "hybrid"                  # Mixed: AI + human
    PENDING_ASSESSMENT = "pending_assessment"  # Not yet classified


@dataclass
class ExperimentSlot:
    """A placeholder for an experiment that needs data collection"""
    slot_id: str
    slot_type: str                     # e.g. "main_performance", "ablation_study"
    description: str
    expected_outcome: str
    estimated_weeks: int = 1
    mode: ExperimentMode = ExperimentMode.PENDING_ASSESSMENT
    status: str = "pending"            # pending | running | completed | failed
    placeholder: str = ""
    actual_data: Optional[Dict[str, Any]] = None
    figures: List[str] = field(default_factory=list)
    submitted_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slot_id": self.slot_id,
            "slot_type": self.slot_type,
            "description": self.description,
            "expected_outcome": self.expected_outcome,
            "estimated_weeks": self.estimated_weeks,
            "mode": self.mode.value,
            "status": self.status,
            "placeholder": self.placeholder,
            "actual_data": self.actual_data,
            "figures": self.figures,
            "submitted_at": self.submitted_at,
        }


@dataclass
class ExperimentData:
    """User-submitted experiment data"""
    slot_id: str
    metrics: Dict[str, float] = field(default_factory=dict)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    figures: List[str] = field(default_factory=list)
    notes: str = ""
    submitted_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "slot_id": self.slot_id,
            "metrics": self.metrics,
            "tables": self.tables,
            "figures": self.figures,
            "notes": self.notes,
            "submitted_at": self.submitted_at,
        }


@dataclass
class PaperSection:
    """A single section of a paper"""
    name: str
    content: str
    word_count: int = 0
    status: str = "complete"           # complete | pending | needs_data

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "content": self.content,
            "word_count": self.word_count or len(self.content.split()),
            "status": self.status,
        }


@dataclass
class GeneratedPaper:
    """A complete generated paper"""
    paper_id: str
    title: str
    abstract: str
    sections: Dict[str, PaperSection] = field(default_factory=dict)
    experiment_slots: List[ExperimentSlot] = field(default_factory=list)
    references: List[Dict[str, str]] = field(default_factory=list)
    target_venue: str = "NeurIPS"
    status: PaperStatus = PaperStatus.DRAFT
    latex_content: str = ""
    markdown_content: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "paper_id": self.paper_id,
            "title": self.title,
            "abstract": self.abstract,
            "sections": {k: v.to_dict() for k, v in self.sections.items()},
            "experiment_slots": [s.to_dict() for s in self.experiment_slots],
            "references": self.references,
            "target_venue": self.target_venue,
            "status": self.status.value,
            "latex_content": self.latex_content,
            "markdown_content": self.markdown_content,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "version": self.version,
        }

    @property
    def needs_experiments(self) -> bool:
        """True if any experiment slot is pending"""
        return any(s.status == "pending" for s in self.experiment_slots)

    @property
    def is_complete(self) -> bool:
        """True if all experiment slots are completed"""
        return self.status == PaperStatus.COMPLETED


@dataclass
class ResearchSpec:
    """Input specification for paper generation (Layer 1 output)"""
    innovation_id: str
    title_hint: str = ""
    problem_statement: str = ""
    proposed_solution: str = ""
    expected_impact: str = ""
    implementation_path: List[Dict[str, str]] = field(default_factory=list)
    related_papers: List[Dict[str, Any]] = field(default_factory=list)
    domain: str = "cross_domain"
    target_venue: str = "NeurIPS"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "innovation_id": self.innovation_id,
            "title_hint": self.title_hint,
            "problem_statement": self.problem_statement,
            "proposed_solution": self.proposed_solution,
            "expected_impact": self.expected_impact,
            "implementation_path": self.implementation_path,
            "related_papers": self.related_papers,
            "domain": self.domain,
            "target_venue": self.target_venue,
        }


@dataclass
class IterationRecord:
    """A single iteration / refinement of a paper section"""
    iteration_id: str
    paper_id: str
    section_name: str
    feedback: str
    before: str
    after: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "iteration_id": self.iteration_id,
            "paper_id": self.paper_id,
            "section_name": self.section_name,
            "feedback": self.feedback,
            "before": self.before,
            "after": self.after,
            "timestamp": self.timestamp,
            "version": self.version,
        }


@dataclass
class PaperVersion:
    """A versioned snapshot of a paper"""
    version_id: str
    paper_id: str
    version_number: int
    content: Dict[str, Any]
    changes_summary: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "paper_id": self.paper_id,
            "version_number": self.version_number,
            "content": self.content,
            "changes_summary": self.changes_summary,
            "created_at": self.created_at,
        }


@dataclass
class QualityReport:
    """Quality validation report for a generated paper"""
    overall_score: float = 0.0
    completeness_score: float = 0.0
    coherence_score: float = 0.0
    style_score: float = 0.0
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    passes_minimum: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "completeness_score": self.completeness_score,
            "coherence_score": self.coherence_score,
            "style_score": self.style_score,
            "issues": self.issues,
            "suggestions": self.suggestions,
            "passes_minimum": self.passes_minimum,
        }
