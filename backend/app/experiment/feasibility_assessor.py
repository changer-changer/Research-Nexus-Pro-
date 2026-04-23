"""
Experiment Feasibility Assessor — LLM-based pre-check before auto-experimentation

Avoids the AutoResearchClaw Stage 12-13 dead loop by performing a thorough
feasibility assessment BEFORE attempting automated experiments.

Decision matrix:
- High feasibility (>80%): AI can auto-run
- Medium feasibility (50-80%): Human supervision required
- Low feasibility (<50%): Human-only, generate design doc only
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.paper_writing.engine import LLMClient

logger = logging.getLogger(__name__)

_FEASIBILITY_SYSTEM_PROMPT = """You are an expert research methodology assessor. Your job is to evaluate whether a proposed experiment can be successfully executed automatically by AI, or if it requires human involvement.

Evaluate across these dimensions:
1. Technical prerequisites: Are all datasets, libraries, and compute resources readily available?
2. Method maturity: Has this type of experiment been done before? What is the typical success rate?
3. Common failure modes: What typically goes wrong? Can AI handle those failures?
4. Human involvement needed: Does the experiment require physical actions, human judgment, or domain expertise?

Output MUST be valid JSON with this exact structure:
{
  "overall_score": 0-100,
  "decision": "ai_auto" | "human_guided" | "hybrid" | "not_recommended",
  "confidence": 0-1,
  "dimensions": {
    "technical_prerequisites": {"score": 0-100, "assessment": "...", "risks": ["..."]},
    "method_maturity": {"score": 0-100, "assessment": "...", "similar_works": ["..."]},
    "common_failures": {"score": 0-100, "assessment": "...", "failure_modes": ["..."]},
    "human_involvement": {"score": 0-100, "assessment": "...", "required_actions": ["..."]}
  },
  "recommendations": ["..."],
  "estimated_time_hours": number,
  "estimated_cost_usd": number or null,
  "required_resources": ["..."],
  "risk_factors": ["..."]
}
"""


@dataclass
class DimensionAssessment:
    score: int = 0
    assessment: str = ""
    risks: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {"score": self.score, "assessment": self.assessment, "risks": self.risks}


@dataclass
class FeasibilityResult:
    """Result of feasibility assessment"""
    overall_score: int = 0          # 0-100
    decision: str = "unknown"       # ai_auto | human_guided | hybrid | not_recommended
    confidence: float = 0.0         # 0-1
    dimensions: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    estimated_time_hours: Optional[float] = None
    estimated_cost_usd: Optional[float] = None
    required_resources: List[str] = field(default_factory=list)
    risk_factors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "decision": self.decision,
            "confidence": self.confidence,
            "dimensions": self.dimensions,
            "recommendations": self.recommendations,
            "estimated_time_hours": self.estimated_time_hours,
            "estimated_cost_usd": self.estimated_cost_usd,
            "required_resources": self.required_resources,
            "risk_factors": self.risk_factors,
        }

    @property
    def is_ai_auto(self) -> bool:
        return self.decision == "ai_auto" and self.overall_score >= 80

    @property
    def is_human_guided(self) -> bool:
        return self.decision in ("human_guided", "hybrid")

    @property
    def is_not_recommended(self) -> bool:
        return self.decision == "not_recommended"


# Simple TTL cache for feasibility assessments
_feasibility_cache: Dict[str, tuple] = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour


class FeasibilityAssessor:
    """LLM-based experiment feasibility assessor"""

    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client or LLMClient()

    def _cache_key(self, title: str, problem: str, solution: str) -> str:
        """Generate a cache key from assessment inputs."""
        content = f"{title}|{problem}|{solution}"
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached(self, key: str) -> Optional[FeasibilityResult]:
        """Get cached result if still valid."""
        if key in _feasibility_cache:
            result, timestamp = _feasibility_cache[key]
            if time.time() - timestamp < _CACHE_TTL_SECONDS:
                logger.info("Feasibility cache hit")
                return result
            else:
                del _feasibility_cache[key]
        return None

    def _set_cached(self, key: str, result: FeasibilityResult) -> None:
        """Cache assessment result."""
        _feasibility_cache[key] = (result, time.time())

    async def assess(
        self,
        title: str,
        problem_statement: str,
        proposed_solution: str,
        target_venue: str = "NeurIPS",
        existing_papers: Optional[List[Dict[str, Any]]] = None,
    ) -> FeasibilityResult:
        """
        Assess experiment feasibility for an innovation point.

        Returns a detailed assessment with decision on whether AI can auto-run,
        human guidance is needed, or the experiment is not recommended.
        """
        # Check cache first
        cache_key = self._cache_key(title, problem_statement, proposed_solution)
        cached = self._get_cached(cache_key)
        if cached:
            return cached

        papers_text = ""
        if existing_papers:
            papers_text = "\n".join(
                f"- {p.get('title', 'Unknown')} ({p.get('year', 'N/A')})"
                for p in existing_papers[:5]
            )

        prompt = f"""# Experiment Feasibility Assessment

## Proposed Research

Title: {title}

Problem: {problem_statement[:800]}

Proposed Solution: {proposed_solution[:800]}

Target Venue: {target_venue}

## Related Work Context

{papers_text if papers_text else "No related papers provided."}

## Instructions

Analyze whether the experiments for this research can be:
1. Fully automated by AI (pure software, well-defined benchmarks)
2. Human-guided (requires physical setup, domain expertise, or complex judgment)
3. Hybrid (some parts auto, some parts manual)
4. Not recommended for automation (too risky, ill-defined, or requiring novel hardware)

Be critical and realistic. Consider the history of similar experiments.
"""

        try:
            # Fast timeout: fail quickly to fallback instead of hanging
            response = await asyncio.wait_for(
                self.llm.generate(
                    prompt=prompt,
                    system_prompt=_FEASIBILITY_SYSTEM_PROMPT,
                    temperature=0.3,
                    max_tokens=4096,
                ),
                timeout=8.0,
            )

            parsed = self._parse_response(response.text)
            if parsed:
                self._set_cached(cache_key, parsed)
                return parsed
            else:
                logger.warning("Could not parse feasibility assessment, using fallback")
                result = self._fallback_assessment(title, problem_statement, proposed_solution)
                self._set_cached(cache_key, result)
                return result

        except asyncio.TimeoutError:
            logger.warning("Feasibility assessment timed out, using fast fallback")
            result = self._fallback_assessment(title, problem_statement, proposed_solution)
            self._set_cached(cache_key, result)
            return result
        except Exception as e:
            logger.error(f"Feasibility assessment failed: {e}")
            result = self._fallback_assessment(title, problem_statement, proposed_solution)
            self._set_cached(cache_key, result)
            return result

    def _parse_response(self, text: str) -> Optional[FeasibilityResult]:
        """Parse LLM response into FeasibilityResult"""
        try:
            # Strip markdown fences
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("\n", 1)[0]

            data = json.loads(text.strip())

            return FeasibilityResult(
                overall_score=data.get("overall_score", 50),
                decision=data.get("decision", "unknown"),
                confidence=data.get("confidence", 0.5),
                dimensions=data.get("dimensions", {}),
                recommendations=data.get("recommendations", []),
                estimated_time_hours=data.get("estimated_time_hours"),
                estimated_cost_usd=data.get("estimated_cost_usd"),
                required_resources=data.get("required_resources", []),
                risk_factors=data.get("risk_factors", []),
            )
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning(f"Failed to parse feasibility JSON: {e}")
            return None

    def _fallback_assessment(
        self, title: str, problem: str, solution: str
    ) -> FeasibilityResult:
        """Rule-based fallback when LLM is unavailable"""
        full_text = f"{title} {problem} {solution}".lower()

        # Keywords indicating hardware/physical experiments
        hardware_keywords = [
            "robot", "hardware", "sensor", "physical", "tactile", "haptic",
            "real world", "deployment", "fabrication", "clinical", "medical",
            "wet lab", "surgery", "drone", "vehicle"
        ]
        # Keywords indicating pure computational experiments
        software_keywords = [
            "benchmark", "dataset", "classification", "regression",
            "transformer", "llm", "gnn", "nlp", "cv", "simulation",
            "algorithm", "optimization", "synthetic"
        ]

        hw_score = sum(1 for kw in hardware_keywords if kw in full_text)
        sw_score = sum(1 for kw in software_keywords if kw in full_text)

        if hw_score > 2:
            decision = "human_guided"
            overall = max(20, 60 - hw_score * 10)
        elif sw_score > 2 and hw_score == 0:
            decision = "ai_auto"
            overall = min(95, 70 + sw_score * 5)
        else:
            decision = "hybrid"
            overall = 55

        return FeasibilityResult(
            overall_score=overall,
            decision=decision,
            confidence=0.6,
            dimensions={
                "technical_prerequisites": {"score": overall, "assessment": "Fallback assessment", "risks": []},
                "method_maturity": {"score": overall, "assessment": "Fallback assessment", "risks": []},
            },
            recommendations=["Please set KIMI_API_KEY for accurate feasibility assessment"],
            estimated_time_hours=4.0 if decision == "ai_auto" else 40.0,
            required_resources=["GPU (recommended)"] if decision == "ai_auto" else ["Hardware setup required"],
            risk_factors=["Fallback mode — assessment may not be accurate"],
        )
