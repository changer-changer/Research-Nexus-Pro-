"""
Local Graph Database - SQLite + NetworkX
Zero-Docker deployment for Research-Nexus
"""

import sqlite3
import json
import networkx as nx
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LocalGraphDB:
    """
    SQLite-backed graph database with NetworkX in-memory caching.
    Replaces Neo4j for zero-docker deployment.
    """
    
    def __init__(self, db_path: str = "data/research_graph.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.graph = nx.DiGraph()
        self._init_db()
        self._load_to_memory()
        logger.info(f"LocalGraphDB initialized at {self.db_path}")
    
    def _init_db(self):
        """Initialize SQLite schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Nodes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                type TEXT CHECK(type IN ('problem', 'method', 'paper')),
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create index on type
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)
        """)
        
        # Edges table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS edges (
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                type TEXT NOT NULL,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (source, target, type),
                FOREIGN KEY (source) REFERENCES nodes(id),
                FOREIGN KEY (target) REFERENCES nodes(id)
            )
        """)
        
        # Create index on edge type
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)
        """)
        
        # FTS5 full-text search on nodes
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS fts_nodes USING fts5(
                node_id UNINDEXED,
                node_type UNINDEXED,
                title,
                content,
                tokenize='porter'
            )
        """)
        
        # Triggers to keep FTS index in sync with nodes
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_nodes_fts_insert
            AFTER INSERT ON nodes
            BEGIN
                INSERT INTO fts_nodes(node_id, node_type, title, content)
                SELECT 
                    NEW.id,
                    NEW.type,
                    json_extract(NEW.data, '$.name'),
                    COALESCE(json_extract(NEW.data, '$.definition'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.description'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.mechanism'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.title'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.abstract'), '')
                WHERE json_extract(NEW.data, '$.name') IS NOT NULL
                   OR json_extract(NEW.data, '$.title') IS NOT NULL;
            END
        """)
        
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_nodes_fts_update
            AFTER UPDATE ON nodes
            BEGIN
                DELETE FROM fts_nodes WHERE node_id = OLD.id;
                INSERT INTO fts_nodes(node_id, node_type, title, content)
                SELECT 
                    NEW.id,
                    NEW.type,
                    json_extract(NEW.data, '$.name'),
                    COALESCE(json_extract(NEW.data, '$.definition'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.description'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.mechanism'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.title'), '') || ' ' ||
                    COALESCE(json_extract(NEW.data, '$.abstract'), '')
                WHERE json_extract(NEW.data, '$.name') IS NOT NULL
                   OR json_extract(NEW.data, '$.title') IS NOT NULL;
            END
        """)
        
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_nodes_fts_delete
            AFTER DELETE ON nodes
            BEGIN
                DELETE FROM fts_nodes WHERE node_id = OLD.id;
            END
        """)
        
        # Claims table (Evidence Layer)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS claims (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL,
                canonical_id TEXT,
                type TEXT NOT NULL,
                text TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Innovations table (Discovery Layer)
        # Schema aligned with innovation_routes.py init_innovation_tables()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS innovations (
                id TEXT PRIMARY KEY,
                title TEXT,
                description TEXT,
                paradigm TEXT,
                target_problem TEXT,
                candidate_method TEXT,
                core_insight TEXT,
                source_papers TEXT,
                novelty_score REAL,
                feasibility_score REAL,
                impact_score REAL,
                urgency_score REAL,
                composite_score REAL,
                mvp_experiment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Insights table — system-generated innovation insights with Agent Society provenance
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS insights (
                id TEXT PRIMARY KEY,
                type TEXT CHECK(type IN ('cdt','shf','mc','tf','ch','rgi')),
                title TEXT NOT NULL,
                rationale TEXT,
                hypothesis TEXT,
                experiment_design TEXT,
                confidence REAL DEFAULT 0.0,
                composite_score REAL DEFAULT 0.0,
                status TEXT CHECK(status IN ('hypothesis','validated','rejected','published')) DEFAULT 'hypothesis',
                source_node_ids TEXT,
                evidence_claim_ids TEXT,
                agent_debate_log TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Agent sessions table — tracks Agent Society debate sessions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_sessions (
                id TEXT PRIMARY KEY,
                session_type TEXT CHECK(session_type IN ('extraction','innovation','review')) NOT NULL,
                trigger_node_id TEXT,
                participants TEXT,
                conclusion TEXT,
                reasoning_chain TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Config table (user settings, library path, etc.)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()

        # Rebuild FTS index if empty (handles schema migrations)
        cursor.execute("SELECT COUNT(*) FROM fts_nodes")
        fts_count = cursor.fetchone()[0]
        if fts_count == 0:
            cursor.execute("""
                INSERT INTO fts_nodes(node_id, node_type, title, content)
                SELECT 
                    id,
                    type,
                    json_extract(data, '$.name'),
                    COALESCE(json_extract(data, '$.definition'), '') || ' ' ||
                    COALESCE(json_extract(data, '$.description'), '') || ' ' ||
                    COALESCE(json_extract(data, '$.mechanism'), '') || ' ' ||
                    COALESCE(json_extract(data, '$.title'), '') || ' ' ||
                    COALESCE(json_extract(data, '$.abstract'), '')
                FROM nodes
                WHERE json_extract(data, '$.name') IS NOT NULL
                   OR json_extract(data, '$.title') IS NOT NULL
            """)
            conn.commit()
            logger.info("FTS5 index populated from existing nodes")
        
        conn.close()
        logger.info("Database schema initialized")
    
    def _load_to_memory(self):
        """Load graph into NetworkX for fast traversal."""
        self.graph.clear()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Load nodes
        cursor.execute("SELECT id, type, data FROM nodes")
        for row in cursor.fetchall():
            node_id, node_type, data_json = row
            data = json.loads(data_json)
            self.graph.add_node(node_id, type=node_type, **data)
        
        # Load edges
        cursor.execute("SELECT source, target, type, data FROM edges")
        for row in cursor.fetchall():
            source, target, edge_type, data_json = row
            data = json.loads(data_json) if data_json else {}
            self.graph.add_edge(source, target, type=edge_type, **data)
        
        conn.close()
        logger.info(f"Loaded {self.graph.number_of_nodes()} nodes and {self.graph.number_of_edges()} edges")
    
    def health_check(self) -> bool:
        """Check database health."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM nodes")
            cursor.execute("SELECT COUNT(*) FROM edges")
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    def rebuild_fts_index(self):
        """Rebuild FTS5 index from existing nodes (useful for migrations)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM fts_nodes")
        cursor.execute("""
            INSERT INTO fts_nodes(node_id, node_type, title, content)
            SELECT 
                id,
                type,
                json_extract(data, '$.name'),
                COALESCE(json_extract(data, '$.definition'), '') || ' ' ||
                COALESCE(json_extract(data, '$.description'), '') || ' ' ||
                COALESCE(json_extract(data, '$.mechanism'), '') || ' ' ||
                COALESCE(json_extract(data, '$.title'), '') || ' ' ||
                COALESCE(json_extract(data, '$.abstract'), '')
            FROM nodes
            WHERE json_extract(data, '$.name') IS NOT NULL
               OR json_extract(data, '$.title') IS NOT NULL
        """)
        conn.commit()
        conn.close()
        logger.info("FTS5 index rebuilt")

    def search_nodes(self, query: str, node_type: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Full-text search across nodes using FTS5."""
        if not query or not query.strip():
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        sanitized = query.strip().replace("'", "''")
        match_expr = ' '.join(f'"{token}"' for token in sanitized.split() if token)
        
        if node_type:
            cursor.execute("""
                SELECT n.node_id, n.node_type, n.title
                FROM fts_nodes n
                WHERE n.fts_nodes MATCH ? AND n.node_type = ?
                ORDER BY rank
                LIMIT ?
            """, (match_expr, node_type, limit))
        else:
            cursor.execute("""
                SELECT n.node_id, n.node_type, n.title
                FROM fts_nodes n
                WHERE n.fts_nodes MATCH ?
                ORDER BY rank
                LIMIT ?
            """, (match_expr, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for node_id, ntype, title in rows:
            if ntype == 'problem':
                data = self.get_problem(node_id)
            elif ntype == 'method':
                data = self.get_method(node_id)
            elif ntype == 'paper':
                if node_id in self.graph:
                    data = dict(self.graph.nodes[node_id])
                    data['id'] = node_id
                else:
                    data = None
            else:
                data = None
            
            if data:
                results.append(data)
        
        return results
    
    # =========================================================================
    # PROBLEM OPERATIONS
    # =========================================================================
    
    def create_problem(self, problem_data: Dict[str, Any]) -> str:
        """
        Create a Problem node.
        
        Args:
            problem_data: Must contain 'id', 'name', 'definition'
            
        Returns:
            The problem ID
        """
        problem_id = problem_data.get('id')
        if not problem_id:
            raise ValueError("problem_data must contain 'id'")
        
        # Prepare data
        data = {
            'name': problem_data.get('name', ''),
            'definition': problem_data.get('definition', ''),
            'domain': problem_data.get('domain', 'unknown'),
            'resolution_status': problem_data.get('resolution_status', 'active'),
            'year': problem_data.get('year'),
            'constraints': problem_data.get('constraints', 'Hardware/Physics/Math constraints not explicitly defined.'),
            'evaluation_metrics': problem_data.get('evaluation_metrics', 'No specific metrics identified.'),
            'description': problem_data.get('description', 'No detailed description generated yet.'),
            'development_progress': problem_data.get('development_progress', 'No progress history generated yet.'),
            'papers': problem_data.get('papers', []),
            'methods': problem_data.get('methods', []),
            # P0-P2 extended fields
            'keywords': problem_data.get('keywords', []),
            'performance_metrics': problem_data.get('performance_metrics'),
            'benchmark_datasets': problem_data.get('benchmark_datasets', []),
            'related_problems': problem_data.get('related_problems', []),
        }
        
        # Save to SQLite
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO nodes (id, type, data, updated_at)
            VALUES (?, 'problem', ?, CURRENT_TIMESTAMP)
            """,
            (problem_id, json.dumps(data))
        )
        conn.commit()
        conn.close()
        
        # Update in-memory graph
        self.graph.add_node(problem_id, type='problem', **data)
        
        logger.debug(f"Created problem: {problem_id}")
        return problem_id
    
    def _compute_problem_value_score(self, data: Dict[str, Any]) -> float:
        """Compute value_score for a problem based on resolution_status, connected methods, and claims."""
        resolution_status = data.get('resolution_status', 'unsolved')
        base_scores = {
            'solved': 90,
            'partial': 65,
            'active': 50,
            'unsolved': 30
        }
        base = base_scores.get(resolution_status, 30)
        
        node_id = data.get('id')
        method_count = 0
        if node_id:
            for _, _, edge_data in self.graph.in_edges(node_id, data=True):
                if edge_data.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                    method_count += 1
        
        claim_count = 0
        if node_id:
            claim_count = len(self.get_claims_by_canonical(node_id))
        
        bonus = method_count * 5 + claim_count * 2
        return float(min(base + bonus, 100))

    def _compute_method_value_score(self, data: Dict[str, Any]) -> float:
        """Compute value_score for a method based on verification status, target problems, and related papers."""
        status = data.get('status') or data.get('verification_status') or 'untested'
        base_scores = {
            'verified': 85,
            'partial': 60,
            'untested': 40,
            'failed': 20
        }
        base = base_scores.get(status, 40)
        
        node_id = data.get('id')
        target_count = 0
        if node_id:
            for _, _, edge_data in self.graph.out_edges(node_id, data=True):
                if edge_data.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                    target_count += 1
        
        # Count related papers via claims (unique paper_ids)
        paper_count = 0
        if node_id:
            claims = self.get_claims_by_canonical(node_id)
            paper_ids = {c.get('paper_id') for c in claims if c.get('paper_id')}
            paper_count = len(paper_ids)
            if paper_count == 0:
                paper_count = len(data.get('papers', []))
        else:
            paper_count = len(data.get('papers', []))
        
        bonus = target_count * 3 + paper_count * 2
        return float(min(base + bonus, 100))

    def get_problem(self, problem_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a problem by ID."""
        if problem_id in self.graph:
            data = dict(self.graph.nodes[problem_id])
            data['id'] = problem_id
            data['value_score'] = self._compute_problem_value_score(data)
            return data
        return None
    
    def get_all_problems(self) -> List[Dict[str, Any]]:
        """Get all problems."""
        problems = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get('type') == 'problem':
                problem_data = dict(data)
                problem_data['id'] = node_id
                problem_data['value_score'] = self._compute_problem_value_score(problem_data)
                problems.append(problem_data)
        return sorted(problems, key=lambda x: x.get('name', ''))
    
    def query_problems(self, domain: Optional[str] = None, 
                       status: Optional[str] = None,
                       limit: int = 100) -> List[Dict[str, Any]]:
        """Query problems with filters."""
        problems = self.get_all_problems()
        
        if domain:
            problems = [p for p in problems if p.get('domain') == domain]
        
        if status:
            problems = [p for p in problems if p.get('resolution_status') == status]
        
        return problems[:limit]
    
    # =========================================================================
    # METHOD OPERATIONS
    # =========================================================================
    
    def create_method(self, method_data: Dict[str, Any]) -> str:
        """Create a Method node."""
        method_id = method_data.get('id')
        if not method_id:
            raise ValueError("method_data must contain 'id'")
        
        data = {
            'name': method_data.get('name', ''),
            'mechanism': method_data.get('mechanism', ''),
            'complexity': method_data.get('complexity', 'medium'),
            'domain': method_data.get('domain', 'unknown'),
            'year': method_data.get('year'),
            'assumptions': method_data.get('assumptions', 'Pre-conditions and assumptions not explicitly defined.'),
            'limitations': method_data.get('limitations', 'Known blind spots not explicitly defined.'),
            'description': method_data.get('description', 'No detailed description generated yet.'),
            'development_progress': method_data.get('development_progress', 'No progress history generated yet.'),
            'papers': method_data.get('papers', []),
            'targets': method_data.get('targets', []),
            # P0-P2 extended fields
            'keywords': method_data.get('keywords', []),
            'input_output_spec': method_data.get('input_output_spec'),
            'hyperparameters': method_data.get('hyperparameters'),
            'application_domains': method_data.get('application_domains', []),
            'cross_domain_potential': method_data.get('cross_domain_potential'),
            'performance_metrics': method_data.get('performance_metrics'),
        }
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO nodes (id, type, data, updated_at)
            VALUES (?, 'method', ?, CURRENT_TIMESTAMP)
            """,
            (method_id, json.dumps(data))
        )
        conn.commit()
        conn.close()
        
        self.graph.add_node(method_id, type='method', **data)
        logger.debug(f"Created method: {method_id}")
        return method_id
    
    def get_method(self, method_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a method by ID."""
        if method_id in self.graph:
            data = dict(self.graph.nodes[method_id])
            data['id'] = method_id
            data['value_score'] = self._compute_method_value_score(data)
            return data
        return None

    def get_all_methods(self) -> List[Dict[str, Any]]:
        """Get all methods."""
        methods = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get('type') == 'method':
                method_data = dict(data)
                method_data['id'] = node_id
                method_data['value_score'] = self._compute_method_value_score(method_data)
                methods.append(method_data)
        return sorted(methods, key=lambda x: x.get('name', ''))

    def _infer_paper_category(self, title: str, abstract: str = "") -> str:
        """Infer paper category from title/abstract keywords."""
        text = (title + " " + abstract).lower()
        tags = []
        keyword_map = {
            'tactile': ['tactile', 'touch', 'haptic', 'gripper', 'grasping', 'slippage'],
            'vision': ['vision', 'visual', 'image', 'camera', 'rgb', 'multimodal'],
            'diffusion': ['diffusion', 'flow', 'score-based', 'ddpm', 'edm'],
            'vla': ['vla', 'vision-language-action', 'vision language action', 'rt-', 'openvla'],
            'manipulation': ['manipulation', 'dexterous', 'hand', 'picking', 'placing'],
            'rl': ['rl', 'reinforcement learning', 'policy gradient', 'ppo', 'sac'],
            'sim2real': ['sim2real', 'sim-to-real', 'domain randomization', 'domain adaptation'],
            'imitation': ['imitation', 'behavior cloning', 'bc', 'demonstration', 'teleoperation'],
            '3d': ['3d', 'point cloud', 'pointnet', 'depth', 'mesh', 'neural field'],
            'transformer': ['transformer', 'attention', 'gpt', 'llm', 'language model', 'qwen'],
            'foundation': ['foundation model', 'foundation', 'generalist', 'general purpose', 'unified'],
            'benchmark': ['benchmark', 'dataset', 'evaluation', 'metric', 'leaderboard'],
            'sensor': ['sensor', 'fingertip', 'gelsight', 'digit', 'bioacoustic', 'force'],
            'language': ['language', 'instruction', 'llm', 'vlm', 'caption'],
            'representation': ['representation', 'embedding', 'latent', 'feature learning', 'pretraining'],
        }
        for tag, keywords in keyword_map.items():
            if any(kw in text for kw in keywords):
                tags.append(tag)
        return ', '.join(tags) if tags else 'General'

    def get_all_papers(self) -> List[Dict[str, Any]]:
        """Get all papers with derived categories and citations."""
        # Pre-build claim-based problem links for all papers
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT paper_id, canonical_id FROM claims WHERE paper_id LIKE '2%' OR paper_id LIKE 'paper_%'
        """)
        paper_claim_links = {}
        for paper_id, canonical_id in cursor.fetchall():
            if paper_id not in paper_claim_links:
                paper_claim_links[paper_id] = set()
            paper_claim_links[paper_id].add(canonical_id)
        conn.close()

        papers = []
        for node_id, data in self.graph.nodes(data=True):
            if data.get('type') == 'paper':
                paper_data = dict(data)
                paper_data['id'] = node_id
                # Derive category
                existing = paper_data.get('category', '')
                if not existing or existing in ('Agent & LLM', 'General', 'unknown'):
                    domains = set()
                    # Check graph edges
                    for source, target, edge_data in self.graph.edges(data=True):
                        if edge_data.get('type') in ('ADDRESSES_PROBLEM', 'SOLVES', 'USES_METHOD'):
                            if source == node_id and self.graph.nodes[target].get('type') in ('problem', 'method'):
                                d = self.graph.nodes[target].get('domain', 'unknown')
                                if d and d not in ('unknown', 'General'):
                                    domains.add(d)
                            if target == node_id and self.graph.nodes[source].get('type') in ('problem', 'method'):
                                d = self.graph.nodes[source].get('domain', 'unknown')
                                if d and d not in ('unknown', 'General'):
                                    domains.add(d)
                    # Check claims for additional links
                    for linked_id in paper_claim_links.get(node_id, []):
                        if linked_id in self.graph:
                            ntype = self.graph.nodes[linked_id].get('type')
                            if ntype in ('problem', 'method'):
                                d = self.graph.nodes[linked_id].get('domain', 'unknown')
                                if d and d not in ('unknown', 'General'):
                                    domains.add(d)
                    if domains:
                        paper_data['category'] = ', '.join(sorted(domains))
                    else:
                        # Fallback to keyword inference from title/abstract
                        paper_data['category'] = self._infer_paper_category(
                            paper_data.get('title', ''),
                            paper_data.get('abstract', '')
                        )
                # Include citations
                paper_data['citations'] = self.get_paper_citations(node_id)
                papers.append(paper_data)
        def _paper_year(p):
            y = p.get('year')
            if y is None:
                return 0
            try:
                return int(y)
            except (ValueError, TypeError):
                return 0
        return sorted(papers, key=_paper_year, reverse=True)
    
    # =========================================================================
    # PAPER OPERATIONS
    # =========================================================================
    
    def create_paper(self, paper_data: Dict[str, Any]) -> str:
        """Create a Paper node."""
        import uuid
        paper_id = paper_data.get('id') or f"paper_{uuid.uuid4().hex[:8]}"
        paper_data['id'] = paper_id
        
        data = {
            'title': paper_data.get('title', ''),
            'authors': paper_data.get('authors', []),
            'year': paper_data.get('year'),
            'venue': paper_data.get('venue', ''),
            'abstract': paper_data.get('abstract', ''),
            'arxiv_id': paper_data.get('arxiv_id'),
            'ranking': paper_data.get('ranking', 'Supporting'),
            'category': paper_data.get('category', ''),
            'methodology': paper_data.get('methodology', 'Unknown'),
            'authority_score': paper_data.get('authority_score') or paper_data.get('authorityScore', 0.5),
            # P0-P2 extended fields
            'keywords': paper_data.get('keywords', []),
            'doi': paper_data.get('doi'),
            'citation_count': paper_data.get('citation_count'),
            'parsed_sections': paper_data.get('parsed_sections'),
            'figure_count': paper_data.get('figure_count'),
        }
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO nodes (id, type, data, updated_at)
            VALUES (?, 'paper', ?, CURRENT_TIMESTAMP)
            """,
            (paper_id, json.dumps(data))
        )
        conn.commit()
        conn.close()
        
        self.graph.add_node(paper_id, type='paper', **data)
        logger.info(f"Created paper: {paper_id}")
        return paper_id
    
    def create_paper_relationships(self, paper_id: str, 
                                   problem_ids: List[str] = None,
                                   method_ids: List[str] = None) -> bool:
        """Create relationships between paper and problems/methods."""
        pass # Not used currently
    
    def create_citation(self, source_paper_id: str, target_paper_id: str) -> bool:
        """Create a CITES relationship between two papers."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO edges (source, target, type, data, created_at)
                VALUES (?, ?, 'CITES', '{}', CURRENT_TIMESTAMP)
                """,
                (source_paper_id, target_paper_id)
            )
            conn.commit()
            conn.close()
            self.graph.add_edge(source_paper_id, target_paper_id, type='CITES')
            return True
        except Exception as e:
            logger.error(f"Failed to create citation: {e}")
            return False
    
    def get_paper_citations(self, paper_id: str) -> List[str]:
        """Get all papers cited by this paper."""
        citations = []
        for source, target, data in self.graph.out_edges(paper_id, data=True):
            if data.get('type') == 'CITES':
                citations.append(target)
        return citations

    # =========================================================================
    # CLAIMS OPERATIONS (Evidence Layer)
    # =========================================================================

    def create_claim(self, claim_data: Dict[str, Any]) -> str:
        claim_id = claim_data.get('id')
        if not claim_id:
            raise ValueError("claim_data must contain 'id'")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO claims (id, paper_id, canonical_id, type, text, evidence_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                claim_id,
                claim_data.get('paper_id', ''),
                claim_data.get('canonical_id', ''),
                claim_data.get('type', ''),
                claim_data.get('text', ''),
                json.dumps(claim_data.get('evidence', []))
            )
        )
        conn.commit()
        conn.close()
        return claim_id

    def get_claim(self, claim_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, paper_id, type, text, evidence_json FROM claims WHERE id = ?", (claim_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "claim_id": row[0],
                "paper_id": row[1],
                "claim_type": row[2],
                "text": row[3],
                "evidence": json.loads(row[4])
            }
        return None

    def get_claims_by_canonical(self, canonical_id: str) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, paper_id, type, text, evidence_json FROM claims WHERE canonical_id = ?", (canonical_id,))
        rows = cursor.fetchall()
        conn.close()
        
        claims = []
        for row in rows:
            claims.append({
                "claim_id": row[0],
                "paper_id": row[1],
                "claim_type": row[2],
                "text": row[3],
                "evidence": json.loads(row[4])
            })
        return claims

    # =========================================================================
    # INNOVATION OPERATIONS (Discovery Layer)
    # =========================================================================

    def create_innovation(self, innovation_data: Dict[str, Any]) -> str:
        """Persist an innovation opportunity to the DB.

        Accepts a dict with keys matching the innovations table schema.
        Falls back to extracting from a nested 'data' JSON blob for backward compat.
        """
        innovation_id = innovation_data.get('id')
        if not innovation_id:
            raise ValueError("innovation_data must contain 'id'")

        # Handle both old format (data blob) and new format (flat columns)
        if 'data' in innovation_data and isinstance(innovation_data['data'], str):
            # Old format: data is a JSON string
            nested = json.loads(innovation_data['data'])
            flat = {**innovation_data, **nested}
        else:
            flat = innovation_data

        target_problem = flat.get('target_problem') or flat.get('target_problem_id', '')
        candidate_methods = flat.get('candidate_method_ids', flat.get('candidate_method', []))
        candidate_method = candidate_methods[0] if isinstance(candidate_methods, list) and candidate_methods else candidate_methods

        title = flat.get('title', '')
        if not title and target_problem and candidate_method:
            title = f"{flat.get('innovation_type', 'CDT').upper()}: {candidate_method} → {target_problem}"

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Check if table has old schema (target_problem_id column) and migrate if needed
        cursor.execute("PRAGMA table_info(innovations)")
        cols = [c[1] for c in cursor.fetchall()]
        if 'target_problem_id' in cols and 'title' not in cols:
            # Old schema detected — drop and recreate
            logger.warning("Old innovations schema detected, migrating...")
            cursor.execute("DROP TABLE innovations")
            cursor.execute("""
                CREATE TABLE innovations (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    paradigm TEXT,
                    target_problem TEXT,
                    candidate_method TEXT,
                    core_insight TEXT,
                    source_papers TEXT,
                    novelty_score REAL,
                    feasibility_score REAL,
                    impact_score REAL,
                    urgency_score REAL,
                    composite_score REAL,
                    mvp_experiment TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        cursor.execute(
            """
            INSERT OR REPLACE INTO innovations (
                id, title, description, paradigm, target_problem, candidate_method,
                core_insight, source_papers, novelty_score, feasibility_score,
                impact_score, urgency_score, composite_score, mvp_experiment, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                innovation_id,
                title,
                flat.get('description', flat.get('rationale', '')),
                flat.get('paradigm', flat.get('innovation_type', 'cdt')),
                target_problem,
                candidate_method,
                flat.get('core_insight', flat.get('rationale', '')),
                json.dumps(flat.get('source_papers', [])),
                flat.get('novelty_score', 0.5),
                flat.get('feasibility_score', 0.5),
                flat.get('impact_score', 0.5),
                flat.get('urgency_score', 0.0),
                flat.get('composite_score', 0.0),
                flat.get('mvp_experiment', ''),
            )
        )
        conn.commit()
        conn.close()
        return innovation_id

    def get_all_innovations(self) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, description, paradigm, target_problem, candidate_method,
                   core_insight, source_papers, novelty_score, feasibility_score,
                   impact_score, urgency_score, composite_score, mvp_experiment, created_at
            FROM innovations
        """)
        rows = cursor.fetchall()
        conn.close()

        innovations = []
        for row in rows:
            innovations.append({
                "id": row["id"],
                "title": row["title"],
                "description": row["description"] or "",
                "paradigm": row["paradigm"],
                "target_problem": row["target_problem"] or "",
                "candidate_method": row["candidate_method"] or "",
                "core_insight": row["core_insight"] or "",
                "source_papers": row["source_papers"] or "[]",
                "novelty_score": row["novelty_score"] or 0.0,
                "feasibility_score": row["feasibility_score"] or 0.0,
                "impact_score": row["impact_score"] or 0.0,
                "urgency_score": row["urgency_score"] or 0.0,
                "composite_score": row["composite_score"] or 0.0,
                "mvp_experiment": row["mvp_experiment"] or "",
                "created_at": row["created_at"],
            })
        return innovations

    # =========================================================================
    # INSIGHT OPERATIONS (Agent Society Output)
    # =========================================================================

    def create_insight(self, insight_data: Dict[str, Any]) -> str:
        insight_id = insight_data.get('id') or insight_data.get('insight_id')
        if not insight_id:
            import uuid
            insight_id = f"insight_{uuid.uuid4().hex[:8]}"

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO insights (id, type, title, rationale, hypothesis,
                experiment_design, confidence, composite_score, status,
                source_node_ids, evidence_claim_ids, agent_debate_log, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                insight_id,
                insight_data.get('type', 'cdt'),
                insight_data.get('title', ''),
                insight_data.get('rationale', ''),
                insight_data.get('hypothesis', ''),
                insight_data.get('experiment_design', ''),
                insight_data.get('confidence', 0.0),
                insight_data.get('composite_score', 0.0),
                insight_data.get('status', 'hypothesis'),
                json.dumps(insight_data.get('source_node_ids', [])),
                json.dumps(insight_data.get('evidence_claim_ids', [])),
                json.dumps(insight_data.get('agent_debate_log', {}))
            )
        )
        conn.commit()
        conn.close()
        return insight_id

    def get_insight(self, insight_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, type, title, rationale, hypothesis, experiment_design,
                   confidence, composite_score, status, source_node_ids,
                   evidence_claim_ids, agent_debate_log, created_at
            FROM insights WHERE id = ?
        """, (insight_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "id": row[0],
                "type": row[1],
                "title": row[2],
                "rationale": row[3],
                "hypothesis": row[4],
                "experiment_design": row[5],
                "confidence": row[6],
                "composite_score": row[7],
                "status": row[8],
                "source_node_ids": json.loads(row[9]) if row[9] else [],
                "evidence_claim_ids": json.loads(row[10]) if row[10] else [],
                "agent_debate_log": json.loads(row[11]) if row[11] else {},
                "created_at": row[12]
            }
        return None

    def get_all_insights(self, paradigm: Optional[str] = None,
                         min_score: float = 0.0,
                         limit: int = 100) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if paradigm:
            cursor.execute("""
                SELECT id, type, title, rationale, hypothesis, experiment_design,
                       confidence, composite_score, status, source_node_ids,
                       evidence_claim_ids, agent_debate_log, created_at
                FROM insights WHERE type = ? AND composite_score >= ?
                ORDER BY composite_score DESC
                LIMIT ?
            """, (paradigm, min_score, limit))
        else:
            cursor.execute("""
                SELECT id, type, title, rationale, hypothesis, experiment_design,
                       confidence, composite_score, status, source_node_ids,
                       evidence_claim_ids, agent_debate_log, created_at
                FROM insights WHERE composite_score >= ?
                ORDER BY composite_score DESC
                LIMIT ?
            """, (min_score, limit))

        rows = cursor.fetchall()
        conn.close()

        insights = []
        for row in rows:
            insights.append({
                "id": row[0],
                "type": row[1],
                "title": row[2],
                "rationale": row[3],
                "hypothesis": row[4],
                "experiment_design": row[5],
                "confidence": row[6],
                "composite_score": row[7],
                "status": row[8],
                "source_node_ids": json.loads(row[9]) if row[9] else [],
                "evidence_claim_ids": json.loads(row[10]) if row[10] else [],
                "agent_debate_log": json.loads(row[11]) if row[11] else {},
                "created_at": row[12]
            })
        return insights

    def update_insight_status(self, insight_id: str, status: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE insights SET status = ? WHERE id = ?", (status, insight_id))
        conn.commit()
        conn.close()
        return True

    # =========================================================================
    # AGENT SESSION OPERATIONS
    # =========================================================================

    def create_agent_session(self, session_data: Dict[str, Any]) -> str:
        session_id = session_data.get('id') or session_data.get('session_id')
        if not session_id:
            import uuid
            session_id = f"session_{uuid.uuid4().hex[:8]}"

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO agent_sessions (id, session_type, trigger_node_id,
                participants, conclusion, reasoning_chain, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                session_id,
                session_data.get('session_type', 'innovation'),
                session_data.get('trigger_node_id', ''),
                json.dumps(session_data.get('participants', [])),
                session_data.get('conclusion', ''),
                json.dumps(session_data.get('reasoning_chain', []))
            )
        )
        conn.commit()
        conn.close()
        return session_id

    def get_agent_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, session_type, trigger_node_id, participants,
                   conclusion, reasoning_chain, created_at
            FROM agent_sessions WHERE id = ?
        """, (session_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "id": row[0],
                "session_type": row[1],
                "trigger_node_id": row[2],
                "participants": json.loads(row[3]) if row[3] else [],
                "conclusion": row[4],
                "reasoning_chain": json.loads(row[5]) if row[5] else [],
                "created_at": row[6]
            }
        return None

    # =========================================================================
    # RELATIONSHIP OPERATIONS
    # =========================================================================

    def create_relation(self, source_id: str, target_id: str, relation_type: str, properties: Dict[str, Any] = None) -> bool:
        """Create a generic relationship between two nodes."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            data = properties or {}
            
            cursor.execute(
                """
                INSERT OR REPLACE INTO edges (source, target, type, data, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (source_id, target_id, relation_type, json.dumps(data))
            )
            conn.commit()
            conn.close()
            
            self.graph.add_edge(source_id, target_id, type=relation_type, **data)
            logger.debug(f"Created {relation_type}: {source_id} -> {target_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create relation: {e}")
            return False

    def create_solves_relationship(self, method_id: str, problem_id: str,
                                    effectiveness: Optional[str] = None,
                                    limitations: Optional[str] = None) -> bool:
        """Create SOLVES relationship."""
        try:
            data = {
                'effectiveness': effectiveness,
                'limitations': limitations
            }
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO edges (source, target, type, data)
                VALUES (?, ?, 'SOLVES', ?)
                """,
                (method_id, problem_id, json.dumps(data))
            )
            conn.commit()
            conn.close()
            
            self.graph.add_edge(method_id, problem_id, type='SOLVES', **data)
            logger.debug(f"Created SOLVES: {method_id} -> {problem_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create SOLVES relationship: {e}")
            return False
    
    def create_improves_upon_relationship(self, child_method_id: str, parent_method_id: str) -> bool:
        """Create IMPROVES_UPON relationship between methods."""
        return self.create_relation(child_method_id, parent_method_id, 'IMPROVES_UPON')
        
    def create_sub_type_of_relationship(self, sub_id: str, parent_id: str) -> bool:
        """Create SUB_TYPE_OF relationship."""
        return self.create_relation(sub_id, parent_id, 'SUB_TYPE_OF')

    def create_sub_problem_relationship(self, child_id: str, parent_id: str) -> bool:
        """Create SUB_PROBLEM_OF relationship."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO edges (source, target, type, data)
                VALUES (?, ?, 'SUB_PROBLEM_OF', '{}')
                """,
                (child_id, parent_id)
            )
            conn.commit()
            conn.close()
            
            self.graph.add_edge(child_id, parent_id, type='SUB_PROBLEM_OF')
            logger.debug(f"Created SUB_PROBLEM_OF: {child_id} -> {parent_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create SUB_PROBLEM_OF: {e}")
            return False
    
    def get_problem_methods(self, problem_id: str) -> List[Dict[str, Any]]:
        """Get all methods that solve a specific problem."""
        methods = []
        for source, target, data in self.graph.in_edges(problem_id, data=True):
            if data.get('type') == 'SOLVES':
                method_data = self.get_method(source)
                if method_data:
                    method_data['effectiveness'] = data.get('effectiveness')
                    method_data['limitations'] = data.get('limitations')
                    methods.append(method_data)
        return methods
    
    def get_method(self, method_id: str) -> Optional[Dict[str, Any]]:
        """Get a method by ID."""
        if method_id in self.graph:
            data = dict(self.graph.nodes[method_id])
            data['id'] = method_id
            data['value_score'] = self._compute_method_value_score(data)
            return data
        return None
    
    def get_statistics(self) -> Dict[str, int]:
        """Get database statistics."""
        problems = len([n for n, d in self.graph.nodes(data=True) if d.get('type') == 'problem'])
        methods = len([n for n, d in self.graph.nodes(data=True) if d.get('type') == 'method'])
        papers = len([n for n, d in self.graph.nodes(data=True) if d.get('type') == 'paper'])
        relationships = self.graph.number_of_edges()
        
        return {
            'problems': problems,
            'methods': methods,
            'papers': papers,
            'relationships': relationships
        }
    
    def clear_all(self):
        """Clear all data (use with caution)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM edges")
        cursor.execute("DELETE FROM nodes")
        conn.commit()
        conn.close()
        
        self.graph.clear()
        logger.warning("All database data cleared")
    
    def import_from_json(self, json_data: Dict[str, Any]):
        """Import data from EXTRACTED_DATA.json format."""
        # Import problems
        for branch_id, problems in json_data.get('problems_by_branch', {}).items():
            for problem in problems:
                problem_data = {
                    'id': problem['id'],
                    'name': problem['name'],
                    'definition': problem.get('description', ''),
                    'domain': branch_id,
                    'resolution_status': problem.get('status', 'active'),
                    'year': problem.get('year')
                }
                self.create_problem(problem_data)
        
        # Import methods
        for branch_id, methods in json_data.get('methods_by_branch', {}).items():
            for method in methods:
                method_data = {
                    'id': method['id'],
                    'name': method['name'],
                    'mechanism': method.get('mechanism', ''),
                    'domain': branch_id,
                    'year': method.get('year')
                }
                self.create_method(method_data)
        
        logger.info(f"Imported {self.get_statistics()}")

    # =========================================================================
    # CONFIG OPERATIONS (User Settings)
    # =========================================================================

    def get_config(self, key: str, default: str = None) -> Optional[str]:
        """Get a config value by key."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM config WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else default

    def set_config(self, key: str, value: str) -> bool:
        """Set a config value."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO config (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            """,
            (key, value)
        )
        conn.commit()
        conn.close()
        return True

    # =========================================================================
    # DELETE OPERATIONS (with cascade support)
    # =========================================================================

    def delete_node(self, node_id: str) -> bool:
        """Delete a node and all its edges from the database."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            # Delete all edges connected to this node
            cursor.execute("DELETE FROM edges WHERE source = ? OR target = ?", (node_id, node_id))
            # Delete the node itself (FTS trigger will auto-remove from fts_nodes)
            cursor.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
            conn.commit()
            conn.close()
            # Update in-memory graph
            if node_id in self.graph:
                self.graph.remove_node(node_id)
            logger.info(f"Deleted node: {node_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete node {node_id}: {e}")
            return False

    def delete_problem(self, problem_id: str) -> bool:
        """Delete a problem node and all related edges."""
        return self.delete_node(problem_id)

    def delete_method(self, method_id: str) -> bool:
        """Delete a method node and all related edges."""
        return self.delete_node(method_id)

    def delete_paper(self, paper_id: str, cascade_orphans: bool = True) -> Dict[str, Any]:
        """
        Delete a paper node. If cascade_orphans is True, also delete
        problems and methods that have no other paper connections.
        Returns dict with lists of deleted node IDs.
        """
        deleted = {"paper": paper_id, "problems": [], "methods": [], "edges": 0}

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Step 1: Count and delete all edges connected to this paper
            cursor.execute(
                "SELECT COUNT(*) FROM edges WHERE source = ? OR target = ?",
                (paper_id, paper_id)
            )
            deleted["edges"] = cursor.fetchone()[0]

            cursor.execute(
                "DELETE FROM edges WHERE source = ? OR target = ?",
                (paper_id, paper_id)
            )

            # Step 2: If cascade_orphans, find nodes only connected to this paper
            if cascade_orphans:
                # Find all problems/methods that had edges with this paper
                cursor.execute(
                    "SELECT DISTINCT source FROM edges WHERE target = ? AND source != ?",
                    (paper_id, paper_id)
                )
                cursor.execute(
                    "SELECT DISTINCT target FROM edges WHERE source = ? AND target != ?",
                    (paper_id, paper_id)
                )

                # Re-check in-memory graph for orphaned nodes
                # An orphan is a problem/method with 0 remaining edges
                for node_id in list(self.graph.nodes()):
                    if node_id == paper_id:
                        continue
                    node_type = self.graph.nodes[node_id].get('type')
                    if node_type not in ('problem', 'method'):
                        continue
                    # Count remaining edges for this node
                    in_deg = self.graph.in_degree(node_id)
                    out_deg = self.graph.out_degree(node_id)
                    if in_deg == 0 and out_deg == 0:
                        # This node is now orphaned - delete it
                        cursor.execute("DELETE FROM edges WHERE source = ? OR target = ?", (node_id, node_id))
                        cursor.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
                        if node_type == 'problem':
                            deleted["problems"].append(node_id)
                        else:
                            deleted["methods"].append(node_id)
                        if node_id in self.graph:
                            self.graph.remove_node(node_id)

            # Step 3: Delete the paper node itself
            cursor.execute("DELETE FROM nodes WHERE id = ?", (paper_id,))
            conn.commit()
            conn.close()

            # Update in-memory graph
            if paper_id in self.graph:
                self.graph.remove_node(paper_id)

            logger.info(f"Deleted paper {paper_id}: {deleted}")
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete paper {paper_id}: {e}")
            return deleted

    # =========================================================================
    # UPDATE OPERATIONS
    # =========================================================================

    def _update_node(self, node_id: str, update_data: Dict[str, Any]) -> bool:
        """Generic node updater - merges new data with existing."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            # Get existing data
            cursor.execute("SELECT type, data FROM nodes WHERE id = ?", (node_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False

            node_type, existing_json = row
            existing = json.loads(existing_json)
            # Merge update
            existing.update(update_data)

            cursor.execute(
                "UPDATE nodes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (json.dumps(existing), node_id)
            )
            conn.commit()
            conn.close()

            # Update in-memory graph
            if node_id in self.graph:
                for k, v in update_data.items():
                    self.graph.nodes[node_id][k] = v

            return True
        except Exception as e:
            logger.error(f"Failed to update node {node_id}: {e}")
            return False

    def update_problem(self, problem_id: str, data: Dict[str, Any]) -> bool:
        """Update a problem node."""
        return self._update_node(problem_id, data)

    def update_method(self, method_id: str, data: Dict[str, Any]) -> bool:
        """Update a method node."""
        return self._update_node(method_id, data)

    def update_paper(self, paper_id: str, data: Dict[str, Any]) -> bool:
        """Update a paper node."""
        return self._update_node(paper_id, data)


# Global instance
_local_graph_db = None

def get_local_graph_db() -> LocalGraphDB:
    """Get singleton instance of LocalGraphDB."""
    global _local_graph_db
    if _local_graph_db is None:
        _local_graph_db = LocalGraphDB()
    return _local_graph_db
