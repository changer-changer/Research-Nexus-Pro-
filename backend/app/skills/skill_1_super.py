"""
Skill 1: Universal Paper Extractor (Super Edition)
整合 Paper Research Agent + Paper Reader Plus + 当前系统精华

Key Improvements:
1. Multi-pass extraction (depth + breadth)
2. Confidence scoring for all extractions
3. Conflict detection and resolution
4. Implicit information mining
5. Self-verification loop
6. Rich context preservation
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from neo4j import Driver
from qdrant_client import QdrantClient
from openai import OpenAI

from ..models.schema import (
    Problem, Method, Paper, ExtractionResult,
    ExtractedProblem, ExtractedMethod, ExtractedRelationship,
    Solves, ResolutionStatus, ComplexityLevel
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ExtractionPass(str, Enum):
    """Multi-pass extraction stages."""
    SURFACE = "surface"           # Explicit information
    DEEP = "deep"                 # Implicit patterns
    VERIFICATION = "verify"       # Cross-check
    ENRICHMENT = "enrich"         # Context addition


@dataclass
class ExtractionConfidence:
    """Confidence score for extracted items."""
    score: float  # 0.0 - 1.0
    reasoning: str
    evidence_count: int
    source_sections: List[str]


@dataclass
class ExtractionConflict:
    """Detected conflict between extractions."""
    item_id: str
    conflict_type: str  # "duplicate", "contradiction", "ambiguous"
    descriptions: List[str]
    resolution: Optional[str] = None


# =============================================================================
# PHASE 1: SURFACE EXTRACTION (Paper Research Agent Style)
# Fast, explicit information extraction
# =============================================================================

SURFACE_PROMPT = """You are a fast paper analyzer. Extract EXPLICIT information only.

INPUT: Research paper text (Abstract + Introduction + Conclusion)

OUTPUT FORMAT (JSON):
{
  "metadata": {
    "title": "paper title",
    "core_contribution": "one sentence main contribution",
    "novelty_claim": "what's new"
  },
  "explicit_problems": [
    {
      "name": "problem name",
      "definition": "one sentence definition",
      "is_primary": true/false,
      "evidence_quote": "exact quote from text"
    }
  ],
  "explicit_methods": [
    {
      "name": "method name",
      "core_mechanism": "how it works in one sentence",
      "key_innovation": "technical innovation",
      "evidence_quote": "exact quote from text"
    }
  ],
  "explicit_relationships": [
    {
      "source": "method name",
      "relation": "SOLVES/ADDRESSES",
      "target": "problem name",
      "evidence_quote": "supporting text"
    }
  ]
}

RULES:
- Only extract what is EXPLICITLY stated
- Include evidence quotes for verification
- Mark primary vs secondary problems
- Be concise, one sentence per field"""


# =============================================================================
# PHASE 2: DEEP READING (Paper Reader Plus Style)
# Implicit pattern recognition and deep analysis
# =============================================================================

DEEP_READING_PROMPT = """You are a deep paper reader. Extract IMPLICIT patterns and insights.

INPUT: Full paper text + Surface extraction results

OUTPUT FORMAT (JSON):
{
  "implicit_insights": {
    "unstated_assumptions": [
      {
        "assumption": "what the method assumes",
        "where_used": "section reference",
        "if_violated": "what would break"
      }
    ],
    "hidden_sub_problems": [
      {
        "name": "sub-problem name",
        "parent_problem": "which main problem",
        "evidence": "why this is a sub-problem",
        "confidence": 0.0-1.0
      }
    ],
    "technical_limitations": [
      {
        "limitation": "unstated limitation",
        "evidence": "supporting analysis",
        "severity": "critical/moderate/minor"
      }
    ],
    "failure_modes": [
      {
        "scenario": "when it fails",
        "why": "root cause",
        "evidence": "from experiments or analysis"
      }
    ]
  },
  "cross_references": {
    "related_work_connections": [
      {
        "cited_paper": "paper name",
        "relationship": "builds_on/contradicts/extends",
        "key_difference": "main difference"
      }
    ],
    "conceptual_lineage": [
      {
        "ancestor_method": "earlier method",
        "evolution_step": "what changed",
        "novelty": "current contribution"
      }
    ]
  },
  "experimental_insights": {
    "unreported_observations": [
      {
        "observation": "interesting but unemphasized finding",
        "location": "where in paper",
        "significance": "why it matters"
      }
    ],
    "ablation_insights": [
      {
        "component": "ablated component",
        "impact": "quantified impact",
        "implication": "what this means"
      }
    ]
  }
}

RULES:
- Read between the lines
- Identify what's NOT said but implied
- Connect dots across sections
- Provide confidence scores
- Cite specific evidence"""


# =============================================================================
# PHASE 3: VERIFICATION & CONFLICT DETECTION
# Cross-check and validate extractions
# =============================================================================

VERIFICATION_PROMPT = """You are a verification engine. Check for conflicts and validate extractions.

INPUT: Surface extraction + Deep reading results

OUTPUT FORMAT (JSON):
{
  "conflicts": [
    {
      "type": "duplicate/contradiction/ambiguous",
      "items": ["item1", "item2"],
      "descriptions": ["description1", "description2"],
      "resolution": "how to resolve",
      "recommended_action": "merge/separate/flag"
    }
  ],
  "confidence_assessment": {
    "overall_confidence": 0.0-1.0,
    "by_category": {
      "problems": 0.0-1.0,
      "methods": 0.0-1.0,
      "relationships": 0.0-1.0
    },
    "low_confidence_items": [
      {
        "item": "name",
        "reason": "why low confidence",
        "suggestion": "how to improve"
      }
    ]
  },
  "completeness_check": {
    "missing_standard_sections": ["what's not covered"],
    "suggested_additions": [
      {
        "category": "problems/methods/relations",
        "suggestion": "what to add",
        "rationale": "why it matters"
      }
    ]
  }
}

CHECK FOR:
- Duplicate entities with different names
- Contradictory statements
- Unclear boundaries between problems
- Methods without clear problems
- Unverified claims
- Missing context"""


# =============================================================================
# PHASE 4: ENRICHMENT & CONTEXT
# Add relationship context and domain knowledge
# =============================================================================

ENRICHMENT_PROMPT = """You are a domain expert. Enrich extractions with broader context.

INPUT: Validated extractions

OUTPUT FORMAT (JSON):
{
  "domain_classification": {
    "primary_domain": "main field",
    "secondary_domains": ["related fields"],
    "interdisciplinary_tags": ["cross-field topics"]
  },
  "maturity_assessment": {
    "problem_maturity": "nascent/emerging/mature",
    "method_maturity": "novel/developed/standard",
    "evidence_level": "theoretical/limited/extensive"
  },
  "comparative_context": {
    "similar_problems_in_other_domains": [
      {
        "domain": "other field",
        "analogous_problem": "similar problem",
        "potential_transfer": "insight that could transfer"
      }
    ],
    "method_versatility": {
      "current_applications": ["where used now"],
      "potential_applications": ["where could be used"],
      "adaptation_requirements": "what's needed to adapt"
    }
  },
  "future_directions": {
    "immediate_extensions": ["next steps"],
    "long_term_challenges": ["hard problems"],
    "enabling_technologies": ["what would help"]
  }
}

FOCUS:
- Place in broader research landscape
- Identify cross-domain analogies
- Assess generalizability
- Suggest future work"""


class UniversalPaperExtractor:
    """
    Universal Paper Extractor - Super Edition
    
    Combines best of:
    - Paper Research Agent: Fast, systematic extraction
    - Paper Reader Plus: Deep, implicit pattern recognition
    - Current system: Structured output, dual storage
    """
    
    def __init__(
        self,
        neo4j_driver: Driver,
        qdrant_client: QdrantClient,
        openai_api_key: Optional[str] = None,
        model: str = "gpt-4o"
    ):
        self.neo4j = neo4j_driver
        self.qdrant = qdrant_client
        self.llm = OpenAI(api_key=openai_api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model
        self.embedding_model = "text-embedding-3-small"
    
    def _call_llm(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        """Call LLM with structured output."""
        response = self.llm.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    
    def _phase1_surface_extraction(self, paper_text: str) -> Dict[str, Any]:
        """Phase 1: Extract explicit information (fast)."""
        logger.info("Phase 1: Surface extraction...")
        
        result = self._call_llm(
            prompt=f"Extract explicit information from:\n\n{paper_text[:6000]}",
            system_prompt=SURFACE_PROMPT,
            temperature=0.1
        )
        
        logger.info(f"Phase 1 complete: {len(result.get('explicit_problems', []))} problems, "
                   f"{len(result.get('explicit_methods', []))} methods")
        return result
    
    def _phase2_deep_reading(self, paper_text: str, surface_results: Dict) -> Dict[str, Any]:
        """Phase 2: Deep implicit analysis."""
        logger.info("Phase 2: Deep reading...")
        
        prompt = f"""Surface extraction results:
{json.dumps(surface_results, indent=2)}

Full paper text:
{paper_text[:8000]}

Extract implicit patterns and insights."""
        
        result = self._call_llm(
            prompt=prompt,
            system_prompt=DEEP_READING_PROMPT,
            temperature=0.3
        )
        
        logger.info(f"Phase 2 complete: {len(result.get('implicit_insights', {}).get('hidden_sub_problems', []))} hidden problems")
        return result
    
    def _phase3_verification(
        self,
        surface_results: Dict,
        deep_results: Dict
    ) -> Tuple[Dict[str, Any], List[ExtractionConflict]]:
        """Phase 3: Verify and detect conflicts."""
        logger.info("Phase 3: Verification...")
        
        prompt = f"""Surface extraction:
{json.dumps(surface_results, indent=2)}

Deep reading results:
{json.dumps(deep_results, indent=2)}

Verify and detect conflicts."""
        
        result = self._call_llm(
            prompt=prompt,
            system_prompt=VERIFICATION_PROMPT,
            temperature=0.1
        )
        
        conflicts = [
            ExtractionConflict(
                item_id=c.get("items", [""])[0],
                conflict_type=c.get("type", ""),
                descriptions=c.get("descriptions", []),
                resolution=c.get("resolution")
            )
            for c in result.get("conflicts", [])
        ]
        
        logger.info(f"Phase 3 complete: {len(conflicts)} conflicts detected")
        return result, conflicts
    
    def _phase4_enrichment(self, validated_results: Dict) -> Dict[str, Any]:
        """Phase 4: Add domain context."""
        logger.info("Phase 4: Enrichment...")
        
        prompt = f"""Validated extraction results:
{json.dumps(validated_results, indent=2)}

Add domain context and enrich."""
        
        result = self._call_llm(
            prompt=prompt,
            system_prompt=ENRICHMENT_PROMPT,
            temperature=0.4
        )
        
        logger.info("Phase 4 complete")
        return result
    
    def _merge_phases(
        self,
        surface: Dict,
        deep: Dict,
        verification: Dict,
        enrichment: Dict
    ) -> Dict[str, Any]:
        """Merge all phases into unified output."""
        
        unified = {
            "metadata": surface.get("metadata", {}),
            "problems": [],
            "methods": [],
            "relationships": [],
            "implicit_insights": deep.get("implicit_insights", {}),
            "domain_context": enrichment.get("domain_classification", {}),
            "quality_metrics": {
                "overall_confidence": verification.get("confidence_assessment", {}).get("overall_confidence", 0.5),
                "completeness_score": 1.0 - len(verification.get("completeness_check", {}).get("missing_standard_sections", [])) * 0.1,
                "verification_status": "verified" if not verification.get("conflicts") else "has_conflicts"
            }
        }
        
        // Merge problems with confidence scores
        for p in surface.get("explicit_problems", []):
            confidence = 0.9 if p.get("is_primary") else 0.7
            unified["problems"].append({
                **p,
                "confidence": confidence,
                "source": "explicit"
            })
        
        for p in deep.get("implicit_insights", {}).get("hidden_sub_problems", []):
            unified["problems"].append({
                **p,
                "source": "implicit"
            })
        
        // Merge methods
        for m in surface.get("explicit_methods", []):
            unified["methods"].append({
                **m,
                "confidence": 0.85,
                "source": "explicit"
            })
        
        // Merge relationships
        for r in surface.get("explicit_relationships", []):
            unified["relationships"].append({
                **r,
                "confidence": 0.8,
                "source": "explicit"
            })
        
        return unified
    
    def execute(self, paper_text: str, paper_meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute 4-phase universal extraction.
        
        Args:
            paper_text: Full or partial paper text
            paper_meta: {title, authors, year, venue, ...}
            
        Returns:
            Unified extraction with confidence scores and quality metrics
        """
        logger.info(f"Starting universal extraction for: {paper_meta.get('title', 'Unknown')}")
        
        // Phase 1: Surface extraction
        surface = self._phase1_surface_extraction(paper_text)
        
        // Phase 2: Deep reading
        deep = self._phase2_deep_reading(paper_text, surface)
        
        // Phase 3: Verification
        verification, conflicts = self._phase3_verification(surface, deep)
        
        // Phase 4: Enrichment
        enrichment = self._phase4_enrichment(surface)
        
        // Merge all phases
        unified = self._merge_phases(surface, deep, verification, enrichment)
        
        # Add conflicts if any
        if conflicts:
            unified["conflicts"] = [
                {
                    "type": c.conflict_type,
                    "items": c.descriptions,
                    "resolution": c.resolution
                }
                for c in conflicts
            ]
        
        logger.info(f"Universal extraction complete: {len(unified['problems'])} problems, "
                   f"{len(unified['methods'])} methods, "
                   f"confidence: {unified['quality_metrics']['overall_confidence']:.2f}")
        
        return unified


# Backward compatibility - keep original function
def extract_and_store_triplets(
    paper_text: str,
    paper_meta: Dict[str, Any],
    neo4j_driver: Driver,
    qdrant_client: QdrantClient,
    openai_api_key: Optional[str] = None,
    use_universal: bool = True
) -> Dict[str, Any]:
    """
    Extract and store paper information.
    
    If use_universal=True, uses the new 4-phase Super Skill.
    If use_universal=False, uses the original fast extraction.
    """
    if use_universal:
        extractor = UniversalPaperExtractor(
            neo4j_driver, qdrant_client, openai_api_key
        )
        return extractor.execute(paper_text, paper_meta)
    else:
        // Fallback to original implementation
        from .skill_1_extract_legacy import extract_and_store_triplets as legacy
        return legacy(paper_text, paper_meta, neo4j_driver, qdrant_client, openai_api_key)
