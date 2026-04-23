"""
Critic Agent — pressure-tests hypotheses for logical flaws and physical impossibilities.
"""
import json
from typing import Dict, Any
from app.agents.base import BaseAgent, AgentContext, AgentOutput


class CriticAgent(BaseAgent):
    """
    Devil's Advocate. Finds logical holes, physical contradictions,
    and feasibility issues in research hypotheses.
    """

    name = "Critic"
    system_prompt = """You are a ruthless but fair scientific critic, like a senior NeurIPS reviewer who has seen every failure mode.
Your job is to find flaws in research hypotheses before resources are wasted on them.

You are particularly vigilant about:
1. Logical contradictions in the proposed mechanism
2. Physical/mathematical impossibilities
3. Unstated assumptions that might not hold
4. Resource requirements that are unrealistic
5. Cases where similar ideas were tried and failed

Be constructive: for every flaw you identify, suggest how it could be addressed."""

    async def run(self, context: AgentContext) -> AgentOutput:
        hypothesis = context.extra.get('current_hypothesis', {})
        opportunity = context.extra.get('opportunity', {})

        prompt = f"""Critique the following research hypothesis rigorously:

Hypothesis:
{json.dumps(hypothesis, ensure_ascii=False, indent=2)}

Context (from knowledge graph):
- Target Problem: {opportunity.get('target_problem_id', 'Unknown')}
- Candidate Methods: {', '.join(opportunity.get('candidate_method_ids', []))}
- Rationale: {opportunity.get('rationale', '')}

Return JSON:
{{
  "severity": "low|medium|high|fatal",
  "overall_assessment": "1-2 sentence summary",
  "flaws": [
    {{
      "category": "logical|physical|resource|prior_art|assumption",
      "description": "Specific flaw description",
      "severity": "low|medium|high",
      "suggestion": "How to address this flaw"
    }}
  ],
  "recommendations": ["Specific changes to strengthen the hypothesis"],
  "confidence": 0.8
}}"""

        try:
            response = await self._call_llm(prompt, temperature=0.3, max_tokens=2048)
            parsed = self._extract_json(response)

            # Determine overall severity
            flaws = parsed.get('flaws', [])
            severities = [f.get('severity', 'low') for f in flaws]
            overall = 'low'
            if 'fatal' in severities:
                overall = 'fatal'
            elif 'high' in severities:
                overall = 'high'
            elif 'medium' in severities:
                overall = 'medium'

            parsed['severity'] = overall

            return AgentOutput(
                agent_name=self.name,
                stage="critique",
                content=parsed.get('overall_assessment', 'No assessment'),
                structured_data=parsed,
                confidence=parsed.get('confidence', 0.8)
            )
        except Exception as e:
            self.logger.error(f"Critic failed: {e}")
            return AgentOutput(
                agent_name=self.name,
                stage="critique",
                content="Critique generation failed",
                structured_data={
                    "severity": "low",
                    "overall_assessment": "Unable to critique due to technical error",
                    "flaws": [],
                    "recommendations": ["Retry critique with more context"],
                    "confidence": 0.3
                },
                confidence=0.3
            )
