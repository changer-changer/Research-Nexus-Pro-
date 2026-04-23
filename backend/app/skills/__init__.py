"""
Research-Nexus Agent Skills (Super Edition)

This module exports all 4 agent skills + Super Skill 1.

Usage:
    from app.skills import (
        extract_and_store_triplets,  # New 4-phase universal extractor
        query_structural_gaps,
        cross_domain_innovation_search,
        merge_equivalent_nodes,
        UniversalPaperExtractor  # Direct access to Super Skill
    )
"""

from .skill_1_super import extract_and_store_triplets, UniversalPaperExtractor
from .skill_2_query_gaps import query_structural_gaps
from .skill_3_cross_domain import cross_domain_innovation_search
from .skill_4_merge_nodes import merge_equivalent_nodes

__all__ = [
    "extract_and_store_triplets",
    "UniversalPaperExtractor",
    "query_structural_gaps",
    "cross_domain_innovation_search",
    "merge_equivalent_nodes",
]
