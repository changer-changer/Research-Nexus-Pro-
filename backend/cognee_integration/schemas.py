"""
Pydantic Schemas for Research Knowledge Graph

Defines data models for:
- ResearchProblem (研究问题)
- ResearchMethod (研究方法)
- Paper (论文)
- Citation (引用关系)
- ProblemHierarchy (问题层级关系)
- MethodHierarchy (方法层级关系)
- ProblemMethodMapping (问题-方法映射)
- V2 Native Graph Models (Cognee direct integration)
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class NodeType(str, Enum):
    """Types of nodes in the research knowledge graph."""
    PROBLEM = "problem"
    METHOD = "method"
    PAPER = "paper"
    AUTHOR = "author"
    DATASET = "dataset"
    METRIC = "metric"


class RelationType(str, Enum):
    """Types of relationships in the research knowledge graph."""
    # Hierarchical
    SUBPROBLEM_OF = "subproblem_of"
    SUBMETHOD_OF = "submethod_of"
    
    # Paper relationships
    CITES = "cites"
    USES_METHOD = "uses_method"
    ADDRESSES_PROBLEM = "addresses_problem"
    EVALUATES_ON = "evaluates_on"
    ACHIEVES_METRIC = "achieves_metric"
    
    # Method-Problem
    SOLVES = "solves"
    PARTIALLY_SOLVES = "partially_solves"
    IMPROVES_UPON = "improves_upon"


class ResearchProblem(BaseModel):
    """A research problem in the knowledge graph."""
    
    id: str = Field(..., description="Unique identifier (e.g., 'p_tactile_perception')")
    name: str = Field(..., description="Human-readable problem name")
    description: Optional[str] = Field(None, description="Detailed problem description")
    level: int = Field(0, description="Hierarchy level (0=root, 1=domain, 2=specific)")
    parent_id: Optional[str] = Field(None, description="Parent problem ID for hierarchy")
    domain: Optional[str] = Field(None, description="Research domain")
    keywords: List[str] = Field(default_factory=list, description="Related keywords")


class ResearchMethod(BaseModel):
    """A research method in the knowledge graph."""
    
    id: str = Field(..., description="Unique identifier (e.g., 'm_cnn_tactile')")
    name: str = Field(..., description="Method name")
    description: Optional[str] = Field(None, description="Method description")
    category: Optional[str] = Field(None, description="Method category (e.g., 'deep_learning')")
    parent_id: Optional[str] = Field(None, description="Parent method for hierarchy")
    input_type: Optional[str] = Field(None, description="Input data type")
    output_type: Optional[str] = Field(None, description="Output type")
    architecture: Optional[str] = Field(None, description="Model architecture if applicable")


class Paper(BaseModel):
    """A research paper in the knowledge graph."""
    
    id: str = Field(..., description="Paper ID (e.g., arxiv_id or doi)")
    title: str = Field(..., description="Paper title")
    abstract: Optional[str] = Field(None, description="Paper abstract")
    authors: List[str] = Field(default_factory=list, description="Author names")
    year: Optional[int] = Field(None, description="Publication year")
    venue: Optional[str] = Field(None, description="Publication venue")
    url: Optional[str] = Field(None, description="Paper URL")
    doi: Optional[str] = Field(None, description="DOI")
    full_text: Optional[str] = Field(None, description="Full paper text")
    sections: Optional[Dict[str, str]] = Field(None, description="Paper sections")
    problems_addressed: List[str] = Field(default_factory=list, description="Problem IDs")
    methods_used: List[str] = Field(default_factory=list, description="Method IDs")
    datasets_used: List[str] = Field(default_factory=list, description="Dataset IDs")
    metrics_reported: List[Dict[str, Any]] = Field(default_factory=list, description="Performance metrics")


class Citation(BaseModel):
    """Citation relationship between papers."""
    
    source_id: str = Field(..., description="Citing paper ID")
    target_id: str = Field(..., description="Cited paper ID")
    citation_type: Optional[str] = Field(None, description="Type of citation")
    context: Optional[str] = Field(None, description="Citation context from paper")


class ProblemHierarchy(BaseModel):
    """Hierarchical relationship between problems."""
    
    child_id: str = Field(..., description="Child/sub-problem ID")
    parent_id: str = Field(..., description="Parent problem ID")
    relationship_type: str = Field("subproblem_of", description="Type of hierarchy")
    strength: float = Field(1.0, ge=0.0, le=1.0, description="Relationship strength")


class MethodHierarchy(BaseModel):
    """Hierarchical relationship between methods."""
    
    child_id: str = Field(..., description="Child/sub-method ID")
    parent_id: str = Field(..., description="Parent method ID")
    relationship_type: str = Field("submethod_of", description="Type of hierarchy")
    extension_type: Optional[str] = Field(None, description="How it extends parent")


class ProblemMethodMapping(BaseModel):
    """Mapping between problems and methods (SOLVES relationship)."""
    
    problem_id: str = Field(..., description="Problem ID")
    method_id: str = Field(..., description="Method ID")
    effectiveness: Optional[float] = Field(None, ge=0.0, le=1.0, description="Effectiveness score")
    limitations: Optional[List[str]] = Field(None, description="Limitations or constraints")
    conditions: Optional[List[str]] = Field(None, description="Conditions for applicability")
    evidence_papers: List[str] = Field(default_factory=list, description="Papers providing evidence")


class ExtractedKnowledge(BaseModel):
    """Complete extracted knowledge from a paper."""
    
    paper: Paper
    problems: List[ResearchProblem] = Field(default_factory=list)
    methods: List[ResearchMethod] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)
    problem_hierarchies: List[ProblemHierarchy] = Field(default_factory=list)
    method_hierarchies: List[MethodHierarchy] = Field(default_factory=list)
    problem_method_mappings: List[ProblemMethodMapping] = Field(default_factory=list)


# Request/Response models for API

class ProcessPaperRequest(BaseModel):
    """Request to process a paper."""
    
    paper_text: str = Field(..., description="Full paper text or abstract")
    paper_meta: Optional[Dict[str, Any]] = Field(None, description="Paper metadata")
    extract_citations: bool = Field(True, description="Whether to extract citations")
    extract_hierarchy: bool = Field(True, description="Whether to extract hierarchy")


class ProcessPaperResponse(BaseModel):
    """Response from paper processing."""
    
    success: bool
    paper_id: Optional[str] = None
    extracted_problems: int = 0
    extracted_methods: int = 0
    extracted_relationships: int = 0
    knowledge: Optional[ExtractedKnowledge] = None
    error: Optional[str] = None


class SearchRequest(BaseModel):
    """Request to search the knowledge graph."""
    
    query: str = Field(..., description="Search query")
    node_types: Optional[List[NodeType]] = Field(None, description="Filter by node types")
    limit: int = Field(10, ge=1, le=100)
    include_relationships: bool = Field(True)


class SearchResponse(BaseModel):
    """Response from knowledge graph search."""
    
    success: bool
    query: str
    results: List[Dict[str, Any]] = Field(default_factory=list)
    total_found: int = 0
    error: Optional[str] = None


class GraphStatistics(BaseModel):
    """Statistics about the knowledge graph."""
    
    total_papers: int = 0
    total_problems: int = 0
    total_methods: int = 0
    total_relationships: int = 0
    problem_hierarchies: int = 0
    method_hierarchies: int = 0
    problem_method_mappings: int = 0
    citations: int = 0
    last_updated: Optional[datetime] = None


# V2 Native Graph Models (for Cognee direct integration)

class PaperInput(BaseModel):
    """Input model for adding a paper to Cognee."""
    
    id: str = Field(..., description="Unique paper identifier")
    title: str = Field(..., description="Paper title")
    authors: List[str] = Field(default_factory=list, description="Author names")
    year: Optional[int] = Field(None, description="Publication year")
    venue: Optional[str] = Field(None, description="Publication venue")
    abstract: Optional[str] = Field(None, description="Paper abstract")
    problems: List[str] = Field(default_factory=list, description="Problem IDs or names")
    methods: List[str] = Field(default_factory=list, description="Method IDs or names")
    contribution: Optional[str] = Field(None, description="Core contribution summary")
    doi: Optional[str] = Field(None, description="DOI or arXiv ID")


class GraphNode(BaseModel):
    """A node in the knowledge graph (native Cognee format)."""
    
    id: str = Field(..., description="Unique node identifier")
    type: str = Field(..., description="Node type (Paper, Problem, Method, etc.)")
    label: str = Field(..., description="Human-readable label")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Additional properties")


class GraphEdge(BaseModel):
    """An edge in the knowledge graph (native Cognee format)."""
    
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    type: str = Field(..., description="Relationship type (CITES, ADDRESSES, etc.)")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Additional properties")


class GraphData(BaseModel):
    """Complete graph data in native Cognee format."""
    
    nodes: List[GraphNode] = Field(default_factory=list, description="Graph nodes")
    edges: List[GraphEdge] = Field(default_factory=list, description="Graph edges")
