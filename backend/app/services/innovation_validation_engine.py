"""
Innovation Validation Engine
Evaluates innovation feasibility, identifies uncertainties, and designs validation experiments.

API: POST /api/v3/innovation/validate
Input: {
    "innovation_id": "...",
    "include_uncertainty_analysis": true
}
Output: {
    "feasibility_score": 0.85,
    "uncertainties": [...],
    "validation_experiments": [...],
    "annotations": [...]
}
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class FeasibilityLevel(Enum):
    """Feasibility assessment levels"""
    HIGH = "high"  # > 0.8
    MEDIUM = "medium"  # 0.5 - 0.8
    LOW = "low"  # < 0.5
    UNKNOWN = "unknown"


class UncertaintyType(Enum):
    """Types of uncertainties in innovations"""
    TECHNICAL = "technical"  # Technical implementation unclear
    EMPIRICAL = "empirical"  # Needs experimental validation
    THEORETICAL = "theoretical"  # Theoretical foundation uncertain
    RESOURCE = "resource"  # Resource requirements unclear
    NOVELTY = "novelty"  # Novelty claim needs verification


@dataclass
class Uncertainty:
    """Represents an identified uncertainty"""
    id: str
    type: UncertaintyType
    description: str
    impact: str  # "high", "medium", "low"
    location: str  # Where in the paper this appears
    suggested_validation: str


@dataclass
class ValidationExperiment:
    """Suggested experiment to validate an uncertainty"""
    id: str
    target_uncertainty_id: str
    name: str
    description: str
    estimated_effort: str  # "days", "weeks", "months"
    success_criteria: str
    priority: str  # "critical", "high", "medium", "low"


@dataclass
class PaperAnnotation:
    """Annotation for marking [待验证] sections in paper"""
    section: str
    location: str  # e.g., "methodology", "results"
    original_text: str
    annotation: str
    uncertainty_id: Optional[str]


class InnovationValidationEngine:
    """
    Validates innovation feasibility and identifies uncertainties.
    
    This engine performs comprehensive validation:
    1. Feasibility scoring (0-1) based on multiple dimensions
    2. Uncertainty identification and categorization
    3. Validation experiment design
    4. Paper annotation generation for [待验证] markers
    """
    
    # Scoring weights for different dimensions
    DIMENSION_WEIGHTS = {
        "technical_feasibility": 0.25,
        "resource_availability": 0.20,
        "novelty_strength": 0.20,
        "empirical_support": 0.20,
        "alignment_with_venue": 0.15
    }
    
    def __init__(self, llm_client=None, graph_db=None):
        self.llm_client = llm_client
        self.graph_db = graph_db
        self._load_prompts()
        logger.info("InnovationValidationEngine initialized")
    
    def _load_prompts(self):
        """Load validation prompts"""
        self.prompts = {
            "feasibility_analysis": """分析以下创新点的可行性，从5个维度打分（0-1）：

创新点: {innovation_name}
描述: {innovation_description}
目标问题: {target_problem}
候选方法: {candidate_methods}
目标会议: {target_venue}

评估维度:
1. 技术可行性 (technical_feasibility): 当前技术能否实现
2. 资源可得性 (resource_availability): 计算资源、数据是否可获取
3. 创新强度 (novelty_strength): 与现有方法的区别程度
4. 实证支持 (empirical_support): 是否有初步实验或理论支持
5. 会议匹配度 (alignment_with_venue): 是否符合目标会议偏好

输出JSON格式:
{{
    "dimension_scores": {{
        "technical_feasibility": 0.0-1.0,
        "resource_availability": 0.0-1.0,
        "novelty_strength": 0.0-1.0,
        "empirical_support": 0.0-1.0,
        "alignment_with_venue": 0.0-1.0
    }},
    "overall_score": 0.0-1.0,
    "confidence": 0.0-1.0,
    "assessment": "简要评估说明"
}}
""",
            "uncertainty_identification": """识别以下创新点中的不确定部分：

创新点: {innovation_name}
描述: {innovation_description}

请识别3-5个关键不确定性，按以下格式输出：

[
    {{
        "type": "technical|empirical|theoretical|resource|novelty",
        "description": "不确定性的具体描述",
        "impact": "high|medium|low",
        "location": "可能出现在论文的哪个章节",
        "suggested_validation": "建议的验证方法"
    }}
]

不确定性类型定义:
- technical: 技术实现路径不清晰
- empirical: 需要实验验证假设
- theoretical: 理论基础不够扎实
- resource: 资源需求不明确
- novelty: 创新性声明需要验证
""",
            "validation_experiment_design": """为以下不确定性设计验证实验：

不确定性: {uncertainty_description}
类型: {uncertainty_type}
影响: {uncertainty_impact}

设计一个最小可行实验(MVE)来验证或消除这个不确定性。

输出格式:
{{
    "experiment_name": "实验名称",
    "description": "实验描述",
    "estimated_effort": "days|weeks|months",
    "success_criteria": "成功的判定标准",
    "priority": "critical|high|medium|low"
}}
"""
        }
    
    async def validate(
        self,
        innovation_id: str,
        include_uncertainty_analysis: bool = True,
        include_validation_experiments: bool = True
    ) -> Dict[str, Any]:
        """
        Main validation entry point.
        
        Args:
            innovation_id: Innovation point to validate
            include_uncertainty_analysis: Whether to identify uncertainties
            include_validation_experiments: Whether to design validation experiments
            
        Returns:
            Complete validation report
        """
        logger.info(f"Starting validation for innovation {innovation_id}")
        
        # Load innovation data
        innovation_data = await self._load_innovation_data(innovation_id)
        if not innovation_data:
            return self._generate_fallback_validation(innovation_id)
        
        # 1. Feasibility scoring
        feasibility_result = await self._assess_feasibility(innovation_data)
        
        # 2. Uncertainty identification
        uncertainties = []
        if include_uncertainty_analysis:
            uncertainties = await self._identify_uncertainties(innovation_data)
        
        # 3. Validation experiment design
        validation_experiments = []
        if include_validation_experiments and uncertainties:
            validation_experiments = await self._design_validation_experiments(
                uncertainties, innovation_data
            )
        
        # 4. Generate paper annotations
        annotations = self._generate_annotations(uncertainties)
        
        # Build validation report
        report = {
            "innovation_id": innovation_id,
            "validation_timestamp": datetime.now().isoformat(),
            "feasibility": feasibility_result,
            "uncertainties": [self._uncertainty_to_dict(u) for u in uncertainties],
            "validation_experiments": [self._experiment_to_dict(e) for e in validation_experiments],
            "annotations": [self._annotation_to_dict(a) for a in annotations],
            "summary": self._generate_summary(feasibility_result, uncertainties, validation_experiments)
        }
        
        logger.info(f"Validation completed for {innovation_id}")
        return report
    
    async def _load_innovation_data(self, innovation_id: str) -> Optional[Dict[str, Any]]:
        """Load innovation data from database"""
        # In production: query from LocalGraphDB
        # For now, return None to trigger mock data
        return None
    
    async def _assess_feasibility(self, innovation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess feasibility across multiple dimensions"""
        
        # In production: use LLM for nuanced assessment
        # For now, use rule-based assessment with mock data
        
        dimension_scores = self._calculate_dimension_scores(innovation_data)
        
        # Calculate weighted overall score
        overall_score = sum(
            score * self.DIMENSION_WEIGHTS[dim]
            for dim, score in dimension_scores.items()
        )
        
        # Determine feasibility level
        if overall_score >= 0.8:
            level = FeasibilityLevel.HIGH
        elif overall_score >= 0.5:
            level = FeasibilityLevel.MEDIUM
        else:
            level = FeasibilityLevel.LOW
        
        return {
            "overall_score": round(overall_score, 2),
            "level": level.value,
            "dimension_scores": {k: round(v, 2) for k, v in dimension_scores.items()},
            "confidence": 0.75,  # Could be calculated from data quality
            "assessment": self._generate_feasibility_assessment(overall_score, dimension_scores),
            "recommendations": self._generate_feasibility_recommendations(dimension_scores)
        }
    
    def _calculate_dimension_scores(self, innovation_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate scores for each feasibility dimension"""
        # In production: use LLM or ML model
        # For now, return mock scores with some variation
        
        description = innovation_data.get("description", "").lower()
        
        # Rule-based scoring
        scores = {
            "technical_feasibility": 0.85,
            "resource_availability": 0.75,
            "novelty_strength": 0.80,
            "empirical_support": 0.65,
            "alignment_with_venue": 0.90
        }
        
        # Adjust based on keywords
        if "difficult" in description or "challenging" in description:
            scores["technical_feasibility"] -= 0.1
        if "compute" in description or "gpu" in description:
            scores["resource_availability"] -= 0.15
        if "novel" in description or "new" in description:
            scores["novelty_strength"] += 0.05
        
        # Ensure bounds
        return {k: max(0.1, min(1.0, v)) for k, v in scores.items()}
    
    def _generate_feasibility_assessment(
        self,
        overall_score: float,
        dimension_scores: Dict[str, float]
    ) -> str:
        """Generate human-readable feasibility assessment"""
        
        if overall_score >= 0.8:
            base = "该创新点具有较高的可行性"
        elif overall_score >= 0.6:
            base = "该创新点具备中等可行性，需要进一步验证"
        else:
            base = "该创新点可行性较低，存在较大风险"
        
        # Identify weakest dimension
        weakest = min(dimension_scores.items(), key=lambda x: x[1])
        
        return f"{base}。主要挑战在于{self._dimension_name(weakest[0])}（{weakest[1]:.0%}），建议重点关注。"
    
    def _dimension_name(self, dim_key: str) -> str:
        """Convert dimension key to Chinese name"""
        names = {
            "technical_feasibility": "技术实现",
            "resource_availability": "资源获取",
            "novelty_strength": "创新强度",
            "empirical_support": "实证支持",
            "alignment_with_venue": "会议匹配"
        }
        return names.get(dim_key, dim_key)
    
    def _generate_feasibility_recommendations(
        self,
        dimension_scores: Dict[str, float]
    ) -> List[str]:
        """Generate recommendations based on weak dimensions"""
        recommendations = []
        
        for dim, score in dimension_scores.items():
            if score < 0.6:
                if dim == "technical_feasibility":
                    recommendations.append("建议先实现原型验证核心技术的可行性")
                elif dim == "resource_availability":
                    recommendations.append("需要提前确认计算资源和数据的获取途径")
                elif dim == "novelty_strength":
                    recommendations.append("建议进行更全面的文献调研，强化创新点论证")
                elif dim == "empirical_support":
                    recommendations.append("建议先进行小规模预实验，收集初步结果")
                elif dim == "alignment_with_venue":
                    recommendations.append("建议调整表述方式，更好地匹配目标会议的偏好")
        
        if not recommendations:
            recommendations.append("各方面可行性较好，建议按计划推进")
        
        return recommendations
    
    async def _identify_uncertainties(
        self,
        innovation_data: Dict[str, Any]
    ) -> List[Uncertainty]:
        """Identify uncertainties in the innovation"""
        
        # In production: use LLM
        # For now, generate context-aware mock uncertainties
        
        description = innovation_data.get("description", "")
        uncertainties = []
        
        # Technical uncertainty
        uncertainties.append(Uncertainty(
            id=f"unc_{datetime.now().timestamp()}_1",
            type=UncertaintyType.TECHNICAL,
            description="核心算法的技术实现路径尚不清晰，需要验证多种实现方案的优劣",
            impact="high",
            location="methodology",
            suggested_validation="实现两个以上的原型版本进行对比实验"
        ))
        
        # Empirical uncertainty
        uncertainties.append(Uncertainty(
            id=f"unc_{datetime.now().timestamp()}_2",
            type=UncertaintyType.EMPIRICAL,
            description="性能提升预期缺乏实证数据支持，仅基于理论分析",
            impact="high",
            location="experiments",
            suggested_validation="在至少2个标准数据集上进行预实验"
        ))
        
        # Resource uncertainty
        uncertainties.append(Uncertainty(
            id=f"unc_{datetime.now().timestamp()}_3",
            type=UncertaintyType.RESOURCE,
            description="大规模实验的计算资源需求未明确，可能超出现有预算",
            impact="medium",
            location="experiments",
            suggested_validation="进行计算复杂度分析，并测试在小规模数据上的效果"
        ))
        
        # Novelty uncertainty
        if "novel" in description.lower():
            uncertainties.append(Uncertainty(
                id=f"unc_{datetime.now().timestamp()}_4",
                type=UncertaintyType.NOVELTY,
                description="创新性声明需要更充分的文献对比支持",
                impact="medium",
                location="related_work",
                suggested_validation="完成全面的文献综述，明确区分现有方法"
            ))
        
        return uncertainties
    
    async def _design_validation_experiments(
        self,
        uncertainties: List[Uncertainty],
        innovation_data: Dict[str, Any]
    ) -> List[ValidationExperiment]:
        """Design experiments to validate uncertainties"""
        
        experiments = []
        
        for i, uncertainty in enumerate(uncertainties):
            experiment = ValidationExperiment(
                id=f"exp_{datetime.now().timestamp()}_{i}",
                target_uncertainty_id=uncertainty.id,
                name=f"验证实验: {uncertainty.description[:30]}...",
                description=uncertainty.suggested_validation,
                estimated_effort="weeks" if uncertainty.impact == "high" else "days",
                success_criteria=f"不确定性消除或找到可行的替代方案",
                priority="critical" if uncertainty.impact == "high" else "high"
            )
            experiments.append(experiment)
        
        return experiments
    
    def _generate_annotations(self, uncertainties: List[Uncertainty]) -> List[PaperAnnotation]:
        """Generate [待验证] annotations for paper sections"""
        
        annotations = []
        
        for uncertainty in uncertainties:
            if uncertainty.location == "methodology":
                annotations.append(PaperAnnotation(
                    section="methodology",
                    location="methodology.implementation",
                    original_text="我们将实现...",
                    annotation="[待验证] 技术实现方案需通过原型验证",
                    uncertainty_id=uncertainty.id
                ))
            elif uncertainty.location == "experiments":
                annotations.append(PaperAnnotation(
                    section="experiments",
                    location="experiments.results",
                    original_text="实验结果表明...",
                    annotation="[待验证] 性能提升需通过大规模实验验证",
                    uncertainty_id=uncertainty.id
                ))
            elif uncertainty.location == "related_work":
                annotations.append(PaperAnnotation(
                    section="related_work",
                    location="related_work.comparison",
                    original_text="与现有方法相比...",
                    annotation="[待验证] 创新性声明需更充分的文献支持",
                    uncertainty_id=uncertainty.id
                ))
        
        return annotations
    
    def _uncertainty_to_dict(self, u: Uncertainty) -> Dict[str, Any]:
        return {
            "id": u.id,
            "type": u.type.value,
            "description": u.description,
            "impact": u.impact,
            "location": u.location,
            "suggested_validation": u.suggested_validation
        }
    
    def _experiment_to_dict(self, e: ValidationExperiment) -> Dict[str, Any]:
        return {
            "id": e.id,
            "target_uncertainty_id": e.target_uncertainty_id,
            "name": e.name,
            "description": e.description,
            "estimated_effort": e.estimated_effort,
            "success_criteria": e.success_criteria,
            "priority": e.priority
        }
    
    def _annotation_to_dict(self, a: PaperAnnotation) -> Dict[str, Any]:
        return {
            "section": a.section,
            "location": a.location,
            "original_text": a.original_text,
            "annotation": a.annotation,
            "uncertainty_id": a.uncertainty_id
        }
    
    def _generate_summary(
        self,
        feasibility: Dict[str, Any],
        uncertainties: List[Uncertainty],
        experiments: List[ValidationExperiment]
    ) -> Dict[str, Any]:
        """Generate validation summary"""
        
        high_impact_uncertainties = [u for u in uncertainties if u.impact == "high"]
        critical_experiments = [e for e in experiments if e.priority == "critical"]
        
        return {
            "overall_feasibility": feasibility["overall_score"],
            "feasibility_level": feasibility["level"],
            "total_uncertainties": len(uncertainties),
            "high_impact_uncertainties": len(high_impact_uncertainties),
            "total_validation_experiments": len(experiments),
            "critical_experiments": len(critical_experiments),
            "risk_assessment": self._assess_risk(feasibility, uncertainties),
            "next_steps": self._suggest_next_steps(feasibility, critical_experiments)
        }
    
    def _assess_risk(
        self,
        feasibility: Dict[str, Any],
        uncertainties: List[Uncertainty]
    ) -> str:
        """Assess overall risk level"""
        score = feasibility["overall_score"]
        high_impact = len([u for u in uncertainties if u.impact == "high"])
        
        if score >= 0.8 and high_impact == 0:
            return "低风险"
        elif score >= 0.6 and high_impact <= 2:
            return "中等风险"
        else:
            return "高风险"
    
    def _suggest_next_steps(
        self,
        feasibility: Dict[str, Any],
        critical_experiments: List[ValidationExperiment]
    ) -> List[str]:
        """Suggest next steps based on validation"""
        steps = []
        
        if critical_experiments:
            steps.append(f"优先执行 {len(critical_experiments)} 个关键验证实验")
        
        if feasibility["overall_score"] < 0.6:
            steps.append("重新评估创新点设计，考虑降低复杂度")
        
        steps.append("根据验证结果迭代改进方案")
        
        return steps
    
    def _generate_fallback_validation(self, innovation_id: str) -> Dict[str, Any]:
        """Generate minimal fallback validation"""
        return {
            "innovation_id": innovation_id,
            "validation_timestamp": datetime.now().isoformat(),
            "feasibility": {
                "overall_score": 0.70,
                "level": "medium",
                "dimension_scores": {
                    "technical_feasibility": 0.75,
                    "resource_availability": 0.70,
                    "novelty_strength": 0.65,
                    "empirical_support": 0.60,
                    "alignment_with_venue": 0.80
                },
                "confidence": 0.60,
                "assessment": "可行性中等，需要进一步验证关键假设",
                "recommendations": ["建议先进行小规模预实验"]
            },
            "uncertainties": [
                {
                    "id": "unc_fallback_1",
                    "type": "technical",
                    "description": "核心技术的可行性需验证",
                    "impact": "high",
                    "location": "methodology",
                    "suggested_validation": "实现原型并测试"
                }
            ],
            "validation_experiments": [
                {
                    "id": "exp_fallback_1",
                    "target_uncertainty_id": "unc_fallback_1",
                    "name": "原型验证实验",
                    "description": "实现核心算法并测试",
                    "estimated_effort": "weeks",
                    "success_criteria": "核心功能正常运行",
                    "priority": "critical"
                }
            ],
            "annotations": [],
            "summary": {
                "overall_feasibility": 0.70,
                "feasibility_level": "medium",
                "total_uncertainties": 1,
                "high_impact_uncertainties": 1,
                "total_validation_experiments": 1,
                "critical_experiments": 1,
                "risk_assessment": "中等风险",
                "next_steps": ["执行原型验证实验"]
            },
            "is_fallback": True
        }


# Convenience functions for API usage
async def validate_innovation(
    innovation_id: str,
    llm_client=None,
    graph_db=None,
    include_uncertainty_analysis: bool = True,
    include_validation_experiments: bool = True
) -> Dict[str, Any]:
    """
    Validate an innovation point.
    
    Args:
        innovation_id: Innovation point identifier
        llm_client: Optional LLM client
        graph_db: Optional graph database
        include_uncertainty_analysis: Whether to identify uncertainties
        include_validation_experiments: Whether to design validation experiments
        
    Returns:
        Complete validation report
    """
    engine = InnovationValidationEngine(llm_client=llm_client, graph_db=graph_db)
    return await engine.validate(
        innovation_id,
        include_uncertainty_analysis,
        include_validation_experiments
    )


def get_feasibility_level(score: float) -> str:
    """Convert score to feasibility level"""
    if score >= 0.8:
        return FeasibilityLevel.HIGH.value
    elif score >= 0.5:
        return FeasibilityLevel.MEDIUM.value
    else:
        return FeasibilityLevel.LOW.value
