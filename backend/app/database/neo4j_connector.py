"""
Neo4j Database Connector with Exception Handling
Handles all Neo4j graph database operations with proper error handling
"""

import os
import logging
import time
from typing import Optional, List, Dict, Any
from functools import wraps
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import ServiceUnavailable, AuthError, ClientError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def retry_on_error(max_retries: int = 3, delay: float = 1.0):
    """Decorator to retry operations on transient errors."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except ServiceUnavailable as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"{func.__name__} failed (attempt {attempt + 1}), retrying...")
                        time.sleep(delay * (2 ** attempt))  # Exponential backoff
                    else:
                        logger.error(f"{func.__name__} failed after {max_retries} attempts: {e}")
                        raise
                except Exception as e:
                    logger.error(f"{func.__name__} failed: {e}")
                    raise
            return None
        return wrapper
    return decorator


class Neo4jConnector:
    """Neo4j database connection and operations handler with robust error handling."""
    
    def __init__(
        self,
        uri: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        max_retries: int = 3
    ):
        """
        Initialize Neo4j connector.
        
        Args:
            uri: Neo4j bolt URI (default: bolt://localhost:7687)
            username: Neo4j username (default: neo4j)
            password: Neo4j password (default: from env or 'password')
            max_retries: Maximum number of connection retries
        """
        self.uri = uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.username = username or os.getenv("NEO4J_USER", "neo4j")
        self.password = password or os.getenv("NEO4J_PASSWORD", "password")
        self.max_retries = max_retries
        self._driver: Optional[Driver] = None
    
    def connect(self) -> Driver:
        """
        Establish connection to Neo4j with retry logic.
        
        Returns:
            Neo4j Driver instance
            
        Raises:
            ServiceUnavailable: If connection fails after all retries
            AuthError: If authentication fails
        """
        if not self._driver:
            for attempt in range(self.max_retries):
                try:
                    self._driver = GraphDatabase.driver(
                        self.uri,
                        auth=(self.username, self.password)
                    )
                    # Test connection
                    self._driver.verify_connectivity()
                    logger.info(f"Connected to Neo4j at {self.uri}")
                    return self._driver
                except ServiceUnavailable as e:
                    if attempt < self.max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.warning(f"Neo4j connection failed (attempt {attempt + 1}), retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Failed to connect to Neo4j after {self.max_retries} attempts: {e}")
                        raise
                except AuthError as e:
                    logger.error(f"Neo4j authentication failed: {e}")
                    raise
                except Exception as e:
                    logger.error(f"Unexpected error connecting to Neo4j: {e}")
                    raise
        return self._driver
    
    def close(self):
        """Close the connection safely."""
        if self._driver:
            try:
                self._driver.close()
                logger.info("Neo4j connection closed")
            except Exception as e:
                logger.warning(f"Error closing Neo4j connection: {e}")
            finally:
                self._driver = None
    
    def health_check(self) -> bool:
        """Check if connection is healthy.
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            driver = self.connect()
            with driver.session() as session:
                result = session.run("RETURN 1 as num")
                return result.single()["num"] == 1
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    # ==================== Problem Operations ====================
    
    @retry_on_error(max_retries=3)
    def create_problem(self, problem_data: Dict[str, Any]) -> Optional[str]:
        """
        Create a Problem node in Neo4j.
        
        Args:
            problem_data: Dictionary containing problem fields
                - id (required): Unique identifier
                - name (required): Problem name
                - definition: Problem description
                - domain: Problem domain
                - status: Resolution status
                - year: Year introduced
                - level: Hierarchy level
                - parent_id: Parent problem ID
                - branch: Branch ID
                
        Returns:
            Problem ID if successful, None otherwise
            
        Raises:
            ClientError: If Cypher syntax error
        """
        # Validate required fields
        if not problem_data.get("id"):
            logger.error("Problem ID is required")
            return None
        if not problem_data.get("name"):
            logger.error("Problem name is required")
            return None
        
        try:
            cypher = """
            MERGE (p:Problem {id: $id})
            SET p.name = $name,
                p.definition = $definition,
                p.domain = $domain,
                p.status = $status,
                p.year = $year,
                p.level = $level,
                p.parentId = $parent_id,
                p.branch = $branch,
                p.embedding_id = $embedding_id,
                p.created_at = datetime(),
                p.updated_at = datetime()
            RETURN p.id as id
            """
            
            driver = self.connect()
            with driver.session() as session:
                result = session.run(cypher, {
                    "id": problem_data["id"],
                    "name": problem_data["name"],
                    "definition": problem_data.get("definition", ""),
                    "domain": problem_data.get("domain", "unknown"),
                    "status": problem_data.get("status", "active"),
                    "year": problem_data.get("year", 2024),
                    "level": problem_data.get("level", 0),
                    "parent_id": problem_data.get("parent_id"),
                    "branch": problem_data.get("branch", "b_root"),
                    "embedding_id": problem_data.get("embedding_id", problem_data["id"])
                })
                record = result.single()
                if record:
                    logger.info(f"Created/Updated Problem: {record['id']}")
                    return record["id"]
                else:
                    logger.warning(f"No record returned for problem: {problem_data['id']}")
                    return None
                    
        except ClientError as e:
            logger.error(f"Cypher error creating problem: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating problem: {e}")
            return None
    
    @retry_on_error(max_retries=3)
    def create_problem_relationship(
        self,
        child_id: str,
        parent_id: str,
        rel_type: str = "SUB_PROBLEM_OF"
    ) -> bool:
        """
        Create relationship between problems.
        
        Args:
            child_id: Child problem ID
            parent_id: Parent problem ID
            rel_type: Relationship type (default: SUB_PROBLEM_OF)
            
        Returns:
            True if successful, False otherwise
        """
        if not child_id or not parent_id:
            logger.error("Both child_id and parent_id are required")
            return False
        
        try:
            cypher = f"""
            MATCH (child:Problem {{id: $child_id}})
            MATCH (parent:Problem {{id: $parent_id}})
            MERGE (child)-[r:{rel_type}]->(parent)
            RETURN type(r) as rel_type
            """
            
            driver = self.connect()
            with driver.session() as session:
                session.run(cypher, {"child_id": child_id, "parent_id": parent_id})
                logger.info(f"Created {rel_type}: {child_id} -> {parent_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error creating relationship: {e}")
            return False
    
    @retry_on_error(max_retries=3)
    def query_problems(
        self,
        domain: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Query problems with optional filtering.
        
        Args:
            domain: Filter by domain
            status: Filter by status
            limit: Maximum number of results
            
        Returns:
            List of problem dictionaries
        """
        try:
            where_clauses = []
            params = {"limit": limit}
            
            if domain:
                where_clauses.append("p.domain = $domain")
                params["domain"] = domain
            if status:
                where_clauses.append("p.status = $status")
                params["status"] = status
            
            where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            cypher = f"""
            MATCH (p:Problem)
            {where_str}
            OPTIONAL MATCH (p)<-[:SUB_PROBLEM_OF]-(child:Problem)
            OPTIONAL MATCH (p)-[:SUB_PROBLEM_OF]->(parent:Problem)
            RETURN p.id as id,
                   p.name as name,
                   p.definition as definition,
                   p.domain as domain,
                   p.status as status,
                   p.year as year,
                   p.level as level,
                   p.parentId as parent_id,
                   p.branch as branch,
                   count(child) as child_count,
                   parent.id as parent_id
            LIMIT $limit
            """
            
            driver = self.connect()
            with driver.session() as session:
                result = session.run(cypher, params)
                return [record.data() for record in result]
                
        except Exception as e:
            logger.error(f"Error querying problems: {e}")
            return []
    
    # ==================== Method Operations ====================
    
    @retry_on_error(max_retries=3)
    def create_method(self, method_data: Dict[str, Any]) -> Optional[str]:
        """Create a Method node in Neo4j with validation."""
        if not method_data.get("id"):
            logger.error("Method ID is required")
            return None
        if not method_data.get("name"):
            logger.error("Method name is required")
            return None
        
        try:
            cypher = """
            MERGE (m:Method {id: $id})
            SET m.name = $name,
                m.mechanism = $mechanism,
                m.approach = $approach,
                m.complexity = $complexity,
                m.level = $level,
                m.parent_id = $parent_id,
                m.embedding_id = $embedding_id,
                m.created_at = datetime(),
                m.updated_at = datetime()
            RETURN m.id as id
            """
            
            driver = self.connect()
            with driver.session() as session:
                result = session.run(cypher, {
                    "id": method_data["id"],
                    "name": method_data["name"],
                    "mechanism": method_data.get("mechanism", ""),
                    "approach": method_data.get("approach", "unknown"),
                    "complexity": method_data.get("complexity", "medium"),
                    "level": method_data.get("level", 0),
                    "parent_id": method_data.get("parent_id"),
                    "embedding_id": method_data.get("embedding_id", method_data["id"])
                })
                record = result.single()
                if record:
                    logger.info(f"Created/Updated Method: {record['id']}")
                    return record["id"]
                return None
                
        except Exception as e:
            logger.error(f"Error creating method: {e}")
            return None
    
    @retry_on_error(max_retries=3)
    def create_solves_relationship(
        self,
        method_id: str,
        problem_id: str,
        effectiveness: str = "",
        limitations: str = ""
    ) -> bool:
        """Create SOLVES relationship with effectiveness data."""
        if not method_id or not problem_id:
            logger.error("Both method_id and problem_id are required")
            return False
        
        try:
            cypher = """
            MATCH (m:Method {id: $method_id})
            MATCH (p:Problem {id: $problem_id})
            MERGE (m)-[r:SOLVES]->(p)
            SET r.effectiveness = $effectiveness,
                r.limitations = $limitations,
                r.created_at = datetime()
            RETURN type(r) as rel_type
            """
            
            driver = self.connect()
            with driver.session() as session:
                session.run(cypher, {
                    "method_id": method_id,
                    "problem_id": problem_id,
                    "effectiveness": effectiveness,
                    "limitations": limitations
                })
                logger.info(f"Created SOLVES: {method_id} -> {problem_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error creating SOLVES relationship: {e}")
            return False
    
    @retry_on_error(max_retries=3)
    def query_methods(
        self,
        approach: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Query methods with optional filtering."""
        try:
            where_str = "WHERE m.approach = $approach" if approach else ""
            params = {"limit": limit}
            if approach:
                params["approach"] = approach
            
            cypher = f"""
            MATCH (m:Method)
            {where_str}
            OPTIONAL MATCH (m)-[:SOLVES]->(p:Problem)
            RETURN m.id as id,
                   m.name as name,
                   m.mechanism as mechanism,
                   m.approach as approach,
                   m.complexity as complexity,
                   m.level as level,
                   m.parent_id as parent_id,
                   count(p) as solves_count
            LIMIT $limit
            """
            
            driver = self.connect()
            with driver.session() as session:
                result = session.run(cypher, params)
                return [record.data() for record in result]
                
        except Exception as e:
            logger.error(f"Error querying methods: {e}")
            return []
    
    # ==================== Paper Operations ====================
    
    @retry_on_error(max_retries=3)
    def create_paper(self, paper_data: Dict[str, Any]) -> Optional[str]:
        """Create a Paper node in Neo4j with validation."""
        if not paper_data.get("id"):
            logger.error("Paper ID is required")
            return None
        
        try:
            cypher = """
            MERGE (p:Paper {id: $id})
            SET p.title = $title,
                p.authors = $authors,
                p.year = $year,
                p.venue = $venue,
                p.abstract = $abstract,
                p.category = $category,
                p.authority_score = $authority_score,
                p.created_at = datetime()
            RETURN p.id as id
            """
            
            driver = self.connect()
            with driver.session() as session:
                result = session.run(cypher, {
                    "id": paper_data["id"],
                    "title": paper_data.get("title", ""),
                    "authors": paper_data.get("authors", []),
                    "year": paper_data.get("year", 2024),
                    "venue": paper_data.get("venue", "unknown"),
                    "abstract": paper_data.get("abstract", ""),
                    "category": paper_data.get("category", ""),
                    "authority_score": paper_data.get("authority_score", 5)
                })
                record = result.single()
                if record:
                    logger.info(f"Created/Updated Paper: {record['id']}")
                    return record["id"]
                return None
                
        except Exception as e:
            logger.error(f"Error creating paper: {e}")
            return None
    
    @retry_on_error(max_retries=3)
    def create_paper_relationships(
        self,
        paper_id: str,
        problem_ids: List[str],
        method_ids: List[str]
    ) -> bool:
        """Create relationships between paper and problems/methods."""
        if not paper_id:
            logger.error("Paper ID is required")
            return False
        
        try:
            driver = self.connect()
            
            with driver.session() as session:
                # Link to problems
                for problem_id in problem_ids or []:
                    if problem_id:
                        session.run("""
                            MATCH (paper:Paper {id: $paper_id})
                            MATCH (prob:Problem {id: $problem_id})
                            MERGE (paper)-[:ADDRESSES_PROBLEM]->(prob)
                        """, {"paper_id": paper_id, "problem_id": problem_id})
                
                # Link to methods
                for method_id in method_ids or []:
                    if method_id:
                        session.run("""
                            MATCH (paper:Paper {id: $paper_id})
                            MATCH (meth:Method {id: $method_id})
                            MERGE (paper)-[:APPLIES_METHOD]->(meth)
                        """, {"paper_id": paper_id, "method_id": method_id})
                
                logger.info(f"Created relationships for Paper: {paper_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error creating paper relationships: {e}")
            return False
    
    @retry_on_error(max_retries=3)
    def query_papers(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Query all papers with their relationships."""
        try:
            cypher = """
            MATCH (p:Paper)
            OPTIONAL MATCH (p)-[:ADDRESSES_PROBLEM]->(prob:Problem)
            OPTIONAL MATCH (p)-[:APPLIES_METHOD]->(meth:Method)
            RETURN p.id as id,
                   p.title as title,
                   p.authors as authors,
                   p.year as year,
                   p.venue as venue,
                   p.category as category,
                   p.authority_score as authority_score,
                   collect(DISTINCT prob.id) as problem_ids,
                   collect(DISTINCT meth.id) as method_ids
            LIMIT $limit
            """
            
            driver = self.connect()
            with driver.session() as session:
                result = session.run(cypher, {"limit": limit})
                return [record.data() for record in result]
                
        except Exception as e:
            logger.error(f"Error querying papers: {e}")
            return []


# Singleton instance with thread-safe initialization
_neo4j_connector: Optional[Neo4jConnector] = None


def get_neo4j_connector() -> Neo4jConnector:
    """Get or create Neo4j connector singleton."""
    global _neo4j_connector
    if _neo4j_connector is None:
        _neoo4j_connector = Neo4jConnector()
    return _neo4j_connector
