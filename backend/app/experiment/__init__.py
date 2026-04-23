"""
Research-Nexus Pro Experiment Pipeline (Layer 2)

Handles experiment feasibility assessment, guide generation, and execution.

Usage:
    from app.experiment import FeasibilityAssessor, LLMGuideGenerator

    assessor = FeasibilityAssessor()
    result = await assessor.assess(innovation_data)

    guide_gen = LLMGuideGenerator()
    guide = await guide_gen.generate_guide(innovation_data, result)
"""

from .feasibility_assessor import FeasibilityAssessor, FeasibilityResult
from .llm_guide_generator import LLMGuideGenerator, ExperimentGuide

__all__ = [
    "FeasibilityAssessor",
    "FeasibilityResult",
    "LLMGuideGenerator",
    "ExperimentGuide",
]
