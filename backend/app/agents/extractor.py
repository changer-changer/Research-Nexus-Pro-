"""
Extractor Agent — extracts typed PaperClaims from academic paper sections.
"""
import json
import asyncio
from typing import List, Dict, Any
from app.agents.base import BaseAgent, AgentContext, AgentOutput, PaperClaim, EvidenceSpan


class ExtractorAgent(BaseAgent):
    """
    Extracts structured claims from paper sections.
    Operates per-section (Intro, Method, Results, Conclusion) for better accuracy.
    """

    name = "Extractor"
    system_prompt = """You are an expert research knowledge extraction system.
Your task is to analyze academic paper text and extract core scientific claims.

Extract ONLY these claim types:
- problem_statement: The core problem the paper addresses
- method_mechanism: The proposed method and its mechanism
- experiment_result: Key experimental results and metrics
- limitation: Acknowledged limitations of the method
- future_work: Suggested future research directions
- theoretical_assertion: Core theoretical claims
- contradicts_prior: Claims that contradict prior work

For every claim, provide exact source evidence spans from the text.
Do not hallucinate evidence.

For problem_statement claims, extract:
  - constraints: physical/mathematical/hardware constraints
  - evaluation_metrics: how success is measured

For method_mechanism claims, extract:
  - assumptions: pre-conditions required
  - limitations: known blind spots
  - hyperparameters: key tuning parameters
  - input_output_spec: data format specifications

Output raw JSON with a "claims" array."""

    async def run(self, context: AgentContext) -> AgentOutput:
        sections = context.extra.get('structured_sections', {})
        all_claims = []

        # Parallel extraction from each section
        tasks = []
        for section_name, text in sections.items():
            if text and len(text.strip()) > 50:
                tasks.append(self._extract_from_section(section_name, text))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, list):
                all_claims.extend(result)

        # Deduplicate and detect contradictions
        all_claims = self._deduplicate_claims(all_claims)

        return AgentOutput(
            agent_name=self.name,
            stage="extraction",
            content=f"Extracted {len(all_claims)} claims from {len(sections)} sections",
            structured_data={"claims": all_claims},
            confidence=0.9 if all_claims else 0.3
        )

    async def _extract_from_section(self, section_name: str, text: str) -> List[Dict[str, Any]]:
        """Extract claims from a single section."""
        prompt = f"""Section: {section_name}

Text:
{text[:15000]}

Extract all relevant claims as JSON:
{{
  "claims": [
    {{
      "claim_type": "problem_statement|method_mechanism|experiment_result|limitation|future_work",
      "text": "concise claim statement",
      "metadata": {{"constraints": "...", "evaluation_metrics": "..." OR "assumptions": "...", "limitations": "..."}},
      "evidence": [{{"section": "{section_name}", "snippet": "exact quote from text", "confidence": 0.95}}]
    }}
  ]
}}"""

        try:
            response = await self._call_llm(prompt, temperature=0.1, max_tokens=4096)
            parsed = self._extract_json(response)
            claims = parsed.get('claims', [])

            # Enrich claims with paper_id and generate IDs
            for i, claim in enumerate(claims):
                claim['claim_id'] = f"claim_{section_name.lower()[:3]}_{i}_{hash(claim['text']) % 10000:04d}"
                claim['paper_id'] = 'unknown'  # Will be set by caller

            return claims
        except Exception as e:
            self.logger.warning(f"Extraction failed for section {section_name}: {e}")
            return []

    def _deduplicate_claims(self, claims: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove near-duplicate claims based on text similarity."""
        seen = set()
        unique = []
        for claim in claims:
            # Simple dedup: first 50 chars as key
            key = claim.get('text', '')[:50].lower().strip()
            if key and key not in seen:
                seen.add(key)
                unique.append(claim)
        return unique
