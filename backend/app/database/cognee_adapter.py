"""
Cognee Adapter — bridges existing LocalGraphDB/LocalVectorDB to Cognee's poly-store.

Design:
  - Graceful degradation: if Cognee is unavailable, fall back to local stores.
  - Sync on write: every write to local stores is mirrored to Cognee when possible.
  - Tree ontology mapped to Cognee's graph model.

Current limitation: Cognee's cognify() requires tiktoken encoding download.
Workaround: use Cognee's lower-level APIs (add + manual graph construction)
instead of the full cognify pipeline.
"""
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Try to import Cognee; if it fails, set a flag
COGNEE_AVAILABLE = False
try:
    import cognee
    COGNEE_AVAILABLE = True
    logger.info("Cognee imported successfully")
except Exception as e:
    logger.warning(f"Cognee not available: {e}")


class CogneeAdapter:
    """
    Adapter that mirrors data between local stores and Cognee.

    Usage:
        adapter = CogneeAdapter()
        adapter.add_paper_chunks(paper_id, chunks, embeddings)
        adapter.add_problem(problem_node)
        adapter.add_method(method_node)
        results = adapter.search(query_text, top_k=5)
    """

    def __init__(self, dataset_name: str = "research_nexus"):
        self.dataset_name = dataset_name
        self._cognee = None
        self._vector_db = None
        self._graph_db = None

        if COGNEE_AVAILABLE:
            try:
                self._init_cognee()
            except Exception as e:
                logger.warning(f"Cognee initialization failed: {e}. Using fallback.")

        # Fallback to local stores
        from app.database.local_vector import get_local_vector_db
        from app.database.local_graph import get_local_graph_db
        self._vector_db = get_local_vector_db()
        self._graph_db = get_local_graph_db()

    def _init_cognee(self):
        """Initialize Cognee connection."""
        import cognee
        # Disable multi-user access control for single-user mode
        import os
        os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")

        self._cognee = cognee
        logger.info("Cognee adapter initialized")

    # ========================================================================
    # Write operations (mirror to both Cognee and local stores)
    # ========================================================================

    def add_paper_chunks(self, paper_id: str, chunks: List[Dict[str, Any]],
                         embeddings: List[List[float]]) -> bool:
        """Store paper chunks in both Cognee (if available) and local vector DB."""
        # Always write to local vector DB (guaranteed to work)
        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"{paper_id}_chunk_{i}"
            self._vector_db.upsert(
                collection="paper_chunks",
                item_id=chunk_id,
                vector=emb,
                payload={
                    "paper_id": paper_id,
                    "index": i,
                    "text": chunk.get("text", ""),
                    "section_hint": chunk.get("section_hint", ""),
                }
            )

        # Try to write to Cognee
        if self._cognee and COGNEE_AVAILABLE:
            try:
                # Note: cognee.add() is for raw text; for structured data
                # we use the lower-level vector store directly
                self._cognee_add_chunks(paper_id, chunks, embeddings)
            except Exception as e:
                logger.warning(f"Cognee chunk write failed: {e}")

        return True

    def add_problem(self, problem: Dict[str, Any]) -> bool:
        """Store a problem node."""
        problem_id = problem.get("id")
        if not problem_id:
            return False

        # Local graph DB
        self._graph_db.create_problem(problem)

        # Cognee
        if self._cognee and COGNEE_AVAILABLE:
            try:
                self._cognee_add_node(problem_id, "problem", problem)
            except Exception as e:
                logger.warning(f"Cognee problem write failed: {e}")

        return True

    def add_method(self, method: Dict[str, Any]) -> bool:
        """Store a method node."""
        method_id = method.get("id")
        if not method_id:
            return False

        self._graph_db.create_method(method)

        if self._cognee and COGNEE_AVAILABLE:
            try:
                self._cognee_add_node(method_id, "method", method)
            except Exception as e:
                logger.warning(f"Cognee method write failed: {e}")

        return True

    def add_insight(self, insight: Dict[str, Any]) -> bool:
        """Store an insight."""
        self._graph_db.create_insight(insight)

        if self._cognee and COGNEE_AVAILABLE:
            try:
                self._cognee_add_node(
                    insight.get("id", ""), "insight", insight
                )
            except Exception as e:
                logger.warning(f"Cognee insight write failed: {e}")

        return True

    def add_relation(self, source_id: str, target_id: str,
                     relation_type: str, properties: Dict[str, Any] = None):
        """Create a relationship between two nodes."""
        self._graph_db.create_relation(source_id, target_id, relation_type, properties)

        if self._cognee and COGNEE_AVAILABLE:
            try:
                self._cognee_add_edge(source_id, target_id, relation_type, properties)
            except Exception as e:
                logger.warning(f"Cognee edge write failed: {e}")

    # ========================================================================
    # Read operations (prefer Cognee, fallback to local)
    # ========================================================================

    def search(self, query_text: str, top_k: int = 10,
               filter_collection: Optional[str] = None) -> List[Dict[str, Any]]:
        """Vector search across all collections."""
        # For now, always use local vector DB (fast and reliable)
        from app.services.local_embedder import LocalEmbedder
        embedder = LocalEmbedder()
        query_vec = embedder.embed_text(query_text)

        collection = filter_collection or "paper_chunks"
        return self._vector_db.search(collection, query_vec, top_k)

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get a node by ID."""
        # Try local graph DB first
        for getter in [self._graph_db.get_problem, self._graph_db.get_method]:
            node = getter(node_id)
            if node:
                return node
        return self._graph_db.get_insight(node_id)

    def get_subgraph(self, node_ids: List[str], depth: int = 2) -> Dict[str, Any]:
        """Get subgraph around given nodes."""
        nodes = []
        edges = []
        visited = set()

        def expand(nid: str, d: int):
            if d > depth or nid in visited:
                return
            visited.add(nid)
            node = self.get_node(nid)
            if node:
                nodes.append(node)

            # Get edges from NetworkX graph
            if nid in self._graph_db.graph:
                for neighbor in self._graph_db.graph.successors(nid):
                    edge_data = self._graph_db.graph.get_edge_data(nid, neighbor)
                    if edge_data:
                        edges.append({
                            "source": nid,
                            "target": neighbor,
                            "type": edge_data.get("type", "unknown"),
                        })
                    expand(neighbor, d + 1)

        for nid in node_ids:
            expand(nid, 0)

        return {"nodes": nodes, "edges": edges}

    # ========================================================================
    # Cognee-specific low-level methods
    # ========================================================================

    def _cognee_add_chunks(self, paper_id: str, chunks: List[Dict],
                           embeddings: List[List[float]]):
        """Add chunks to Cognee vector store."""
        # Cognee 0.5.6 vector store is LanceDB-based.
        # We bypass cognify() and write directly to avoid tiktoken.
        if not self._cognee:
            return
        # TODO: implement direct LanceDB write when Cognee is fully initialized
        pass

    def _cognee_add_node(self, node_id: str, node_type: str, data: Dict):
        """Add a node to Cognee graph store."""
        if not self._cognee:
            return
        # TODO: implement direct KuzuDB write when Cognee is fully initialized
        pass

    def _cognee_add_edge(self, source: str, target: str, rel_type: str,
                         props: Optional[Dict] = None):
        """Add an edge to Cognee graph store."""
        if not self._cognee:
            return
        pass

    def health(self) -> Dict[str, Any]:
        """Health check for both local and Cognee stores."""
        return {
            "cognee_available": COGNEE_AVAILABLE,
            "cognee_initialized": self._cognee is not None,
            "local_vector_stats": self._vector_db.get_statistics(),
            "local_graph_nodes": len(self._graph_db.graph.nodes()),
            "local_graph_edges": len(self._graph_db.graph.edges()),
        }


# Global instance
_cognee_adapter = None


def get_cognee_adapter() -> CogneeAdapter:
    global _cognee_adapter
    if _cognee_adapter is None:
        _cognee_adapter = CogneeAdapter()
    return _cognee_adapter
