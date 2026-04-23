"""
Experimentalist Agent — Designs MVP experiments to validate hypotheses.

Responsibilities:
- Design minimal viable experiments given resource constraints
- Propose datasets, baselines, metrics, and expected outcomes
- Estimate compute and time requirements
- Identify confounding variables and control strategies
"""

import json
import logging
from typing import Dict, Any

from app.agents.base import BaseAgent, AgentContext, AgentOutput

logger = logging.getLogger(__name__)


class ExperimentalistAgent(BaseAgent):
    """
    The Experimentalist designs validation experiments for hypotheses.

    Input: a hypothesis + opportunity context
    Output: structured experiment design (steps, dataset, metrics, expected results)
    """

    name = "Experimentalist"
    system_prompt = (
        "You are the Experimentalist, a pragmatic research scientist who designs "
        "minimal viable experiments to test hypotheses. You care about: "
        "(1) reproducibility, (2) statistical power, (3) resource efficiency. "
        "You always suggest concrete datasets, baselines, and evaluation metrics."
    )

    async def run(self, context: AgentContext) -> AgentOutput:
        """Design an experiment for the current hypothesis."""
        opportunity = context.extra.get("opportunity", {})
        hypothesis = context.extra.get("current_hypothesis", {})

        if not self.llm_client:
            return self._placeholder_output(opportunity, hypothesis)

        prompt = self._build_prompt(opportunity, hypothesis)
        response = await self._call_llm(prompt, temperature=0.5, max_tokens=2048)

        try:
            structured = self._extract_json(response)
        except Exception:
            structured = self._parse_fallback(response)

        return AgentOutput(
            agent_name=self.name,
            stage="experiment_design",
            content=response,
            structured_data=structured,
            confidence=structured.get("feasibility_score", 0.7)
        )

    def _build_prompt(self, opportunity: Dict[str, Any], hypothesis: Dict[str, Any]) -> str:
        """Construct the experiment design prompt."""
        opp_rationale = opportunity.get("rationale", "")
        opp_type = opportunity.get("innovation_type", "unknown")
        hyp_text = hypothesis.get("hypothesis", "")
        target_problem = opportunity.get("target_problem_id", "")
        candidate_methods = opportunity.get("candidate_method_ids", [])

        return f"""Design a minimal viable experiment (MVP) to test the following research hypothesis.

Opportunity Type: {opp_type}
Problem: {target_problem}
Candidate Methods: {', '.join(candidate_methods)}
Rationale: {opp_rationale}

Hypothesis: {hyp_text}

Your experiment design must include:
1. objective — one sentence stating what this experiment validates
2. dataset — name or description of the dataset(s) to use
3. baselines — which existing methods to compare against
4. steps — numbered list of experimental steps (3-7 steps)
5. metrics — list of evaluation metrics with justification
6. expected_results — what outcomes would support vs refute the hypothesis
7. resources — estimated compute (GPU hours), time, and personnel
8. risks — main confounders and how to control them

Respond in JSON format:
{{
  "objective": "...",
  "dataset": "...",
  "baselines": ["..."],
  "steps": ["..."],
  "metrics": ["..."],
  "expected_results": "...",
  "resources": "...",
  "risks": "...",
  "feasibility_score": 0.0-1.0
}}"""

    def _placeholder_output(self, opportunity: Dict[str, Any],
                            hypothesis: Dict[str, Any]) -> AgentOutput:
        """Return a sensible placeholder when no LLM is available."""
        opp_type = opportunity.get("innovation_type", "cdt")
        target_problem = opportunity.get("target_problem_id", "")
        candidate_methods = opportunity.get("candidate_method_ids", [])

        return AgentOutput(
            agent_name=self.name,
            stage="experiment_design",
            content="No LLM available — returning generic experiment template.",
            structured_data={
                "objective": f"Validate whether combining methods for {target_problem} improves performance.",
                "dataset": "Standard benchmark dataset for the target domain",
                "baselines": candidate_methods if candidate_methods else ["existing SOTA method"],
                "steps": [
                    "Implement proposed method combination",
                    "Run on benchmark dataset",
                    "Evaluate against baselines",
                    "Perform ablation study"
                ],
                "metrics": ["accuracy", "efficiency", "robustness"],
                "expected_results": "Significant improvement over baselines with p<0.05",
                "resources": "~40 GPU hours, 2 weeks",
                "risks": "Implementation bugs, hyperparameter sensitivity",
                "feasibility_score": 0.6,
                "placeholder": True
            },
            confidence=0.6
        )

    def _parse_fallback(self, text: str) -> Dict[str, Any]:
        """If JSON parsing fails, return a minimal structured object."""
        return {
            "objective": "See raw response",
            "raw_response": text[:500],
            "feasibility_score": 0.5,
            "parse_error": True
        }
