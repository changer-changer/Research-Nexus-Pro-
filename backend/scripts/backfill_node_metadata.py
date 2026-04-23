"""
Backfill missing metadata for existing nodes in the research graph.

This script infers domain, year, and keywords for existing problem/method nodes
that were created before the extraction prompt included these fields.
"""

import sys
import json
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database.local_graph import get_local_graph_db

# Domain keyword mapping for inference
DOMAIN_KEYWORDS = {
    "robotics": ["robot", "manipulation", "grasp", "gripper", "dexterous", "arm", "mobile",
                 "navigation", "locomotion", "humanoid", "manipulator"],
    "tactile": ["tactile", "touch", "haptic", "vibration", "force", "pressure", "sensor",
                "gelsight", "digit", "bioacoustic", "texture", "slippage"],
    "diffusion": ["diffusion", "score-based", "ddpm", "edm", "flow", "generative",
                  "denoising", "score matching", "diffusion model"],
    "vla": ["vla", "vision-language-action", "vision language action", "rt-", "openvla",
            "language-action", "policy", "visual-language"],
    "rl": ["reinforcement learning", "rl", "ppo", "sac", "policy gradient", "q-learning",
           "actor-critic", "reward", "mdp", "markov"],
    "imitation": ["imitation", "behavior cloning", "bc", "demonstration", "teleoperation",
                  "human demonstration", "expert trajectory"],
    "sim2real": ["sim2real", "sim-to-real", "domain randomization", "domain adaptation",
                 "reality gap", "simulation"],
    "3d": ["3d", "point cloud", "pointnet", "depth", "mesh", "neural field", "nerf",
           "reconstruction", "voxel"],
    "transformer": ["transformer", "attention", "gpt", "llm", "language model", "qwen",
                    "bert", "vision transformer", "vit"],
    "multi_agent": ["multi-agent", "multiagent", "swarm", "collective", "distributed",
                    "agent cooperation", "agent collaboration"],
    "agent_memory": ["memory", "long-term", "short-term", "episodic", "semantic",
                     "retrieval", "forgetting", "memory-augmented"],
    "agent_tools": ["tool", "api", "function calling", "plugin", "tool use",
                    "external tool", "tool learning"],
    "llm_reasoning": ["reasoning", "chain-of-thought", "cot", "planning", "logic",
                      "theorem proving", "math", "arithmetic", "inference"],
}


def infer_domain(text: str) -> str:
    """Infer domain from text using keyword matching."""
    text_lower = text.lower()
    scores = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[domain] = score

    if not scores:
        return "General"

    # Return domain with highest score, or "General" if tie at low scores
    best_domain = max(scores, key=scores.get)
    if scores[best_domain] < 2:
        return "General"
    return best_domain


def infer_keywords(text: str, domain: str) -> list:
    """Extract keywords from text, prioritizing domain-specific terms."""
    text_lower = text.lower()
    keywords = set()

    # Add domain keywords that appear in text
    domain_kws = DOMAIN_KEYWORDS.get(domain, [])
    for kw in domain_kws:
        if kw in text_lower:
            keywords.add(kw.replace(" ", "_"))

    # Extract compound terms from text
    # Match patterns like "X-based", "X-driven", "X-aware"
    patterns = [
        r"(\w+)-based",
        r"(\w+)-driven",
        r"(\w+)-aware",
        r"(\w+)-enhanced",
        r"(\w+)-augmented",
    ]
    for pattern in patterns:
        for match in re.findall(pattern, text_lower):
            if len(match) > 2:
                keywords.add(match)

    return list(keywords)[:8]


def infer_year_from_context(node_data: dict, graph_db) -> int:
    """Try to infer year from connected papers via claims or edges."""
    node_id = node_data.get('id')
    if not node_id:
        return None

    years = []

    # First: check claims table (paper_id -> canonical_id linkage)
    try:
        import sqlite3
        conn = sqlite3.connect(graph_db.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT DISTINCT paper_id FROM claims WHERE canonical_id = ?",
            (node_id,)
        )
        paper_ids = [row[0] for row in cursor.fetchall()]
        conn.close()

        for pid in paper_ids:
            node = graph_db.graph.nodes.get(pid)
            if node and node.get('type') == 'paper':
                y = node.get('year')
                if y is not None:
                    try:
                        years.append(int(y))
                    except (ValueError, TypeError):
                        pass
    except Exception:
        pass

    # Second: check direct edges
    for source, target, edge_data in graph_db.graph.edges(data=True):
        if source == node_id or target == node_id:
            other_id = target if source == node_id else source
            other_node = graph_db.graph.nodes.get(other_id)
            if other_node and other_node.get('type') == 'paper':
                y = other_node.get('year')
                if y is not None:
                    try:
                        years.append(int(y))
                    except (ValueError, TypeError):
                        pass

    if years:
        return min(years)  # Use earliest year (when problem/method was introduced)
    return None


def backfill_nodes():
    """Main backfill function."""
    graph_db = get_local_graph_db()

    stats = {"problems_updated": 0, "methods_updated": 0, "papers_updated": 0}

    # Backfill problems
    problems = graph_db.get_all_problems()
    for problem in problems:
        prob_id = problem.get('id')
        if not prob_id:
            continue

        updates = {}

        # Domain
        if problem.get('domain') in (None, 'unknown', 'General', ''):
            text = f"{problem.get('name', '')} {problem.get('definition', '')}"
            inferred = infer_domain(text)
            if inferred != 'General':
                updates['domain'] = inferred

        # Year
        if problem.get('year') is None:
            inferred_year = infer_year_from_context(problem, graph_db)
            if inferred_year:
                updates['year'] = inferred_year

        # Keywords
        if not problem.get('keywords'):
            text = f"{problem.get('name', '')} {problem.get('definition', '')}"
            domain = updates.get('domain', problem.get('domain', 'General'))
            kws = infer_keywords(text, domain)
            if kws:
                updates['keywords'] = kws

        if updates:
            # Update in graph and DB
            for key, val in updates.items():
                graph_db.graph.nodes[prob_id][key] = val

            # Write back to SQLite
            import sqlite3
            conn = sqlite3.connect(graph_db.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM nodes WHERE id = ?", (prob_id,))
            row = cursor.fetchone()
            if row:
                data = json.loads(row[0])
                data.update(updates)
                cursor.execute(
                    "UPDATE nodes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(data), prob_id)
                )
                conn.commit()
            conn.close()
            stats['problems_updated'] += 1
            print(f"  [Problem] {prob_id}: {updates}")

    # Backfill methods
    methods = graph_db.get_all_methods()
    for method in methods:
        meth_id = method.get('id')
        if not meth_id:
            continue

        updates = {}

        # Domain
        if method.get('domain') in (None, 'unknown', 'General', ''):
            text = f"{method.get('name', '')} {method.get('mechanism', '')}"
            inferred = infer_domain(text)
            if inferred != 'General':
                updates['domain'] = inferred

        # Year
        if method.get('year') is None:
            inferred_year = infer_year_from_context(method, graph_db)
            if inferred_year:
                updates['year'] = inferred_year

        # Keywords
        if not method.get('keywords'):
            text = f"{method.get('name', '')} {method.get('mechanism', '')}"
            domain = updates.get('domain', method.get('domain', 'General'))
            kws = infer_keywords(text, domain)
            if kws:
                updates['keywords'] = kws

        # Application domains (same as domain if not set)
        if not method.get('application_domains') and updates.get('domain'):
            updates['application_domains'] = [updates['domain']]

        if updates:
            for key, val in updates.items():
                graph_db.graph.nodes[meth_id][key] = val

            import sqlite3
            conn = sqlite3.connect(graph_db.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM nodes WHERE id = ?", (meth_id,))
            row = cursor.fetchone()
            if row:
                data = json.loads(row[0])
                data.update(updates)
                cursor.execute(
                    "UPDATE nodes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(data), meth_id)
                )
                conn.commit()
            conn.close()
            stats['methods_updated'] += 1
            print(f"  [Method] {meth_id}: {updates}")

    # Backfill papers (keywords from title/abstract)
    papers = graph_db.get_all_papers()
    for paper in papers:
        paper_id = paper.get('id')
        if not paper_id:
            continue

        updates = {}
        if not paper.get('keywords'):
            text = f"{paper.get('title', '')} {paper.get('abstract', '')}"
            domain = infer_domain(text)
            kws = infer_keywords(text, domain)
            if kws:
                updates['keywords'] = kws

        if updates:
            for key, val in updates.items():
                graph_db.graph.nodes[paper_id][key] = val

            import sqlite3
            conn = sqlite3.connect(graph_db.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM nodes WHERE id = ?", (paper_id,))
            row = cursor.fetchone()
            if row:
                data = json.loads(row[0])
                data.update(updates)
                cursor.execute(
                    "UPDATE nodes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(data), paper_id)
                )
                conn.commit()
            conn.close()
            stats['papers_updated'] += 1

    print(f"\nBackfill complete: {stats}")


if __name__ == "__main__":
    backfill_nodes()
