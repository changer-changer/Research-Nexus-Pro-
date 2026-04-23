"""
Reviewer Agent — synthesizes the full debate into a final Innovation Insight.
"""
import json
from typing import Dict, Any
from app.agents.base import BaseAgent, AgentContext, AgentOutput


class ReviewerAgent(BaseAgent):
    """
    Senior PI role. Synthesizes Hypothesizer + Critic outputs into
    a polished, publication-ready Innovation Insight with scoring.
    """

    name = "Reviewer"
    system_prompt = """You are a senior Principal Investigator with 20 years of experience across multiple fields.
You synthesize research proposals from your team into polished, publication-ready insights.

Your synthesis must:
1. Preserve the core innovative insight
2. Incorporate all valid criticisms as addressed limitations
3. Present a balanced view of risks and rewards
4. Score the proposal objectively on multiple dimensions

Output must be in English for academic publication standards."""

    async def run(self, context: AgentContext) -> AgentOutput:
        hypothesis = context.extra.get('final_hypothesis', {})
        debate_log = context.extra.get('debate_log', [])
        opportunity = context.extra.get('opportunity', {})

        # Build a summary of the debate
        debate_summary = []
        for entry in debate_log:
            debate_summary.append(f"[{entry.get('agent', '?')}] {entry.get('stage', '?')}: {entry.get('content', '')[:200]}")

        debate_text = "\n".join(debate_summary)
        hypothesis_json = json.dumps(hypothesis, ensure_ascii=False, indent=2)
        candidate_methods = ", ".join(opportunity.get('candidate_method_ids', []))

        prompt = f"""Synthesize the following research debate into a final Innovation Insight:

Original Opportunity:
- Problem: {opportunity.get('target_problem_id', 'Unknown')}
- Methods: {candidate_methods}
- Type: {opportunity.get('innovation_type', 'cdt')}

Debate History:
{debate_text}

Final Hypothesis:
{hypothesis_json}

Return JSON:
{{
  "paper_title": "Final paper title",
  "innovation_type": "Final innovation type",
  "abstract": "300-word abstract covering problem, method, and impact",
  "rationale": "Core insight and why it matters",
  "hypothesis": "Final testable hypothesis",
  "methodology_design": "Detailed methodology",
  "experiment_design": {{
    "datasets": ["Dataset 1", "Dataset 2"],
    "baselines": ["Baseline 1", "Baseline 2"],
    "metrics": ["Metric 1", "Metric 2"],
    "ablation_plan": "What to ablate and why"
  }},
  "impact_statement": "Why this deserves a top-tier venue",
  "limitations": ["Acknowledged limitation 1", "Limitation 2"],
  "confidence": 0.75,
  "scores": {{
    "novelty": 0.0,
    "feasibility": 0.0,
    "impact": 0.0,
    "evidence_strength": 0.0
  }},
  "composite_score": 0.0
}}"""

        try:
            response = await self._call_llm(prompt, temperature=0.5, max_tokens=4000)
            parsed = self._extract_json(response)

            # Calculate composite score if not provided
            scores = parsed.get('scores', {})
            if 'composite_score' not in parsed or parsed['composite_score'] == 0:
                composite = (
                    0.30 * scores.get('novelty', 0.5) +
                    0.25 * scores.get('feasibility', 0.5) +
                    0.25 * scores.get('impact', 0.5) +
                    0.20 * scores.get('evidence_strength', 0.5)
                )
                parsed['composite_score'] = round(composite, 3)

            return AgentOutput(
                agent_name=self.name,
                stage="synthesis",
                content=parsed.get('abstract', 'No abstract generated'),
                structured_data=parsed,
                confidence=parsed.get('confidence', 0.7)
            )
        except Exception as e:
            self.logger.error(f"Reviewer failed: {e}")
            # Return a synthesis of the hypothesis as fallback
            return AgentOutput(
                agent_name=self.name,
                stage="synthesis",
                content=hypothesis.get('rationale', 'Synthesis failed'),
                structured_data={
                    **hypothesis,
                    "composite_score": 0.5,
                    "scores": {
                        "novelty": 0.5,
                        "feasibility": 0.5,
                        "impact": 0.5,
                        "evidence_strength": 0.5
                    },
                    "limitations": ["Synthesis incomplete due to technical error"]
                },
                confidence=0.5
            )
