"""
Qdrant Vector Database Connector for Research-Nexus
Handles all vector operations for semantic search
"""

import os
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, 
    Filter, FieldCondition, MatchValue
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
VECTOR_DIMENSION = 1536  # OpenAI text-embedding-3-small


class QdrantConnector:
    """Handles all Qdrant vector database operations."""
    
    def __init__(self, host: str = QDRANT_HOST, port: int = QDRANT_PORT):
        self.client: Optional[QdrantClient] = None
        self.host = host
        self.port = port
        self.collections = {
            "problems": "research_problems",
            "methods": "research_methods"
        }
    
    def connect(self) -> QdrantClient:
        """Establish connection to Qdrant."""
        try:
            self.client = QdrantClient(host=self.host, port=self.port)
            logger.info(f"Connected to Qdrant at {self.host}:{self.port}")
            return self.client
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            raise
    
    def close(self):
        """Close the Qdrant connection."""
        if self.client:
            self.client.close()
            logger.info("Qdrant connection closed")
    
    def health_check(self) -> bool:
        """Check if Qdrant is accessible."""
        try:
            if not self.client:
                self.connect()
            # Try to get collections list
            self.client.get_collections()
            return True
        except Exception as e:
            logger.error(f"Qdrant health check failed: {e}")
            return False
    
    # =========================================================================
    # COLLECTION MANAGEMENT
    # =========================================================================
    
    def create_collections(self):
        """Create collections if they don't exist."""
        for collection_name in self.collections.values():
            try:
                # Check if collection exists
                collections = self.client.get_collections().collections
                collection_names = [c.name for c in collections]
                
                if collection_name not in collection_names:
                    self.client.create_collection(
                        collection_name=collection_name,
                        vectors_config=VectorParams(
                            size=VECTOR_DIMENSION,
                            distance=Distance.COSINE
                        )
                    )
                    logger.info(f"Created collection: {collection_name}")
                else:
                    logger.info(f"Collection already exists: {collection_name}")
            except Exception as e:
                logger.error(f"Failed to create collection {collection_name}: {e}")
                raise
    
    def delete_collection(self, collection_name: str):
        """Delete a collection."""
        try:
            self.client.delete_collection(collection_name=collection_name)
            logger.info(f"Deleted collection: {collection_name}")
        except Exception as e:
            logger.error(f"Failed to delete collection {collection_name}: {e}")
    
    # =========================================================================
    # PROBLEM VECTOR OPERATIONS
    # =========================================================================
    
    def upsert_problem_vector(self, problem_id: str, vector: List[float], 
                               payload: Dict[str, Any]) -> bool:
        """Insert or update a problem vector."""
        try:
            point = PointStruct(
                id=problem_id,
                vector=vector,
                payload=payload
            )
            
            self.client.upsert(
                collection_name=self.collections["problems"],
                points=[point]
            )
            logger.debug(f"Upserted problem vector: {problem_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert problem vector {problem_id}: {e}")
            return False
    
    def search_similar_problems(self, query_vector: List[float], 
                                 top_k: int = 10,
                                 filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for similar problems using vector similarity."""
        try:
            search_filter = None
            if filter_domain:
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="domain",
                            match=MatchValue(value=filter_domain)
                        )
                    ]
                )
            
            results = self.client.search(
                collection_name=self.collections["problems"],
                query_vector=query_vector,
                limit=top_k,
                query_filter=search_filter,
                with_payload=True
            )
            
            return [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "payload": hit.payload
                }
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Failed to search similar problems: {e}")
            return []
    
    def get_problem_vector(self, problem_id: str) -> Optional[List[float]]:
        """Retrieve a problem vector by ID."""
        try:
            results = self.client.retrieve(
                collection_name=self.collections["problems"],
                ids=[problem_id],
                with_vectors=True
            )
            
            if results:
                return results[0].vector
            return None
        except Exception as e:
            logger.error(f"Failed to get problem vector {problem_id}: {e}")
            return None
    
    # =========================================================================
    # METHOD VECTOR OPERATIONS
    # =========================================================================
    
    def upsert_method_vector(self, method_id: str, vector: List[float],
                              payload: Dict[str, Any]) -> bool:
        """Insert or update a method vector."""
        try:
            point = PointStruct(
                id=method_id,
                vector=vector,
                payload=payload
            )
            
            self.client.upsert(
                collection_name=self.collections["methods"],
                points=[point]
            )
            logger.debug(f"Upserted method vector: {method_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to upsert method vector {method_id}: {e}")
            return False
    
    def search_similar_methods(self, query_vector: List[float],
                               top_k: int = 10,
                               exclude_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for similar methods, optionally excluding a domain."""
        try:
            search_filter = None
            if exclude_domain:
                search_filter = Filter(
                    must_not=[
                        FieldCondition(
                            key="domain",
                            match=MatchValue(value=exclude_domain)
                        )
                    ]
                )
            
            results = self.client.search(
                collection_name=self.collections["methods"],
                query_vector=query_vector,
                limit=top_k,
                query_filter=search_filter,
                with_payload=True
            )
            
            return [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "payload": hit.payload
                }
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Failed to search similar methods: {e}")
            return []
    
    # =========================================================================
    # CROSS-DOMAIN SEARCH
    # =========================================================================
    
    def cross_domain_method_search(self, problem_vector: List[float],
                                   current_domain: str,
                                   top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for methods from other domains that might solve a problem.
        Uses sweet-spot filtering: [0.40, 0.75] for true cross-domain candidates.
        """
        try:
            results = self.client.search(
                collection_name=self.collections["methods"],
                query_vector=problem_vector,
                limit=top_k * 3,
                query_filter=Filter(
                    must_not=[
                        FieldCondition(
                            key="domain",
                            match=MatchValue(value=current_domain)
                        )
                    ]
                ),
                with_payload=True
            )

            cross_domain_methods = []
            for hit in results:
                score = hit.score
                if score < 0.40 or score > 0.75:
                    continue
                cross_domain_methods.append({
                    "id": hit.id,
                    "similarity_score": score,
                    "name": hit.payload.get("name"),
                    "mechanism": hit.payload.get("mechanism"),
                    "domain": hit.payload.get("domain"),
                    "source_domain": current_domain,
                    "transfer_explanation": self._generate_transfer_explanation(
                        hit.payload, score
                    )
                })

            return cross_domain_methods[:top_k]
        except Exception as e:
            logger.error(f"Failed cross-domain search: {e}")
            return []

    def _generate_transfer_explanation(self, method_payload: Dict, similarity: float) -> str:
        """Generate explanation for why this method might transfer."""
        method_name = method_payload.get("name", "Unknown")
        method_domain = method_payload.get("domain", "Unknown")

        if similarity >= 0.65:
            return f"Strong cross-domain potential ({similarity:.2f}): {method_name} from {method_domain} shows relevant mechanism overlap."
        elif similarity >= 0.50:
            return f"Good cross-domain candidate ({similarity:.2f}): {method_name} from {method_domain} shares transferable principles."
        else:
            return f"Emerging cross-domain link ({similarity:.2f}): {method_name} from {method_domain} has distant but intriguing relevance."
    
    # =========================================================================
    # BATCH OPERATIONS
    # =========================================================================
    
    def batch_upsert_problems(self, problems: List[Dict[str, Any]]) -> bool:
        """Batch upsert problem vectors."""
        try:
            points = [
                PointStruct(
                    id=p["id"],
                    vector=p["vector"],
                    payload=p["payload"]
                )
                for p in problems
            ]
            
            self.client.upsert(
                collection_name=self.collections["problems"],
                points=points
            )
            logger.info(f"Batch upserted {len(problems)} problem vectors")
            return True
        except Exception as e:
            logger.error(f"Failed batch upsert problems: {e}")
            return False
    
    def batch_upsert_methods(self, methods: List[Dict[str, Any]]) -> bool:
        """Batch upsert method vectors."""
        try:
            points = [
                PointStruct(
                    id=m["id"],
                    vector=m["vector"],
                    payload=m["payload"]
                )
                for m in methods
            ]
            
            self.client.upsert(
                collection_name=self.collections["methods"],
                points=points
            )
            logger.info(f"Batch upserted {len(methods)} method vectors")
            return True
        except Exception as e:
            logger.error(f"Failed batch upsert methods: {e}")
            return False
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about collections."""
        try:
            stats = {}
            for collection_type, collection_name in self.collections.items():
                info = self.client.get_collection(collection_name=collection_name)
                stats[collection_type] = {
                    "vectors_count": info.vectors_count,
                    "indexed_vectors_count": info.indexed_vectors_count,
                    "status": info.status
                }
            return stats
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {}


# Global connector instance
qdrant_connector = QdrantConnector()


def get_qdrant_connector() -> QdrantConnector:
    """Get the global Qdrant connector instance."""
    if not qdrant_connector.client:
        qdrant_connector.connect()
        qdrant_connector.create_collections()
    return qdrant_connector
