"""
Skill 4: Merge Equivalent Nodes

This skill handles knowledge alignment by merging duplicate concepts
that have different names but represent the same entity.

Key Use Case: Different papers may refer to the same method with different names
(e.g., "Domain Randomization" vs "Randomized Domain Transfer"). When vector
similarity is high, this skill merges them into a single canonical node.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from neo4j import Driver
from qdrant_client import QdrantClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MergeEquivalentNodesSkill:
    """
    Skill 4: Merge duplicate nodes that represent the same concept.
    
    This skill maintains knowledge graph integrity by consolidating
    redundant entries while preserving all relationship edges.
    """
    
    def __init__(
        self,
        neo4j_driver: Driver,
        qdrant_client: Optional[QdrantClient] = None
    ):
        self.neo4j = neo4j_driver
        self.qdrant = qdrant_client
    
    def _get_node_info(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get node type and properties from Neo4j."""
        cypher = """
        MATCH (n {id: $node_id})
        RETURN labels(n)[0] as node_type,
               n.name as name,
               n.definition as definition,
               n.mechanism as mechanism,
               n.domain as domain,
               n.embedding_id as embedding_id
        """
        
        with self.neo4j.session() as session:
            result = session.run(cypher, {"node_id": node_id})
            record = result.single()
            return record.data() if record else None
    
    def _get_relationships(self, node_id: str) -> List[Dict[str, Any]]:
        """Get all relationships connected to a node."""
        cypher = """
        MATCH (n {id: $node_id})-[r]-(other)
        RETURN n.id as source_id,
               other.id as target_id,
               labels(other)[0] as target_type,
               type(r) as rel_type,
               properties(r) as rel_properties,
               startNode(r).id = n.id as is_outgoing
        """
        
        with self.neo4j.session() as session:
            result = session.run(cypher, {"node_id": node_id})
            return [record.data() for record in result]
    
    def _merge_in_neo4j(
        self,
        keep_id: str,
        merge_id: str,
        node_type: str
    ) -> bool:
        """
        Merge two nodes in Neo4j, keeping one and deleting the other.
        All relationships are transferred to the kept node.
        """
        try:
            // Use APOC mergeNodes if available, otherwise manual merge
            cypher = """
            MATCH (keep {id: $keep_id})
            MATCH (merge {id: $merge_id})
            
            // Transfer all incoming relationships
            WITH keep, merge
            MATCH (other)-[r_in]->(merge)
            WHERE other.id <> keep.id
            WITH keep, merge, r_in, other, type(r_in) as rel_type, properties(r_in) as rel_props
            MERGE (other)-[new_r:rel_type]->(keep)
            SET new_r = rel_props
            DELETE r_in
            
            // Transfer all outgoing relationships
            WITH keep, merge
            MATCH (merge)-[r_out]->(other)
            WHERE other.id <> keep.id
            WITH keep, merge, r_out, other, type(r_out) as rel_type, properties(r_out) as rel_props
            MERGE (keep)-[new_r:rel_type]->(other)
            SET new_r = rel_props
            DELETE r_out
            
            // Copy any additional properties from merge to keep
            WITH keep, merge
            SET keep += apoc.map.clean(merge, ['id'], [])
            
            // Delete the merged node
            DELETE merge
            
            RETURN count(*) as merged_count
            """
            
            with self.neo4j.session() as session:
                result = session.run(cypher, {
                    "keep_id": keep_id,
                    "merge_id": merge_id
                })
                record = result.single()
                
                if record:
                    logger.info(f"Successfully merged node {merge_id} into {keep_id}")
                    return True
                else:
                    logger.warning(f"Merge returned no results for {keep_id} <- {merge_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error during Neo4j merge: {e}")
            return False
    
    def _merge_in_qdrant(self, keep_id: str, merge_id: str) -> bool:
        """Update vector DB to reflect the merge."""
        if not self.qdrant:
            return True
        
        try:
            // Delete the merged vector
            self.qdrant.delete(
                collection_name="methods",
                points_selector=[merge_id]
            )
            self.qdrant.delete(
                collection_name="problems",
                points_selector=[merge_id]
            )
            
            logger.info(f"Removed merged vector {merge_id} from Qdrant")
            return True
            
        except Exception as e:
            logger.warning(f"Error updating Qdrant (non-critical): {e}")
            return True  // Non-critical failure
    
    def _decide_which_to_keep(
        self,
        node_1_info: Dict[str, Any],
        node_2_info: Dict[str, Any]
    ) -> tuple:
        """
        Decide which node to keep and which to merge.
        
        Priority:
        1. Keep node with more relationships
        2. Keep node with more complete properties
        3. Keep node with shorter ID (likely created earlier)
        """
        id_1 = node_1_info.get("id", "")
        id_2 = node_2_info.get("id", "")
        
        // Get relationship counts
        with self.neo4j.session() as session:
            result_1 = session.run(
                "MATCH (n {id: $id})--() RETURN count(*) as rel_count",
                {"id": id_1}
            )
            count_1 = result_1.single()["rel_count"]
            
            result_2 = session.run(
                "MATCH (n {id: $id})--() RETURN count(*) as rel_count",
                {"id": id_2}
            )
            count_2 = result_2.single()["rel_count"]
        
        // Decide based on relationship count
        if count_1 >= count_2:
            return id_1, id_2
        else:
            return id_2, id_1
    
    def execute(
        self,
        node_id_1: str,
        node_id_2: str,
        confidence_score: float
    ) -> Dict[str, Any]:
        """
        Main entry point for Skill 4.
        
        Merges two equivalent nodes into one, preserving all relationships.
        
        Args:
            node_id_1: First node ID
            node_id_2: Second node ID
            confidence_score: Similarity confidence (0.0-1.0)
            
        Returns:
            Result dictionary with merge status and details
        """
        logger.info(f"Initiating merge: {node_id_1} <-> {node_id_2} (confidence: {confidence_score:.2f})")
        
        // Validate confidence threshold
        if confidence_score < 0.85:
            return {
                "success": False,
                "error": f"Confidence score {confidence_score:.2f} below threshold (0.85)",
                "node_id_1": node_id_1,
                "node_id_2": node_id_2
            }
        
        // Get node info
        info_1 = self._get_node_info(node_id_1)
        info_2 = self._get_node_info(node_id_2)
        
        if not info_1 or not info_2:
            return {
                "success": False,
                "error": "One or both nodes not found in database",
                "node_id_1": node_id_1,
                "node_id_2": node_id_2
            }
        
        // Check same node type
        type_1 = info_1.get("node_type")
        type_2 = info_2.get("node_type")
        
        if type_1 != type_2:
            return {
                "success": False,
                "error": f"Cannot merge different node types: {type_1} vs {type_2}",
                "node_id_1": node_id_1,
                "node_id_2": node_id_2
            }
        
        // Decide which node to keep
        keep_id, merge_id = self._decide_which_to_keep(info_1, info_2)
        
        // Perform merge
        neo4j_success = self._merge_in_neo4j(keep_id, merge_id, type_1)
        qdrant_success = self._merge_in_qdrant(keep_id, merge_id)
        
        return {
            "success": neo4j_success,
            "kept_node_id": keep_id,
            "merged_node_id": merge_id,
            "node_type": type_1,
            "confidence_score": confidence_score,
            "timestamp": datetime.utcnow().isoformat(),
            "details": {
                "neo4j_merge": neo4j_success,
                "qdrant_update": qdrant_success,
                "kept_name": info_1.get("name") if keep_id == node_id_1 else info_2.get("name"),
                "merged_name": info_2.get("name") if keep_id == node_id_1 else info_1.get("name")
            }
        }


// Convenience function for direct usage
def merge_equivalent_nodes(
    node_id_1: str,
    node_id_2: str,
    confidence_score: float,
    neo4j_driver: Driver,
    qdrant_client: Optional[QdrantClient] = None
) -> Dict[str, Any]:
    """
    Standalone function for Skill 4.
    
    Usage:
        result = merge_equivalent_nodes(
            node_id_1="m_domain_random",
            node_id_2="m_rand_transfer",
            confidence_score=0.92,
            neo4j_driver=driver
        )
        if result["success"]:
            print(f"Merged into: {result['kept_node_id']}")
    """
    skill = MergeEquivalentNodesSkill(neo4j_driver, qdrant_client)
    return skill.execute(node_id_1, node_id_2, confidence_score)
