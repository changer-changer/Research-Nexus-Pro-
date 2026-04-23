#!/usr/bin/env python3
"""
End-to-End Paper Generation Pipeline Tests

Tests the complete workflow:
1. Feasibility assessment for an innovation point
2. Paper generation (with fallback LLM)
3. Iterative refinement on a section
4. Data injection into experiment slots
5. Paper completion (all slots filled)
6. Quality validation: no [PENDING] placeholders remain

Uses the real modules with a mock LLM client to avoid API dependency.
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest

# Ensure app modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "app"))

from paper_writing.engine import LLMClient, PaperWritingEngine
from paper_writing.iteration_engine import IterationEngine
from paper_writing.data_injector import DataInjector
from paper_writing.models import (
    ExperimentData,
    ExperimentMode,
    ExperimentSlot,
    GeneratedPaper,
    IterationRecord,
    PaperSection,
    PaperStatus,
    QualityReport,
    ResearchSpec,
)
from experiment.feasibility_assessor import FeasibilityAssessor, FeasibilityResult


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client that returns predictable responses."""
    client = Mock(spec=LLMClient)

    async def mock_generate(prompt, system_prompt=None, temperature=0.7, max_tokens=2048):
        # Return context-aware mock responses based on prompt content
        text = "Mock response"
        if "title" in prompt.lower() and "generate" in prompt.lower():
            text = "Adaptive Frequency Tuning for High-Frequency Tactile Sensing"
        elif "abstract" in prompt.lower():
            text = (
                "Current tactile sensors face a fundamental limitation in capturing "
                "high-frequency vibrations above 500Hz, restricting robotic dexterity. "
                "We propose a metamaterial-inspired sensor design that leverages "
                "periodic subwavelength structures to amplify and localize tactile signals. "
                "Our approach achieves a 10x improvement in frequency response, enabling "
                "precise manipulation of delicate objects. Experimental validation on "
                "standardized textures demonstrates state-of-the-art performance."
            )
        elif "introduction" in prompt.lower():
            text = (
                "Tactile sensing remains a critical bottleneck in robotic manipulation. "
                "While vision systems have achieved remarkable progress, the sense of touch "
                "provides complementary information essential for dexterous interaction. "
                "Existing tactile sensors struggle with high-frequency signal capture, "
                "limiting their utility in tasks requiring fine texture discrimination. "
                "This paper addresses this gap through a cross-domain approach inspired "
                "by acoustic metamaterials."
            )
        elif "related_work" in prompt.lower():
            text = (
                "Recent advances in tactile sensing include optical approaches [1], "
                "piezoelectric arrays [2], and capacitive methods [3]. Metamaterial "
                "designs have been explored in acoustic contexts [4] but remain "
                "underutilized in tactile applications. Our work bridges this gap."
            )
        elif "methodology" in prompt.lower() or "method" in prompt.lower():
            text = (
                "Our sensor design consists of three layers: (1) a metamaterial core "
                "with periodic hole arrays, (2) an optical readout layer using "
                "structured illumination, and (3) a signal processing pipeline. "
                "The metamaterial layer amplifies target frequencies through "
                "resonant coupling, while suppressing noise. We optimize the "
                "structure using topology optimization with a custom objective."
            )
        elif "experiment" in prompt.lower() and "design" in prompt.lower():
            text = (
                "We evaluate our sensor on three benchmark tasks: (1) texture "
                "classification on the TacTip dataset, (2) slip detection during "
                "grasping, and (3) frequency response characterization. Baselines "
                "include standard piezoelectric sensors and recent optical methods. "
                "Metrics: accuracy, F1 score, and frequency bandwidth."
            )
        elif "analysis" in prompt.lower() or "result" in prompt.lower():
            text = (
                "Our approach achieves 94.2% accuracy on texture classification, "
                "outperforming the best baseline by 8.3 percentage points. "
                "The frequency response extends to 5kHz, a 10x improvement. "
                "Ablation studies confirm the contribution of each design component."
            )
        elif "conclusion" in prompt.lower():
            text = (
                "We presented a metamaterial-inspired tactile sensor that achieves "
                "unprecedented frequency response. Our cross-domain approach opens "
                "new directions for sensor design. Future work includes scaling "
                "to multi-modal sensing and real-time integration."
            )
        elif "refine" in prompt.lower() or "feedback" in prompt.lower():
            # Iteration refinement: return improved text
            text = (
                "Tactile sensing remains a critical bottleneck in robotic manipulation "
                "[Schi et al., 2021; Lee et al., 2022]. While vision systems have achieved "
                "remarkable progress [He et al., 2016], the sense of touch provides "
                "complementary information essential for dexterous interaction [Fishel et al., 2022]. "
                "Existing piezoelectric and capacitive tactile sensors struggle with "
                "high-frequency signal capture above 500Hz [Kim et al., 2020], limiting "
                "their utility in tasks requiring fine texture discrimination. "
                "This paper addresses this gap through a principled cross-domain approach "
                "inspired by acoustic metamaterial design [Zhu et al., 2021]."
            )
        elif "feasibility" in prompt.lower() or "assess" in prompt.lower():
            # Feasibility assessment JSON
            text = json.dumps({
                "overall_score": 72,
                "decision": "human_guided",
                "confidence": 0.78,
                "dimensions": {
                    "technical_prerequisites": {
                        "score": 80,
                        "assessment": "Simulation environments available; hardware fabrication requires cleanroom access",
                        "risks": ["Metamaterial fabrication precision", "Optical calibration complexity"]
                    },
                    "method_maturity": {
                        "score": 70,
                        "assessment": "Similar approaches demonstrated in simulation; real-world transfer limited",
                        "similar_works": ["Zhu et al. 2021 (acoustic)", "Ward-Cherrier et al. 2018 (TacTip)"]
                    },
                    "common_failures": {
                        "score": 65,
                        "assessment": "Optical misalignment and resonant frequency drift are common issues",
                        "failure_modes": ["Resonance detuning", "Optical cross-talk", "Material fatigue"]
                    },
                    "human_involvement": {
                        "score": 55,
                        "assessment": "Requires physical sensor fabrication and careful optical calibration",
                        "required_actions": ["Cleanroom fabrication", "Optical alignment", "Manual calibration"]
                    }
                },
                "recommendations": [
                    "Start with simulation-only experiments",
                    "Partner with a fabrication lab for physical prototype",
                    "Validate optical design with ray-tracing simulation first"
                ],
                "estimated_time_hours": 120,
                "estimated_cost_usd": 5000,
                "required_resources": ["Simulation cluster", "Cleanroom access", "Optical equipment"],
                "risk_factors": ["Fabrication yield", "Calibration sensitivity", "Real-world performance gap"]
            })
        elif "experimental setup" in prompt.lower() or "experimental results" in prompt.lower():
            text = (
                "## Experimental Setup\n\n"
                "We implement our sensor using a fabricated metamaterial substrate "
                "with 200um periodic holes. The optical readout uses a 12MP camera "
                "with structured illumination at 30Hz.\n\n"
                "### Main Results\n\n"
                "| Method | Accuracy | F1 Score | Freq. Range |\n"
                "|--------|----------|----------|-------------|\n"
                "| Ours   | 94.2%    | 0.938    | 5kHz        |\n"
                "| Baseline A | 85.9% | 0.852 | 500Hz     |\n"
                "| Baseline B | 88.1% | 0.871 | 800Hz     |\n\n"
                "Our approach achieves a 10x improvement in frequency response "
                "while maintaining superior classification accuracy."
            )
        elif "quality" in prompt.lower() or "check" in prompt.lower():
            text = json.dumps({
                "score": 85,
                "grade": "B+",
                "issues": [],
                "warnings": ["Consider adding more ablation details"],
                "venue": "NeurIPS",
                "passes_minimum": True
            })
        else:
            text = "Generated content for the requested section."

        mock_response = Mock()
        mock_response.text = text
        mock_response.model = "mock-model"
        mock_response.usage = {"input_tokens": 100, "output_tokens": 200}
        return mock_response

    client.generate = mock_generate
    return client


@pytest.fixture
def sample_innovation():
    """Sample innovation point data."""
    return {
        "id": "innov_test_001",
        "type": "cross_domain",
        "title": "Cross-Domain Transfer for Tactile Perception",
        "description": (
            "Applying acoustic metamaterial principles to tactile sensor design "
            "to enable high-frequency signal capture beyond 500Hz"
        ),
        "sourcePapers": [
            {"title": "High-Frequency Tactile Sensing", "year": 2024},
            {"title": "Acoustic Metamaterials Review", "year": 2023},
        ],
        "targetProblem": {
            "name": "High-Frequency Tactile Signal Capture",
            "description": "Current tactile sensors struggle to capture vibrations above 500Hz.",
            "questions": ["How to capture high-frequency tactile signals?"],
        },
        "proposedMethod": {
            "name": "Metamaterial-Inspired Tactile Sensor",
            "description": "A novel sensor design inspired by acoustic metamaterial principles",
            "components": ["Metamaterial core", "Optical readout", "Signal processing"],
            "architecture": "Layered metamaterial structure",
        },
        "confidenceScore": 0.85,
        "expectedImpact": "Enable next-generation robotic manipulation",
    }


@pytest.fixture
def sample_research_spec(sample_innovation):
    """Build a ResearchSpec from sample innovation."""
    return ResearchSpec(
        innovation_id=sample_innovation["id"],
        title_hint=sample_innovation["title"],
        problem_statement=sample_innovation["targetProblem"]["description"],
        proposed_solution=sample_innovation["proposedMethod"]["description"],
        target_venue="NeurIPS",
        related_papers=sample_innovation["sourcePapers"],
    )


# =============================================================================
# Phase 1: Feasibility Assessment Tests
# =============================================================================

class TestFeasibilityAssessment:
    """Test experiment feasibility assessment."""

    @pytest.mark.asyncio
    async def test_assess_returns_structured_result(self, mock_llm_client):
        """Feasibility assessment returns a structured FeasibilityResult."""
        assessor = FeasibilityAssessor(llm_client=mock_llm_client)
        result = await assessor.assess(
            title="Metamaterial Tactile Sensor",
            problem_statement="Capture high-frequency tactile signals",
            proposed_solution="Use acoustic metamaterial principles",
            target_venue="NeurIPS",
        )

        assert isinstance(result, FeasibilityResult)
        assert 0 <= result.overall_score <= 100
        assert result.decision in ("ai_auto", "human_guided", "hybrid", "not_recommended")
        assert 0.0 <= result.confidence <= 1.0
        assert "dimensions" in result.to_dict()

    @pytest.mark.asyncio
    async def test_human_guided_for_hardware_experiments(self, mock_llm_client):
        """Hardware experiments should be classified as human_guided or hybrid."""
        assessor = FeasibilityAssessor(llm_client=mock_llm_client)
        result = await assessor.assess(
            title="Metamaterial Tactile Sensor for Robotics",
            problem_statement="Physical sensor with optical readout",
            proposed_solution="Fabricate metamaterial substrate",
        )

        # Hardware experiments should NOT be ai_auto
        assert result.decision != "ai_auto" or result.overall_score < 80

    @pytest.mark.asyncio
    async def test_fallback_assessment_for_software(self):
        """Fallback assessment correctly classifies software experiments."""
        assessor = FeasibilityAssessor(llm_client=None)
        result = assessor._fallback_assessment(
            title="Benchmark on ImageNet Classification",
            problem="Improve accuracy on standard benchmark",
            solution="Use transformer architecture with synthetic data augmentation",
        )

        assert result.decision == "ai_auto"
        assert result.overall_score >= 70

    @pytest.mark.asyncio
    async def test_fallback_assessment_for_hardware(self):
        """Fallback assessment correctly classifies hardware experiments."""
        assessor = FeasibilityAssessor(llm_client=None)
        result = assessor._fallback_assessment(
            title="Novel Tactile Sensor Fabrication",
            problem="Physical sensor for robotic manipulation",
            solution="Fabricate metamaterial with cleanroom process",
        )

        assert result.decision in ("human_guided", "hybrid", "not_recommended")


# =============================================================================
# Phase 2: Paper Generation Tests
# =============================================================================

class TestPaperGeneration:
    """Test paper writing engine generation pipeline."""

    @pytest.mark.asyncio
    async def test_generate_creates_complete_paper(self, mock_llm_client, sample_research_spec):
        """Paper generation produces a complete paper with all sections."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        assert isinstance(paper, GeneratedPaper)
        assert paper.title
        assert paper.abstract
        assert paper.status == PaperStatus.DRAFT

        # All required sections should exist
        required_sections = [
            "introduction", "related_work", "methodology",
            "experiment_design", "analysis", "conclusion",
        ]
        for section in required_sections:
            assert section in paper.sections, f"Missing section: {section}"
            assert len(paper.sections[section].content) > 0

    @pytest.mark.asyncio
    async def test_generate_creates_experiment_slots(self, mock_llm_client, sample_research_spec):
        """Generated paper includes experiment slots for data injection."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        assert len(paper.experiment_slots) > 0
        for slot in paper.experiment_slots:
            assert slot.slot_id
            assert slot.description
            assert slot.placeholder

    @pytest.mark.asyncio
    async def test_paper_needs_experiments_flag(self, mock_llm_client, sample_research_spec):
        """Freshly generated paper should need experiments."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        assert paper.needs_experiments is True
        assert paper.is_complete is False

    @pytest.mark.asyncio
    async def test_stream_generate_yields_progress_events(self, mock_llm_client, sample_research_spec):
        """Streaming generation yields progress events in order."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        events = []
        async for event in engine.stream_generate(sample_research_spec):
            events.append(event)
            assert "stage" in event
            assert "progress" in event
            assert "message" in event

        assert len(events) > 0
        assert events[0]["stage"] == "init"
        assert events[-1]["stage"] == "complete"
        assert events[-1]["progress"] == 100

    def test_assemble_markdown_contains_all_sections(self, mock_llm_client, sample_research_spec):
        """Markdown assembly includes all paper sections."""
        # Use a simpler approach - test the assembly method directly
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        sections = {
            "introduction": PaperSection(name="introduction", content="Intro text."),
            "methodology": PaperSection(name="methodology", content="Method text."),
            "experiment_design": PaperSection(name="experiment_design", content="Exp text."),
            "analysis": PaperSection(name="analysis", content="Analysis text."),
            "conclusion": PaperSection(name="conclusion", content="Conclusion text."),
        }
        md = engine._assemble_markdown("Test Title", "Test abstract.", sections)

        assert "# Test Title" in md
        assert "Test abstract." in md
        assert "Intro text." in md
        assert "Method text." in md

    def test_assemble_latex_produces_valid_structure(self, mock_llm_client):
        """LaTeX assembly produces valid document structure."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        sections = {
            "introduction": PaperSection(name="introduction", content="Intro."),
            "methodology": PaperSection(name="methodology", content="Method."),
        }
        latex = engine._assemble_latex("Test Title", "Abstract.", sections)

        assert "\\documentclass" in latex
        assert "\\title{Test Title}" in latex
        assert "\\begin{document}" in latex
        assert "\\section{Introduction}" in latex
        assert "\\end{document}" in latex

    def test_sanitize_code_output_strips_fences(self):
        """Code sanitization strips markdown fences (Stage 10 bug fix)."""
        from paper_writing.engine import _sanitize_code_output, _strip_markdown_fences

        # Test fence stripping
        fenced = '```python\nprint("hello")\n```'
        assert _strip_markdown_fences(fenced).strip() == 'print("hello")'

        # Test code sanitization with valid code
        code = '```\ndef foo():\n    return 42\n```'
        result = _sanitize_code_output(code)
        assert "def foo():" in result
        assert "```" not in result


# =============================================================================
# Phase 3: Iterative Refinement Tests
# =============================================================================

class TestIterativeRefinement:
    """Test iteration engine for section refinement."""

    @pytest.mark.asyncio
    async def test_refine_section_returns_refined_text(self, mock_llm_client):
        """Refining a section returns improved text with iteration ID."""
        iteration_engine = IterationEngine(llm_client=mock_llm_client)

        paper = GeneratedPaper(
            paper_id="test_001",
            title="Test Paper",
            abstract="Test abstract.",
            sections={
                "introduction": PaperSection(name="introduction", content="Original intro text."),
                "methodology": PaperSection(name="methodology", content="Original method text."),
            },
            experiment_slots=[],
            status=PaperStatus.DRAFT,
        )

        result = await iteration_engine.refine_section(
            paper=paper,
            section_name="introduction",
            feedback="Add more citations and make it more formal",
        )

        assert "section_name" in result
        assert result["section_name"] == "introduction"
        assert "original" in result
        assert "refined" in result
        assert "iteration_id" in result
        assert result["iteration_id"].startswith("iter_")
        assert "coherence_warnings" in result

    @pytest.mark.asyncio
    async def test_refine_section_preserves_other_sections(self, mock_llm_client):
        """Refining one section should not affect other sections."""
        iteration_engine = IterationEngine(llm_client=mock_llm_client)

        paper = GeneratedPaper(
            paper_id="test_002",
            title="Test Paper",
            abstract="Test abstract.",
            sections={
                "introduction": PaperSection(name="introduction", content="Intro."),
                "methodology": PaperSection(name="methodology", content="Method."),
            },
            experiment_slots=[],
            status=PaperStatus.DRAFT,
        )

        original_method = paper.sections["methodology"].content

        await iteration_engine.refine_section(
            paper=paper,
            section_name="introduction",
            feedback="Make it longer",
        )

        # Methodology should be unchanged
        assert paper.sections["methodology"].content == original_method

    @pytest.mark.asyncio
    async def test_refine_nonexistent_section_raises_error(self, mock_llm_client):
        """Refining a non-existent section should raise ValueError."""
        iteration_engine = IterationEngine(llm_client=mock_llm_client)

        paper = GeneratedPaper(
            paper_id="test_003",
            title="Test",
            abstract="Abstract.",
            sections={},
            experiment_slots=[],
            status=PaperStatus.DRAFT,
        )

        with pytest.raises(ValueError, match="not found"):
            await iteration_engine.refine_section(
                paper=paper,
                section_name="nonexistent",
                feedback="Some feedback",
            )


# =============================================================================
# Phase 4: Data Injection Tests
# =============================================================================

class TestDataInjection:
    """Test experiment data injection and paper completion."""

    @pytest.mark.asyncio
    async def test_inject_data_updates_slot_status(self, mock_llm_client):
        """Injecting data marks the slot as completed."""
        injector = DataInjector(llm_client=mock_llm_client)

        paper = GeneratedPaper(
            paper_id="test_004",
            title="Test Paper",
            abstract="Abstract.",
            sections={
                "experiment_design": PaperSection(name="experiment_design", content="[PENDING]"),
                "analysis": PaperSection(name="analysis", content="[PENDING]"),
                "conclusion": PaperSection(name="conclusion", content="[PENDING]"),
            },
            experiment_slots=[
                ExperimentSlot(
                    slot_id="exp_1",
                    slot_type="main_performance",
                    description="Main evaluation",
                    expected_outcome="Table with accuracy and F1 scores",
                    placeholder="[PENDING: Main results]",
                    status="pending",
                ),
            ],
            status=PaperStatus.DRAFT,
        )

        data = ExperimentData(
            slot_id="exp_1",
            metrics={"accuracy": 0.942, "f1_score": 0.938},
            notes="Results exceeded expectations",
        )

        updated = await injector.inject_experiment_data(paper, "exp_1", data)

        slot = updated.experiment_slots[0]
        assert slot.status == "completed"
        assert slot.actual_data is not None

    @pytest.mark.asyncio
    async def test_inject_all_data_completes_paper(self, mock_llm_client):
        """Filling all experiment slots marks paper as COMPLETED."""
        injector = DataInjector(llm_client=mock_llm_client)

        paper = GeneratedPaper(
            paper_id="test_005",
            title="Test Paper",
            abstract="Abstract.",
            sections={
                "experiment_design": PaperSection(name="experiment_design", content="[PENDING]"),
                "analysis": PaperSection(name="analysis", content="[PENDING]"),
                "conclusion": PaperSection(name="conclusion", content="[PENDING]"),
            },
            experiment_slots=[
                ExperimentSlot(
                    slot_id="exp_1",
                    slot_type="main_performance",
                    description="Main evaluation",
                    expected_outcome="Table with accuracy scores",
                    placeholder="[PENDING]",
                    status="pending",
                ),
                ExperimentSlot(
                    slot_id="exp_2",
                    slot_type="ablation",
                    description="Ablation study",
                    expected_outcome="Bar chart showing component contributions",
                    placeholder="[PENDING]",
                    status="pending",
                ),
            ],
            status=PaperStatus.DRAFT,
        )

        data_map = {
            "exp_1": ExperimentData(
                slot_id="exp_1",
                metrics={"accuracy": 0.95, "f1_score": 0.94},
            ),
            "exp_2": ExperimentData(
                slot_id="exp_2",
                metrics={"component_A": 0.88, "component_B": 0.92},
            ),
        }

        updated = await injector.inject_all_experiments(paper, data_map)

        assert updated.status == PaperStatus.COMPLETED
        assert all(s.status == "completed" for s in updated.experiment_slots)

    def test_generate_figure_from_data_creates_image(self, mock_llm_client, tmp_path):
        """Figure generation creates actual image files (when matplotlib available)."""
        try:
            import matplotlib
        except ImportError:
            pytest.skip("matplotlib not installed")

        injector = DataInjector(llm_client=mock_llm_client)

        data = ExperimentData(
            slot_id="exp_1",
            metrics={"accuracy": 0.95, "f1_score": 0.94, "precision": 0.93},
        )

        output_dir = str(tmp_path / "figures")
        paths = injector.generate_figure_from_data(data, output_dir=output_dir)

        # Should create at least one figure
        assert len(paths) > 0
        for path in paths:
            assert Path(path).exists()

    def test_describe_figures_from_metrics(self, mock_llm_client):
        """Figure descriptions are generated from metrics."""
        injector = DataInjector(llm_client=mock_llm_client)

        data = ExperimentData(
            slot_id="exp_1",
            metrics={"accuracy": 0.95, "f1_score": 0.94},
            tables=[{"caption": "Main results table"}],
        )

        descriptions = injector._describe_figures(data)

        assert len(descriptions) > 0
        assert any("Bar chart" in d for d in descriptions)
        assert any("Table" in d for d in descriptions)


# =============================================================================
# Phase 5: Full Pipeline Integration Test
# =============================================================================

class TestFullPipeline:
    """End-to-end test of the complete paper generation workflow."""

    @pytest.mark.asyncio
    async def test_complete_pipeline_no_placeholders_remaining(self, mock_llm_client, sample_research_spec):
        """
        Full pipeline: generate → refine → inject data → complete.
        After completion, no [PENDING] placeholders should remain.
        """
        # Step 1: Generate initial paper
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        assert paper.status == PaperStatus.DRAFT
        assert paper.needs_experiments is True

        # Step 2: Refine introduction
        iteration_engine = IterationEngine(llm_client=mock_llm_client)
        refine_result = await iteration_engine.refine_section(
            paper=paper,
            section_name="introduction",
            feedback="Add citations and make more formal",
        )
        paper.sections["introduction"] = PaperSection(
            name="introduction",
            content=refine_result["refined"],
        )

        # Step 3: Inject experiment data for all slots
        injector = DataInjector(llm_client=mock_llm_client)

        data_map = {}
        for slot in paper.experiment_slots:
            data_map[slot.slot_id] = ExperimentData(
                slot_id=slot.slot_id,
                metrics={
                    "accuracy": 0.95,
                    "f1_score": 0.94,
                    "frequency_range_hz": 5000,
                },
                notes=f"Completed {slot.slot_type} experiment",
            )

        paper = await injector.inject_all_experiments(paper, data_map)

        # Step 4: Validate completion
        assert paper.status == PaperStatus.COMPLETED
        assert paper.is_complete is True
        assert paper.needs_experiments is False

        # Step 5: CRITICAL — no [PENDING] placeholders in final output
        full_text = paper.markdown_content or ""
        full_text += paper.latex_content or ""
        for section in paper.sections.values():
            full_text += section.content

        assert "[PENDING" not in full_text, "Found [PENDING] placeholder in completed paper!"
        assert "[PLACEHOLDER" not in full_text, "Found [PLACEHOLDER] in completed paper!"

    @pytest.mark.asyncio
    async def test_pipeline_produces_valid_latex(self, mock_llm_client, sample_research_spec):
        """Final paper produces valid LaTeX structure."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        # Complete all experiments
        injector = DataInjector(llm_client=mock_llm_client)
        for slot in paper.experiment_slots:
            data = ExperimentData(
                slot_id=slot.slot_id,
                metrics={"accuracy": 0.95},
            )
            paper = await injector.inject_experiment_data(paper, slot.slot_id, data)

        latex = paper.latex_content
        assert latex
        assert "\\documentclass" in latex
        assert "\\begin{document}" in latex
        assert "\\end{document}" in latex
        assert "\\title{" in latex

    @pytest.mark.asyncio
    async def test_pipeline_version_increments(self, mock_llm_client, sample_research_spec):
        """Paper version increments after data injection."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)
        initial_version = paper.version

        injector = DataInjector(llm_client=mock_llm_client)
        for slot in paper.experiment_slots:
            data = ExperimentData(slot_id=slot.slot_id, metrics={"acc": 0.9})
            paper = await injector.inject_experiment_data(paper, slot.slot_id, data)

        assert paper.version > initial_version


# =============================================================================
# Quality & Sanity Tests
# =============================================================================

class TestQualityValidation:
    """Quality checks on generated papers."""

    @pytest.mark.asyncio
    async def test_paper_has_reasonable_length(self, mock_llm_client, sample_research_spec):
        """Generated paper sections should have reasonable length."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        for name, section in paper.sections.items():
            assert len(section.content) > 20, f"Section '{name}' is too short"

    @pytest.mark.asyncio
    async def test_paper_title_is_non_empty(self, mock_llm_client, sample_research_spec):
        """Paper title should be non-empty and reasonable length."""
        engine = PaperWritingEngine(llm_client=mock_llm_client)
        paper = await engine.generate(sample_research_spec)

        assert len(paper.title) > 10
        assert len(paper.title) < 200

    def test_experiment_data_model_validation(self):
        """ExperimentData model validates correctly."""
        data = ExperimentData(
            slot_id="exp_1",
            metrics={"accuracy": 0.95},
            tables=[{"caption": "Results"}],
        )
        assert data.slot_id == "exp_1"
        assert data.metrics["accuracy"] == 0.95


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
