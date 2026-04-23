"""
Hypothesizer Agent — generates innovation hypotheses from structural holes.
"""
import json
from typing import Dict, Any
from app.agents.base import BaseAgent, AgentContext, AgentOutput


class HypothesizerAgent(BaseAgent):
    """
    Based on an InnovationOpportunity, generates a compelling research hypothesis.
    Can revise based on Critic feedback.
    """

    name = "Hypothesizer"
    system_prompt = """You are a creative research scientist with deep cross-domain knowledge.
Your task is to generate compelling, rigorous research hypotheses based on structural holes in the knowledge graph.

You excel at:
- Identifying non-obvious connections between methods and problems
- Proposing testable hypotheses with clear mechanisms
- Designing experiments that could validate or refute your hypothesis

Always ground your hypothesis in the provided evidence. Do not hallucinate connections."""

    async def run(self, context: AgentContext) -> AgentOutput:
        opportunity = context.extra.get('opportunity', {})

        prompt = self._build_hypothesis_prompt(opportunity)

        try:
            response = await self._call_llm(prompt, temperature=0.8, max_tokens=3000)
            parsed = self._extract_json(response)

            return AgentOutput(
                agent_name=self.name,
                stage="hypothesis",
                content=parsed.get('rationale', 'No rationale provided'),
                structured_data=parsed,
                confidence=parsed.get('confidence', 0.7)
            )
        except Exception as e:
            self.logger.error(f"Hypothesizer failed: {e}")
            return self._fallback_output(opportunity)

    async def revise(self, context: AgentContext) -> AgentOutput:
        """Revise hypothesis based on Critic feedback."""
        hypothesis = context.extra.get('current_hypothesis', {})
        critique = context.extra.get('critique', {})
        opportunity = context.extra.get('opportunity', {})

        prompt = f"""You previously generated this hypothesis:

{json.dumps(hypothesis, ensure_ascii=False, indent=2)}

A critic has raised these concerns:

{json.dumps(critique, ensure_ascii=False, indent=2)}

Please revise your hypothesis to address ALL criticisms while maintaining the core insight.
Return the revised hypothesis in the same JSON format."""

        try:
            response = await self._call_llm(prompt, temperature=0.6, max_tokens=3000)
            parsed = self._extract_json(response)

            return AgentOutput(
                agent_name=self.name,
                stage="revision",
                content=parsed.get('rationale', 'Revised hypothesis'),
                structured_data=parsed,
                confidence=parsed.get('confidence', 0.7)
            )
        except Exception as e:
            self.logger.error(f"Hypothesizer revision failed: {e}")
            return AgentOutput(
                agent_name=self.name,
                stage="revision",
                content="Revision failed, keeping original",
                structured_data=hypothesis,
                confidence=0.5
            )

    def _build_hypothesis_prompt(self, opportunity: Dict[str, Any]) -> str:
        """Build the hypothesis generation prompt from an opportunity."""
        return f"""Generate a research hypothesis based on the following innovation opportunity:

Target Problem: {opportunity.get('target_problem_id', 'Unknown')}
Candidate Methods: {', '.join(opportunity.get('candidate_method_ids', []))}
Rationale: {opportunity.get('rationale', '')}
Innovation Type: {opportunity.get('innovation_type', 'cdt')}

Return JSON with:
{{
  "paper_title": "Compelling paper title (15 words max)",
  "innovation_type": "Type of innovation",
  "rationale": "Why this connection is promising (2-3 sentences)",
  "hypothesis": "Core testable hypothesis (1 sentence)",
  "mechanism": "Proposed mechanism of action",
  "expected_experiments": ["Experiment 1 description", "Experiment 2 description"],
  "key_metrics": ["Metric 1", "Metric 2"],
  "confidence": 0.75,
  "risks": ["Risk 1", "Risk 2"]
}}"""

    def _fallback_output(self, opportunity: Dict[str, Any]) -> AgentOutput:
        """Generate a fallback output when LLM fails."""
        problem_id = opportunity.get('target_problem_id', 'Unknown')
        method_ids = opportunity.get('candidate_method_ids', [])

        return AgentOutput(
            agent_name=self.name,
            stage="hypothesis",
            content=f"Fallback hypothesis for {problem_id} using {method_ids}",
            structured_data={
                "paper_title": f"Applying {method_ids[0] if method_ids else 'Method'} to {problem_id}",
                "innovation_type": opportunity.get('innovation_type', 'cdt'),
                "rationale": opportunity.get('rationale', 'No rationale available'),
                "hypothesis": "The candidate method can effectively address the target problem.",
                "mechanism": "To be determined through experimentation.",
                "expected_experiments": ["Benchmark comparison", "Ablation study"],
                "key_metrics": ["Accuracy", "Efficiency"],
                "confidence": 0.5,
                "risks": ["Method may not transfer across domains"]
            },
            confidence=0.5
        )
