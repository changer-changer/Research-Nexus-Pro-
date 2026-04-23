"""
GraphRAG Engine — Scientific reasoning over knowledge subgraphs.

Retrieval modes:
- Ego Graph: 1-2 hop neighbors around a seed node (detail panels)
- Multi-Hop Path: shortest paths between two nodes (explain association)
- Community Summary: Louvain clusters + auto-summary (macro overview)
- Temporal Subgraph: time-filtered subgraph (trend analysis)
- Hybrid: vector search seeds + graph expansion (general queries)
"""

import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

import networkx as nx

logger = logging.getLogger(__name__)


@dataclass
class Subgraph:
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    edges: List[Dict[str, Any]] = field(default_factory=list)
    context_text: str = ""


@dataclass
class EvidenceSpan:
    claim_id: str = ""
    paper_id: str = ""
    node_id: str = ""
    node_name: str = ""
    text: str = ""
    confidence: float = 0.0


@dataclass
class GraphRAGResponse:
    answer: str
    subgraph: Subgraph
    sources: List[Dict[str, Any]] = field(default_factory=list)
    evidence_spans: List[EvidenceSpan] = field(default_factory=list)
    intent: str = "general"
    confidence: float = 0.0


class GraphRAGEngine:
    """
    GraphRAG query engine for scientific knowledge graphs.

    Uses intent classification + subgraph retrieval + (optional) LLM synthesis.
    Works without LLM by returning structured subgraph summaries.
    """

    def __init__(
        self,
        graph_db: Any,
        vector_db: Optional[Any] = None,
        llm_client: Optional[Any] = None
    ):
        self.graph_db = graph_db
        self.vector_db = vector_db
        self.llm_client = llm_client
        self.graph = graph_db.graph if hasattr(graph_db, "graph") else nx.DiGraph()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def answer(self, query: str) -> GraphRAGResponse:
        """Main entry: classify intent, retrieve subgraph, synthesize answer."""
        intent = self._identify_intent(query)
        logger.info(f"GraphRAG query: '{query}' → intent: {intent}")

        subgraph = await self._retrieve_subgraph(query, intent)
        sources = self._extract_sources(subgraph)

        if self.llm_client:
            answer, evidence_spans = await self._llm_synthesize(query, subgraph, intent)
            confidence = 0.85
        else:
            answer = self._structured_answer(query, subgraph, intent)
            evidence_spans = []
            confidence = 0.6

        return GraphRAGResponse(
            answer=answer,
            subgraph=subgraph,
            sources=sources,
            evidence_spans=evidence_spans,
            intent=intent,
            confidence=confidence
        )

    def answer_sync(self, query: str) -> GraphRAGResponse:
        """Synchronous wrapper for non-async callers."""
        import asyncio
        return asyncio.run(self.answer(query))

    # ------------------------------------------------------------------
    # Intent classification
    # ------------------------------------------------------------------

    def _identify_intent(self, query: str) -> str:
        """Rule-based intent classification (fast, no LLM needed)."""
        q = query.lower().strip()

        # Relationship / comparison queries
        relationship_patterns = [
            "how does", "how is", "related to", "connection between",
            "link between", "compare", "difference between", "vs",
            "versus", "what is the relation", "path from"
        ]
        for pat in relationship_patterns:
            if pat in q:
                return "relationship"

        # Detail / node-specific queries
        detail_patterns = [
            "what is", "tell me about", "explain", "describe",
            "details on", "overview of", "summary of"
        ]
        for pat in detail_patterns:
            if pat in q:
                return "node_detail"

        # Innovation / gap queries
        innovation_patterns = [
            "gap", "missing", "not solved", "unsolved", "opportunity",
            "innovation", "novel", "future work", "open problem"
        ]
        for pat in innovation_patterns:
            if pat in q:
                return "innovation"

        # Temporal / trend queries
        temporal_patterns = [
            "trend", "evolution", "history", "recent", "latest",
            "since", "before", "after", "timeline"
        ]
        for pat in temporal_patterns:
            if pat in q:
                return "temporal"

        return "general"

    # ------------------------------------------------------------------
    # Subgraph retrieval
    # ------------------------------------------------------------------

    async def _retrieve_subgraph(self, query: str, intent: str) -> Subgraph:
        """Route to appropriate retrieval strategy."""
        if intent == "relationship":
            return self._get_relationship_subgraph(query)
        elif intent == "node_detail":
            return self._get_ego_subgraph(query)
        elif intent == "innovation":
            return self._get_innovation_subgraph(query)
        elif intent == "temporal":
            return self._get_temporal_subgraph(query)
        else:
            return self._get_hybrid_subgraph(query)

    def _get_ego_subgraph(self, query: str, depth: int = 2) -> Subgraph:
        """Ego graph: seed node + neighbors up to `depth` hops."""
        seeds = self._find_seed_nodes(query, top_k=3)
        if not seeds:
            return Subgraph(context_text="No relevant nodes found for this query.")

        all_nodes = set()
        all_edges = []

        for seed_id in seeds:
            all_nodes.add(seed_id)
            # BFS up to depth
            for current_depth in range(1, depth + 1):
                new_nodes = set()
                for node in list(all_nodes):
                    for nbr in self.graph.neighbors(node):
                        if nbr not in all_nodes:
                            new_nodes.add(nbr)
                        edge_data = self.graph.get_edge_data(node, nbr) or {}
                        all_edges.append({
                            "source": node,
                            "target": nbr,
                            **edge_data
                        })
                all_nodes.update(new_nodes)

        nodes_data = []
        for nid in all_nodes:
            data = self._get_node_data(nid)
            if data:
                nodes_data.append(data)

        context = self._nodes_to_text(nodes_data, all_edges)
        return Subgraph(nodes=nodes_data, edges=all_edges, context_text=context)

    def _get_relationship_subgraph(self, query: str) -> Subgraph:
        """Find paths between two nodes mentioned in query."""
        seeds = self._find_seed_nodes(query, top_k=5)
        if len(seeds) < 2:
            # Fallback to ego graph
            return self._get_ego_subgraph(query, depth=2)

        # Try all pairs, keep shortest path
        best_path = None
        best_len = float("inf")
        for i, a in enumerate(seeds):
            for b in seeds[i + 1:]:
                try:
                    path = nx.shortest_path(
                        self.graph.to_undirected(), a, b, cutoff=4
                    )
                    if len(path) < best_len:
                        best_len = len(path)
                        best_path = path
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue

        if not best_path:
            return Subgraph(context_text="No direct relationship found between mentioned concepts.")

        # Extract path nodes and edges
        nodes_data = []
        for nid in best_path:
            data = self._get_node_data(nid)
            if data:
                nodes_data.append(data)

        edges = []
        for i in range(len(best_path) - 1):
            edge_data = self.graph.get_edge_data(best_path[i], best_path[i + 1]) or {}
            edges.append({
                "source": best_path[i],
                "target": best_path[i + 1],
                **edge_data
            })

        context = self._path_to_text(nodes_data, edges)
        return Subgraph(nodes=nodes_data, edges=edges, context_text=context)

    def _get_innovation_subgraph(self, query: str) -> Subgraph:
        """Subgraph focused on unsolved problems + candidate methods."""
        seeds = self._find_seed_nodes(query, top_k=5)

        # Find unsolved problems among seeds or their neighbors
        unsolved = []
        candidate_methods = []

        for nid in seeds:
            data = self._get_node_data(nid)
            if not data:
                continue
            ntype = data.get("type", "unknown")
            if ntype == "problem" and data.get("resolution_status") == "unsolved":
                unsolved.append(data)
            elif ntype == "method":
                candidate_methods.append(data)

            # Check neighbors
            for nbr in self.graph.neighbors(nid):
                nbr_data = self._get_node_data(nbr)
                if nbr_data and nbr_data.get("type") == "problem" and nbr_data.get("resolution_status") == "unsolved":
                    unsolved.append(nbr_data)

        # Deduplicate
        seen = set()
        unsolved_unique = []
        for p in unsolved:
            pid = p.get("id", "")
            if pid and pid not in seen:
                seen.add(pid)
                unsolved_unique.append(p)

        context = f"Query: {query}\n\n"
        context += f"Unsolved Problems ({len(unsolved_unique)}):\n"
        for p in unsolved_unique[:5]:
            context += f"- {p.get('name', 'Unknown')}: {p.get('definition', '')[:120]}...\n"

        if candidate_methods:
            context += f"\nRelevant Methods ({len(candidate_methods)}):\n"
            for m in candidate_methods[:5]:
                context += f"- {m.get('name', 'Unknown')}: {m.get('mechanism', '')[:120]}...\n"

        all_nodes = unsolved_unique + candidate_methods
        return Subgraph(nodes=all_nodes, context_text=context)

    def _get_temporal_subgraph(self, query: str) -> Subgraph:
        """Time-filtered subgraph: recent methods + old problems."""
        # Extract year from query if present
        import re
        year_match = re.search(r"20\d{2}", query)
        cutoff_year = int(year_match.group()) if year_match else 2024

        nodes_data = []
        for nid in self.graph.nodes:
            data = self._get_node_data(nid)
            if not data:
                continue
            year = data.get("year") or data.get("year_identified")
            if year and isinstance(year, int):
                ntype = data.get("type", "")
                # Recent methods or old problems
                if ntype == "method" and year >= cutoff_year:
                    nodes_data.append(data)
                elif ntype == "problem" and year <= cutoff_year - 2:
                    nodes_data.append(data)

        nodes_data.sort(key=lambda x: x.get("year", x.get("year_identified", 0)), reverse=True)
        context = f"Temporal context (around {cutoff_year}):\n"
        for n in nodes_data[:10]:
            y = n.get("year") or n.get("year_identified", "?")
            context += f"- [{y}] {n.get('name', 'Unknown')} ({n.get('type', '')})\n"

        return Subgraph(nodes=nodes_data, context_text=context)

    def _get_hybrid_subgraph(self, query: str) -> Subgraph:
        """Default: vector search seeds + 1-hop expansion."""
        seeds = self._find_seed_nodes(query, top_k=5)
        if not seeds:
            return Subgraph(context_text="No relevant nodes found.")

        all_nodes = set(seeds)
        all_edges = []

        for seed_id in seeds:
            for nbr in self.graph.neighbors(seed_id):
                all_nodes.add(nbr)
                edge_data = self.graph.get_edge_data(seed_id, nbr) or {}
                all_edges.append({
                    "source": seed_id,
                    "target": nbr,
                    **edge_data
                })

        nodes_data = []
        for nid in all_nodes:
            data = self._get_node_data(nid)
            if data:
                nodes_data.append(data)

        context = self._nodes_to_text(nodes_data, all_edges)
        return Subgraph(nodes=nodes_data, edges=all_edges, context_text=context)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _find_seed_nodes(self, query: str, top_k: int = 5) -> List[str]:
        """Find seed nodes via FTS or vector search."""
        # Try FTS first
        results = self.graph_db.search_nodes(query, limit=top_k)
        seeds = [r["id"] for r in results if "id" in r]

        # Fallback / supplement with vector search
        if self.vector_db and len(seeds) < top_k:
            try:
                search_method = getattr(self.vector_db, "search", None)
                if search_method is None:
                    search_method = getattr(self.vector_db, "search_similar_problems", None)
                if search_method:
                    vec_results = search_method(query, top_k=top_k) if "problems" in search_method.__name__ else search_method(query, top_k=top_k)
                    for vr in vec_results:
                        vid = vr.get("id", "")
                        if vid and vid not in seeds:
                            seeds.append(vid)
            except Exception as e:
                logger.warning(f"Vector search failed: {e}")

        return seeds[:top_k]

    def _get_node_data(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get enriched node data from graph."""
        if node_id not in self.graph:
            return None
        data = dict(self.graph.nodes[node_id])
        data["id"] = node_id
        return data

    def _extract_sources(self, subgraph: Subgraph) -> List[Dict[str, Any]]:
        """Extract source papers from subgraph nodes."""
        sources = []
        seen = set()
        for node in subgraph.nodes:
            paper_ids = node.get("paper_ids", []) or node.get("source_paper_ids", [])
            for pid in paper_ids:
                if pid not in seen:
                    seen.add(pid)
                    paper = self._get_node_data(pid)
                    if paper:
                        sources.append({
                            "paper_id": pid,
                            "title": paper.get("title", "Unknown"),
                            "authors": paper.get("authors", []),
                            "year": paper.get("year", "")
                        })
        return sources[:10]

    # ------------------------------------------------------------------
    # Text generation
    # ------------------------------------------------------------------

    def _nodes_to_text(self, nodes: List[Dict], edges: List[Dict]) -> str:
        """Convert subgraph to human-readable text context."""
        lines = []
        type_groups: Dict[str, List[Dict]] = {}
        for n in nodes:
            t = n.get("type", "unknown")
            type_groups.setdefault(t, []).append(n)

        for ntype, group in type_groups.items():
            lines.append(f"\n{ntype.upper()} ({len(group)}):")
            for n in group[:5]:
                node_id = n.get("id", "unknown")
                name = n.get("name") or n.get("title", "Unknown")
                desc = n.get("definition") or n.get("mechanism") or n.get("description", "")
                lines.append(f"  [{node_id}] {name}: {desc[:100]}")

        if edges:
            lines.append(f"\nRELATIONSHIPS ({len(edges)}):")
            for e in edges[:10]:
                src = self._node_name(e.get("source", ""))
                tgt = self._node_name(e.get("target", ""))
                rel = e.get("type", "related")
                lines.append(f"  - {src} --[{rel}]--> {tgt}")

        return "\n".join(lines)

    def _path_to_text(self, nodes: List[Dict], edges: List[Dict]) -> str:
        """Convert a path to narrative text."""
        names = [n.get("name") or n.get("title", "?") for n in nodes]
        path_str = " → ".join(names)
        lines = [f"Relationship path: {path_str}", ""]

        for i, e in enumerate(edges):
            rel = e.get("type", "related")
            eff = e.get("effectiveness", "")
            lines.append(f"Step {i + 1}: {names[i]} --[{rel}]{f' ({eff})' if eff else ''}--> {names[i + 1]}")

        return "\n".join(lines)

    def _node_name(self, node_id: str) -> str:
        data = self._get_node_data(node_id)
        return data.get("name") or data.get("title", node_id[:12]) if data else node_id[:12]

    # ------------------------------------------------------------------
    # Answer synthesis
    # ------------------------------------------------------------------

    async def _llm_synthesize(self, query: str, subgraph: Subgraph, intent: str) -> Tuple[str, List[EvidenceSpan]]:
        """Use LLM to synthesize final answer from subgraph context with evidence anchoring."""
        system_prompt = """You are Research-Nexus GraphRAG, a scientific research assistant powered by a knowledge graph of problems, methods, and papers.

Your core ontology is the Research Triplet:
- Problem: "What is the world?" (descriptive knowledge, gaps between current and ideal state)
- Method: "How to make the world what it should be?" (procedural knowledge, transformation functions)
- Relation: Under what conditions can a method act on a problem?

RULES:
1. Answer based ONLY on the provided knowledge graph context. Do not hallucinate.
2. For every key claim in your answer, you MUST cite the source by adding [EVIDENCE:node_id] at the end of the sentence.
   Use the EXACT node_id shown in brackets [node_id] in the context above.
   Example: "Diffusion Policy has been successfully applied to robotic manipulation [EVIDENCE:prob_43fbf4ff]."
3. If the context does not contain enough information, say so clearly.
4. Be concise but thorough. Use bullet points for multiple items.
5. When discussing innovation opportunities, explicitly state the problem, the candidate method, and the rationale.
"""

        user_prompt = f"""User Question: {query}
Query Intent: {intent}

Retrieved Knowledge Graph Context:
{subgraph.context_text}

Please provide a structured answer with evidence citations."""

        try:
            response = await self.llm_client.client.messages.create(
                model=getattr(self.llm_client, 'model', 'kimi-for-coding'),
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=0.3,
                max_tokens=2048
            )
            answer = response.content[0].text
            evidence_spans = self._extract_evidence_from_answer(answer, subgraph)
            return answer, evidence_spans
        except Exception as e:
            logger.error(f"LLM synthesis failed: {e}")
            return self._structured_answer(query, subgraph, intent), []

    def _extract_evidence_from_answer(self, answer: str, subgraph: Subgraph) -> List[EvidenceSpan]:
        """Extract [EVIDENCE:node_id] markers from LLM answer and map to subgraph nodes."""
        import re
        spans = []
        seen = set()

        # Find all [EVIDENCE:xxx] markers
        for match in re.finditer(r'\[EVIDENCE:([^\]]+)\]', answer):
            node_id = match.group(1).strip()
            if node_id in seen:
                continue
            seen.add(node_id)

            # Find node in subgraph
            node = None
            for n in subgraph.nodes:
                if n.get("id") == node_id:
                    node = n
                    break

            if node:
                spans.append(EvidenceSpan(
                    node_id=node_id,
                    node_name=node.get("name") or node.get("title", "Unknown"),
                    text=node.get("definition") or node.get("mechanism") or node.get("description", "")[:200],
                    confidence=node.get("authority_score", 0.5)
                ))

        return spans

    def _structured_answer(self, query: str, subgraph: Subgraph, intent: str) -> str:
        """Generate structured answer without LLM."""
        if intent == "relationship":
            return self._answer_relationship(query, subgraph)
        elif intent == "node_detail":
            return self._answer_node_detail(query, subgraph)
        elif intent == "innovation":
            return self._answer_innovation(query, subgraph)
        elif intent == "temporal":
            return self._answer_temporal(query, subgraph)
        else:
            return self._answer_general(query, subgraph)

    def _answer_relationship(self, query: str, subgraph: Subgraph) -> str:
        nodes = subgraph.nodes
        edges = subgraph.edges
        if not edges:
            return f"No direct relationship found in the knowledge graph for '{query}'."

        lines = [f"Relationship analysis for '{query}':", ""]
        for e in edges[:5]:
            src = self._node_name(e.get("source", ""))
            tgt = self._node_name(e.get("target", ""))
            rel = e.get("type", "related")
            lines.append(f"- {src} → {tgt} (relation: {rel})")

        return "\n".join(lines)

    def _answer_node_detail(self, query: str, subgraph: Subgraph) -> str:
        nodes = subgraph.nodes
        if not nodes:
            return f"No information found for '{query}'."

        main = nodes[0]
        name = main.get("name") or main.get("title", "Unknown")
        ntype = main.get("type", "")
        lines = [f"{name} ({ntype})", "=" * 40]

        if ntype == "problem":
            lines.append(f"Definition: {main.get('definition', 'N/A')}")
            lines.append(f"Status: {main.get('resolution_status', 'unknown')}")
        elif ntype == "method":
            lines.append(f"Mechanism: {main.get('mechanism', 'N/A')}")
            lines.append(f"Complexity: {main.get('complexity', 'unknown')}")
        elif ntype == "paper":
            lines.append(f"Abstract: {main.get('abstract', 'N/A')[:200]}...")

        neighbors = [n for n in nodes[1:6]]
        if neighbors:
            lines.append(f"\nRelated ({len(neighbors)}):")
            for n in neighbors:
                nname = n.get("name") or n.get("title", "?")
                lines.append(f"  - {nname} ({n.get('type', '')})")

        return "\n".join(lines)

    def _answer_innovation(self, query: str, subgraph: Subgraph) -> str:
        nodes = subgraph.nodes
        problems = [n for n in nodes if n.get("type") == "problem" and n.get("resolution_status") == "unsolved"]
        methods = [n for n in nodes if n.get("type") == "method"]

        lines = [f"Innovation landscape for '{query}':", ""]
        lines.append(f"Unsolved problems: {len(problems)}")
        for p in problems[:5]:
            lines.append(f"  - {p.get('name', 'Unknown')}: {p.get('definition', '')[:80]}...")

        if methods:
            lines.append(f"\nCandidate methods: {len(methods)}")
            for m in methods[:5]:
                lines.append(f"  - {m.get('name', 'Unknown')}: {m.get('mechanism', '')[:80]}...")

        return "\n".join(lines)

    def _answer_temporal(self, query: str, subgraph: Subgraph) -> str:
        nodes = subgraph.nodes
        lines = [f"Temporal analysis for '{query}':", ""]
        for n in nodes[:10]:
            y = n.get("year") or n.get("year_identified", "?")
            name = n.get("name") or n.get("title", "Unknown")
            lines.append(f"- [{y}] {name} ({n.get('type', '')})")
        return "\n".join(lines)

    def _answer_general(self, query: str, subgraph: Subgraph) -> str:
        nodes = subgraph.nodes
        edges = subgraph.edges
        if not nodes:
            return f"No relevant information found for '{query}'."

        lines = [f"Results for '{query}':", ""]
        lines.append(f"Found {len(nodes)} related nodes and {len(edges)} relationships.")
        lines.append("")

        type_counts = {}
        for n in nodes:
            t = n.get("type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1

        for t, count in type_counts.items():
            lines.append(f"- {t.capitalize()}: {count}")

        lines.append("")
        lines.append("Top matches:")
        for n in nodes[:5]:
            name = n.get("name") or n.get("title", "Unknown")
            lines.append(f"  - {name}")

        return "\n".join(lines)
