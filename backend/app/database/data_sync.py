"""
Data Synchronization Module
Handles synchronization between Neo4j and Qdrant
"""

import logging
from typing import Dict, Any, Optional
from .neo4j_connector import get_neo4j_connector
from .qdrant_connector import get_qdrant_connector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataSynchronizer:
    """Synchronizes data between Neo4j (graph) and Qdrant (vector) databases."""
    
    def __init__(self):
        self.neo4j = get_neo4j_connector()
        self.qdrant = get_qdrant_connector()
    
    def sync_problem_with_vector(
        self,
        problem_data: Dict[str, Any],
        vector: Optional[list] = None
    ) -> bool:
        """
        Synchronize a problem to both Neo4j and Qdrant.
        
        Args:
            problem_data: Problem node data
            vector: Embedding vector (optional)
            
        Returns:
            True if both operations successful
        """
        try:
            # Save to Neo4j
            problem_id = self.neo4j.create_problem(problem_data)
            
            # Save to Qdrant if vector provided
            if vector:
                self.qdrant.upsert_problem_vector(
                    problem_id=problem_id,
                    vector=vector,
                    payload={
                        "id": problem_id,
                        "name": problem_data.get("name", ""),
                        "domain": problem_data.get("domain", "unknown"),
                        "type": "problem"
                    }
                )
            
            logger.info(f"Synced problem: {problem_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to sync problem: {e}")
            return False
    
    def sync_method_with_vector(
        self,
        method_data: Dict[str, Any],
        vector: Optional[list] = None
    ) -> bool:
        """
        Synchronize a method to both Neo4j and Qdrant.
        
        Args:
            method_data: Method node data
            vector: Embedding vector (optional)
            
        Returns:
            True if both operations successful
        """
        try:
            # Save to Neo4j
            method_id = self.neo4j.create_method(method_data)
            
            # Save to Qdrant if vector provided
            if vector:
                self.qdrant.upsert_method_vector(
                    method_id=method_id,
                    vector=vector,
                    payload={
                        "id": method_id,
                        "name": method_data.get("name", ""),
                        "approach": method_data.get("approach", "unknown"),
                        "type": "method"
                    }
                )
            
            logger.info(f"Synced method: {method_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to sync method: {e}")
            return False
    
    def sync_paper_complete(
        self,
        paper_data: Dict[str, Any],
        problem_ids: list,
        method_ids: list
    ) -> bool:
        """
        Synchronize a paper with all its relationships.
        
        Args:
            paper_data: Paper node data
            problem_ids: List of problem IDs addressed
            method_ids: List of method IDs applied
            
        Returns:
            True if successful
        """
        try:
            # Create paper in Neo4j
            paper_id = self.neo4j.create_paper(paper_data)
            
            # Create relationships
            self.neo4j.create_paper_relationships(
                paper_id=paper_id,
                problem_ids=problem_ids,
                method_ids=method_ids
            )
            
            logger.info(f"Synced paper with relationships: {paper_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to sync paper: {e}")
            return False
    
    def verify_sync(self, problem_id: str) -> Dict[str, Any]:
        """
        Verify that a problem is synced in both databases.
        
        Args:
            problem_id: Problem ID to check
            
        Returns:
            Sync status report
        """
        try:
            # Check Neo4j
            problems = self.neo4j.query_problems()
            in_neo4j = any(p["id"] == problem_id for p in problems)
            
            # Check Qdrant
            vector = self.qdrant.get_problem_vector(problem_id)
            in_qdrant = vector is not None
            
            return {
                "problem_id": problem_id,
                "in_neo4j": in_neo4j,
                "in_qdrant": in_qdrant,
                "fully_synced": in_neo4j and in_qdrant
            }
        except Exception as e:
            logger.error(f"Failed to verify sync: {e}")
            return {
                "problem_id": problem_id,
                "in_neo4j": False,
                "in_qdrant": False,
                "fully_synced": False,
                "error": str(e)
            }
    
    def health_check(self) -> Dict[str, bool]:
        """Check health of both databases."""
        return {
            "neo4j": self.neo4j.health_check(),
            "qdrant": self.qdrant.health_check()
        }


# Singleton instance
_synchronizer: Optional[DataSynchronizer] = None


def get_synchronizer() -> DataSynchronizer:
    """Get or create DataSynchronizer singleton."""
    global _synchronizer
    if _synchronizer is None:
        _synchronizer = DataSynchronizer()
    return _synchronizer
