"""
Innovation Validation Engine
Validates innovation opportunities and generates verification experiments.
"""

import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ValidationStatus(Enum):
    """Validation status for innovation points"""
    UNVALIDATED = "unvalidated"
    VALIDATED = "validated"
    PARTIALLY_VALIDATED = "partially_validated"
    REQUIRES_EXPERIMENT = "requires_experiment"
    INVALID = "invalid"


@dataclass
class ValidationResult:
    """Result of innovation validation"""
    innovation_id: str
    status: ValidationStatus
    confidence_score: float  # 0-1
    technical_feasibility: float  # 0-1
    novelty_assessment: float  # 0-1
    
    # Validation details
    key_assumptions: List[str]
    assumptions_risks: List[Dict[str, Any]]  # [{"assumption": "...", "risk": "...", "mitigation": "..."}]
    
    # Experiment design for validation
    validation_experiments: List[Dict[str, Any]]
    estimated_validation_time: str
    estimated_cost: str
    
    # Recommendations
    is_ready_for_paper: bool
    recommendations: List[str]
    next_steps: List[str]


class InnovationValidationEngine:
    """
    Validates innovation opportunities before paper generation.
    
    Performs multi-dimensional validation:
    1. Technical feasibility assessment
    2. Novelty verification (against literature)
    3. Key assumption identification and risk analysis
    4. Validation experiment design
    5. Resource and time estimation
    """
    
    def __init__(self, llm_client=None, paper_db=None):
        self.llm_client = llm_client
        self.paper_db = paper_db
    
    def validate(
        self,
        innovation_id: str,
        target_problem: Dict[str, Any],
        candidate_methods: List[Dict[str, Any]],
        rationale: str,
        supporting_evidence: List[str] = None
    ) -> ValidationResult:
        """
        Validate an innovation opportunity.
        
        Returns comprehensive validation result including:
        - Feasibility scores
        - Risk analysis
        - Validation experiments needed
        - Recommendations
        """
        
        # 1. Technical feasibility assessment
        tech_feasibility = self._assess_technical_feasibility(
            target_problem, candidate_methods
        )
        
        # 2. Novelty assessment
        novelty_score = self._assess_novelty(
            target_problem, candidate_methods, supporting_evidence
        )
        
        # 3. Identify key assumptions
        assumptions = self._identify_key_assumptions(
            target_problem, candidate_methods, rationale
        )
        
        # 4. Analyze assumption risks
        risks = self._analyze_assumption_risks(assumptions)
        
        # 5. Design validation experiments
        validation_exps = self._design_validation_experiments(
            target_problem, candidate_methods, assumptions, risks
        )
        
        # 6. Calculate confidence score
        confidence = self._calculate_confidence(
            tech_feasibility, novelty_score, risks
        )
        
        # 7. Determine status
        status = self._determine_status(confidence, risks, validation_exps)
        
        # 8. Generate recommendations
        recommendations = self._generate_recommendations(
            status, risks, tech_feasibility, novelty_score
        )
        
        # 9. Estimate resources
        time_est, cost_est = self._estimate_resources(validation_exps)
        
        # 10. Determine if ready for paper
        ready_for_paper = status in [ValidationStatus.VALIDATED, ValidationStatus.REQUIRES_EXPERIMENT]
        
        # 11. Generate next steps
        next_steps = self._generate_next_steps(status, validation_exps, risks)
        
        return ValidationResult(
            innovation_id=innovation_id,
            status=status,
            confidence_score=confidence,
            technical_feasibility=tech_feasibility,
            novelty_assessment=novelty_score,
            key_assumptions=assumptions,
            assumptions_risks=risks,
            validation_experiments=validation_exps,
            estimated_validation_time=time_est,
            estimated_cost=cost_est,
            is_ready_for_paper=ready_for_paper,
            recommendations=recommendations,
            next_steps=next_steps
        )
    
    def _assess_technical_feasibility(
        self, 
        problem: Dict, 
        methods: List[Dict]
    ) -> float:
        """Assess technical feasibility (0-1)"""
        scores = []
        
        # Check method maturity
        for method in methods:
            # If method is well-established, higher feasibility
            if method.get('complexity', '').lower() in ['low', 'medium']:
                scores.append(0.8)
            elif method.get('complexity', '').lower() == 'high':
                scores.append(0.5)
            else:
                scores.append(0.6)
        
        # Check problem complexity
        problem_def = problem.get('definition', problem.get('description', ''))
        if len(problem_def) < 200:
            scores.append(0.8)  # Simple problem
        elif len(problem_def) < 500:
            scores.append(0.6)  # Medium complexity
        else:
            scores.append(0.4)  # Complex problem
        
        return sum(scores) / len(scores) if scores else 0.5
    
    def _assess_novelty(
        self,
        problem: Dict,
        methods: List[Dict],
        evidence: Optional[List[str]]
    ) -> float:
        """Assess novelty (0-1)"""
        # Default mid-range novelty
        base_score = 0.6
        
        # More methods = potentially more novel combinations
        method_bonus = min(0.2, len(methods) * 0.05)
        
        # Evidence presence indicates some novelty support
        evidence_bonus = 0.1 if evidence else 0
        
        return min(1.0, base_score + method_bonus + evidence_bonus)
    
    def _identify_key_assumptions(
        self,
        problem: Dict,
        methods: List[Dict],
        rationale: str
    ) -> List[str]:
        """Identify key assumptions for the innovation"""
        assumptions = []
        
        # Technical assumptions
        assumptions.append(f"The combination of {len(methods)} methods will work synergistically")
        assumptions.append("The problem can be effectively decomposed into tractable sub-problems")
        assumptions.append("Available compute resources are sufficient for the proposed approach")
        
        # Method-specific assumptions
        for i, method in enumerate(methods):
            method_name = method.get('name', f'Method {i+1}')
            assumptions.append(f"{method_name} can be adapted to the target problem domain")
        
        # Problem-specific assumptions
        problem_def = problem.get('definition', '')
        if 'real-time' in problem_def.lower() or 'latency' in problem_def.lower():
            assumptions.append("The solution can meet real-time/latency constraints")
        if 'scale' in problem_def.lower() or 'large-scale' in problem_def.lower():
            assumptions.append("The approach scales to the required problem size")
        
        return assumptions
    
    def _analyze_assumption_risks(
        self,
        assumptions: List[str]
    ) -> List[Dict[str, Any]]:
        """Analyze risks for each assumption"""
        risks = []
        
        risk_templates = [
            {
                "risk": "Method integration may fail due to incompatible assumptions",
                "mitigation": "Design modular architecture with clear interfaces; test integration early"
            },
            {
                "risk": "Problem decomposition may lose critical dependencies",
                "mitigation": "Perform thorough problem analysis; validate decomposition with toy examples"
            },
            {
                "risk": "Compute requirements may exceed available resources",
                "mitigation": "Profile resource usage early; design efficient approximations"
            },
            {
                "risk": "Method adaptation may require substantial modifications",
                "mitigation": "Review method assumptions carefully; prototype adaptation early"
            },
            {
                "risk": "Scalability constraints may limit practical applicability",
                "mitigation": "Design with scaling in mind; establish complexity bounds"
            },
            {
                "risk": "Real-time constraints may not be achievable",
                "mitigation": "Profile latency early; consider approximation/trading accuracy for speed"
            }
        ]
        
        for i, assumption in enumerate(assumptions):
            risk_template = risk_templates[i % len(risk_templates)]
            risks.append({
                "assumption": assumption,
                "risk_level": "medium",  # Default to medium risk
                "risk_description": risk_template["risk"],
                "mitigation": risk_template["mitigation"],
                "validation_required": True
            })
        
        return risks
    
    def _design_validation_experiments(
        self,
        problem: Dict,
        methods: List[Dict],
        assumptions: List[str],
        risks: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Design experiments to validate key assumptions"""
        experiments = []
        
        # 1. Method integration test
        experiments.append({
            "exp_id": "val_001",
            "name": "方法集成验证",
            "objective": "验证所选方法可以正确集成并协同工作",
            "procedure": [
                "实现各方法的简化版本",
                "设计集成接口",
                "在小规模数据上测试端到端流程",
                "验证输出符合预期"
            ],
            "success_criteria": "集成系统在小样本上产生合理输出",
            "estimated_time": "3-5天",
            "priority": "high"
        })
        
        # 2. Feasibility proof-of-concept
        experiments.append({
            "exp_id": "val_002",
            "name": "可行性概念验证",
            "objective": "验证核心创新点在简化场景下可行",
            "procedure": [
                "选择问题的简化版本",
                "实现核心方法组件",
                "在简化场景下评估性能",
                "与基线方法对比"
            ],
            "success_criteria": "简化场景下性能优于或持平基线",
            "estimated_time": "5-7天",
            "priority": "high"
        })
        
        # 3. Scalability test (if applicable)
        problem_def = problem.get('definition', '')
        if 'scale' in problem_def.lower():
            experiments.append({
                "exp_id": "val_003",
                "name": "可扩展性测试",
                "objective": "验证方法可以扩展到实际问题规模",
                "procedure": [
                    "测试不同规模下的性能",
                    "分析时间/空间复杂度",
                    "确定瓶颈组件",
                    "设计优化策略"
                ],
                "success_criteria": "复杂度符合预期，可以接受的时间内完成",
                "estimated_time": "3-4天",
                "priority": "medium"
            })
        
        # 4. Robustness check
        experiments.append({
            "exp_id": "val_004",
            "name": "鲁棒性检查",
            "objective": "验证方法对输入变化和噪声的鲁棒性",
            "procedure": [
                "在不同随机种子下测试",
                "添加不同程度的噪声",
                "测试边界情况",
                "分析失败模式"
            ],
            "success_criteria": "性能方差在可接受范围内，无灾难性失败",
            "estimated_time": "2-3天",
            "priority": "medium"
        })
        
        return experiments
    
    def _calculate_confidence(
        self,
        tech_feasibility: float,
        novelty: float,
        risks: List[Dict]
    ) -> float:
        """Calculate overall confidence score"""
        # Base confidence from feasibility and novelty
        base = (tech_feasibility * 0.6 + novelty * 0.4)
        
        # Penalize for high-risk assumptions
        high_risk_count = sum(1 for r in risks if r["risk_level"] == "high")
        risk_penalty = high_risk_count * 0.05
        
        return max(0.1, min(1.0, base - risk_penalty))
    
    def _determine_status(
        self,
        confidence: float,
        risks: List[Dict],
        experiments: List[Dict]
    ) -> ValidationStatus:
        """Determine validation status"""
        if confidence > 0.8:
            return ValidationStatus.VALIDATED
        elif confidence > 0.6:
            return ValidationStatus.REQUIRES_EXPERIMENT
        elif confidence > 0.4:
            return ValidationStatus.PARTIALLY_VALIDATED
        else:
            return ValidationStatus.UNVALIDATED
    
    def _generate_recommendations(
        self,
        status: ValidationStatus,
        risks: List[Dict],
        tech_feasibility: float,
        novelty: float
    ) -> List[str]:
        """Generate recommendations based on validation"""
        recommendations = []
        
        if status == ValidationStatus.VALIDATED:
            recommendations.append("✅ 创新点验证充分，可以开始论文写作")
            recommendations.append("💡 建议在论文中详细描述方法集成的技术细节")
        
        elif status == ValidationStatus.REQUIRES_EXPERIMENT:
            recommendations.append("⚠️ 需要先完成关键验证实验")
            recommendations.append("📋 优先执行高优先级验证实验")
            for risk in risks[:2]:  # Top 2 risks
                recommendations.append(f"🔍 重点关注: {risk['assumption'][:50]}...")
        
        elif status == ValidationStatus.PARTIALLY_VALIDATED:
            recommendations.append("⚠️ 创新点需要进一步完善")
            recommendations.append("🔄 重新评估方法组合的可行性")
            recommendations.append("💡 考虑简化问题或调整方法选择")
        
        else:
            recommendations.append("❌ 当前创新点风险较高")
            recommendations.append("🔄 建议重新思考技术路线")
            recommendations.append("👥 考虑寻求专家意见")
        
        if tech_feasibility < 0.5:
            recommendations.append("⚠️ 技术可行性较低，建议先进行技术预研")
        
        if novelty < 0.5:
            recommendations.append("💡 创新性可能不足，建议挖掘更深层次的创新")
        
        return recommendations
    
    def _estimate_resources(
        self,
        experiments: List[Dict]
    ) -> Tuple[str, str]:
        """Estimate time and cost for validation"""
        # Parse time estimates
        total_days = 0
        for exp in experiments:
            time_str = exp.get("estimated_time", "0天")
            # Extract numbers from strings like "3-5天"
            import re
            numbers = re.findall(r'\d+', time_str)
            if numbers:
                avg_days = sum(int(n) for n in numbers) / len(numbers)
                total_days += avg_days
        
        time_estimate = f"{int(total_days)}-{int(total_days*1.5)}天"
        cost_estimate = "中等" if total_days < 10 else "较高"
        
        return time_estimate, cost_estimate
    
    def _generate_next_steps(
        self,
        status: ValidationStatus,
        experiments: List[Dict],
        risks: List[Dict]
    ) -> List[str]:
        """Generate concrete next steps"""
        steps = []
        
        if status == ValidationStatus.VALIDATED:
            steps.append("1. 开始论文大纲设计")
            steps.append("2. 收集相关文献")
            steps.append("3. 设计完整实验方案")
        
        elif status == ValidationStatus.REQUIRES_EXPERIMENT:
            high_priority_exps = [e for e in experiments if e.get("priority") == "high"]
            for i, exp in enumerate(high_priority_exps[:2], 1):
                steps.append(f"{i}. 执行验证实验: {exp['name']}")
            steps.append(f"{len(high_priority_exps)+1}. 根据验证结果决定是否继续")
        
        else:
            steps.append("1. 重新评估创新点假设")
            steps.append("2. 考虑技术方案调整")
            steps.append("3. 与导师/专家讨论可行性")
        
        return steps
    
    def to_dict(self, result: ValidationResult) -> Dict[str, Any]:
        """Convert ValidationResult to dictionary"""
        return {
            "innovation_id": result.innovation_id,
            "status": result.status.value,
            "confidence_score": result.confidence_score,
            "technical_feasibility": result.technical_feasibility,
            "novelty_assessment": result.novelty_assessment,
            "key_assumptions": result.key_assumptions,
            "assumptions_risks": result.assumptions_risks,
            "validation_experiments": result.validation_experiments,
            "estimated_validation_time": result.estimated_validation_time,
            "estimated_cost": result.estimated_cost,
            "is_ready_for_paper": result.is_ready_for_paper,
            "recommendations": result.recommendations,
            "next_steps": result.next_steps,
        }


# Convenience function for API usage
def validate_innovation(
    innovation_id: str,
    target_problem: Dict[str, Any],
    candidate_methods: List[Dict[str, Any]],
    rationale: str,
    supporting_evidence: List[str] = None,
    llm_client=None,
    paper_db=None
) -> Dict[str, Any]:
    """
    Convenience function to validate an innovation.
    
    Returns the validation result as a dictionary for JSON serialization.
    """
    engine = InnovationValidationEngine(llm_client=llm_client, paper_db=paper_db)
    result = engine.validate(
        innovation_id=innovation_id,
        target_problem=target_problem,
        candidate_methods=candidate_methods,
        rationale=rationale,
        supporting_evidence=supporting_evidence
    )
    return engine.to_dict(result)