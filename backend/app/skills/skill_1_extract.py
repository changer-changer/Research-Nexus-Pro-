"""
Skill 1: Extract and Store Triplets

This skill receives a paper's core text and extracts minimal knowledge triplets
(Problem/Method nodes + relationships) using an LLM. The extracted data is then
stored in both Neo4j (graph) and Qdrant (vector) databases.

Key Design Principle: 
- The LLM prompt is aggressively constrained to output ONLY structured triplets
- NO long summaries, NO explanations, ONLY machine-parseable data
- This minimizes token usage and maximizes agent efficiency
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from neo4j import Driver
from qdrant_client import QdrantClient
from openai import OpenAI

from ..models.schema import (
    Problem, Method, Paper, ExtractionResult,
    ExtractedProblem, ExtractedMethod, ExtractedRelationship,
    Solves, ResolutionStatus, ComplexityLevel
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# ULTRA-MINIMAL EXTRACTION PROMPT
# =============================================================================

EXTRACTION_SYSTEM_PROMPT = """You are a minimalist knowledge extraction engine. Your job is to parse academic paper text and extract ONLY structured triplets for a knowledge graph.

OUTPUT RULES (STRICT):
1. Output ONLY valid JSON. No markdown, no explanations, no summaries.
2. Be EXTREMELY concise. One-sentence definitions only.
3. Focus ONLY on: (a) Problems addressed, (b) Methods proposed, (c) Relationships between them.
4. If information is missing or unclear, OMIT it rather than hallucinate.

EXTRACTION SCHEMA:
{
  "problems": [
    {
      "name": "Concise problem name (5-10 words max)",
      "definition": "One-sentence definition (max 20 words)",
      "domain": "Macro field (e.g., Robotics, NLP, Computer Vision)"
    }
  ],
  "methods": [
    {
      "name": "Method name",
      "mechanism": "Core mechanism in ONE sentence",
      "complexity": "Low|Medium|High"
    }
  ],
  "relationships": [
    {
      "source_type": "Method|Problem|Paper",
      "source_name": "Exact name from above",
      "rel_type": "SOLVES|VARIANT_OF|COMPLEMENTARY_TO|SUB_PROBLEM_OF|EVOLVED_FROM|APPLIES_METHOD|ADDRESSES_PROBLEM",
      "target_type": "Method|Problem|Paper",
      "target_name": "Exact name from above",
      "properties": {}
    }
  ]
}

RELATIONSHIP PROPERTIES:
- For SOLVES: MUST include {"effectiveness": "...", "limitations": "..."}
- Be honest about limitations. Scientific progress requires knowing failure modes.

EXAMPLE OUTPUT:
{
  "problems": [
    {"name": "Sim-to-Real Gap", "definition": "Performance drop when transferring policies from simulation to real robots", "domain": "Robotics"}
  ],
  "methods": [
    {"name": "Domain Randomization", "mechanism": "Randomizing simulation parameters during training", "complexity": "Medium"}
  ],
  "relationships": [
    {
      "source_type": "Method",
      "source_name": "Domain Randomization",
      "rel_type": "SOLVES",
      "target_type": "Problem",
      "target_name": "Sim-to-Real Gap",
      "properties": {"effectiveness": "Moderate improvement", "limitations": "Requires careful parameter tuning, may not work for complex dynamics"}
    }
  ]
}

REMEMBER: MINIMALISM IS KEY. Output ONLY the JSON. No other text."""


class TripletExtractionSkill:
    """
    Skill 1: Extract and store knowledge triplets from paper text.
    
    This skill acts as a bridge between unstructured academic text and 
    structured knowledge graphs. It uses LLM for extraction with an
    ultra-minimal prompt to maximize token efficiency.
    """
    
    def __init__(
        self,
        neo4j_driver: Driver,
        qdrant_client: QdrantClient,
        openai_api_key: Optional[str] = None
    ):
        self.neo4j = neo4j_driver
        self.qdrant = qdrant_client
        self.llm = OpenAI(api_key=openai_api_key or os.getenv("OPENAI_API_KEY"))
        self.embedding_model = "text-embedding-3-small"
    
    def _generate_id(self, prefix: str, name: str) -> str:
        """Generate a unique ID from prefix and sanitized name."""
        sanitized = name.lower().replace(" ", "_")[:30]
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{prefix}_{sanitized}_{timestamp}"
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text."""
        response = self.llm.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding
    
    def _extract_with_llm(self, paper_text: str) -> ExtractionResult:
        """
        Use LLM to extract structured triplets from paper text.
        
        The prompt is aggressively minimal to reduce token usage.
        """
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",  # Cost-effective for extraction
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"Extract triplets from this paper text:\n\n{paper_text[:4000]}"}
            ],
            temperature=0.1,  # Low temperature for consistency
            response_format={"type": "json_object"}
        )
        
        result_json = json.loads(response.choices[0].message.content)
        return ExtractionResult(**result_json)
    
    def _store_problem(self, problem: ExtractedProblem) -> str:
        """Store a Problem node in Neo4j and Qdrant."""
        # Generate ID
        problem_id = self._generate_id("p", problem.name)
        
        # Generate embedding
        embedding_text = f"{problem.name}: {problem.definition}"
        embedding = self._get_embedding(embedding_text)
        
        # Store in Neo4j
        with self.neo4j.session() as session:
            session.run("""
                MERGE (p:Problem {id: $id})
                SET p.name = $name,
                    p.definition = $definition,
                    p.domain = $domain,
                    p.resolution_status = $status,
                    p.embedding_id = $embedding_id,
                    p.updated_at = datetime()
            """, {
                "id": problem_id,
                "name": problem.name,
                "definition": problem.definition,
                "domain": problem.domain,
                "status": ResolutionStatus.ACTIVE_RESEARCH.value,
                "embedding_id": problem_id
            })
        
        # Store in Qdrant
        self.qdrant.upsert(
            collection_name="problems",
            points=[{
                "id": problem_id,
                "vector": embedding,
                "payload": {
                    "name": problem.name,
                    "definition": problem.definition,
                    "domain": problem.domain
                }
            }]
        )
        
        logger.info(f"Stored Problem: {problem_id} - {problem.name}")
        return problem_id
    
    def _store_method(self, method: ExtractedMethod) -> str:
        """Store a Method node in Neo4j and Qdrant."""
        # Generate ID
        method_id = self._generate_id("m", method.name)
        
        # Generate embedding
        embedding_text = f"{method.name}: {method.mechanism}"
        embedding = self._get_embedding(embedding_text)
        
        # Store in Neo4j
        with self.neo4j.session() as session:
            session.run("""
                MERGE (m:Method {id: $id})
                SET m.name = $name,
                    m.mechanism = $mechanism,
                    m.complexity = $complexity,
                    m.embedding_id = $embedding_id,
                    m.updated_at = datetime()
            """, {
                "id": method_id,
                "name": method.name,
                "mechanism": method.mechanism,
                "complexity": method.complexity.value,
                "embedding_id": method_id
            })
        
        # Store in Qdrant
        self.qdrant.upsert(
            collection_name="methods",
            points=[{
                "id": method_id,
                "vector": embedding,
                "payload": {
                    "name": method.name,
                    "mechanism": method.mechanism,
                    "complexity": method.complexity.value
                }
            }]
        )
        
        logger.info(f"Stored Method: {method_id} - {method.name}")
        return method_id
    
    def _store_relationship(
        self,
        rel: ExtractedRelationship,
        name_to_id_map: Dict[str, str]
    ):
        """Store a relationship in Neo4j."""
        source_id = name_to_id_map.get(rel.source_name)
        target_id = name_to_id_map.get(rel.target_name)
        
        if not source_id or not target_id:
            logger.warning(f"Skipping relationship: {rel.source_name} -> {rel.target_name} (missing ID)")
            return
        
        # Build Cypher query based on relationship type
        rel_properties = json.dumps(rel.properties) if rel.properties else "{}"
        
        cypher = f"""
            MATCH (a {{id: $source_id}})
            MATCH (b {{id: $target_id}})
            MERGE (a)-[r:{rel.rel_type}]->(b)
            SET r = $properties
        """
        
        with self.neo4j.session() as session:
            session.run(cypher, {
                "source_id": source_id,
                "target_id": target_id,
                "properties": rel.properties
            })
        
        logger.info(f"Stored Relationship: {rel.source_name} -[{rel.rel_type}]-> {rel.target_name}")
    
    def execute(self, paper_text: str, paper_meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main entry point for Skill 1.
        
        Args:
            paper_text: Core text of the paper (abstract + intro + conclusion)
            paper_meta: Metadata {id, title, authors, year, venue}
        
        Returns:
            Summary of extracted and stored entities
        """
        logger.info(f"Starting extraction for paper: {paper_meta.get('title', 'Unknown')}")
        
        # Step 1: Extract triplets using LLM
        extraction = self._extract_with_llm(paper_text)
        logger.info(f"Extracted: {len(extraction.problems)} problems, {len(extraction.methods)} methods")
        
        # Step 2: Store Paper node first
        paper_id = paper_meta.get('id') or self._generate_id("paper", paper_meta['title'][:20])
        with self.neo4j.session() as session:
            session.run("""
                MERGE (p:Paper {id: $id})
                SET p.title = $title,
                    p.authors = $authors,
                    p.year = $year,
                    p.venue = $venue,
                    p.created_at = datetime()
            """, {
                "id": paper_id,
                "title": paper_meta['title'],
                "authors": paper_meta.get('authors', []),
                "year": paper_meta['year'],
                "venue": paper_meta.get('venue', 'Unknown')
            })
        
        # Step 3: Store Problems and build name-to-ID map
        name_to_id = {}
        problem_ids = []
        for p in extraction.problems:
            pid = self._store_problem(p)
            name_to_id[p.name] = pid
            problem_ids.append(pid)
            
            # Link paper to problem
            with self.neo4j.session() as session:
                session.run("""
                    MATCH (paper:Paper {id: $paper_id})
                    MATCH (prob:Problem {id: $problem_id})
                    MERGE (paper)-[:ADDRESSES_PROBLEM]->(prob)
                """, {"paper_id": paper_id, "problem_id": pid})
        
        # Step 4: Store Methods
        method_ids = []
        for m in extraction.methods:
            mid = self._store_method(m)
            name_to_id[m.name] = mid
            method_ids.append(mid)
            
            # Link paper to method
            with self.neo4j.session() as session:
                session.run("""
                    MATCH (paper:Paper {id: $paper_id})
                    MATCH (meth:Method {id: $method_id})
                    MERGE (paper)-[:APPLIES_METHOD]->(meth)
                """, {"paper_id": paper_id, "method_id": mid})
        
        # Step 5: Store Relationships
        for rel in extraction.relationships:
            self._store_relationship(rel, name_to_id)
        
        result = {
            "paper_id": paper_id,
            "problems_extracted": len(extraction.problems),
            "methods_extracted": len(extraction.methods),
            "relationships_extracted": len(extraction.relationships),
            "problem_ids": problem_ids,
            "method_ids": method_ids
        }
        
        logger.info(f"Extraction complete: {result}")
        return result


# Convenience function for direct usage
def extract_and_store_triplets(
    paper_text: str,
    paper_meta: Dict[str, Any],
    neo4j_driver: Driver,
    qdrant_client: QdrantClient,
    openai_api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Standalone function for Skill 1.
    
    Usage:
        result = extract_and_store_triplets(
            paper_text="...",
            paper_meta={"title": "...", "year": 2024, ...},
            neo4j_driver=driver,
            qdrant_client=client
        )
    """
    skill = TripletExtractionSkill(neo4j_driver, qdrant_client, openai_api_key)
    return skill.execute(paper_text, paper_meta)
