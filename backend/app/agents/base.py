"""
Agent Base Classes for the AI Scientist Society.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class EvidenceSpan(BaseModel):
    paper_id: str
    section: Optional[str] = None
    snippet: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    page_num: Optional[int] = None


class PaperClaim(BaseModel):
    claim_id: str
    paper_id: str
    claim_type: str
    text: str
    canonical_id: Optional[str] = None
    evidence: List[EvidenceSpan] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentContext(BaseModel):
    """Shared context passed between agents in a session."""
    session_id: str
    paper_id: Optional[str] = None
    node_id: Optional[str] = None
    claims: List[PaperClaim] = Field(default_factory=list)
    graph_data: Dict[str, Any] = Field(default_factory=dict)
    vector_data: Dict[str, Any] = Field(default_factory=dict)
    extra: Dict[str, Any] = Field(default_factory=dict)


class AgentOutput(BaseModel):
    """Standard output format for all agents."""
    agent_name: str
    stage: str
    content: str
    structured_data: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class BaseAgent(ABC):
    """Base class for all AI Scientist Society agents."""

    name: str = "BaseAgent"
    system_prompt: str = "You are a helpful research assistant."

    def __init__(self, llm_client=None):
        self.llm_client = llm_client
        self.logger = logging.getLogger(f"agent.{self.name}")

    @abstractmethod
    async def run(self, context: AgentContext) -> AgentOutput:
        """Execute the agent's core logic."""
        pass

    async def _call_llm(self, user_prompt: str, temperature: float = 0.7,
                        max_tokens: int = 2048, system_override: Optional[str] = None) -> str:
        """Call the LLM with the agent's system prompt."""
        if not self.llm_client:
            self.logger.warning("No LLM client available, returning placeholder")
            return json.dumps({"placeholder": True, "message": "LLM not configured"})

        try:
            response = await self.llm_client.messages.create(
                model=getattr(self.llm_client, 'model', 'kimi-for-coding'),
                system=system_override or self.system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.content[0].text
        except Exception as e:
            self.logger.error(f"LLM call failed: {e}")
            raise

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Extract JSON from LLM response, handling markdown blocks and common malformations."""
        original = text.strip()

        # Strip markdown code blocks
        if "```json" in original:
            original = original.split("```json")[1].split("```")[0].strip()
        elif "```" in original:
            parts = original.split("```")
            if len(parts) >= 3:
                original = parts[1].strip()

        # Try direct parse first
        try:
            return json.loads(original)
        except json.JSONDecodeError:
            pass

        # Aggressive repair pipeline
        import re
        repaired = original

        # 1. Remove trailing commas before } or ]
        repaired = re.sub(r',(\s*[}\]])', r'\1', repaired)

        # 2. Replace single quotes with double quotes (carefully)
        # Only replace outside of existing double-quoted strings
        # Simple heuristic: replace 'key': with "key":
        repaired = re.sub(r"(?<=[{\[,\s])'([^']+)'(?=\s*:)", r'"\1"', repaired)

        # 3. Fix missing quotes around string values (heuristic)
        # This is dangerous; only try if still failing
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # 4. Try to extract the first JSON object from the text
        # Sometimes LLM outputs text + JSON + text
        json_match = re.search(r'\{.*\}', repaired, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass

        # 5. Last resort: try json5-like parsing via ast.literal_eval
        try:
            import ast
            # Replace true/false/null with Python equivalents
            py_text = repaired.replace('true', 'True').replace('false', 'False').replace('null', 'None')
            result = ast.literal_eval(py_text)
            if isinstance(result, dict):
                return result
        except Exception:
            pass

        # If all repair attempts fail, raise with the original text for debugging
        raise json.JSONDecodeError(f"Could not parse JSON after repair attempts. Original text (first 500 chars): {original[:500]}", original, 0)
