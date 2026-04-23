#!/usr/bin/env python3
"""
实验可行性评估测试 (Experiment Feasibility Evaluator Tests)

测试ExperimentFeasibilityEvaluator的各个评估维度和风险分类
"""

import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'app', 'services', 'paper_generation'))

from feasibility_evaluator import (
    ExperimentFeasibilityEvaluator,
    RiskLevel,
    evaluate_experiment_feasibility
)


class TestExperimentFeasibilityEvaluator:
    """实验可行性评估器测试类"""
    
    @pytest.fixture
    def evaluator(self):
        """创建评估器实例"""
        return ExperimentFeasibilityEvaluator()
    
    @pytest.fixture
    def sample_experiment_design(self):
        """示例实验设计"""
        return {
            "slots": [
                {
                    "slot_id": "exp_1",
                    "type": "main_performance",
                    "description": "Main performance evaluation",
                    "estimated_weeks": 2,
                    "compute_requirements": "high"
                },
                {
                    "slot_id": "exp_2",
                    "type": "ablation_study",
                    "description": "Ablation study for components",
                    "estimated_weeks": 1,
                    "compute_requirements": "medium"
                },
                {
                    "slot_id": "exp_3",
                    "type": "robustness_analysis",
                    "description": "Robustness under various conditions",
                    "estimated_weeks": 1,
                    "compute_requirements": "medium"
                }
            ],
            "resources": {
                "compute_budget": 100,
                "data_access": 80,
                "equipment": 60
            },
            "timeline": "4 weeks",
            "dependencies": []
        }
    
    # ==================== 核心评估函数测试 ====================
    
    def test_evaluate_complete_design(self, evaluator, sample_experiment_design):
        """测试完整实验设计评估"""
        result = evaluator.evaluate(sample_experiment_design)
        
        # 验证返回值结构
        assert "overall_score" in result
        assert "breakdown" in result
        assert "slot_evaluations" in result
        assert "recommendations" in result
        assert "risk_mitigation" in result
        assert "estimated_total_weeks" in result
        assert "passes_minimum" in result
        
        # 验证breakdown结构
        breakdown = result["breakdown"]
        assert "technical_feasibility" in breakdown
        assert "time_cost" in breakdown
        assert "resource_demand" in breakdown
        assert "risk_level" in breakdown
        assert "expected_success_rate" in breakdown
    
    def test_evaluate_dimension_scores(self, evaluator, sample_experiment_design):
        """测试评估维度分数 (0-100范围)"""
        result = evaluator.evaluate(sample_experiment_design)
        breakdown = result["breakdown"]
        
        # 验证分数在0-100范围内
        assert 0 <= breakdown["technical_feasibility"] <= 100
        assert 0 <= breakdown["time_cost"] <= 100
        assert 0 <= breakdown["resource_demand"] <= 100
        assert 0 <= breakdown["expected_success_rate"] <= 100
        assert 0 <= result["overall_score"] <= 100
    
    def test_evaluate_empty_slots(self, evaluator):
        """测试空实验槽评估"""
        empty_design = {
            "slots": [],
            "resources": {},
            "dependencies": []
        }
        
        result = evaluator.evaluate(empty_design)
        
        assert result["breakdown"]["technical_feasibility"] >= 0
        assert result["estimated_total_weeks"] == 0
    
    # ==================== 风险等级分类测试 ====================
    
    def test_risk_level_low(self, evaluator):
        """测试低风险分类"""
        low_risk_design = {
            "slots": [
                {
                    "slot_id": "exp_1",
                    "type": "main_performance",
                    "estimated_weeks": 1
                }
            ],
            "resources": {
                "compute_budget": 100,
                "data_access": 100,
                "equipment": 100
            },
            "dependencies": []
        }
        
        result = evaluator.evaluate(low_risk_design)
        
        assert result["breakdown"]["risk_level"] == "low"
        assert result["breakdown"]["expected_success_rate"] >= 80
    
    def test_risk_level_medium(self, evaluator):
        """测试中风险分类"""
        medium_risk_design = {
            "slots": [
                {"slot_id": "exp_1", "type": "user_study", "estimated_weeks": 4},
                {"slot_id": "exp_2", "type": "cross_domain_validation", "estimated_weeks": 2}
            ],
            "resources": {
                "compute_budget": 60,
                "data_access": 60,
                "equipment": 50
            },
            "dependencies": ["external_dependencies"]
        }
        
        result = evaluator.evaluate(medium_risk_design)
        
        # 中高风险可能
        assert result["breakdown"]["risk_level"] in ["medium", "high"]
    
    def test_risk_level_high(self, evaluator):
        """测试高风险分类"""
        high_risk_design = {
            "slots": [
                {"slot_id": "exp_1", "type": "hardware_validation", "estimated_weeks": 3},
                {"slot_id": "exp_2", "type": "data_collection", "estimated_weeks": 4},
                {"slot_id": "exp_3", "type": "user_study", "estimated_weeks": 4}
            ],
            "resources": {
                "compute_budget": 30,
                "data_access": 30,
                "equipment": 40
            },
            "dependencies": ["new_hardware", "untested_method", "tight_deadline"]
        }
        
        result = evaluator.evaluate(high_risk_design)
        
        assert result["breakdown"]["risk_level"] in ["high", "critical"]
        assert result["breakdown"]["expected_success_rate"] < 70
    
    def test_risk_level_critical(self, evaluator):
        """测试极高风险分类"""
        critical_design = {
            "slots": [
                {"slot_id": "exp_1", "type": "hardware_validation", "estimated_weeks": 3},
                {"slot_id": "exp_2", "type": "data_collection", "estimated_weeks": 4},
                {"slot_id": "exp_3", "type": "user_study", "estimated_weeks": 4},
                {"slot_id": "exp_4", "type": "cross_domain_validation", "estimated_weeks": 3}
            ],
            "resources": {
                "compute_budget": 20,
                "data_access": 20,
                "equipment": 20
            },
            "dependencies": [
                "new_hardware", "new_dataset", "untested_method",
                "tight_deadline", "external_dependencies", "expensive_compute"
            ]
        }
        
        result = evaluator.evaluate(critical_design)
        
        # 极高风险应该返回critical或high
        assert result["breakdown"]["risk_level"] in ["high", "critical"]
        assert not result["passes_minimum"]
    
    # ==================== 建议生成测试 ====================
    
    def test_recommendations_generated(self, evaluator, sample_experiment_design):
        """测试建议生成"""
        result = evaluator.evaluate(sample_experiment_design)
        
        assert len(result["recommendations"]) > 0
        # 建议应该是字符串列表
        for rec in result["recommendations"]:
            assert isinstance(rec, str)
            assert len(rec) > 0
    
    def test_risk_mitigation_generated(self, evaluator, sample_experiment_design):
        """测试风险缓解策略生成"""
        result = evaluator.evaluate(sample_experiment_design)
        
        assert len(result["risk_mitigation"]) > 0
        # 缓解策略应该是字符串列表
        for mitigation in result["risk_mitigation"]:
            assert isinstance(mitigation, str)
            assert len(mitigation) > 0
    
    def test_slot_specific_recommendations(self, evaluator):
        """测试实验槽特定建议"""
        design_with_gaps = {
            "slots": [
                {
                    "slot_id": "exp_1",
                    "type": "main_performance",
                    "estimated_weeks": 3
                }
            ],
            "resources": {
                "compute_budget": 50,  # 低于需求
                "data_access": 40      # 低于需求
            },
            "dependencies": []
        }
        
        result = evaluator.evaluate(design_with_gaps)
        
        # 应该有资源相关的建议
        assert any(
            "resource" in rec.lower() or "gap" in rec.lower()
            for rec in result["recommendations"]
        )
    
    # ==================== 实验槽评估测试 ====================
    
    def test_evaluate_slot_main_performance(self, evaluator):
        """测试主性能评估槽"""
        slot = {
            "slot_id": "exp_1",
            "type": "main_performance",
            "description": "Main evaluation"
        }
        resources = {"compute_budget": 80, "data_access": 70}
        
        result = evaluator._evaluate_slot(slot, resources)
        
        assert result["slot_id"] == "exp_1"
        assert result["type"] == "main_performance"
        assert "feasibility_score" in result
        assert "resource_requirements" in result
        assert "estimated_weeks" in result
    
    def test_evaluate_slot_with_resource_gaps(self, evaluator):
        """测试资源不足的实验槽"""
        slot = {
            "slot_id": "exp_1",
            "type": "main_performance"
        }
        resources = {"compute_budget": 50, "data_access": 40}  # 低于profile需求
        
        result = evaluator._evaluate_slot(slot, resources)
        
        # 应该有资源缺口
        assert len(result["resource_gaps"]) > 0
        assert result["feasibility_score"] < 100
    
    def test_evaluate_slot_user_study(self, evaluator):
        """测试用户研究槽的特殊风险识别"""
        slot = {
            "slot_id": "exp_user",
            "type": "user_study",
            "description": "User study"
        }
        resources = {"compute_budget": 100, "data_access": 100}
        
        result = evaluator._evaluate_slot(slot, resources)
        
        # 用户研究应该识别特定风险
        assert any(
            "human" in risk.lower() or "recruitment" in risk.lower()
            for risk in result["risks"]
        )
    
    def test_evaluate_slot_cross_domain(self, evaluator):
        """测试跨域验证槽的特殊风险识别"""
        slot = {
            "slot_id": "exp_cross",
            "type": "cross_domain_validation"
        }
        resources = {"compute_budget": 90, "data_access": 80}
        
        result = evaluator._evaluate_slot(slot, resources)
        
        # 跨域验证应该识别特定风险
        assert any(
            "cross-domain" in risk.lower() or "domain" in risk.lower()
            for risk in result["risks"]
        )
    
    # ==================== 评分计算测试 ====================
    
    def test_calculate_technical_feasibility(self, evaluator):
        """测试技术可行性评分"""
        evaluations = [
            {"feasibility_score": 90, "resource_gaps": []},
            {"feasibility_score": 80, "resource_gaps": []}
        ]
        
        score = evaluator._calculate_technical_feasibility(evaluations)
        
        assert 0 <= score <= 100
        # 平均分85，无资源缺口惩罚
        assert score == 85
    
    def test_calculate_technical_feasibility_with_gaps(self, evaluator):
        """测试有资源缺口的技术可行性评分"""
        evaluations = [
            {"feasibility_score": 90, "resource_gaps": ["gap1", "gap2"]},
            {"feasibility_score": 80, "resource_gaps": ["gap3"]}
        ]
        
        score = evaluator._calculate_technical_feasibility(evaluations)
        
        # 平均分85，3个缺口惩罚15分，但最低30
        assert score < 85
        assert score >= 30
    
    def test_calculate_time_cost(self, evaluator):
        """测试时间成本评分"""
        # 1-2周: 95分
        short_evaluations = [
            {"estimated_weeks": 1},
            {"estimated_weeks": 1}
        ]
        short_score = evaluator._calculate_time_cost(short_evaluations)
        assert short_score == 95
        
        # 3-4周: 80分
        medium_evaluations = [
            {"estimated_weeks": 2},
            {"estimated_weeks": 2}
        ]
        medium_score = evaluator._calculate_time_cost(medium_evaluations)
        assert medium_score == 80
        
        # 5-6周: 65分
        long_evaluations = [
            {"estimated_weeks": 3},
            {"estimated_weeks": 3}
        ]
        long_score = evaluator._calculate_time_cost(long_evaluations)
        assert long_score == 65
    
    def test_calculate_resource_demand(self, evaluator):
        """测试资源需求评分"""
        evaluations = [
            {"resource_requirements": {"compute": 70, "data": 60}},
            {"resource_requirements": {"compute": 50, "data": 40}}
        ]
        resources = {"compute_budget": 100, "data_access": 100}
        
        score = evaluator._calculate_resource_demand(evaluations, resources)
        
        assert 0 <= score <= 100
        # 平均需求: compute 60, data 50 -> 55
        assert score == 55
    
    def test_calculate_resource_demand_insufficient(self, evaluator):
        """测试资源不足的评分"""
        evaluations = [
            {"resource_requirements": {"compute": 80, "data": 70}}
        ]
        resources = {"compute_budget": 50, "data_access": 40}  # 不足
        
        score = evaluator._calculate_resource_demand(evaluations, resources)
        
        # 应该增加惩罚分（更高表示更差）
        assert score > 55
    
    def test_estimate_success_rate(self, evaluator):
        """测试成功率估算"""
        # 低风险: 高成功率
        low_risk_rate = evaluator._estimate_success_rate(
            [{"feasibility_score": 90}],
            RiskLevel.LOW
        )
        assert low_risk_rate >= 80
        
        # 中风险: 中等成功率
        medium_risk_rate = evaluator._estimate_success_rate(
            [{"feasibility_score": 80}],
            RiskLevel.MEDIUM
        )
        assert 60 <= medium_risk_rate <= 85
        
        # 高风险: 低成功率
        high_risk_rate = evaluator._estimate_success_rate(
            [{"feasibility_score": 70}],
            RiskLevel.HIGH
        )
        assert high_risk_rate < 70
        
        # 极高风险: 很低成功率
        critical_risk_rate = evaluator._estimate_success_rate(
            [{"feasibility_score": 60}],
            RiskLevel.CRITICAL
        )
        assert critical_risk_rate < 50
    
    # ==================== 快速检查测试 ====================
    
    def test_quick_check_feasible(self, evaluator):
        """测试快速检查 - 可行"""
        result = evaluator.quick_check(
            "ablation_study",
            {"compute_budget": 80, "data_access": 80, "equipment": 80}
        )
        
        assert result["feasible"] is True
        assert result["feasibility_score"] >= 60
        assert result["recommendation"] == "Proceed"
    
    def test_quick_check_infeasible(self, evaluator):
        """测试快速检查 - 不可行"""
        result = evaluator.quick_check(
            "cross_domain_validation",
            {"compute_budget": 30, "data_access": 30, "equipment": 20}
        )
        
        assert result["feasible"] is False
        assert result["feasibility_score"] < 60
        assert "Revise" in result["recommendation"]
    
    def test_quick_check_resource_gaps(self, evaluator):
        """测试快速检查的资源缺口检测"""
        result = evaluator.quick_check(
            "main_performance",
            {"compute_budget": 50, "data_access": 100, "equipment": 100}
        )
        
        assert "compute" in result["resource_gaps"]
        assert result["estimated_weeks"] > 0
    
    # ==================== 便捷函数测试 ====================
    
    def test_convenience_function(self):
        """测试便捷函数evaluate_experiment_feasibility"""
        design = {
            "slots": [
                {"slot_id": "exp_1", "type": "main_performance"}
            ],
            "resources": {"compute_budget": 80},
            "dependencies": []
        }
        
        result = evaluate_experiment_feasibility(design)
        
        assert "overall_score" in result
        assert "breakdown" in result
        assert isinstance(result["overall_score"], int)
    
    # ==================== 边界情况测试 ====================
    
    def test_empty_dependencies(self, evaluator):
        """测试空依赖"""
        design = {
            "slots": [],
            "resources": {},
            "dependencies": []
        }
        
        result = evaluator.evaluate(design)
        
        assert result["breakdown"]["risk_level"] == "low"
        assert result["estimated_total_weeks"] == 0
    
    def test_unknown_slot_type(self, evaluator):
        """测试未知实验类型"""
        design = {
            "slots": [
                {"slot_id": "exp_1", "type": "unknown_type"}
            ],
            "resources": {"compute_budget": 100},
            "dependencies": []
        }
        
        result = evaluator.evaluate(design)
        
        # 应该使用默认配置
        assert result["breakdown"]["technical_feasibility"] >= 0
    
    def test_invalid_weeks_estimation(self, evaluator):
        """测试无效周数估计"""
        design = {
            "slots": [
                {"slot_id": "exp_1", "type": "main_performance", "estimated_weeks": -1}
            ],
            "resources": {},
            "dependencies": []
        }
        
        result = evaluator.evaluate(design)
        
        # 应该能处理负数，使用默认值
        assert result["estimated_total_weeks"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
