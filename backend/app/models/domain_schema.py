from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# ==========================================
# EVIDENCE LAYER (Paper-Local)
# ==========================================
class EvidenceSpan(BaseModel):
    paper_id: str
    section: Optional[str] = None
    snippet: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    page_num: Optional[int] = None

class PaperClaim(BaseModel):
    claim_id: str
    canonical_id: Optional[str] = None
    claim_type: str  # problem_statement, method_mechanism, limitation, future_work, experiment_result
    text: str
    evidence: List[EvidenceSpan]
    
    # RNOS v2.0 Extensions: Extracted metadata specific to the claim
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

# ==========================================
# CANONICAL LAYER (Global Graph)
# ==========================================
class CanonicalNode(BaseModel):
    canonical_id: str
    name: str
    aliases: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Problem(CanonicalNode):
    domain: str
    definition: str
    resolution_status: str  # active, partial, solved, unsolved
    year_identified: Optional[int] = None
    description: Optional[str] = Field(default="No detailed description generated yet.")
    development_progress: Optional[str] = Field(default="No progress history generated yet.")
    value_score: Optional[float] = None
    parent_id: Optional[str] = None  # For hierarchical display

    # RNOS v2.0 Extensions
    constraints: Optional[str] = Field(default="Hardware/Physics/Math constraints not explicitly defined.")
    evaluation_metrics: Optional[str] = Field(default="No specific metrics identified.")

    # P0-P2 Data Fields (extracted from papers)
    keywords: List[str] = Field(default_factory=list, description="Domain keywords for cross-domain search")
    performance_metrics: Optional[str] = Field(default=None, description="Quantitative results on benchmarks")
    benchmark_datasets: List[str] = Field(default_factory=list, description="Datasets used for evaluation")
    related_problems: List[str] = Field(default_factory=list, description="IDs of related problems")

class Method(CanonicalNode):
    domain: str
    mechanism: str
    complexity: str
    description: Optional[str] = Field(default="No detailed description generated yet.")
    development_progress: Optional[str] = Field(default="No progress history generated yet.")
    value_score: Optional[float] = None
    parent_id: Optional[str] = None  # For hierarchical display

    # RNOS v2.0 Extensions
    assumptions: Optional[str] = Field(default="Pre-conditions and assumptions not explicitly defined.")
    limitations: Optional[str] = Field(default="Known blind spots not explicitly defined.")

    # P0-P2 Data Fields (extracted from papers)
    keywords: List[str] = Field(default_factory=list, description="Domain keywords for cross-domain search")
    input_output_spec: Optional[str] = Field(default=None, description="Input/output format specification")
    hyperparameters: Optional[str] = Field(default=None, description="Key hyperparameters and their ranges")
    application_domains: List[str] = Field(default_factory=list, description="Domains where method has been applied")
    cross_domain_potential: Optional[float] = Field(default=None, description="0-1 score of cross-domain applicability")
    performance_metrics: Optional[str] = Field(default=None, description="Quantitative results on benchmarks")

class Paper(CanonicalNode):
    title: str
    authors: List[str]
    year: int
    venue: str
    abstract: str
    arxiv_id: Optional[str] = None

    # RNOS v2.0 Extensions
    ranking: str = Field(default="Supporting", description="Foundational, SOTA, or Supporting")

    # P0-P2 Data Fields
    keywords: List[str] = Field(default_factory=list, description="Paper keywords/tags")
    doi: Optional[str] = Field(default=None)
    citation_count: Optional[int] = Field(default=None)
    parsed_sections: Optional[Dict[str, Any]] = Field(default=None, description="Structured sections from PDF")
    figure_count: Optional[int] = Field(default=None)

# ==========================================
# RELATIONS (With Evidence Binding)
# ==========================================
class EvidenceLink(BaseModel):
    source_canonical_id: str
    target_canonical_id: str
    relation_type: str  # USES_METHOD, ADDRESSES_PROBLEM, SOLVES, etc.
    effectiveness: Optional[str] = None
    limitations: Optional[str] = None
    supporting_claims: List[str] = Field(default_factory=list)  # list of claim_ids

# ==========================================
# INNOVATION DISCOVERY
# ==========================================
class InnovationOpportunity(BaseModel):
    opportunity_id: str
    target_problem_id: str
    candidate_method_ids: List[str]
    rationale: str
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    feasibility_score: float = Field(default=0.0, ge=0.0, le=1.0)
    novelty_score: float = Field(default=0.0, ge=0.0, le=1.0)

# ==========================================
# FRONTEND DTOs (Query-Driven Views)
# ==========================================
class DomainMapDTO(BaseModel):
    problems: List[Problem]
    methods: List[Method]
    relations: List[EvidenceLink]

class ProblemTimelineDTO(BaseModel):
    problem: Problem
    evolution_stages: List[Dict[str, Any]]

class MethodLineageDTO(BaseModel):
    method: Method
    variants: List[Method]
    applications: List[Dict[str, Any]]

class InnovationBoardDTO(BaseModel):
    opportunities: List[InnovationOpportunity]
    problems_index: Dict[str, Problem]
    methods_index: Dict[str, Method]
    total_opportunities: int

class EvidencePanelDTO(BaseModel):
    claim_id: str
    claim_text: str
    evidence: List[EvidenceSpan]
    paper: Paper

class NodeDetailDTO(BaseModel):
    node: CanonicalNode
    node_type: str  # "Problem" or "Method"
    related_papers: List[Paper]
    specific_claims: List[PaperClaim]  # The exact claims from those papers that mapped to this node
    sub_nodes: List[CanonicalNode]  # e.g., Sub-methods (Hardware/Software) or Sub-problems
    
class SearchResultDTO(BaseModel):
    node_id: str
    node_type: str
    title: str
    domain: Optional[str] = None
    description: Optional[str] = None

class SearchResultsDTO(BaseModel):
    query: str
    results: List[SearchResultDTO]
    total: int

class InnovationInsightDTO(BaseModel):
    opportunity_id: str
    target_problem_name: str
    candidate_method_name: str
    
    # Top-Tier Conference Paper Proposal Fields
    paper_title: str
    innovation_type: str
    abstract: str
    motivation_gap: str
    methodology_design: str
    expected_experiments: List[str]
    ablation_study: str
    impact_statement: str
    
    supporting_evidence_texts: List[str]
