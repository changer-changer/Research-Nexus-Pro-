"""
Paper Iteration Engine — Iterative Refinement with User Feedback

Usage:
    engine = IterationEngine()
    result = await engine.refine_section(
        paper=paper,
        section_name="methodology",
        feedback="Make the notation more formal and add complexity analysis",
    )
"""

from __future__ import annotations

import logging
import uuid
from typing import Dict, List, Optional

from .engine import LLMClient
from .models import GeneratedPaper, IterationRecord, PaperSection

logger = logging.getLogger(__name__)


_REFINE_SYSTEM_PROMPT = """You are an expert academic editor. Your task is to refine a specific section of a research paper based on user feedback.

Rules:
1. Preserve the original structure and length as much as possible
2. Address ALL points in the feedback
3. Maintain academic tone and technical accuracy
4. Do not introduce new claims without evidence
5. Ensure coherence with the rest of the paper
6. Output ONLY the refined section text, no explanations
"""


class IterationEngine:
    """Engine for iterative paper refinement"""

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client or LLMClient()

    async def refine_section(
        self,
        paper: GeneratedPaper,
        section_name: str,
        feedback: str,
    ) -> Dict[str, str]:
        """
        Refine a single section based on user feedback.

        Returns:
            {
                "section_name": str,
                "original": str,
                "refined": str,
                "iteration_id": str,
                "coherence_warnings": List[str],
            }
        """
        section = paper.sections.get(section_name)
        if not section:
            raise ValueError(f"Section '{section_name}' not found in paper")

        original = section.content

        # Build context prompt
        context = self._build_refine_prompt(paper, section_name, original, feedback)

        # Call LLM
        response = await self.llm.generate(
            prompt=context,
            system_prompt=_REFINE_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=4096,
        )
        refined = response.text.strip()

        # Validate coherence
        warnings = self._check_coherence(paper, section_name, original, refined)

        iteration_id = f"iter_{uuid.uuid4().hex[:8]}"

        logger.info(f"Refined section '{section_name}': iteration {iteration_id}")

        return {
            "section_name": section_name,
            "original": original,
            "refined": refined,
            "iteration_id": iteration_id,
            "coherence_warnings": warnings,
        }

    async def refine_multiple(
        self,
        paper: GeneratedPaper,
        feedbacks: Dict[str, str],
    ) -> Dict[str, Dict[str, str]]:
        """
        Refine multiple sections at once.

        Args:
            paper: The paper to refine
            feedbacks: Dict of {section_name: feedback_text}

        Returns:
            Dict of {section_name: refine_result}
        """
        results = {}
        for section_name, feedback in feedbacks.items():
            try:
                result = await self.refine_section(paper, section_name, feedback)
                results[section_name] = result
            except Exception as e:
                logger.error(f"Failed to refine section '{section_name}': {e}")
                results[section_name] = {
                    "section_name": section_name,
                    "original": paper.sections.get(section_name, PaperSection(name=section_name, content="")).content,
                    "refined": f"[ERROR: Refinement failed - {e}]",
                    "iteration_id": f"iter_error_{uuid.uuid4().hex[:8]}",
                    "coherence_warnings": [str(e)],
                }
        return results

    def create_iteration_record(
        self,
        paper_id: str,
        section_name: str,
        feedback: str,
        before: str,
        after: str,
    ) -> IterationRecord:
        """Create a record of an iteration"""
        return IterationRecord(
            iteration_id=f"iter_{uuid.uuid4().hex[:8]}",
            paper_id=paper_id,
            section_name=section_name,
            feedback=feedback,
            before=before,
            after=after,
        )

    def _build_refine_prompt(
        self,
        paper: GeneratedPaper,
        section_name: str,
        original: str,
        feedback: str,
    ) -> str:
        """Build the refinement prompt with full paper context"""
        # Gather neighboring sections for context
        section_order = [
            "title", "abstract", "introduction", "related_work",
            "methodology", "experiment_design", "analysis", "conclusion"
        ]

        context_sections = []
        idx = section_order.index(section_name) if section_name in section_order else -1

        if idx > 0:
            prev_name = section_order[idx - 1]
            prev = paper.sections.get(prev_name)
            if prev:
                context_sections.append(f"PREVIOUS SECTION ({prev_name}):\n{prev.content[:500]}...")

        if idx < len(section_order) - 1:
            next_name = section_order[idx + 1]
            nxt = paper.sections.get(next_name)
            if nxt:
                context_sections.append(f"NEXT SECTION ({next_name}):\n{nxt.content[:500]}...")

        context_text = "\n\n".join(context_sections)

        prompt = f"""# Paper Context

Title: {paper.title}
Target Venue: {paper.target_venue}

{context_text}

# Section to Refine

SECTION: {section_name}

ORIGINAL TEXT:
---
{original}
---

# User Feedback

{feedback}

# Instructions

Please refine the section above based on the feedback. Output ONLY the refined section text (no explanations, no markdown fences). Maintain the same general structure and length unless the feedback specifically requests changes.
"""
        return prompt

    def _check_coherence(
        self,
        paper: GeneratedPaper,
        section_name: str,
        original: str,
        refined: str,
    ) -> List[str]:
        """Check if refinement introduces coherence issues"""
        warnings = []

        # Check if key terms from original were lost
        original_terms = set(original.lower().split())
        refined_terms = set(refined.lower().split())
        lost_terms = original_terms - refined_terms

        # Check for significant length change
        orig_len = len(original.split())
        refined_len = len(refined.split())
        if orig_len > 50:
            ratio = refined_len / orig_len
            if ratio < 0.5:
                warnings.append(f"Refined section is much shorter ({refined_len} vs {orig_len} words). Content may have been lost.")
            elif ratio > 2.0:
                warnings.append(f"Refined section is much longer ({refined_len} vs {orig_len} words). Consider condensing.")

        # Check for title consistency
        title_words = set(paper.title.lower().split())
        refined_words = set(refined.lower().split())
        if not title_words & refined_words and section_name not in ["title", "abstract"]:
            warnings.append("Refined section does not reference paper title keywords. Check for consistency.")

        return warnings
