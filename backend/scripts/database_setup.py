"""
Database Setup Script for Research-Nexus Backend
Initializes Neo4j graph database with schema constraints and indexes.
Also initializes Qdrant vector database collections.

Usage:
    python scripts/database_setup.py
"""

import os
import logging
from typing import Optional

from neo4j import GraphDatabase, Driver
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

# Vector dimensions for embeddings (OpenAI text-embedding-3-small = 1536)
VECTOR_DIMENSION = 1536


class DatabaseSetup:
    """Handles initialization of Neo4j and Qdrant databases."""
    
    def __init__(self):
        self.neo4j_driver: Optional[Driver] = None
        self.qdrant_client: Optional[QdrantClient] = None
    
    def connect_neo4j(self) -> Driver:
        """Establish connection to Neo4j."""
        self.neo4j_driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD)
        )
        logger.info(f"Connected to Neo4j at {NEO4J_URI}")
        return self.neo4j_driver
    
    def connect_qdrant(self) -> QdrantClient:
        """Establish connection to Qdrant."""
        self.qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        logger.info(f"Connected to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
        return self.qdrant_client
    
    def setup_neo4j_schema(self):
        """
        Initialize Neo4j schema with constraints and indexes.
        
        Schema Design:
        - Nodes: Problem, Method, Paper
        - Edges: SUB_PROBLEM_OF, EVOLVED_FROM, VARIANT_OF, COMPLEMENTARY_TO, 
                 SOLVES, APPLIES_METHOD, ADDRESSES_PROBLEM
        """
        if not self.neo4j_driver:
            raise RuntimeError("Neo4j not connected. Call connect_neo4j() first.")
        
        constraints_and_indexes = [
            # Unique constraints for node IDs
            "CREATE CONSTRAINT problem_id_unique IF NOT EXISTS FOR (p:Problem) REQUIRE p.id IS UNIQUE",
            "CREATE CONSTRAINT method_id_unique IF NOT EXISTS FOR (m:Method) REQUIRE m.id IS UNIQUE",
            "CREATE CONSTRAINT paper_id_unique IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE",
            
            # Indexes for common query patterns
            "CREATE INDEX problem_domain_idx IF NOT EXISTS FOR (p:Problem) ON (p.domain)",
            "CREATE INDEX problem_status_idx IF NOT EXISTS FOR (p:Problem) ON (p.resolution_status)",
            "CREATE INDEX method_name_idx IF NOT EXISTS FOR (m:Method) ON (m.name)",
            "CREATE INDEX paper_year_idx IF NOT EXISTS FOR (p:Paper) ON (p.year)",
            "CREATE INDEX paper_venue_idx IF NOT EXISTS FOR (p:Paper) ON (p.venue)",
            
            # Full-text indexes for semantic search
            "CREATE FULLTEXT INDEX problem_fulltext IF NOT EXISTS FOR (p:Problem) ON EACH [p.name, p.definition]",
            "CREATE FULLTEXT INDEX method_fulltext IF NOT EXISTS FOR (m:Method) ON EACH [m.name, m.mechanism]",
        ]
        
        with self.neo4j_driver.session() as session:
            for cypher in constraints_and_indexes:
                try:
                    session.run(cypher)
                    logger.info(f"Applied: {cypher[:60]}...")
                except Exception as e:
                    logger.warning(f"Constraint/Index may already exist: {e}")
        
        logger.info("Neo4j schema setup completed.")
    
    def setup_qdrant_collections(self):
        """Initialize Qdrant collections for Problem and Method embeddings."""
        if not self.qdrant_client:
            raise RuntimeError("Qdrant not connected. Call connect_qdrant() first.")
        
        collections = ["problems", "methods"]
        
        for collection_name in collections:
            try:
                # Check if collection exists
                self.qdrant_client.get_collection(collection_name)
                logger.info(f"Collection '{collection_name}' already exists.")
            except Exception:
                # Create new collection
                self.qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(
                        size=VECTOR_DIMENSION,
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"Created collection: {collection_name}")
        
        logger.info("Qdrant collections setup completed.")
    
    def create_sample_data(self):
        """Create sample data to demonstrate the schema."""
        if not self.neo4j_driver:
            raise RuntimeError("Neo4j not connected.")
        
        sample_cypher = """
        // Create sample Problem nodes
        MERGE (p1:Problem {id: "p_dex_manip", name: "Dexterous Manipulation", 
                           definition: "Enabling robots to handle complex manipulation tasks with human-like dexterity",
                           domain: "Robotics", resolution_status: "Partially Solved"})
        
        MERGE (p2:Problem {id: "p_tactile_perception", name: "Tactile Perception",
                           definition: "Extracting meaningful information from tactile sensor data",
                           domain: "Perception", resolution_status: "Active Research"})
        
        // Create sample Method nodes
        MERGE (m1:Method {id: "m_vla", name: "Vision-Language-Action Models",
                          mechanism: "Multimodal transformers that map visual observations and language instructions to robot actions",
                          complexity: "High"})
        
        MERGE (m2:Method {id: "m_tactile_cnn", name: "Tactile CNN",
                          mechanism: "Convolutional neural networks processing raw tactile sensor arrays",
                          complexity: "Medium"})
        
        // Create sample Paper nodes
        MERGE (paper1:Paper {id: "paper_001", title: "RT-2: Vision-Language-Action Models",
                              authors: "Brohan et al.", year: 2023, venue: "CoRL"})
        
        // Create relationships
        MERGE (p2)-[:SUB_PROBLEM_OF]->(p1)
        MERGE (m1)-[:SOLVES {effectiveness: "High on seen tasks, limited on novel objects", 
                              limitations: "Requires large-scale training data, computationally expensive"}]->(p1)
        MERGE (m2)-[:SOLVES {effectiveness: "Moderate on texture classification",
                              limitations: "Poor generalization to unseen materials"}]->(p2)
        MERGE (paper1)-[:APPLIES_METHOD]->(m1)
        MERGE (paper1)-[:ADDRESSES_PROBLEM]->(p1)
        """
        
        with self.neo4j_driver.session() as session:
            session.run(sample_cypher)
        
        logger.info("Sample data created successfully.")
    
    def verify_setup(self):
        """Verify that the database setup is correct."""
        if not self.neo4j_driver:
            raise RuntimeError("Neo4j not connected.")
        
        with self.neo4j_driver.session() as session:
            # Count nodes
            result = session.run("MATCH (n) RETURN labels(n)[0] as type, count(n) as count")
            counts = {record["type"]: record["count"] for record in result}
            logger.info(f"Node counts: {counts}")
            
            # Count relationships
            result = session.run("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count")
            rel_counts = {record["type"]: record["count"] for record in result}
            logger.info(f"Relationship counts: {rel_counts}")
    
    def close(self):
        """Close all database connections."""
        if self.neo4j_driver:
            self.neo4j_driver.close()
            logger.info("Neo4j connection closed.")


def main():
    """Main entry point for database setup."""
    setup = DatabaseSetup()
    
    try:
        # Connect to databases
        setup.connect_neo4j()
        setup.connect_qdrant()
        
        # Setup schemas
        setup.setup_neo4j_schema()
        setup.setup_qdrant_collections()
        
        # Create sample data
        setup.create_sample_data()
        
        # Verify
        setup.verify_setup()
        
        logger.info("✅ Database setup completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Setup failed: {e}")
        raise
    finally:
        setup.close()


if __name__ == "__main__":
    main()
