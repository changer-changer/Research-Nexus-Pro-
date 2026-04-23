"""
Cognee Integration for Research-Nexus Pro

This module provides deep integration between Cognee knowledge graph engine 
and Research-Nexus Pro for research paper analysis.
"""

from .config import CogneeConfig
from .schemas import (
    Paper, ResearchProblem, ResearchMethod,
    ExtractedKnowledge, ProcessPaperRequest, ProcessPaperResponse,
    SearchRequest, SearchResponse
)
from .pipeline import ResearchPaperProcessor, CogneePipeline
from .adapter import (
    CogneeToResearchNexusAdapter,
    ResearchNexusToCogneeAdapter,
    to_reactflow,
    to_research_nexus
)

__version__ = "1.0.0"

__all__ = [
    # Configuration
    "CogneeConfig",
    
    # Schemas
    "Paper",
    "ResearchProblem",
    "ResearchMethod",
    "ExtractedKnowledge",
    "ProcessPaperRequest",
    "ProcessPaperResponse",
    "SearchRequest",
    "SearchResponse",
    
    # Pipeline
    "ResearchPaperProcessor",
    "CogneePipeline",
    
    # Adapters
    "CogneeToResearchNexusAdapter",
    "ResearchNexusToCogneeAdapter",
    "to_reactflow",
    "to_research_nexus",
]
