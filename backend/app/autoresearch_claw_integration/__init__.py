"""
AutoResearchClaw Integration Package

Bridges AutoResearchClaw's 23-stage research pipeline into Research-Nexus Pro's
web API architecture. Provides adapters for LLM, artifact storage, HITL, and
streaming.
"""

from .llm_adapter import KimiLLMAdapter, get_kimi_llm_adapter
from .artifact_store import DatabaseArtifactStore
from .hitl_adapter import WebHITLAdapter
from .config_builder import build_rc_config_from_innovation
from .streaming_wrapper import stream_pipeline

__all__ = [
    "KimiLLMAdapter",
    "get_kimi_llm_adapter",
    "DatabaseArtifactStore",
    "WebHITLAdapter",
    "build_rc_config_from_innovation",
    "stream_pipeline",
]
