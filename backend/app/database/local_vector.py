"""
Local Vector Database - NumPy-based
Zero-Docker deployment for Research-Nexus
Supports: problems, methods, paper_chunks, claims
"""

import numpy as np
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LocalVectorDB:
    """
    File-backed vector database using NumPy.
    Replaces Qdrant for zero-docker deployment.
    """

    COLLECTIONS = ["problems", "methods", "paper_chunks", "claims"]

    def __init__(self, data_dir: str = "data/vectors"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.problems: Dict[str, Dict] = {}
        self.methods: Dict[str, Dict] = {}
        self.paper_chunks: Dict[str, Dict] = {}
        self.claims: Dict[str, Dict] = {}

        for name in self.COLLECTIONS:
            self._load_collection(name)

        logger.info(f"LocalVectorDB initialized at {self.data_dir}")

    def _collection(self, name: str) -> Dict[str, Dict]:
        return getattr(self, name, {})

    def _load_collection(self, name: str):
        file_path = self.data_dir / f"{name}.json"
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                collection = {}
                for item_id, item_data in data.items():
                    collection[item_id] = {
                        'vector': np.array(item_data['vector'], dtype=np.float32),
                        'payload': item_data['payload']
                    }
                setattr(self, name, collection)
                logger.info(f"Loaded {len(collection)} vectors from {name}")
            except Exception as e:
                logger.error(f"Failed to load {name}: {e}")

    def _save_collection(self, name: str):
        file_path = self.data_dir / f"{name}.json"
        collection = self._collection(name)
        serializable = {}
        for item_id, item_data in collection.items():
            serializable[item_id] = {
                'vector': item_data['vector'].tolist(),
                'payload': item_data['payload']
            }
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(serializable, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save {name}: {e}")

    # ========================================================================
    # Generic CRUD
    # ========================================================================

    def upsert(self, collection: str, item_id: str, vector: List[float],
               payload: Dict[str, Any]) -> bool:
        """Insert or update any item in any collection."""
        try:
            coll = self._collection(collection)
            coll[item_id] = {
                'vector': np.array(vector, dtype=np.float32),
                'payload': payload
            }
            self._save_collection(collection)
            return True
        except Exception as e:
            logger.error(f"Upsert failed [{collection}/{item_id}]: {e}")
            return False

    def get(self, collection: str, item_id: str) -> Optional[Dict[str, Any]]:
        coll = self._collection(collection)
        if item_id in coll:
            return {
                'id': item_id,
                'vector': coll[item_id]['vector'].tolist(),
                'payload': coll[item_id]['payload']
            }
        return None

    def search(self, collection: str, query_vector: List[float],
               top_k: int = 10,
               filter_fn: Optional[callable] = None) -> List[Dict[str, Any]]:
        """Cosine similarity search in any collection."""
        try:
            query = np.array(query_vector, dtype=np.float32)
            qnorm = np.linalg.norm(query)
            if qnorm == 0:
                return []

            results = []
            coll = self._collection(collection)
            for item_id, data in coll.items():
                if filter_fn and not filter_fn(data['payload']):
                    continue
                v = data['vector']
                vnorm = np.linalg.norm(v)
                if vnorm == 0:
                    continue
                sim = float(np.dot(query, v) / (qnorm * vnorm))
                results.append({
                    'id': item_id,
                    'score': sim,
                    'payload': data['payload']
                })

            results.sort(key=lambda x: x['score'], reverse=True)
            return results[:top_k]
        except Exception as e:
            logger.error(f"Search failed [{collection}]: {e}")
            return []

    def delete(self, collection: str, item_id: str) -> bool:
        try:
            coll = self._collection(collection)
            if item_id in coll:
                del coll[item_id]
                self._save_collection(collection)
                return True
            return False
        except Exception as e:
            logger.error(f"Delete failed [{collection}/{item_id}]: {e}")
            return False

    # ========================================================================
    # Back-compat wrappers
    # ========================================================================

    def upsert_problem_vector(self, problem_id: str, vector: List[float],
                               payload: Dict[str, Any]) -> bool:
        return self.upsert("problems", problem_id, vector, payload)

    def get_problem_vector(self, problem_id: str) -> Optional[List[float]]:
        item = self.get("problems", problem_id)
        return item['vector'] if item else None

    def search_similar_problems(self, query_vector: List[float],
                                 top_k: int = 10,
                                 filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        fn = (lambda p: p.get('domain') == filter_domain) if filter_domain else None
        return self.search("problems", query_vector, top_k, fn)

    def upsert_method_vector(self, method_id: str, vector: List[float],
                              payload: Dict[str, Any]) -> bool:
        return self.upsert("methods", method_id, vector, payload)

    def get_method_vector(self, method_id: str) -> Optional[List[float]]:
        item = self.get("methods", method_id)
        return item['vector'] if item else None

    def search_similar_methods(self, query_vector: List[float],
                                top_k: int = 10,
                                exclude_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        fn = (lambda p: p.get('domain') != exclude_domain) if exclude_domain else None
        return self.search("methods", query_vector, top_k, fn)

    # Domain-specific keyword vocabulary for hybrid scoring
    DOMAIN_KEYWORDS = {
        "robotics": ["manipulation", "grasp", "robot", "arm", "gripper", "dexterous", "motion planning", "control"],
        "vision": ["image", "visual", "camera", "rgb", "pixel", "segmentation", "detection", "recognition"],
        "tactile": ["tactile", "touch", "haptic", "force", "pressure", "texture", "deformation", "gelsight"],
        "diffusion": ["diffusion", "score-based", "ddpm", "edm", "sde", "noise", "sampling"],
        "vla": ["vla", "vision-language-action", "rt-", "openvla", "instruction following", "language"],
        "rl": ["rl", "reinforcement", "policy", "reward", "actor-critic", "ppo", "sac"],
        "llm": ["llm", "transformer", "attention", "gpt", "language model", "prompt", "finetuning"],
        "sim2real": ["sim2real", "domain randomization", "domain adaptation", "simulation", "transfer"],
        "perception": ["perception", "sensing", "observation", "state estimation", "sensor fusion"],
    }

    def cross_domain_method_search(self, problem_vector: List[float],
                                    current_domain: str,
                                    top_k: int = 5,
                                    similarity_threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Cross-domain method search with hybrid scoring.

        Sweet spot for CDT (Cross-Domain Transfer):
          - < 0.40: Semantically unrelated, discard
          - 0.40 - 0.75: Cross-domain sweet spot (different domain, relevant mechanism)
          - > 0.75: Same-domain method, not "cross-domain"
        """
        results = self.search_similar_methods(problem_vector, top_k * 3, exclude_domain=current_domain)
        out = []
        for r in results:
            vector_sim = r['score']
            p = r['payload']
            method_domain = p.get('domain', 'Unknown')

            # Sweet spot check: must be within [0.40, 0.75] for true cross-domain
            if vector_sim < 0.40:
                continue
            if vector_sim > 0.75:
                # Too similar — likely same-domain method
                continue

            # Hybrid scoring: blend vector similarity with keyword overlap
            keyword_sim = self._keyword_overlap_score(current_domain, method_domain)
            hybrid_score = 0.6 * vector_sim + 0.4 * keyword_sim

            if hybrid_score >= similarity_threshold:
                out.append({
                    'id': r['id'],
                    'similarity_score': vector_sim,
                    'hybrid_score': round(hybrid_score, 3),
                    'name': p.get('name'),
                    'mechanism': p.get('mechanism'),
                    'domain': method_domain,
                    'source_domain': current_domain,
                    'transfer_explanation': self._generate_transfer_explanation(p, vector_sim, hybrid_score)
                })
        # Sort by hybrid score descending
        out.sort(key=lambda x: x['hybrid_score'], reverse=True)
        return out[:top_k]

    def _keyword_overlap_score(self, domain_a: str, domain_b: str) -> float:
        """Compute keyword overlap between two domains for hybrid scoring."""
        words_a = set(self.DOMAIN_KEYWORDS.get(domain_a.lower(), []))
        words_b = set(self.DOMAIN_KEYWORDS.get(domain_b.lower(), []))
        if not words_a or not words_b:
            return 0.5  # Neutral when unknown
        # Lower overlap = higher cross-domain potential
        intersection = words_a & words_b
        union = words_a | words_b
        jaccard = len(intersection) / len(union) if union else 0.0
        # Invert: low jaccard = high cross-domain score
        return 1.0 - jaccard

    def _generate_transfer_explanation(self, method_payload: Dict, vector_sim: float, hybrid_score: float) -> str:
        name = method_payload.get('name', 'Unknown')
        domain = method_payload.get('domain', 'Unknown')
        if vector_sim >= 0.65:
            return f"Strong cross-domain potential ({vector_sim:.2f} vector, {hybrid_score:.2f} hybrid): {name} from {domain} shows relevant mechanism overlap."
        elif vector_sim >= 0.50:
            return f"Good cross-domain candidate ({vector_sim:.2f} vector, {hybrid_score:.2f} hybrid): {name} from {domain} shares transferable principles."
        else:
            return f"Emerging cross-domain link ({vector_sim:.2f} vector, {hybrid_score:.2f} hybrid): {name} from {domain} has distant but intriguing relevance."

    def batch_upsert_problems(self, problems: List[Dict[str, Any]]) -> bool:
        for p in problems:
            self.problems[p['id']] = {'vector': np.array(p['vector'], dtype=np.float32), 'payload': p['payload']}
        self._save_collection("problems")
        return True

    def batch_upsert_methods(self, methods: List[Dict[str, Any]]) -> bool:
        for m in methods:
            self.methods[m['id']] = {'vector': np.array(m['vector'], dtype=np.float32), 'payload': m['payload']}
        self._save_collection("methods")
        return True

    def health_check(self) -> bool:
        try:
            _ = len(self.problems)
            _ = len(self.methods)
            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    def get_statistics(self) -> Dict[str, int]:
        return {
            'problem_vectors': len(self.problems),
            'method_vectors': len(self.methods),
            'paper_chunk_vectors': len(self.paper_chunks),
            'claim_vectors': len(self.claims)
        }

    def clear_all(self):
        for name in self.COLLECTIONS:
            setattr(self, name, {})
            self._save_collection(name)
        logger.warning("All vectors cleared")


# Global instance
_local_vector_db = None


def get_local_vector_db() -> LocalVectorDB:
    global _local_vector_db
    if _local_vector_db is None:
        _local_vector_db = LocalVectorDB()
    return _local_vector_db
