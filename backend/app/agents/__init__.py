"""
AI Scientist Society - Multi-Agent Research System
"""
from app.agents.base import BaseAgent, AgentContext, AgentOutput, PaperClaim, EvidenceSpan
from app.agents.orchestrator import AgentOrchestrator
from app.agents.extractor import ExtractorAgent
from app.agents.hypothesizer import HypothesizerAgent
from app.agents.critic import CriticAgent
from app.agents.reviewer import ReviewerAgent

__all__ = [
    'BaseAgent',
    'AgentContext',
    'AgentOutput',
    'PaperClaim',
    'EvidenceSpan',
    'AgentOrchestrator',
    'ExtractorAgent',
    'HypothesizerAgent',
    'CriticAgent',
    'ReviewerAgent',
]
