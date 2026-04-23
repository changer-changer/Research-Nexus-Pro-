"""
Skill 3: Cross Domain Innovation Search

This skill uses vector similarity to find cross-domain analogies.
When an agent discovers an unsolved problem, it can search for methods
from other domains with similar underlying mechanisms.

Key Concept: "Intuition Right Brain" - fuzzy semantic matching across domains
"""

import logging
from typing import List, Dict, Any, Optional
from neo4j import Driver
from qdrant_client import QdrantClient
from openai import OpenAI

from ..models.schema import CrossDomainMatch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CrossDomainInnovationSkill:
    """
    Skill 3: Find cross-domain method analogies.
    
    This skill acts as the "intuitive right brain" - using vector similarity
    to find semantic connections that might be missed by keyword search.
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
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text."""
        response = self.llm.embeddings.create(
            model=self.embedding_model,
            input=text[:8000]  // Limit input size
        )
        return response.data[0].embedding
    
    def _search_vector_db(
        self,
        query_vector: List[float],
        current_domain: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search vector DB for methods similar to the problem description,
        excluding the current domain.
        """
        results = self.qdrant.search(
            collection_name="methods",
            query_vector=query_vector,
            limit=top_k * 3,  // Get more, filter by domain
            with_payload=True
        )
        
        // Filter out current domain
        cross_domain_results = []
        for result in results:
            method_domain = result.payload.get("domain", "Unknown")
            if method_domain != current_domain:
                cross_domain_results.append({
                    "method_id": result.id,
                    "name": result.payload.get("name", ""),
                    "mechanism": result.payload.get("mechanism", ""),
                    "source_domain": method_domain,
                    "similarity_score": result.score
                })
        
        // Return top_k after filtering
        return cross_domain_results[:top_k]
    
    def _get_method_details(self, method_id: str) -> Optional[Dict[str, Any]]:
        """Get full method details from Neo4j."""
        cypher = """
        MATCH (m:Method {id: $method_id})
        OPTIONAL MATCH (m)-[r:SOLVES]->(p:Problem)
        WITH m, COUNT(p) as solves_count, COLLECT(p.name) as target_problems
        RETURN m.id as id,
               m.name as name,
               m.mechanism as mechanism,
               m.complexity as complexity,
               solves_count,
               target_problems
        """
        
        with self.neo4j.session() as session:
            result = session.run(cypher, {"method_id": method_id})
            record = result.single()
            return record.data() if record else None
    
    def _generate_why_relevant(
        self,
        problem_description: str,
        method_mechanism: str,
        source_domain: str,
        target_domain: str
    ) -> str:
        """
        Generate explanation of why this cross-domain method might help.
        
        Uses LLM to identify the underlying principle similarity.
        """
        prompt = f"""Analyze the underlying similarity between:

PROBLEM (in {target_domain}):
{problem_description}

METHOD (from {source_domain}):
{method_mechanism}

Explain in 1-2 sentences why this method's core principle could potentially address the problem, despite being from a different field. Focus on the shared underlying mechanism or mathematical structure.

Be concise and technical."""
        
        try:
            response = self.llm.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert in cross-disciplinary research transfer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error generating relevance explanation: {e}")
            return f"Cross-domain transfer from {source_domain} based on mechanism similarity."
    
    def execute(
        self,
        problem_description: str,
        current_domain: str,
        top_k: int = 5
    ) -> List[CrossDomainMatch]:
        """
        Main entry point for Skill 3.
        
        Finds methods from other domains that might solve the given problem
        based on semantic similarity of underlying mechanisms.
        
        Args:
            problem_description: Description of the problem and core difficulty
            current_domain: The domain to exclude from search
            top_k: Number of cross-domain matches to return
            
        Returns:
            List of CrossDomainMatch with relevance explanations
        """
        logger.info(f"Searching cross-domain innovation for problem in {current_domain}")
        
        // Step 1: Embed the problem description
        query_vector = self._get_embedding(problem_description)
        
        // Step 2: Search vector DB (excluding current domain)
        vector_results = self._search_vector_db(
            query_vector,
            current_domain,
            top_k
        )
        
        logger.info(f"Found {len(vector_results)} potential cross-domain matches")
        
        // Step 3: Enrich with Neo4j details and generate explanations
        matches = []
        for result in vector_results:
            method_details = self._get_method_details(result["method_id"])
            
            if not method_details:
                continue
            
            // Generate relevance explanation
            why_relevant = self._generate_why_relevant(
                problem_description,
                method_details.get("mechanism", ""),
                result["source_domain"],
                current_domain
            )
            
            matches.append(CrossDomainMatch(
                method_id=result["method_id"],
                method_name=result["name"],
                source_domain=result["source_domain"],
                target_domain=current_domain,
                similarity_score=result["similarity_score"],
                mechanism=method_details.get("mechanism", ""),
                why_relevant=why_relevant
            ))
        
        // Sort by similarity score
        matches.sort(key=lambda x: x.similarity_score, reverse=True)
        
        logger.info(f"Returning {len(matches)} cross-domain matches")
        return matches


// Convenience function for direct usage
def cross_domain_innovation_search(
    problem_description: str,
    current_domain: str,
    neo4j_driver: Driver,
    qdrant_client: QdrantClient,
    openai_api_key: Optional[str] = None,
    top_k: int = 5
) -> List[CrossDomainMatch]:
    """
    Standalone function for Skill 3.
    
    Usage:
        matches = cross_domain_innovation_search(
            problem_description="Sim-to-real transfer gap in robotics",
            current_domain="Robotics",
            neo4j_driver=driver,
            qdrant_client=client
        )
        for match in matches:
            print(f"{match.source_domain}: {match.method_name}")
            print(f"Why: {match.why_relevant}")
    """
    skill = CrossDomainInnovationSkill(neo4j_driver, qdrant_client, openai_api_key)
    return skill.execute(problem_description, current_domain, top_k)
