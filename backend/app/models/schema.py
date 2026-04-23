"""
Data Models and Schema Definitions for Research-Nexus Backend

This module defines the Pydantic models for nodes and relationships
in the knowledge graph, ensuring type safety and validation.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class ResolutionStatus(str, Enum):
    """Enumeration of problem resolution statuses."""
    SOLVED = "Solved"
    PARTIALLY_SOLVED = "Partially Solved"
    ACTIVE_RESEARCH = "Active Research"
    UNSOLVED = "Unsolved"


class ComplexityLevel(str, Enum):
    """Enumeration of method complexity levels."""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


# =============================================================================
# Node Models
# =============================================================================

class Problem(BaseModel):
    """
    Represents a research problem node in the knowledge graph.
    
    Attributes:
        id: Unique identifier (e.g., "p_dex_manip")
        name: Human-readable name
        definition: Detailed problem definition
        domain: Macro domain (e.g., "Robotics", "Computer Vision")
        resolution_status: Current state of problem resolution
        embedding_id: Reference to vector database entry
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    id: str = Field(..., description="Unique problem identifier")
    name: str = Field(..., min_length=1, max_length=200)
    definition: str = Field(..., min_length=10, max_length=2000)
    domain: str = Field(..., description="Research domain")
    resolution_status: ResolutionStatus = ResolutionStatus.ACTIVE_RESEARCH
    embedding_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "p_dex_manip",
                "name": "Dexterous Manipulation",
                "definition": "Enabling robots to handle complex manipulation tasks",
                "domain": "Robotics",
                "resolution_status": "Partially Solved"
            }
        }


class Method(BaseModel):
    """
    Represents a research method/algorithm node in the knowledge graph.
    
    Attributes:
        id: Unique identifier (e.g., "m_vla")
        name: Human-readable name
        mechanism: Core working principle/mechanism
        complexity: Computational/experimental complexity
        embedding_id: Reference to vector database entry
    """
    id: str = Field(..., description="Unique method identifier")
    name: str = Field(..., min_length=1, max_length=200)
    mechanism: str = Field(..., min_length=10, max_length=2000)
    complexity: ComplexityLevel = ComplexityLevel.MEDIUM
    embedding_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "m_vla",
                "name": "Vision-Language-Action Models",
                "mechanism": "Multimodal transformers mapping vision+language to actions",
                "complexity": "High"
            }
        }


class Paper(BaseModel):
    """
    Represents a research paper node - serves as temporal/evidence anchor.
    
    Attributes:
        id: Unique identifier (e.g., "paper_001")
        title: Paper title
        authors: List of author names
        year: Publication year
        venue: Conference or journal
        abstract: Optional abstract text
    """
    id: str = Field(..., description="Unique paper identifier")
    title: str = Field(..., min_length=1, max_length=500)
    authors: List[str] = Field(default_factory=list)
    year: int = Field(..., ge=1900, le=2100)
    venue: str = Field(..., description="Conference or journal name")
    abstract: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "paper_001",
                "title": "RT-2: Vision-Language-Action Models",
                "authors": ["Anthony Brohan", "Noah Brown"],
                "year": 2023,
                "venue": "CoRL"
            }
        }


# =============================================================================
# Relationship Models
# =============================================================================

class SubProblemOf(BaseModel):
    """Relationship: Problem is a sub-problem of another Problem."""
    rel_type: str = "SUB_PROBLEM_OF"


class EvolvedFrom(BaseModel):
    """Relationship: Problem evolved from another Problem over time."""
    rel_type: str = "EVOLVED_FROM"
    year: int = Field(..., description="Year of evolution")


class VariantOf(BaseModel):
    """Relationship: Method is a variant/derivative of another Method."""
    rel_type: str = "VARIANT_OF"


class ComplementaryTo(BaseModel):
    """Relationship: Method complements another Method."""
    rel_type: str = "COMPLEMENTARY_TO"


class Solves(BaseModel):
    """
    Relationship: Method solves a Problem.
    
    This is the most critical relationship - must include effectiveness
    and limitations for honest scientific assessment.
    """
    rel_type: str = "SOLVES"
    effectiveness: str = Field(
        ..., 
        description="How effective is the solution? (High/Moderate/Low with context)"
    )
    limitations: str = Field(
        ...,
        description="Specific limitations and failure modes"
    )


class AppliesMethod(BaseModel):
    """Relationship: Paper applies/uses a Method."""
    rel_type: str = "APPLIES_METHOD"


class AddressesProblem(BaseModel):
    """Relationship: Paper addresses/tackles a Problem."""
    rel_type: str = "ADDRESSES_PROBLEM"


# =============================================================================
# Extraction Models (for LLM output parsing)
# =============================================================================

class ExtractedProblem(BaseModel):
    """Minimal representation of a problem extracted from paper text."""
    name: str
    definition: str
    domain: str


class ExtractedMethod(BaseModel):
    """Minimal representation of a method extracted from paper text."""
    name: str
    mechanism: str
    complexity: ComplexityLevel = ComplexityLevel.MEDIUM


class ExtractedRelationship(BaseModel):
    """Minimal representation of a relationship extracted from paper text."""
    source_type: str = Field(..., regex="^(Problem|Method|Paper)$")
    source_name: str
    rel_type: str
    target_type: str = Field(..., regex="^(Problem|Method|Paper)$")
    target_name: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class ExtractionResult(BaseModel):
    """
    Structured output from LLM paper extraction.
    
    This is what Skill 1 (extract_and_store_triplets) expects from the LLM.
    """
    problems: List[ExtractedProblem] = Field(default_factory=list)
    methods: List[ExtractedMethod] = Field(default_factory=list)
    relationships: List[ExtractedRelationship] = Field(default_factory=list)
    
    class Config:
        json_schema_extra = {
            "example": {
                "problems": [
                    {
                        "name": "Dexterous Manipulation",
                        "definition": "Handling complex manipulation tasks",
                        "domain": "Robotics"
                    }
                ],
                "methods": [
                    {
                        "name": "Vision-Language-Action Models",
                        "mechanism": "Multimodal transformers",
                        "complexity": "High"
                    }
                ],
                "relationships": [
                    {
                        "source_type": "Method",
                        "source_name": "Vision-Language-Action Models",
                        "rel_type": "SOLVES",
                        "target_type": "Problem",
                        "target_name": "Dexterous Manipulation",
                        "properties": {
                            "effectiveness": "High on seen tasks",
                            "limitations": "Requires large training data"
                        }
                    }
                ]
            }
        }


# =============================================================================
# Query Result Models
# =============================================================================

class StructuralGap(BaseModel):
    """
    Represents a structural gap identified by Skill 2.
    
    Types:
        - isolated_abyss: Problem with no solving methods
        - bottleneck: High-centrality problem with limited solutions
    """
    gap_type: str = Field(..., regex="^(isolated_abyss|bottleneck)$")
    problem_id: str
    problem_name: str
    description: str
    severity_score: float = Field(..., ge=0.0, le=1.0)
    related_papers_count: int
    current_methods_count: int


class CrossDomainMatch(BaseModel):
    """
    Represents a cross-domain method match from Skill 3.
    """
    method_id: str
    method_name: str
    source_domain: str
    target_domain: str
    similarity_score: float
    mechanism: str
    why_relevant: str  # Explanation of why this cross-domain method might help


# =============================================================================
# API Request/Response Models
# =============================================================================

class ExtractPaperRequest(BaseModel):
    """Request model for Skill 1: extract_and_store_triplets."""
    paper_text: str = Field(..., description="Core paper text (abstract + intro + conclusion)")
    paper_meta: Dict[str, Any] = Field(..., description="Paper metadata {id, title, authors, year, venue}")


class QueryGapsRequest(BaseModel):
    """Request model for Skill 2: query_structural_gaps."""
    domain: Optional[str] = Field(None, description="Filter by domain, or None for all")


class CrossDomainRequest(BaseModel):
    """Request model for Skill 3: cross_domain_innovation_search."""
    problem_description: str = Field(..., description="Description of the problem and its core difficulty")
    current_domain: str = Field(..., description="Current research domain to exclude")
    top_k: int = Field(default=5, ge=1, le=20)


class MergeNodesRequest(BaseModel):
    """Request model for Skill 4: merge_equivalent_nodes."""
    node_id_1: str
    node_id_2: str
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Similarity confidence")
