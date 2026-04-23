"""AutoResearchClaw 适配层 - 实验可行性分类器

判断实验是否可以由 AI 自动执行，还是需要人类参与
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import re


class ExperimentMode(str, Enum):
    """实验执行模式"""
    AI_AUTO = "ai_auto"           # AI 可自动执行（纯软件）
    HUMAN_GUIDED = "human_guided"   # 需要人类按指南执行
    HYBRID = "hybrid"               # 混合模式（部分AI + 部分人工）
    UNKNOWN = "unknown"             # 无法判断


@dataclass
class ExperimentFeasibility:
    """实验可行性评估结果"""
    mode: ExperimentMode
    confidence: float              # 0-1 置信度
    estimated_time: str            # 预计时间
    estimated_cost: Optional[str] # 预计成本
    required_hardware: List[str]   # 所需硬件
    required_software: List[str]   # 所需软件
    risk_factors: List[str]        # 风险因素
    prerequisites: List[str]       # 前置条件
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode.value,
            "confidence": self.confidence,
            "estimated_time": self.estimated_time,
            "estimated_cost": self.estimated_cost,
            "required_hardware": self.required_hardware,
            "required_software": self.required_software,
            "risk_factors": self.risk_factors,
            "prerequisites": self.prerequisites
        }


class ExperimentClassifier:
    """实验可行性分类器
    
    基于创新点描述和实现路径，判断实验类型
    """
    
    # AI 可自动执行的领域关键词
    AI_EXECUTABLE_DOMAINS = {
        "nlp", "natural language processing", "text processing",
        "cv", "computer vision", "image processing",
        "ml", "machine learning", "deep learning",
        "rl", "reinforcement learning",
        "graph neural network", "gnn",
        "transformer", "llm", "language model",
        "classification", "regression", "clustering",
        "generation", "synthesis", "embedding",
        "benchmark", "evaluation", "dataset",
        "algorithm", "optimization", "simulation"
    }
    
    # 需要硬件的领域关键词
    HARDWARE_REQUIRED_DOMAINS = {
        "robotics", "robot", "embodied", "physical",
        "hardware", "sensor", "actuator", "motor",
        "drone", "uav", "vehicle", "autonomous driving",
        "manipulation", "grasping", "locomotion",
        "haptic", "tactile", "force feedback",
        "real world", "physical world", "deployment",
        "fabrication", "manufacturing", "3d printing",
        "chemistry", "biology", "material", "wet lab",
        "medical", "clinical", "surgery", "diagnosis"
    }
    
    # 软件依赖关键词（表明是计算类实验）
    SOFTWARE_INDICATORS = {
        "python", "pytorch", "tensorflow", "jax", "numpy",
        "cuda", "gpu", "training", "inference", "model",
        "code", "implementation", "algorithm", "framework",
        "api", "library", "package", "dependency"
    }
    
    def classify(
        self,
        innovation_title: str,
        problem_statement: str,
        proposed_solution: str,
        required_skills: List[str],
        implementation_path: Optional[List[Dict]] = None
    ) -> ExperimentFeasibility:
        """
        分类实验可行性
        
        Args:
            innovation_title: 创新点标题
            problem_statement: 问题陈述
            proposed_solution: 解决方案
            required_skills: 所需技能列表
            implementation_path: 实现路径步骤
        
        Returns:
            实验可行性评估
        """
        # 合并文本用于分析
        full_text = f"{innovation_title} {problem_statement} {proposed_solution}"
        full_text_lower = full_text.lower()
        
        # 技能分析
        skills_lower = [s.lower() for s in required_skills]
        
        # 计分器
        ai_score = 0.0
        hardware_score = 0.0
        
        # 1. 领域关键词匹配
        for domain in self.AI_EXECUTABLE_DOMAINS:
            if domain in full_text_lower:
                ai_score += 1.0
        
        for domain in self.HARDWARE_REQUIRED_DOMAINS:
            if domain in full_text_lower:
                hardware_score += 2.0  # 硬件权重更高
        
        # 2. 技能分析
        software_skills = {"programming", "python", "pytorch", "tensorflow", 
                          "machine learning", "deep learning", "data processing"}
        hardware_skills = {"hardware", "robotics", "sensor", "embedded", 
                          "mechanical", "electrical", "fabrication"}
        
        for skill in skills_lower:
            if any(s in skill for s in software_skills):
                ai_score += 0.5
            if any(s in skill for s in hardware_skills):
                hardware_score += 1.5
        
        # 3. 实现路径分析
        if implementation_path:
            for step in implementation_path:
                step_text = str(step).lower()
                # 检查是否需要物理操作
                physical_keywords = ["build", "assemble", "construct", "fabricate",
                                   "test on hardware", "real robot", "physical"]
                for pk in physical_keywords:
                    if pk in step_text:
                        hardware_score += 1.0
                
                # 检查是否纯计算
                compute_keywords = ["implement", "code", "train", "evaluate",
                                    "benchmark", "simulate"]
                for ck in compute_keywords:
                    if ck in step_text:
                        ai_score += 0.5
        
        # 4. 综合判断
        total_score = ai_score + hardware_score
        
        if total_score == 0:
            return ExperimentFeasibility(
                mode=ExperimentMode.UNKNOWN,
                confidence=0.3,
                estimated_time="Unknown",
                estimated_cost=None,
                required_hardware=[],
                required_software=[],
                risk_factors=["Unable to determine experiment type from description"],
                prerequisites=["Manual review required"]
            )
        
        ai_ratio = ai_score / total_score
        
        # 决策逻辑
        if hardware_score > 3 or ai_ratio < 0.3:
            # 硬件权重高，需要人类执行
            mode = ExperimentMode.HUMAN_GUIDED
            confidence = min(0.9, 0.5 + hardware_score * 0.1)
        elif ai_ratio > 0.7 and hardware_score < 1:
            # 主要是软件实验
            mode = ExperimentMode.AI_AUTO
            confidence = min(0.95, 0.6 + ai_ratio * 0.3)
        else:
            # 混合模式
            mode = ExperimentMode.HYBRID
            confidence = 0.6
        
        # 生成详细信息
        return self._generate_details(
            mode, confidence, ai_score, hardware_score,
            full_text_lower, skills_lower
        )
    
    def _generate_details(
        self,
        mode: ExperimentMode,
        confidence: float,
        ai_score: float,
        hardware_score: float,
        text_lower: str,
        skills_lower: List[str]
    ) -> ExperimentFeasibility:
        """生成详细的可行性信息"""
        
        # 预估时间
        if mode == ExperimentMode.AI_AUTO:
            if ai_score > 10:
                estimated_time = "2-4 hours (AI automated)"
            elif ai_score > 5:
                estimated_time = "4-8 hours (AI automated)"
            else:
                estimated_time = "8-16 hours (AI automated)"
        elif mode == ExperimentMode.HUMAN_GUIDED:
            if hardware_score > 8:
                estimated_time = "3-6 months (Human execution)"
            elif hardware_score > 5:
                estimated_time = "1-3 months (Human execution)"
            else:
                estimated_time = "2-4 weeks (Human execution)"
        else:
            estimated_time = "1-2 weeks (Hybrid mode)"
        
        # 所需硬件
        required_hardware = []
        hardware_keywords = {
            "gpu": "NVIDIA GPU (RTX 4090 or higher recommended)",
            "robot": "Robotic platform (UR5, Franka, or equivalent)",
            "sensor": "Physical sensors (camera, LiDAR, IMU)",
            "3d printer": "3D printer for prototyping",
            "microcontroller": "Microcontroller (Arduino, Raspberry Pi)",
            "vr": "VR/AR headset (Quest, HoloLens)",
            "cluster": "Compute cluster access"
        }
        
        for keyword, desc in hardware_keywords.items():
            if keyword in text_lower:
                required_hardware.append(desc)
        
        if not required_hardware:
            if mode == ExperimentMode.AI_AUTO:
                required_hardware.append("Standard workstation with GPU (optional)")
            else:
                required_hardware.append("TBD - see detailed guide")
        
        # 所需软件
        required_software = []
        software_keywords = {
            "pytorch": "PyTorch 2.0+",
            "tensorflow": "TensorFlow 2.x",
            "jax": "JAX + Flax",
            "cuda": "CUDA 11.8+",
            "ros": "ROS2 (for robotics)",
            "gazebo": "Gazebo simulation",
            "mujoco": "MuJoCo physics engine",
            "isaac": "NVIDIA Isaac Sim"
        }
        
        for keyword, desc in software_keywords.items():
            if keyword in text_lower:
                required_software.append(desc)
        
        if not required_software:
            required_software.append("Python 3.9+")
            if mode == ExperimentMode.AI_AUTO:
                required_software.append("Standard ML libraries (PyTorch/TensorFlow)")
        
        # 风险因素
        risk_factors = []
        if mode == ExperimentMode.AI_AUTO:
            if "benchmark" not in text_lower and "dataset" not in text_lower:
                risk_factors.append("Dataset availability may affect reproducibility")
            if ai_score > 15:
                risk_factors.append("Complex experiment - may require parameter tuning")
        elif mode == ExperimentMode.HUMAN_GUIDED:
            risk_factors.append("Hardware setup complexity")
            risk_factors.append("Real-world variability affects results")
            if "safety" in text_lower or "human" in text_lower:
                risk_factors.append("Safety considerations for human-robot interaction")
        
        # 前置条件
        prerequisites = []
        if mode == ExperimentMode.AI_AUTO:
            prerequisites.append("Python programming (intermediate)")
            prerequisites.append("Machine learning basics")
            prerequisites.append("Access to GPU (recommended)")
        else:
            prerequisites.append("Hardware assembly skills")
            prerequisites.append("Domain expertise in target area")
            prerequisites.append("Safety training (if applicable)")
        
        return ExperimentFeasibility(
            mode=mode,
            confidence=confidence,
            estimated_time=estimated_time,
            estimated_cost=None,  # 暂不估算成本
            required_hardware=required_hardware,
            required_software=required_software,
            risk_factors=risk_factors,
            prerequisites=prerequisites
        )


# 便捷函数
def classify_experiment(
    title: str,
    problem: str,
    solution: str,
    skills: List[str],
    implementation_path: Optional[List[Dict]] = None
) -> Dict[str, Any]:
    """
    便捷分类函数
    
    Usage:
        result = classify_experiment(
            title="Multi-Agent Reinforcement Learning",
            problem="...",
            solution="...",
            skills=["Python", "PyTorch", "RL"]
        )
    """
    classifier = ExperimentClassifier()
    feasibility = classifier.classify(title, problem, solution, skills, implementation_path)
    return feasibility.to_dict()