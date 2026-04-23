"""
Cognee Pipeline Wrapper for Research-Nexus Pro

Provides a high-level interface for:
1. Processing papers and extracting knowledge
2. Building the knowledge graph
3. Searching and querying the graph
4. Converting to Research-Nexus compatible format
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

import cognee
from cognee.infrastructure.llm.config import get_llm_config

from .config import CogneeConfig, ensure_directories
from .schemas import (
    Paper, ResearchProblem, ResearchMethod, Citation,
    ProblemHierarchy, MethodHierarchy, ProblemMethodMapping,
    ExtractedKnowledge, ProcessPaperRequest, ProcessPaperResponse,
    SearchRequest, SearchResponse, GraphStatistics
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ResearchPaperProcessor:
    """Main processor for research papers using Cognee."""
    
    def __init__(self, config: Optional[CogneeConfig] = None):
        self.config = config or CogneeConfig.from_env()
        self._initialized = False
        
    async def initialize(self):
        """Initialize Cognee with configuration."""
        if self._initialized:
            return
        
        # Skip connection test to avoid timeout
        os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"
            
        # Ensure directories exist
        ensure_directories(self.config)
        
        # Apply configuration
        self.config.apply()
        
        # Set custom prompt path if exists
        prompt_path = os.path.join(
            os.path.dirname(__file__), 
            "prompts", 
            "generate_research_graph_prompt.txt"
        )
        if os.path.exists(prompt_path):
            llm_config = get_llm_config()
            llm_config.graph_prompt_path = prompt_path
            logger.info(f"Using custom research prompt: {prompt_path}")
        
        self._initialized = True
        logger.info("ResearchPaperProcessor initialized")
        
    async def process_paper(
        self, 
        paper_text: str, 
        paper_meta: Optional[Dict[str, Any]] = None
    ) -> ProcessPaperResponse:
        """
        Process a research paper and extract knowledge.
        
        Args:
            paper_text: Full text or abstract of the paper
            paper_meta: Metadata like title, authors, year, etc.
            
        Returns:
            ProcessPaperResponse with extracted knowledge
        """
        await self.initialize()
        
        try:
            # Create paper ID
            paper_id = self._generate_paper_id(paper_meta)
            
            # Prepare text with metadata context
            full_text = self._prepare_text(paper_text, paper_meta)
            
            # Add to Cognee
            logger.info(f"Adding paper {paper_id} to Cognee...")
            await cognee.add(full_text, dataset_name="research_papers")
            
            # Build knowledge graph
            logger.info("Building knowledge graph...")
            await cognee.cognify()
            
            # Extract structured knowledge
            knowledge = await self._extract_knowledge(paper_id, paper_meta)
            
            return ProcessPaperResponse(
                success=True,
                paper_id=paper_id,
                extracted_problems=len(knowledge.problems),
                extracted_methods=len(knowledge.methods),
                extracted_relationships=(
                    len(knowledge.problem_method_mappings) +
                    len(knowledge.citations) +
                    len(knowledge.problem_hierarchies) +
                    len(knowledge.method_hierarchies)
                ),
                knowledge=knowledge
            )
            
        except Exception as e:
            logger.error(f"Error processing paper: {e}", exc_info=True)
            return ProcessPaperResponse(
                success=False,
                error=str(e)
            )
    
    async def process_papers_batch(
        self, 
        papers: List[Dict[str, Any]]
    ) -> List[ProcessPaperResponse]:
        """Process multiple papers in batch."""
        await self.initialize()
        
        results = []
        for paper_data in papers:
            result = await self.process_paper(
                paper_text=paper_data.get("text", ""),
                paper_meta=paper_data.get("meta", {})
            )
            results.append(result)
        
        return results
    
    async def search(
        self, 
        query: str, 
        limit: int = 10,
        node_types: Optional[List[str]] = None
    ) -> SearchResponse:
        """
        Search the knowledge graph.
        
        Args:
            query: Natural language query
            limit: Maximum number of results
            node_types: Filter by node types (problem, method, paper)
            
        Returns:
            SearchResponse with results
        """
        await self.initialize()
        
        try:
            logger.info(f"Searching for: {query}")
            
            # Use Cognee search - note: cognee.search doesn't support limit parameter
            raw_results = await cognee.search(
                query_text=query
            )
            
            # Convert to response format and apply limit
            results = []
            for result in raw_results[:limit]:  # Apply limit here
                results.append({
                    "content": str(result),
                    "score": 1.0,  # Cognee doesn't return scores directly
                    "type": "unknown"  # Would need to parse from result
                })
            
            return SearchResponse(
                success=True,
                query=query,
                results=results,
                total_found=len(results)
            )
            
        except Exception as e:
            logger.error(f"Error searching: {e}", exc_info=True)
            return SearchResponse(
                success=False,
                query=query,
                error=str(e)
            )
    
    async def get_statistics(self) -> GraphStatistics:
        """Get statistics about the knowledge graph."""
        await self.initialize()
        
        try:
            # This would query the actual graph database
            # For now, return placeholder
            return GraphStatistics(
                total_papers=0,
                total_problems=0,
                total_methods=0,
                last_updated=datetime.now()
            )
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return GraphStatistics()
    
    async def reset(self):
        """Reset the knowledge graph (clear all data)."""
        await self.initialize()
        
        try:
            await cognee.prune.prune_data()
            await cognee.prune.prune_system(metadata=True)
            logger.info("Knowledge graph reset successfully")
            return True
        except Exception as e:
            logger.error(f"Error resetting graph: {e}")
            return False
    
    def _generate_paper_id(self, paper_meta: Optional[Dict[str, Any]]) -> str:
        """Generate a unique paper ID."""
        if paper_meta:
            # Try to use arxiv ID or DOI
            if "arxiv_id" in paper_meta:
                return f"arxiv_{paper_meta['arxiv_id']}"
            if "doi" in paper_meta:
                return f"doi_{paper_meta['doi'].replace('/', '_')}"
            if "title" in paper_meta:
                import hashlib
                title_hash = hashlib.md5(
                    paper_meta["title"].encode()
                ).hexdigest()[:8]
                return f"paper_{title_hash}"
        
        # Fallback to timestamp-based ID
        import time
        return f"paper_{int(time.time())}"
    
    def _prepare_text(
        self, 
        paper_text: str, 
        paper_meta: Optional[Dict[str, Any]]
    ) -> str:
        """Prepare paper text with metadata context."""
        context_parts = []
        
        if paper_meta:
            if "title" in paper_meta:
                context_parts.append(f"Title: {paper_meta['title']}")
            if "authors" in paper_meta:
                authors = paper_meta["authors"]
                if isinstance(authors, list):
                    authors = ", ".join(authors)
                context_parts.append(f"Authors: {authors}")
            if "year" in paper_meta:
                context_parts.append(f"Year: {paper_meta['year']}")
            if "venue" in paper_meta:
                context_parts.append(f"Venue: {paper_meta['venue']}")
            if "abstract" in paper_meta:
                context_parts.append(f"Abstract: {paper_meta['abstract']}")
        
        context_parts.append("---")
        context_parts.append(paper_text)
        
        return "\n\n".join(context_parts)
    
    async def _extract_knowledge(
        self, 
        paper_id: str, 
        paper_meta: Optional[Dict[str, Any]]
    ) -> ExtractedKnowledge:
        """Extract structured knowledge from Cognee graph."""
        # This is a placeholder - in production, this would query
        # the Cognee graph database to extract the actual structure
        
        paper = Paper(
            id=paper_id,
            title=paper_meta.get("title", "Unknown") if paper_meta else "Unknown",
            authors=paper_meta.get("authors", []) if paper_meta else [],
            year=paper_meta.get("year") if paper_meta else None,
            venue=paper_meta.get("venue") if paper_meta else None,
            abstract=paper_meta.get("abstract") if paper_meta else None
        )
        
        return ExtractedKnowledge(
            paper=paper,
            problems=[],
            methods=[],
            citations=[],
            problem_hierarchies=[],
            method_hierarchies=[],
            problem_method_mappings=[]
        )


class CogneePipeline:
    """High-level pipeline for Cognee operations."""
    
    def __init__(self):
        self.processor = ResearchPaperProcessor()
    
    async def initialize(self, config: Optional[CogneeConfig] = None):
        """Initialize with optional custom config."""
        if config:
            self.processor = ResearchPaperProcessor(config)
        await self.processor.initialize()
    
    async def add_paper(self, paper_text: str, paper_meta: Dict[str, Any]) -> Dict[str, Any]:
        """Add a paper to the knowledge graph."""
        result = await self.processor.process_paper(paper_text, paper_meta)
        return result.model_dump()
    
    async def search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Search the knowledge graph."""
        result = await self.processor.search(query, limit=limit)
        return result.model_dump()
    
    async def reset(self) -> bool:
        """Reset the knowledge graph."""
        return await self.processor.reset()
