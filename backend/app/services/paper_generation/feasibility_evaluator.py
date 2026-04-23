"""
Experiment Feasibility Evaluator
Assesses the practicality and risk of proposed experiments
"""

import logging
from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    """Risk levels for experiments"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class FeasibilityScore:
    """Feasibility score breakdown"""
    technical_feasibility: int  # 0-100
    time_cost: int  # 0-100 (lower is better)
    resource_demand: int  # 0-100 (lower is better)
    risk_level: RiskLevel
    expected_success_rate: int  # 0-100


class ExperimentFeasibilityEvaluator:
    """
    Evaluates the feasibility of experimental designs.
    
    Assess dimensions:
    - Technical feasibility (can it be built?)
    - Time cost (how long will it take?)
    - Resource requirements (compute, data, equipment)
    - Risk level (what could go wrong?)
    - Expected success rate (probability of success)
    
    Provides recommendations and risk mitigation strategies.
    """
    
    # Known resource requirements for common experiment types
    RESOURCE_PROFILES = {
        "main_performance": {
            "compute": 70,  # GPU hours
            "data": 50,  # Data availability
            "equipment": 10,
            "typical_weeks": 2
        },
        "ablation_study": {
            "compute": 60,
            "data": 30,
            "equipment": 10,
            "typical_weeks": 1
        },
        "robustness_analysis": {
            "compute": 50,
            "data": 40,
            "equipment": 20,
            "typical_weeks": 1
        },
        "cross_domain_validation": {
            "compute": 80,
            "data": 70,
            "equipment": 30,
            "typical_weeks": 2
        },
        "data_collection": {
            "compute": 30,
            "data": 90,
            "equipment": 60,
            "typical_weeks": 3
        },
        "user_study": {
            "compute": 20,
            "data": 80,
            "equipment": 40,
            "typical_weeks": 4
        },
        "hardware_validation": {
            "compute": 40,
            "data": 50,
            "equipment": 90,
            "typical_weeks": 3
        }
    }
    
    # Risk factors and their weights
    RISK_FACTORS = {
        "new_dataset": 15,
        "new_hardware": 20,
        "human_subjects": 10,
        "expensive_compute": 15,
        "external_dependencies": 20,
        "untested_method": 25,
        "tight_deadline": 15
    }
    
    def __init__(self):
        self.issues = []
        self.recommendations = []
        self.risk_mitigation = []
    
    def evaluate(self, experiment_design: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate experiment feasibility.
        
        Args:
            experiment_design: Dictionary containing experiment details
                {
                    "slots": [...],
                    "resources": {...},
                    "timeline": "...",
                    "dependencies": [...]
                }
        
        Returns:
            Feasibility report with scores and recommendations
        """
        self.issues = []
        self.recommendations = []
        self.risk_mitigation = []
        
        slots = experiment_design.get("slots", [])
        resources = experiment_design.get("resources", {})
        dependencies = experiment_design.get("dependencies", [])
        
        # Evaluate each slot
        slot_evaluations = []
        for slot in slots:
            eval_result = self._evaluate_slot(slot, resources)
            slot_evaluations.append(eval_result)
        
        # Calculate overall scores
        technical_score = self._calculate_technical_feasibility(slot_evaluations)
        time_score = self._calculate_time_cost(slot_evaluations)
        resource_score = self._calculate_resource_demand(slot_evaluations, resources)
        risk_level = self._assess_risk(slot_evaluations, dependencies)
        success_rate = self._estimate_success_rate(slot_evaluations, risk_level)
        
        # Generate recommendations
        self._generate_recommendations(slot_evaluations, resources)
        self._generate_risk_mitigation(slot_evaluations, risk_level)
        
        overall_score = self._calculate_overall_score(
            technical_score, time_score, resource_score, success_rate
        )
        
        return {
            "overall_score": overall_score,
            "breakdown": {
                "technical_feasibility": technical_score,
                "time_cost": time_score,
                "resource_demand": resource_score,
                "risk_level": risk_level.value,
                "expected_success_rate": success_rate
            },
            "slot_evaluations": slot_evaluations,
            "recommendations": self.recommendations,
            "risk_mitigation": self.risk_mitigation,
            "estimated_total_weeks": sum(e.get("estimated_weeks", 1) for e in slot_evaluations),
            "passes_minimum": overall_score >= 60 and risk_level not in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        }
    
    def _evaluate_slot(self, slot: Dict, available_resources: Dict) -> Dict[str, Any]:
        """Evaluate a single experiment slot"""
        slot_type = slot.get("type", "unknown")
        slot_id = slot.get("slot_id", "unknown")
        
        # Get resource profile
        profile = self.RESOURCE_PROFILES.get(slot_type, {
            "compute": 50, "data": 50, "equipment": 50, "typical_weeks": 2
        })
        
        # Check resource availability
        resource_gaps = []
        
        available_compute = available_resources.get("compute_budget", 100)
        if profile["compute"] > available_compute:
            resource_gaps.append(f"Insufficient compute: need {profile['compute']}, have {available_compute}")
        
        available_data = available_resources.get("data_access", 100)
        if profile["data"] > available_data:
            resource_gaps.append(f"Data access challenges: need {profile['data']}, have {available_data}")
        
        available_equipment = available_resources.get("equipment", 100)
        if profile["equipment"] > available_equipment:
            resource_gaps.append(f"Equipment requirements: need {profile['equipment']}, have {available_equipment}")
        
        # Calculate slot-specific score
        if resource_gaps:
            feasibility = max(30, 100 - len(resource_gaps) * 25)
        else:
            feasibility = 90 + (10 - profile["compute"] // 10)
        
        return {
            "slot_id": slot_id,
            "type": slot_type,
            "feasibility_score": min(100, feasibility),
            "estimated_weeks": slot.get("estimated_weeks", profile["typical_weeks"]),
            "resource_requirements": profile,
            "resource_gaps": resource_gaps,
            "risks": self._identify_slot_risks(slot, profile),
            "recommendations": self._get_slot_recommendations(slot, profile, resource_gaps)
        }
    
    def _identify_slot_risks(self, slot: Dict, profile: Dict) -> List[str]:
        """Identify risks for a specific slot"""
        risks = []
        slot_type = slot.get("type", "")
        
        if profile["compute"] > 70:
            risks.append("High compute requirements may cause delays")
        
        if profile["data"] > 70:
            risks.append("Data collection may take longer than estimated")
        
        if profile["equipment"] > 70:
            risks.append("Equipment dependency is a single point of failure")
        
        if slot_type == "user_study":
            risks.append("Human subject recruitment can be unpredictable")
        
        if slot_type == "cross_domain_validation":
            risks.append("Cross-domain results may be inconsistent")
        
        return risks
    
    def _get_slot_recommendations(self, slot: Dict, profile: Dict, gaps: List[str]) -> List[str]:
        """Get recommendations for a specific slot"""
        recs = []
        slot_type = slot.get("type", "")
        
        if gaps:
            recs.append("Secure required resources before starting")
        
        if profile["compute"] > 60:
            recs.append("Consider cloud compute options for scalability")
        
        if slot_type == "ablation_study":
            recs.append("Start with most important components first")
        
        if slot_type == "robustness_analysis":
            recs.append("Use synthetic data augmentation if real data is limited")
        
        return recs
    
    def _calculate_technical_feasibility(self, evaluations: List[Dict]) -> int:
        """Calculate overall technical feasibility (0-100)"""
        if not evaluations:
            return 50
        
        scores = [e["feasibility_score"] for e in evaluations]
        avg_score = sum(scores) / len(scores)
        
        # Penalize for resource gaps
        gap_count = sum(len(e.get("resource_gaps", [])) for e in evaluations)
        penalty = min(30, gap_count * 5)
        
        return int(max(0, avg_score - penalty))
    
    def _calculate_time_cost(self, evaluations: List[Dict]) -> int:
        """
        Calculate time cost score (0-100, lower is better/cheaper).
        Returns score based on total estimated time.
        """
        total_weeks = sum(e.get("estimated_weeks", 2) for e in evaluations)
        
        # Scoring: 1-2 weeks = 90-100, 3-4 weeks = 70-89, 5-6 weeks = 50-69, 7+ weeks = <50
        if total_weeks <= 2:
            return 95
        elif total_weeks <= 4:
            return 80
        elif total_weeks <= 6:
            return 65
        elif total_weeks <= 8:
            return 50
        else:
            return max(20, 100 - total_weeks * 5)
    
    def _calculate_resource_demand(self, evaluations: List[Dict], available: Dict) -> int:
        """
        Calculate resource demand score (0-100, lower is better/less demanding).
        """
        if not evaluations:
            return 50
        
        total_compute = sum(
            e["resource_requirements"].get("compute", 50) for e in evaluations
        ) / len(evaluations)
        
        total_data = sum(
            e["resource_requirements"].get("data", 50) for e in evaluations
        ) / len(evaluations)
        
        # Combined score - higher means more demanding (worse)
        demand = (total_compute + total_data) / 2
        
        # Check availability
        compute_budget = available.get("compute_budget", 100)
        data_access = available.get("data_access", 100)
        
        if total_compute > compute_budget:
            demand += 20
        if total_data > data_access:
            demand += 20
        
        return int(min(100, demand))
    
    def _assess_risk(self, evaluations: List[Dict], dependencies: List[str]) -> RiskLevel:
        """Assess overall risk level"""
        risk_score = 0
        
        # Count risks from all slots
        for eval in evaluations:
            risk_score += len(eval.get("risks", [])) * 5
            risk_score += len(eval.get("resource_gaps", [])) * 10
        
        # Add dependency risks
        for dep in dependencies:
            risk_score += self.RISK_FACTORS.get(dep, 10)
        
        # Determine level
        if risk_score >= 80:
            return RiskLevel.CRITICAL
        elif risk_score >= 50:
            return RiskLevel.HIGH
        elif risk_score >= 25:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    def _estimate_success_rate(self, evaluations: List[Dict], risk_level: RiskLevel) -> int:
        """Estimate probability of successful completion"""
        base_rate = 85  # Assume 85% base success
        
        # Adjust for feasibility scores
        avg_feasibility = sum(e["feasibility_score"] for e in evaluations) / len(evaluations) if evaluations else 50
        base_rate = (base_rate + avg_feasibility) / 2
        
        # Adjust for risk
        risk_adjustment = {
            RiskLevel.LOW: 0,
            RiskLevel.MEDIUM: -10,
            RiskLevel.HIGH: -25,
            RiskLevel.CRITICAL: -40
        }
        
        adjusted_rate = base_rate + risk_adjustment.get(risk_level, 0)
        return int(max(10, min(95, adjusted_rate)))
    
    def _generate_recommendations(self, evaluations: List[Dict], resources: Dict):
        """Generate overall recommendations"""
        self.recommendations = []
        
        # Check for common patterns
        high_compute_slots = [e for e in evaluations if e["resource_requirements"].get("compute", 0) > 70]
        if high_compute_slots:
            self.recommendations.append(
                f"Consider parallelizing {len(high_compute_slots)} high-compute experiments"
            )
        
        # Check timeline
        total_weeks = sum(e.get("estimated_weeks", 2) for e in evaluations)
        if total_weeks > 6:
            self.recommendations.append(
                f"Timeline is aggressive ({total_weeks} weeks). Consider prioritizing critical experiments."
            )
        
        # Check resource gaps
        all_gaps = []
        for e in evaluations:
            all_gaps.extend(e.get("resource_gaps", []))
        
        if all_gaps:
            self.recommendations.append(
                f"Address {len(all_gaps)} resource gaps before starting experiments"
            )
        
        # General recommendations
        self.recommendations.extend([
            "Set up automated experiment tracking from day one",
            "Prepare backup plans for high-risk experiments",
            "Schedule regular checkpoints to assess progress"
        ])
    
    def _generate_risk_mitigation(self, evaluations: List[Dict], risk_level: RiskLevel):
        """Generate risk mitigation strategies"""
        self.risk_mitigation = []
        
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            self.risk_mitigation.append("Consider reducing experiment scope or extending timeline")
            self.risk_mitigation.append("Identify fallback experiments that require fewer resources")
        
        # Slot-specific mitigations
        for eval in evaluations:
            slot_type = eval.get("type", "")
            if slot_type == "user_study":
                self.risk_mitigation.append(
                    f"For {eval['slot_id']}: Start recruitment early and have backup participants"
                )
            elif slot_type == "cross_domain_validation":
                self.risk_mitigation.append(
                    f"For {eval['slot_id']}: Validate on one domain first before expanding"
                )
            elif eval.get("resource_gaps"):
                self.risk_mitigation.append(
                    f"For {eval['slot_id']}: Secure alternative resources or simplify design"
                )
        
        # General mitigations
        self.risk_mitigation.extend([
            "Document all experiment parameters for reproducibility",
            "Set up monitoring to detect issues early",
            "Have a contingency plan for each critical experiment"
        ])
    
    def _calculate_overall_score(self, technical: int, time: int, resource: int, success: int) -> int:
        """Calculate overall feasibility score"""
        # Weights: technical 30%, time 25%, resource 25%, success 20%
        score = (
            technical * 0.30 +
            time * 0.25 +
            (100 - resource) * 0.25 +  # Invert resource (lower is better)
            success * 0.20
        )
        return int(score)
    
    def quick_check(self, slot_type: str, available_resources: Dict) -> Dict[str, Any]:
        """
        Quick feasibility check for a single experiment type.
        
        Useful for rapid assessment during experiment design.
        """
        profile = self.RESOURCE_PROFILES.get(slot_type, {
            "compute": 50, "data": 50, "equipment": 50, "typical_weeks": 2
        })
        
        gaps = []
        
        if profile["compute"] > available_resources.get("compute_budget", 100):
            gaps.append("compute")
        if profile["data"] > available_resources.get("data_access", 100):
            gaps.append("data")
        if profile["equipment"] > available_resources.get("equipment", 100):
            gaps.append("equipment")
        
        feasibility = 100 - len(gaps) * 30
        
        return {
            "feasible": feasibility >= 60,
            "feasibility_score": feasibility,
            "resource_gaps": gaps,
            "estimated_weeks": profile["typical_weeks"],
            "recommendation": "Proceed" if feasibility >= 60 else "Revise design or secure more resources"
        }


# Convenience function for direct usage
def evaluate_experiment_feasibility(experiment_design: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate experiment feasibility - convenience function.
    
    Args:
        experiment_design: Experiment design dictionary
        
    Returns:
        Feasibility report
    """
    evaluator = ExperimentFeasibilityEvaluator()
    return evaluator.evaluate(experiment_design)
