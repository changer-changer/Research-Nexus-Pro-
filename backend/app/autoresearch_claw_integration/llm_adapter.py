"""
LLM Adapter: Wraps Research-Nexus Pro's Kimi client to match
AutoResearchClaw's LLMClient interface.
"""

import sys
import os
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Ensure AutoResearchClaw is importable
_AUTO_CLAW_PATH = "/home/cuizhixing/AutoResearchClaw"
if _AUTO_CLAW_PATH not in sys.path:
    sys.path.insert(0, _AUTO_CLAW_PATH)

try:
    from researchclaw.llm.client import LLMResponse
except ImportError:
    # Fallback dataclass if AutoResearchClaw not available
    from dataclasses import dataclass, field
    @dataclass
    class LLMResponse:
        content: str
        model: str = ""
        prompt_tokens: int = 0
        completion_tokens: int = 0
        total_tokens: int = 0
        finish_reason: str = "stop"
        truncated: bool = False
        raw: dict = field(default_factory=dict)

from app.services.kimi_client import KimiExtractor


class KimiLLMAdapter:
    """
    Wraps KimiExtractor to match AutoResearchClaw's LLMClient.chat() interface.

    AutoResearchClaw expects:
        response = llm.chat(
            messages=[{"role": "user", "content": "..."}],
            model=None,
            max_tokens=None,
            temperature=None,
            json_mode=False,
            system=None,
            strip_thinking=False,
        )
        # response.content -> str
        # response.model -> str
        # response.total_tokens -> int

    KimiExtractor provides async methods. This adapter bridges sync/async.
    """

    def __init__(self):
        self.kimi = KimiExtractor()
        self.model_name = self.kimi.model

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        json_mode: bool = False,
        system: str | None = None,
        strip_thinking: bool = False,
    ) -> LLMResponse:
        """Synchronous wrapper around async Kimi call."""
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're in an async context — use run_coroutine_threadsafe
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        self._async_chat(
                            messages=messages,
                            model=model,
                            max_tokens=max_tokens,
                            temperature=temperature,
                            json_mode=json_mode,
                            system=system,
                            strip_thinking=strip_thinking,
                        )
                    )
                    return future.result(timeout=120)
            else:
                return loop.run_until_complete(
                    self._async_chat(
                        messages=messages,
                        model=model,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        json_mode=json_mode,
                        system=system,
                        strip_thinking=strip_thinking,
                    )
                )
        except RuntimeError:
            # No event loop — create one
            return asyncio.run(
                self._async_chat(
                    messages=messages,
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    json_mode=json_mode,
                    system=system,
                    strip_thinking=strip_thinking,
                )
            )

    async def _async_chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        json_mode: bool = False,
        system: str | None = None,
        strip_thinking: bool = False,
    ) -> LLMResponse:
        """Actual async chat implementation using Kimi."""

        # Build system + messages for Kimi
        system_prompt = system or ""

        # Convert messages to Anthropic format
        anthropic_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_prompt = content
                continue
            anthropic_messages.append({"role": role, "content": content})

        # If no messages left (all were system), add a dummy user message
        if not anthropic_messages:
            anthropic_messages.append({"role": "user", "content": "Proceed."})

        try:
            response = await self.kimi.client.messages.create(
                model=model or self.model_name,
                system=system_prompt,
                messages=anthropic_messages,
                max_tokens=max_tokens or 4096,
                temperature=temperature if temperature is not None else 0.7,
            )

            content = response.content[0].text if response.content else ""

            # Strip thinking tags if requested
            if strip_thinking and "<think>" in content:
                import re
                content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
                content = content.strip()

            # Try to extract JSON if json_mode requested
            if json_mode and content:
                # Try to find JSON in markdown fences
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()

            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "input_tokens", 0) if usage else 0
            completion_tokens = getattr(usage, "output_tokens", 0) if usage else 0

            return LLMResponse(
                content=content,
                model=model or self.model_name,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                finish_reason="stop",
                raw={"response": str(response)},
            )

        except Exception as e:
            logger.error(f"Kimi chat failed: {e}")
            # Return a fallback response so the pipeline doesn't crash
            return LLMResponse(
                content=f"[Kimi API Error: {e}]",
                model=model or self.model_name,
                finish_reason="error",
            )


# Singleton instance
_kimi_adapter: KimiLLMAdapter | None = None


def get_kimi_llm_adapter() -> KimiLLMAdapter:
    """Get or create the singleton Kimi LLM adapter."""
    global _kimi_adapter
    if _kimi_adapter is None:
        _kimi_adapter = KimiLLMAdapter()
    return _kimi_adapter
