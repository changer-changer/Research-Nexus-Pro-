"""
Paper Writing Engine — Core Generation Pipeline

Real LLM-driven paper generation. Replaces placeholder content with actual
Kimi API calls. Supports:
- Multi-stage generation (title → abstract → intro → related_work → methodology
  → experiment_design → analysis → conclusion → quality_check)
- Experiment-aware: generates placeholder slots when no data available
- Markdown fence sanitization (fixes AutoResearchClaw Stage 10 bug)
- LaTeX and Markdown assembly
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from string import Template
from typing import Any, AsyncGenerator, Dict, List, Optional

from .models import (
    ExperimentMode,
    ExperimentSlot,
    GeneratedPaper,
    PaperSection,
    PaperStatus,
    QualityReport,
    ResearchSpec,
)

logger = logging.getLogger(__name__)

# =============================================================================
# Constants
# =============================================================================

PROMPTS_DIR = Path(__file__).parent.parent / "services" / "paper_generation" / "prompts"

STAGE_ORDER = [
    "title",
    "abstract",
    "introduction",
    "related_work",
    "methodology",
    "experiment_design",
    "analysis",
    "conclusion",
    "quality_check",
]

STAGE_PROGRESS = {
    "init": 0,
    "title": 10,
    "abstract": 20,
    "introduction": 35,
    "related_work": 42,
    "methodology": 50,
    "experiment_design": 65,
    "analysis": 80,
    "conclusion": 90,
    "quality_check": 95,
    "complete": 100,
}


# =============================================================================
# Exception
# =============================================================================

class CodeGenerationError(Exception):
    """Raised when generated code has syntax errors"""
    pass


# =============================================================================
# LLM Client Wrapper
# =============================================================================

@dataclass
class LLMResponse:
    text: str
    model: str = "unknown"
    usage: Dict[str, int] = field(default_factory=dict)


class LLMClient:
    """Unified LLM client wrapper. Prefers Kimi, falls back to structured fallback."""

    def __init__(self):
        self._client = None
        self._model = "kimi-for-coding"
        self._init_client()

    def _init_client(self):
        """Try to initialize Kimi client via Anthropic SDK"""
        try:
            from app.services.kimi_client import KimiExtractor

            extractor = KimiExtractor()
            self._client = extractor.client
            self._model = extractor.model
            logger.info(f"LLM client initialized: {self._model}")
        except Exception as e:
            logger.warning(f"Could not initialize Kimi client: {e}. Using fallback mode.")
            self._client = None

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        """Generate text via LLM"""
        if self._client is not None:
            return await self._call_kimi(prompt, system_prompt, temperature, max_tokens)
        return self._fallback_generate(prompt)

    async def _call_kimi(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> LLMResponse:
        """Call Kimi API via Anthropic SDK"""
        kwargs: Dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        try:
            response = await self._client.messages.create(**kwargs)
            text = response.content[0].text
            # Strip markdown fences (AutoResearchClaw Stage 10 fix)
            text = _strip_markdown_fences(text)
            return LLMResponse(
                text=text,
                model=self._model,
                usage={
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
            )
        except Exception as e:
            logger.error(f"Kimi API call failed: {e}")
            return self._fallback_generate(prompt)

    def _fallback_generate(self, prompt: str) -> LLMResponse:
        """
        Fallback when no LLM is available.
        Returns a structured template that is better than raw mock text.
        """
        # Detect what kind of content is being requested from the prompt
        prompt_lower = prompt.lower()

        if "title" in prompt_lower and "option" in prompt_lower:
            return LLMResponse(text=_FALLBACK_TITLE)
        if "abstract" in prompt_lower or "pmr" in prompt_lower:
            return LLMResponse(text=_FALLBACK_ABSTRACT)
        if "introduction" in prompt_lower and "paragraph" in prompt_lower:
            return LLMResponse(text=_FALLBACK_INTRODUCTION)
        if "methodology" in prompt_lower or "method" in prompt_lower:
            return LLMResponse(text=_FALLBACK_METHODOLOGY)
        if "experiment design" in prompt_lower or "experimental" in prompt_lower:
            return LLMResponse(text=_FALLBACK_EXPERIMENT_DESIGN)
        if "analysis" in prompt_lower and "result" in prompt_lower:
            return LLMResponse(text=_FALLBACK_ANALYSIS)
        if "conclusion" in prompt_lower:
            return LLMResponse(text=_FALLBACK_CONCLUSION)
        if "related work" in prompt_lower:
            return LLMResponse(text=_FALLBACK_RELATED_WORK)

        return LLMResponse(text="[Content generation requires LLM API key. Please set KIMI_API_KEY.]")


# =============================================================================
# Fallback Content Templates (used when LLM is unavailable)
# =============================================================================

_FALLBACK_TITLE = """Option 1 (Highest confidence): [Method]: A Novel Approach for [Problem] in [Domain]
Rationale: Follows standard academic title conventions with clear method-problem-domain structure.

Option 2: Enhancing [Capability] through [Technique] for [Application]
Rationale: Emphasizes practical impact and technical contribution.

Option 3: Towards [Goal]: [Method] for [Problem]
Rationale: Forward-looking framing suitable for emerging research directions."""

_FALLBACK_ABSTRACT = """[ABSTRACT PLACEHOLDER — LLM unavailable]

Problem: [The specific research gap this work addresses]
Method: [The proposed technical approach]
Result: [Expected or preliminary findings]

Word count: 0 words (placeholder)

Note: Set KIMI_API_KEY environment variable for real abstract generation."""

_FALLBACK_INTRODUCTION = """1. Introduction

[INTRODUCTION PLACEHOLDER — LLM unavailable]

Paragraph 1 — Opening & Motivation:
[Set the broader context and importance of the research area]

Paragraph 2 — Problem Statement:
[Narrow down to the specific gap and limitations of existing approaches]

Paragraph 3 — Proposed Solution:
[High-level description of the approach and key innovations]

Paragraph 4 — Contributions:
[List 3-4 concrete contributions]

Paragraph 5 — Paper Organization:
[Roadmap of remaining sections]

Note: Set KIMI_API_KEY for real introduction generation."""

_FALLBACK_RELATED_WORK = """2. Related Work

[RELATED WORK PLACEHOLDER — LLM unavailable]

2.1 Problem Domain Background
[Broader field context]

2.2 Existing Approaches
[Review of prior methods]

2.3 Gaps and Opportunities
[What is missing]

Note: Set KIMI_API_KEY for real related work generation."""

_FALLBACK_METHODOLOGY = """3. Methodology

[METHODOLOGY PLACEHOLDER — LLM unavailable]

3.1 Overview / Problem Formulation
[Mathematical formulation and notation]

3.2 Core Algorithm/Architecture
[Main method description]

3.3 Component Details
[Breakdown of each component]

3.4 Training/Optimization
[Loss function and optimization]

3.5 Implementation Details
[Software stack and reproducibility info]

Note: Set KIMI_API_KEY for real methodology generation."""

_FALLBACK_EXPERIMENT_DESIGN = """4. Experimental Setup

[EXPERIMENT DESIGN PLACEHOLDER — LLM unavailable]

4.1 Dataset and Evaluation Protocol
[Dataset description and splits]

4.2 Baseline Methods
[Methods for comparison]

4.3 Main Results
[Expected outcomes]

4.4 Ablation Studies
[Component analysis plan]

4.5 Statistical Testing
[Significance tests]

Note: Set KIMI_API_KEY for real experiment design generation.

=== EXPERIMENT SLOTS ===
Slot 1: Main Performance — [PENDING: Collect metrics for method + baselines]
Slot 2: Ablation Study — [PENDING: Component-wise performance data]
Slot 3: Analysis — [PENDING: Robustness and efficiency data]"""

_FALLBACK_ANALYSIS = """5. Results and Analysis

[ANALYSIS PLACEHOLDER — LLM unavailable]

5.1 Main Results
[Performance summary]

5.2 Ablation Analysis
[Component contributions]

5.3 Comparison with Baselines
[Head-to-head analysis]

5.4 Qualitative Analysis
[Case studies and visual examples]

5.5 Limitations and Broader Impact
[Honest discussion of limitations]

Note: Set KIMI_API_KEY for real analysis generation.
This section will be auto-completed when experiment data is injected."""

_FALLBACK_CONCLUSION = """6. Conclusion

[CONCLUSION PLACEHOLDER — LLM unavailable]

[Summary of contributions]

[Key technical contributions]

[Broader impact and limitations]

[Future work directions]

Note: Set KIMI_API_KEY for real conclusion generation."""


# =============================================================================
# Utility Functions
# =============================================================================

def _strip_markdown_fences(text: str) -> str:
    """Strip markdown code fences from LLM output.

    Fixes AutoResearchClaw Stage 10 bug where ```filename:main.py
    gets written as the first line of a .py file, causing SyntaxError.
    """
    text = text.strip()
    # Strip leading ```language
    if text.startswith("```"):
        # Find first newline after opening fence
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        else:
            text = text[3:]
    # Strip trailing ```
    if text.endswith("```"):
        text = text[:-3].strip()
    return text


def _sanitize_code_output(raw_output: str) -> str:
    """Sanitize code output before writing to file.

    1. Remove markdown fences
    2. Validate Python syntax (if applicable)
    3. Remove filename annotations like 'filename:main.py'
    """
    lines = raw_output.split("\n")

    # Remove opening fence and filename annotation
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    # Remove lines like 'filename:main.py' or 'main.py'
    if lines and ("filename:" in lines[0] or lines[0].strip().endswith(".py")):
        lines = lines[1:]

    # Remove closing fence
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]

    code = "\n".join(lines).strip()

    # Validate Python syntax if it looks like Python
    if "import " in code or "def " in code or "class " in code:
        import ast
        try:
            ast.parse(code)
        except SyntaxError as e:
            raise CodeGenerationError(f"Generated code has syntax error at line {e.lineno}: {e.msg}")

    return code


def _extract_best_title(response: str) -> str:
    """Extract the best title option from LLM response"""
    lines = response.split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Skip option headers and rationales
        if line.lower().startswith("option"):
            continue
        if line.lower().startswith("rationale:"):
            continue
        if line.startswith("-") or line.startswith("*"):
            line = line[1:].strip()
        # Look for a substantial line that looks like a title
        if 15 < len(line) < 200 and not line.startswith("#"):
            return line
    return "A Novel Approach to the Target Research Problem"


def _parse_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """Try to extract JSON from text that may be wrapped in markdown fences"""
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown fence
    pattern = r"```(?:json)?\s*\n?(.*?)\n?```"
    matches = re.findall(pattern, text, re.DOTALL)
    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    # Try finding any JSON-like object
    pattern2 = r"\{[\s\S]*?\}"
    matches2 = re.findall(pattern2, text)
    for match in matches2:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue

    return None


# =============================================================================
# Main Engine
# =============================================================================

class PaperWritingEngine:
    """Real LLM-driven paper generation engine.

    Usage:
        engine = PaperWritingEngine()
        spec = ResearchSpec(innovation_id="...", ...)
        paper = await engine.generate(spec)
    """

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client or LLMClient()
        self.prompts = self._load_prompts()

    def _load_prompts(self) -> Dict[str, str]:
        """Load prompt templates from the shared prompts directory"""
        prompts = {}
        prompt_files = {
            "title_generation": "title_generation.txt",
            "abstract_pmr": "abstract_pmr.txt",
            "introduction": "introduction.txt",
            "methodology": "methodology.txt",
            "experiment_design": "experiment_design.txt",
            "analysis_framework": "analysis_framework.txt",
            "conclusion": "conclusion.txt",
            "related_work": "related_work.txt",
        }
        for key, filename in prompt_files.items():
            filepath = PROMPTS_DIR / filename
            if filepath.exists():
                prompts[key] = filepath.read_text(encoding="utf-8")
            else:
                logger.warning(f"Prompt file not found: {filepath}")
                prompts[key] = f"# {key}\n\n[Template not configured]"
        return prompts

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    async def generate(self, spec: ResearchSpec) -> GeneratedPaper:
        """Generate a complete paper from a ResearchSpec.

        When no experiment data is available, experiment sections contain
        placeholders and ExperimentSlots are generated.
        """
        paper_id = f"paper_{uuid.uuid4().hex[:12]}"
        logger.info(f"Starting paper generation: {paper_id} for innovation {spec.innovation_id}")

        sections: Dict[str, PaperSection] = {}

        # 1. Title
        title = await self._generate_title(spec)
        sections["title"] = PaperSection(name="title", content=title)

        # 2. Abstract
        abstract = await self._generate_abstract(spec, title)
        sections["abstract"] = PaperSection(name="abstract", content=abstract)

        # 3. Introduction
        intro = await self._generate_introduction(spec, title, abstract)
        sections["introduction"] = PaperSection(name="introduction", content=intro)

        # 4. Related Work
        related = await self._generate_related_work(spec)
        sections["related_work"] = PaperSection(name="related_work", content=related)

        # 5. Methodology
        method = await self._generate_methodology(spec, title, abstract)
        sections["methodology"] = PaperSection(name="methodology", content=method)

        # 6. Experiment Design (generates placeholders + slots)
        exp_design, slots = await self._generate_experiment_design(spec, title)
        sections["experiment_design"] = PaperSection(
            name="experiment_design", content=exp_design, status="needs_data"
        )

        # 7. Analysis (placeholder when no data)
        analysis = await self._generate_analysis_placeholder(spec, title)
        sections["analysis"] = PaperSection(
            name="analysis", content=analysis, status="needs_data"
        )

        # 8. Conclusion
        conclusion = await self._generate_conclusion(spec, sections)
        sections["conclusion"] = PaperSection(name="conclusion", content=conclusion)

        # 9. Quality check
        quality = await self._validate_paper(sections)

        # Assemble outputs
        latex = self._assemble_latex(title, abstract, sections)
        markdown = self._assemble_markdown(title, abstract, sections)

        paper = GeneratedPaper(
            paper_id=paper_id,
            title=title,
            abstract=abstract,
            sections=sections,
            experiment_slots=slots,
            references=self._extract_references(spec.related_papers),
            target_venue=spec.target_venue,
            status=PaperStatus.DRAFT,
            latex_content=latex,
            markdown_content=markdown,
        )

        logger.info(f"Paper generation completed: {paper_id} with {len(slots)} experiment slots")
        return paper

    async def stream_generate(
        self, spec: ResearchSpec
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate a paper with streaming progress events.

        Yields dicts with keys: stage, progress, message, preview, paper.
        """
        stages = [
            ("title", 10, self._generate_title),
            ("abstract", 20, self._generate_abstract),
            ("introduction", 35, self._generate_introduction),
            ("related_work", 42, self._generate_related_work),
            ("methodology", 50, self._generate_methodology),
            ("experiment_design", 65, self._generate_experiment_design),
            ("analysis", 80, self._generate_analysis_placeholder),
            ("conclusion", 90, self._generate_conclusion),
            ("quality_check", 95, self._validate_paper),
        ]

        paper_id = f"paper_{uuid.uuid4().hex[:12]}"
        sections: Dict[str, PaperSection] = {}
        slots: List[ExperimentSlot] = []

        yield {
            "stage": "init",
            "progress": 0,
            "message": "Starting paper generation...",
            "paper_id": paper_id,
        }

        for stage_name, progress, stage_func in stages:
            try:
                yield {
                    "stage": stage_name,
                    "progress": progress,
                    "message": f"Generating {stage_name.replace('_', ' ')}...",
                }

                if stage_name == "title":
                    content = await stage_func(spec)
                    sections["title"] = PaperSection(name="title", content=content)
                elif stage_name == "abstract":
                    content = await stage_func(spec, sections["title"].content)
                    sections["abstract"] = PaperSection(name="abstract", content=content)
                elif stage_name == "introduction":
                    content = await stage_func(
                        spec, sections["title"].content, sections["abstract"].content
                    )
                    sections["introduction"] = PaperSection(name="introduction", content=content)
                elif stage_name == "related_work":
                    content = await stage_func(spec)
                    sections["related_work"] = PaperSection(name="related_work", content=content)
                elif stage_name == "methodology":
                    content = await stage_func(
                        spec, sections["title"].content, sections["abstract"].content
                    )
                    sections["methodology"] = PaperSection(name="methodology", content=content)
                elif stage_name == "experiment_design":
                    design_text, slots = await stage_func(spec, sections["title"].content)
                    sections["experiment_design"] = PaperSection(
                        name="experiment_design", content=design_text, status="needs_data"
                    )
                elif stage_name == "analysis":
                    content = await stage_func(spec, sections["title"].content)
                    sections["analysis"] = PaperSection(
                        name="analysis", content=content, status="needs_data"
                    )
                elif stage_name == "conclusion":
                    content = await stage_func(spec, sections)
                    sections["conclusion"] = PaperSection(name="conclusion", content=content)
                elif stage_name == "quality_check":
                    quality = await stage_func(sections)
                    content = f"Overall: {quality.overall_score}"
                    sections["quality_check"] = PaperSection(name="quality_check", content=content)

                preview = content[:200] + "..." if len(str(content)) > 200 else str(content)
                yield {
                    "stage": stage_name,
                    "progress": progress,
                    "message": f"Completed {stage_name.replace('_', ' ')}",
                    "preview": preview,
                    "status": "stage_complete",
                }

                await asyncio.sleep(0.05)

            except Exception as e:
                logger.error(f"Stage {stage_name} failed: {e}")
                yield {
                    "stage": stage_name,
                    "progress": progress,
                    "message": f"Stage failed: {e}",
                    "error": str(e),
                    "status": "error",
                }
                return

        # Assemble final paper
        latex = self._assemble_latex(
            sections["title"].content, sections["abstract"].content, sections
        )
        markdown = self._assemble_markdown(
            sections["title"].content, sections["abstract"].content, sections
        )

        paper = GeneratedPaper(
            paper_id=paper_id,
            title=sections["title"].content,
            abstract=sections["abstract"].content,
            sections=sections,
            experiment_slots=slots,
            references=self._extract_references(spec.related_papers),
            target_venue=spec.target_venue,
            status=PaperStatus.DRAFT,
            latex_content=latex,
            markdown_content=markdown,
        )

        yield {
            "stage": "complete",
            "progress": 100,
            "message": "Paper generation completed successfully",
            "paper": paper.to_dict(),
            "status": "complete",
        }

    # -------------------------------------------------------------------------
    # Stage Generators
    # -------------------------------------------------------------------------

    async def _generate_title(self, spec: ResearchSpec) -> str:
        """Generate paper title"""
        template = self.prompts.get("title_generation", "")
        variables = {
            "problem": spec.problem_statement[:300] if spec.problem_statement else "Research Problem",
            "method": spec.proposed_solution[:300] if spec.proposed_solution else "Novel Method",
            "target_venue": spec.target_venue,
            "domain": spec.domain.replace("_", " ").title(),
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.7, max_tokens=1024)
        return _extract_best_title(response.text)

    async def _generate_abstract(self, spec: ResearchSpec, title: str) -> str:
        """Generate PMR-format abstract"""
        template = self.prompts.get("abstract_pmr", "")
        variables = {
            "title": title,
            "problem": spec.problem_statement[:500] if spec.problem_statement else "",
            "method": spec.proposed_solution[:500] if spec.proposed_solution else "",
            "expected_outcomes": spec.expected_impact[:300] if spec.expected_impact else "",
            "target_venue": spec.target_venue,
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.5, max_tokens=2048)
        return response.text.strip()

    async def _generate_introduction(
        self, spec: ResearchSpec, title: str, abstract: str
    ) -> str:
        """Generate introduction section"""
        template = self.prompts.get("introduction", "")
        related_summary = self._format_related_work(spec.related_papers)
        variables = {
            "title": title,
            "abstract": abstract[:800],
            "problem_domain": spec.problem_statement[:400] if spec.problem_statement else "",
            "contributions": spec.expected_impact[:400] if spec.expected_impact else "",
            "related_work": related_summary,
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.6, max_tokens=4096)
        return response.text.strip()

    async def _generate_related_work(self, spec: ResearchSpec) -> str:
        """Generate related work section"""
        template = self.prompts.get("related_work", "")
        papers_text = self._format_related_work(spec.related_papers)
        variables = {
            "source_papers": papers_text,
            "problem_domain": spec.problem_statement[:300] if spec.problem_statement else "",
            "target_venue": spec.target_venue,
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.5, max_tokens=4096)
        return response.text.strip()

    async def _generate_methodology(
        self, spec: ResearchSpec, title: str, abstract: str
    ) -> str:
        """Generate methodology section"""
        template = self.prompts.get("methodology", "")
        components = json.dumps(
            [step.get("description", "") for step in spec.implementation_path[:5]]
        )
        variables = {
            "title": title,
            "abstract": abstract[:600],
            "components": components,
            "architecture": spec.proposed_solution[:500] if spec.proposed_solution else "",
            "notation": "Standard mathematical notation",
            "venue": spec.target_venue,
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.5, max_tokens=4096)
        return response.text.strip()

    async def _generate_experiment_design(
        self, spec: ResearchSpec, title: str
    ) -> tuple[str, List[ExperimentSlot]]:
        """Generate experiment design section and data collection slots"""
        template = self.prompts.get("experiment_design", "")
        variables = {
            "method": spec.proposed_solution[:400] if spec.proposed_solution else title,
            "research_questions": json.dumps([spec.problem_statement[:200]] if spec.problem_statement else ["Main research question"]),
            "resources": "Standard compute (GPU recommended)",
            "baselines": "State-of-the-art methods in the field",
            "metrics": "Standard evaluation metrics for the domain",
            "budget": "Reasonable computational budget",
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.5, max_tokens=4096)
        design_text = response.text.strip()

        # Generate structured experiment slots
        slots = self._create_experiment_slots(spec)
        # Append slot placeholders to design text
        design_text += "\n\n## Data Collection Slots\n\n"
        for slot in slots:
            design_text += f"**{slot.slot_id}** ({slot.slot_type}): {slot.description}\n"
            design_text += f"- Status: {slot.placeholder}\n\n"

        return design_text, slots

    async def _generate_analysis_placeholder(self, spec: ResearchSpec, title: str) -> str:
        """Generate analysis section placeholder (will be filled with real data later)"""
        template = self.prompts.get("analysis_framework", "")
        variables = {
            "results": "[PENDING: Experiment results to be collected and injected]",
            "questions": json.dumps([spec.problem_statement[:200]] if spec.problem_statement else []),
            "method": title,
            "comparisons": "State-of-the-art baselines",
        }
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.5, max_tokens=4096)
        text = response.text.strip()

        # Mark as placeholder
        text = (
            "[ANALYSIS SECTION — AWAITING EXPERIMENT DATA]\n\n"
            "This section will be auto-completed when experiment data is injected.\n\n"
            + text
        )
        return text

    async def _generate_conclusion(
        self, spec: ResearchSpec, sections: Dict[str, PaperSection]
    ) -> str:
        """Generate conclusion section"""
        template = self.prompts.get("conclusion", "")
        sections_text = f"""
Title: {sections.get('title', PaperSection(name='title', content='')).content}

Abstract: {sections.get('abstract', PaperSection(name='abstract', content='')).content[:300]}

Key Contributions:
- {sections.get('methodology', PaperSection(name='methodology', content='')).content[:200]}...
- {sections.get('experiment_design', PaperSection(name='experiment_design', content='')).content[:200]}...
"""
        variables = {"sections": sections_text}
        prompt = self._fill_template(template, variables)
        response = await self.llm.generate(prompt, temperature=0.6, max_tokens=4096)
        return response.text.strip()

    # -------------------------------------------------------------------------
    # Validation
    # -------------------------------------------------------------------------

    async def _validate_paper(self, sections: Dict[str, PaperSection]) -> QualityReport:
        """Run quality checks on generated paper"""
        issues = []
        suggestions = []

        # Check completeness
        required = ["title", "abstract", "introduction", "methodology", "conclusion"]
        for key in required:
            if key not in sections or not sections[key].content.strip():
                issues.append(f"Missing or empty section: {key}")

        # Check abstract length
        abstract = sections.get("abstract", PaperSection(name="abstract", content="")).content
        word_count = len(abstract.split())
        if word_count < 100:
            suggestions.append(f"Abstract is short ({word_count} words). Target: 150-250 words.")
        elif word_count > 300:
            suggestions.append(f"Abstract is long ({word_count} words). Target: 150-250 words.")

        # Check for placeholder markers
        full_text = " ".join(s.content for s in sections.values())
        placeholder_count = full_text.count("[PENDING]") + full_text.count("[PLACEHOLDER]")
        if placeholder_count > 0:
            suggestions.append(f"Found {placeholder_count} placeholder markers. These are expected in experiment sections before data injection.")

        # Scoring (simplified heuristic)
        completeness = max(0.0, 1.0 - len(issues) * 0.2)
        coherence = 0.8 if len(sections) >= 6 else 0.5
        style = 0.75 if word_count > 100 else 0.5
        overall = (completeness + coherence + style) / 3.0

        return QualityReport(
            overall_score=round(overall, 2),
            completeness_score=round(completeness, 2),
            coherence_score=round(coherence, 2),
            style_score=round(style, 2),
            issues=issues,
            suggestions=suggestions,
            passes_minimum=overall >= 0.5 and len(issues) == 0,
        )

    # -------------------------------------------------------------------------
    # Assembly
    # -------------------------------------------------------------------------

    def _assemble_markdown(
        self, title: str, abstract: str, sections: Dict[str, PaperSection]
    ) -> str:
        """Assemble all sections into Markdown"""
        lines = [
            f"# {title}",
            "",
            "## Abstract",
            abstract,
            "",
        ]
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
            if sec and sec.content.strip():
                lines.extend([f"## {heading}", "", sec.content, ""])
        lines.extend([
            "## References",
            "[References to be added]",
            "",
            f"---",
            f"*Generated by Research-Nexus Pro — {datetime.now().strftime('%Y-%m-%d')}*",
        ])
        return "\n".join(lines)

    def _assemble_latex(
        self, title: str, abstract: str, sections: Dict[str, PaperSection]
    ) -> str:
        """Assemble all sections into LaTeX"""
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
            if sec and sec.content.strip():
                # Basic markdown-to-latex conversion
                content = sec.content
                content = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", content)
                content = re.sub(r"\*(.+?)\*", r"\\textit{\1}", content)
                content = re.sub(r"^#{1,3}\s+(.+)$", r"\\textbf{\1}", content, flags=re.MULTILINE)
                latex_sections.append(f"\\section{{{heading}}}\n{content}")

        latex = f"""\\documentclass{{article}}
\\usepackage{{amsmath,amssymb,amsfonts}}
\\usepackage{{graphicx}}
\\usepackage{{hyperref}}
\\usepackage{{booktabs}}
\\usepackage{{algorithm}}
\\usepackage{{algpseudocode}}

\\title{{{title}}}
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
        return latex

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _fill_template(self, template: str, variables: Dict[str, str]) -> str:
        """Fill template variables safely"""
        try:
            t = Template(template)
            return t.safe_substitute(variables)
        except Exception as e:
            logger.warning(f"Template filling failed: {e}")
            result = template
            for key, value in variables.items():
                result = result.replace(f"{{{{{key}}}}}", str(value))
            return result

    def _format_related_work(self, papers: List[Dict[str, Any]]) -> str:
        """Format related papers for prompt"""
        if not papers:
            return "No specific source papers listed."
        summaries = []
        for paper in papers[:10]:
            title = paper.get("title", "Unknown")
            year = paper.get("year", "N/A")
            authors = ", ".join(paper.get("authors", [])[:2])
            summaries.append(f"- {title} ({year}) — {authors}")
        return "\n".join(summaries)

    def _extract_references(self, papers: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Extract references from paper list"""
        refs = []
        for i, paper in enumerate(papers[:20], 1):
            authors = paper.get("authors", [])
            if isinstance(authors, list):
                authors_str = ", ".join(authors[:3])
            else:
                authors_str = str(authors)
            ref = {
                "id": f"[{i}]",
                "title": paper.get("title", "Unknown"),
                "authors": authors_str,
                "year": str(paper.get("year", "2024")),
                "venue": paper.get("venue", "Unknown"),
            }
            refs.append(ref)
        return refs

    def _create_experiment_slots(self, spec: ResearchSpec) -> List[ExperimentSlot]:
        """Create default experiment data collection slots"""
        slots = [
            ExperimentSlot(
                slot_id="exp_1",
                slot_type="main_performance",
                description="Main performance evaluation: compare proposed method against baselines",
                expected_outcome="Table with mean ± std across multiple runs",
                estimated_weeks=2,
                placeholder="[PENDING: Main performance metrics — collect results with 5+ random seeds]",
            ),
            ExperimentSlot(
                slot_id="exp_2",
                slot_type="ablation_study",
                description="Ablation study to validate each component's contribution",
                expected_outcome="Bar chart + table showing component importance",
                estimated_weeks=1,
                placeholder="[PENDING: Ablation results — remove each component and measure impact]",
            ),
            ExperimentSlot(
                slot_id="exp_3",
                slot_type="robustness_analysis",
                description="Robustness tests under various conditions",
                expected_outcome="Analysis figures and statistical tests",
                estimated_weeks=1,
                placeholder="[PENDING: Robustness data — test under different hyperparameters and data conditions]",
            ),
        ]

        # Add cross-domain validation if applicable
        if "cross" in spec.domain.lower() or "transfer" in spec.proposed_solution.lower():
            slots.append(
                ExperimentSlot(
                    slot_id="exp_4",
                    slot_type="cross_domain_validation",
                    description="Validate method across different domains",
                    expected_outcome="Cross-domain performance comparison",
                    estimated_weeks=2,
                    placeholder="[PENDING: Cross-domain validation — test on multiple target domains]",
                )
            )

        return slots
