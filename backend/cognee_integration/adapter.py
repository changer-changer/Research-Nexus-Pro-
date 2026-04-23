"""
Data Adapter: Convert between Cognee and Research-Nexus Pro formats

Handles:
- Cognee graph → Research-Nexus nodes/edges
- Research-Nexus data → Cognee input format
- Frontend-compatible graph structure
"""

from typing import List, Dict, Any, Optional
import logging

from .schemas import (
    Paper, ResearchProblem, ResearchMethod,
    ExtractedKnowledge, NodeType, RelationType
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CogneeToResearchNexusAdapter:
    """Adapter to convert Cognee output to Research-Nexus Pro format."""
    
    @staticmethod
    def adapt_knowledge(knowledge: ExtractedKnowledge) -> Dict[str, Any]:
        """
        Convert ExtractedKnowledge to Research-Nexus format.
        
        Returns format compatible with EXTRACTED_DATA.json structure:
        {
            "nodes": [...],
            "edges": [...],
            "metadata": {...}
        }
        """
        nodes = []
        edges = []
        
        # Add paper as node
        paper_node = CogneeToResearchNexusAdapter._paper_to_node(knowledge.paper)
        nodes.append(paper_node)
        
        # Add problems as nodes
        for problem in knowledge.problems:
            nodes.append(CogneeToResearchNexusAdapter._problem_to_node(problem))
        
        # Add methods as nodes
        for method in knowledge.methods:
            nodes.append(CogneeToResearchNexusAdapter._method_to_node(method))
        
        # Add relationships as edges
        # Paper-Problem relationships
        for problem_id in knowledge.paper.problems_addressed:
            edges.append({
                "id": f"e_{knowledge.paper.id}_{problem_id}",
                "source": knowledge.paper.id,
                "target": problem_id,
                "type": "ADDRESSES_PROBLEM",
                "label": "addresses"
            })
        
        # Paper-Method relationships
        for method_id in knowledge.paper.methods_used:
            edges.append({
                "id": f"e_{knowledge.paper.id}_{method_id}",
                "source": knowledge.paper.id,
                "target": method_id,
                "type": "USES_METHOD",
                "label": "uses"
            })
        
        # Problem hierarchies
        for hierarchy in knowledge.problem_hierarchies:
            edges.append({
                "id": f"e_{hierarchy.child_id}_{hierarchy.parent_id}",
                "source": hierarchy.child_id,
                "target": hierarchy.parent_id,
                "type": "SUBPROBLEM_OF",
                "label": "sub-problem of",
                "strength": hierarchy.strength
            })
        
        # Method hierarchies
        for hierarchy in knowledge.method_hierarchies:
            edges.append({
                "id": f"e_{hierarchy.child_id}_{hierarchy.parent_id}",
                "source": hierarchy.child_id,
                "target": hierarchy.parent_id,
                "type": hierarchy.relationship_type,
                "label": hierarchy.relationship_type.lower().replace("_", " ")
            })
        
        # Problem-Method mappings
        for mapping in knowledge.problem_method_mappings:
            edges.append({
                "id": f"e_{mapping.method_id}_{mapping.problem_id}",
                "source": mapping.method_id,
                "target": mapping.problem_id,
                "type": "SOLVES",
                "label": "solves",
                "effectiveness": mapping.effectiveness,
                "limitations": mapping.limitations
            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "source": "cognee",
                "paper_id": knowledge.paper.id,
                "total_problems": len(knowledge.problems),
                "total_methods": len(knowledge.methods),
                "total_relationships": len(edges)
            }
        }
    
    @staticmethod
    def _paper_to_node(paper: Paper) -> Dict[str, Any]:
        """Convert Paper to Research-Nexus node format."""
        return {
            "id": paper.id,
            "type": "paper",
            "label": paper.title,
            "data": {
                "title": paper.title,
                "authors": paper.authors,
                "year": paper.year,
                "venue": paper.venue,
                "abstract": paper.abstract,
                "doi": paper.doi,
                "url": paper.url
            },
            "style": {
                "color": "#3b82f6",  # Blue for papers
                "shape": "rect"
            }
        }
    
    @staticmethod
    def _problem_to_node(problem: ResearchProblem) -> Dict[str, Any]:
        """Convert ResearchProblem to Research-Nexus node format."""
        colors = {
            0: "#6366f1",  # Root - indigo
            1: "#8b5cf6",  # Domain - violet
            2: "#ec4899",  # Specific - pink
        }
        
        return {
            "id": problem.id,
            "type": "problem",
            "label": problem.name,
            "level": problem.level,
            "parent_id": problem.parent_id,
            "data": {
                "name": problem.name,
                "description": problem.description,
                "domain": problem.domain,
                "keywords": problem.keywords
            },
            "style": {
                "color": colors.get(problem.level, "#6b7280"),
                "shape": "circle"
            }
        }
    
    @staticmethod
    def _method_to_node(method: ResearchMethod) -> Dict[str, Any]:
        """Convert ResearchMethod to Research-Nexus node format."""
        return {
            "id": method.id,
            "type": "method",
            "label": method.name,
            "data": {
                "name": method.name,
                "description": method.description,
                "category": method.category,
                "input_type": method.input_type,
                "output_type": method.output_type,
                "architecture": method.architecture
            },
            "style": {
                "color": "#22c55e",  # Green for methods
                "shape": "diamond"
            }
        }
    
    @staticmethod
    def adapt_to_reactflow(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert to ReactFlow compatible format.
        
        ReactFlow expects:
        {
            "nodes": [{"id": ..., "type": ..., "position": {...}, "data": {...}}],
            "edges": [{"id": ..., "source": ..., "target": ..., "label": ...}]
        }
        """
        nodes = []
        edges = []
        
        # Convert nodes with positions
        for i, node in enumerate(data.get("nodes", [])):
            # Calculate position based on level and index
            level = node.get("level", 0)
            angle = (i % 10) * 36  # Distribute in circles
            radius = 200 + level * 150
            
            x = radius * 0.5 + (i % 5) * 200
            y = level * 150 + (i // 5) * 100
            
            reactflow_node = {
                "id": node["id"],
                "type": node.get("type", "default"),
                "position": {"x": x, "y": y},
                "data": {
                    "label": node.get("label", ""),
                    **node.get("data", {})
                },
                "style": node.get("style", {})
            }
            nodes.append(reactflow_node)
        
        # Convert edges
        for edge in data.get("edges", []):
            reactflow_edge = {
                "id": edge.get("id", f"e_{edge['source']}_{edge['target']}"),
                "source": edge["source"],
                "target": edge["target"],
                "label": edge.get("label", ""),
                "type": "smoothstep",
                "animated": edge.get("type") == "SOLVES",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 1 + (edge.get("strength", 0.5) or 0.5)
                }
            }
            edges.append(reactflow_edge)
        
        return {"nodes": nodes, "edges": edges}


class ResearchNexusToCogneeAdapter:
    """Adapter to convert Research-Nexus data to Cognee input format."""
    
    @staticmethod
    def adapt_paper_from_extracted_data(
        paper_data: Dict[str, Any]
    ) -> tuple[str, Dict[str, Any]]:
        """
        Convert EXTRACTED_DATA.json paper format to Cognee input.
        
        Args:
            paper_data: Paper data from EXTRACTED_DATA.json
            
        Returns:
            (paper_text, paper_meta) tuple for Cognee.add()
        """
        # Build paper text from available fields
        text_parts = []
        
        meta = {
            "id": paper_data.get("id"),
            "title": paper_data.get("title"),
            "authors": paper_data.get("authors", []),
            "year": paper_data.get("year"),
            "venue": paper_data.get("venue"),
        }
        
        if paper_data.get("title"):
            text_parts.append(f"Title: {paper_data['title']}")
        
        if paper_data.get("abstract"):
            text_parts.append(f"Abstract: {paper_data['abstract']}")
            meta["abstract"] = paper_data["abstract"]
        
        # Add problem context
        if paper_data.get("problem_ids"):
            text_parts.append(f"Addresses problems: {', '.join(paper_data['problem_ids'])}")
        
        # Add method context
        if paper_data.get("method_ids"):
            text_parts.append(f"Uses methods: {', '.join(paper_data['method_ids'])}")
        
        paper_text = "\n\n".join(text_parts)
        
        return paper_text, meta
    
    @staticmethod
    def adapt_full_extracted_data(
        extracted_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Convert full EXTRACTED_DATA.json to list of Cognee inputs.
        
        Returns list of {"text": ..., "meta": ...} dicts.
        """
        papers = []
        
        # Get papers from the data
        papers_list = extracted_data.get("papers", [])
        
        for paper_data in papers_list:
            text, meta = ResearchNexusToCogneeAdapter.adapt_paper_from_extracted_data(
                paper_data
            )
            papers.append({"text": text, "meta": meta})
        
        return papers


# Convenience functions
def to_reactflow(knowledge: ExtractedKnowledge) -> Dict[str, Any]:
    """Quick convert knowledge to ReactFlow format."""
    adapter = CogneeToResearchNexusAdapter()
    data = adapter.adapt_knowledge(knowledge)
    return adapter.adapt_to_reactflow(data)


def to_research_nexus(knowledge: ExtractedKnowledge) -> Dict[str, Any]:
    """Quick convert knowledge to Research-Nexus format."""
    return CogneeToResearchNexusAdapter.adapt_knowledge(knowledge)
