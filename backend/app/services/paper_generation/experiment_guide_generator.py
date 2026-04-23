"""
Experiment Guide Generator
Generates detailed experiment execution guides for human researchers.
Converts abstract experiment designs into concrete, actionable instructions.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ExperimentStep:
    """A single step in the experiment procedure"""
    step_number: int
    title: str
    description: str
    estimated_time: str  # e.g., "2 hours"
    materials_needed: List[str]
    critical_points: List[str]  # Things that must be done correctly
    checkpoints: List[str]  # How to verify this step is done correctly


@dataclass
class ExperimentGuide:
    """Complete guide for executing an experiment"""
    experiment_id: str
    experiment_name: str
    objective: str
    expected_outcome: str
    
    # Materials and setup
    materials: List[Dict[str, Any]]  # [{"name": "...", "quantity": "...", "source": "..."}]
    equipment: List[Dict[str, Any]]  # [{"name": "...", "specs": "...", "alternative": "..."}]
    software_requirements: List[str]
    
    # Procedure
    preparation_steps: List[str]  # Setup before starting
    main_procedure: List[ExperimentStep]
    cleanup_steps: List[str]
    
    # Data collection
    data_to_collect: List[Dict[str, Any]]  # [{"metric": "...", "method": "...", "frequency": "..."}]
    expected_data_format: Dict[str, Any]  # Schema for data files
    
    # Safety and validation
    safety_notes: List[str]
    common_pitfalls: List[str]
    validation_criteria: List[str]  # How to know the experiment succeeded
    
    # Results interpretation
    success_indicators: List[str]
    failure_indicators: List[str]
    next_steps_if_success: List[str]
    next_steps_if_failure: List[str]
    
    # Metadata
    estimated_total_time: str
    difficulty_level: str  # beginner, intermediate, advanced
    prerequisite_knowledge: List[str]
    references: List[str]


class ExperimentGuideGenerator:
    """
    Generates comprehensive experiment guides from innovation opportunities.
    
    Takes an innovation opportunity (problem + method) and generates:
    1. Detailed experiment procedure
    2. Material and equipment list
    3. Data collection protocol
    4. Validation criteria
    5. Troubleshooting guide
    """
    
    def __init__(self, llm_client=None):
        self.llm_client = llm_client
    
    def generate_guide(
        self,
        innovation_id: str,
        target_problem: Dict[str, Any],
        candidate_methods: List[Dict[str, Any]],
        rationale: str,
        feasibility_score: float,
        novelty_score: float
    ) -> ExperimentGuide:
        """
        Generate a complete experiment guide from an innovation opportunity.
        
        Args:
            innovation_id: Unique identifier for this innovation
            target_problem: Problem definition dict
            candidate_methods: List of methods to combine/adapt
            rationale: Why this combination might work
            feasibility_score: Predicted feasibility (0-1)
            novelty_score: Predicted novelty (0-1)
        
        Returns:
            ExperimentGuide: Complete guide for human execution
        """
        
        # Build experiment name from problem and methods
        experiment_name = self._generate_experiment_name(
            target_problem, candidate_methods
        )
        
        # Generate the full guide
        guide = ExperimentGuide(
            experiment_id=f"exp_{innovation_id}",
            experiment_name=experiment_name,
            objective=self._generate_objective(target_problem, candidate_methods),
            expected_outcome=self._generate_expected_outcome(target_problem, candidate_methods),
            
            materials=self._generate_materials_list(target_problem, candidate_methods),
            equipment=self._generate_equipment_list(target_problem, candidate_methods),
            software_requirements=self._generate_software_requirements(candidate_methods),
            
            preparation_steps=self._generate_preparation_steps(target_problem, candidate_methods),
            main_procedure=self._generate_main_procedure(target_problem, candidate_methods, rationale),
            cleanup_steps=self._generate_cleanup_steps(),
            
            data_to_collect=self._generate_data_collection_protocol(target_problem, candidate_methods),
            expected_data_format=self._generate_data_format(),
            
            safety_notes=self._generate_safety_notes(target_problem, candidate_methods),
            common_pitfalls=self._generate_common_pitfalls(target_problem, candidate_methods),
            validation_criteria=self._generate_validation_criteria(target_problem),
            
            success_indicators=self._generate_success_indicators(target_problem),
            failure_indicators=self._generate_failure_indicators(target_problem),
            next_steps_if_success=self._generate_next_steps_success(target_problem, candidate_methods),
            next_steps_if_failure=self._generate_next_steps_failure(target_problem, candidate_methods),
            
            estimated_total_time=self._estimate_time(feasibility_score, len(candidate_methods)),
            difficulty_level=self._determine_difficulty(feasibility_score, novelty_score),
            prerequisite_knowledge=self._determine_prerequisites(candidate_methods),
            references=self._extract_references(target_problem, candidate_methods)
        )
        
        return guide
    
    def _generate_experiment_name(self, problem: Dict, methods: List[Dict]) -> str:
        """Generate a descriptive experiment name"""
        problem_name = problem.get('name', 'Unknown Problem')[:50]
        method_names = [m.get('name', 'Unknown')[:30] for m in methods[:2]]
        return f"验证{problem_name}通过{'与'.join(method_names)}"
    
    def _generate_objective(self, problem: Dict, methods: List[Dict]) -> str:
        """Generate clear experiment objective"""
        problem_def = problem.get('definition', problem.get('description', ''))
        return f"验证以下假设：通过结合使用{len(methods)}种方法，可以有效解决'{problem_def[:100]}...'所描述的问题"
    
    def _generate_expected_outcome(self, problem: Dict, methods: List[Dict]) -> str:
        """Generate expected outcome description"""
        return f"实验成功将证明：所选方法组合能有效解决目标问题，产生可量化的改进指标"
    
    def _generate_materials_list(self, problem: Dict, methods: List[Dict]) -> List[Dict[str, Any]]:
        """Generate list of required materials"""
        # Template materials based on problem domain
        domain = problem.get('domain', 'General')
        
        base_materials = [
            {"name": "实验记录本", "quantity": "1本", "source": "办公用品", "purpose": "记录实验过程和观察"},
            {"name": "数据存储介质", "quantity": "≥100GB", "source": "计算资源", "purpose": "存储实验数据和中间结果"},
        ]
        
        # Add domain-specific materials
        if 'vision' in domain.lower() or 'image' in domain.lower():
            base_materials.extend([
                {"name": "图像数据集", "quantity": "依实验规模", "source": "公开数据集或自建", "purpose": "模型训练和评估"},
                {"name": "标注工具", "quantity": "1套", "source": "LabelImg/VIA等", "purpose": "数据标注验证"},
            ])
        
        if 'robot' in domain.lower() or 'manipulation' in domain.lower():
            base_materials.extend([
                {"name": "机器人平台", "quantity": "1台", "source": "实验室设备", "purpose": "实验执行"},
                {"name": "测试对象", "quantity": "依实验设计", "source": "实验材料", "purpose": "操作目标"},
            ])
        
        return base_materials
    
    def _generate_equipment_list(self, problem: Dict, methods: List[Dict]) -> List[Dict[str, Any]]:
        """Generate required equipment list"""
        equipment = [
            {"name": "计算工作站", "specs": "GPU: NVIDIA RTX 3090或同等, RAM: ≥32GB", 
             "alternative": "云服务器(AWS/GCP) with GPU实例", "purpose": "模型训练和推理"},
            {"name": "开发环境", "specs": "Python 3.9+, PyTorch/TensorFlow, CUDA", 
             "alternative": "Docker容器化环境", "purpose": "代码开发和实验"},
        ]
        return equipment
    
    def _generate_software_requirements(self, methods: List[Dict]) -> List[str]:
        """Generate software requirements"""
        return [
            "Python 3.9 或更高版本",
            "PyTorch ≥ 1.12 或 TensorFlow ≥ 2.8",
            "CUDA Toolkit (如果使用GPU)",
            "Git 版本控制",
            "实验跟踪工具 (Weights & Biases / TensorBoard)"
        ]
    
    def _generate_preparation_steps(self, problem: Dict, methods: List[Dict]) -> List[str]:
        """Generate preparation steps"""
        return [
            "1. 环境配置: 安装所有软件依赖，验证GPU可用性",
            "2. 数据准备: 下载或收集所需数据集，进行初步清洗",
            "3. 基线建立: 运行现有方法作为对比基准",
            "4. 代码框架: 搭建实验代码结构，确保模块化设计",
            "5. 备份策略: 设置代码和数据备份机制",
        ]
    
    def _generate_main_procedure(
        self, 
        problem: Dict, 
        methods: List[Dict],
        rationale: str
    ) -> List[ExperimentStep]:
        """Generate main experiment procedure"""
        
        steps = [
            ExperimentStep(
                step_number=1,
                title="基线方法实现",
                description="复现现有SOTA方法作为基准",
                estimated_time="3-5天",
                materials_needed=["基线代码", "数据集", "评估指标代码"],
                critical_points=["确保与论文报告结果一致", "记录所有超参数"],
                checkpoints=["基线结果与文献报告误差<5%", "训练曲线正常收敛"]
            ),
            ExperimentStep(
                step_number=2,
                title="核心方法实现",
                description="实现创新点提出的方法组合",
                estimated_time="5-7天",
                materials_needed=["方法论文", "参考实现", "实验记录本"],
                critical_points=["严格遵循算法描述", "模块化实现便于调试"],
                checkpoints=["代码通过单元测试", "小规模数据验证通过"]
            ),
            ExperimentStep(
                step_number=3,
                title="消融实验设计",
                description="设计消融实验验证各组件贡献",
                estimated_time="2-3天",
                materials_needed=["完整实现代码", "评估框架"],
                critical_points=["确保单一变量原则", "实验设置可重复"],
                checkpoints=["消融实验设计通过review", "代码版本已tag"]
            ),
            ExperimentStep(
                step_number=4,
                title="主实验运行",
                description="在完整数据集上运行主实验",
                estimated_time="7-14天",
                materials_needed=["完整数据集", "计算资源", "实验监控工具"],
                critical_points=["定期检查训练状态", "及时保存checkpoint"],
                checkpoints=["训练损失正常下降", "验证集性能提升"]
            ),
            ExperimentStep(
                step_number=5,
                title="对比实验",
                description="与相关方法进行全面比较",
                estimated_time="3-5天",
                materials_needed=["对比方法代码", "统一评估框架"],
                critical_points=["公平比较(相同数据/评估)"],
                checkpoints=["所有对比方法成功运行", "结果一致性检查通过"]
            ),
            ExperimentStep(
                step_number=6,
                title="结果分析",
                description="统计分析实验结果，生成图表",
                estimated_time="2-3天",
                materials_needed=["实验结果数据", "可视化工具", "统计分析代码"],
                critical_points=["统计显著性检验", "误差 bars/confidence intervals"],
                checkpoints=["所有图表生成完成", "统计检验通过"]
            ),
        ]
        
        return steps
    
    def _generate_cleanup_steps(self) -> List[str]:
        """Generate cleanup steps"""
        return [
            "1. 数据归档: 整理所有实验数据和结果",
            "2. 代码清理: 清理临时文件，确保代码可复现",
            "3. 文档更新: 更新README和实验记录",
            "4. 资源释放: 关闭不必要的计算资源",
        ]
    
    def _generate_data_collection_protocol(
        self, 
        problem: Dict, 
        methods: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Generate data collection protocol"""
        return [
            {"metric": "主要性能指标", "method": "自动评估脚本", "frequency": "每epoch记录"},
            {"metric": "训练损失曲线", "method": "TensorBoard/W&B", "frequency": "实时记录"},
            {"metric": "资源使用情况", "method": "nvidia-smi, top", "frequency": "每10分钟采样"},
            {"metric": "推理时间", "method": "计时脚本", "frequency": "最终评估时"},
            {"metric": "消融实验结果", "method": "对比表格", "frequency": "消融实验完成后"},
        ]
    
    def _generate_data_format(self) -> Dict[str, Any]:
        """Generate expected data format specification"""
        return {
            "training_log": {
                "format": "JSON Lines",
                "fields": ["epoch", "train_loss", "val_loss", "val_metric", "timestamp"],
                "example": {"epoch": 1, "train_loss": 0.5, "val_loss": 0.4, "val_metric": 0.85}
            },
            "results": {
                "format": "JSON",
                "fields": ["method_name", "dataset", "metric_value", "std_dev", "n_runs"],
                "example": {"method_name": "Ours", "dataset": "CIFAR-10", "metric_value": 95.2}
            },
            "checkpoints": {
                "format": "PyTorch .pth files",
                "naming": "model_epoch_{epoch}_val_{metric:.2f}.pth",
            }
        }
    
    def _generate_safety_notes(self, problem: Dict, methods: List[Dict]) -> List[str]:
        """Generate safety notes"""
        return [
            "⚠️ 计算资源: 长时间训练需监控GPU温度，防止过热",
            "⚠️ 数据安全: 敏感数据需脱敏处理，遵守隐私政策",
            "⚠️ 代码安全: 不运行不信任的第三方代码",
            "⚠️ 备份: 关键checkpoint及时备份到多个位置",
        ]
    
    def _generate_common_pitfalls(self, problem: Dict, methods: List[Dict]) -> List[str]:
        """Generate common pitfalls to avoid"""
        return [
            "❌ 数据泄漏: 确保验证/测试数据不用于训练",
            "❌ 不公平比较: 对比方法使用相同超参数搜索空间",
            "❌ 过度拟合: 观察train/val差距，及时early stopping",
            "❌ 随机性: 使用多随机种子运行，报告均值和方差",
            "❌ 评估指标: 选择领域标准指标，避免自定义指标",
        ]
    
    def _generate_validation_criteria(self, problem: Dict) -> List[str]:
        """Generate validation criteria"""
        return [
            "✓ 代码可复现: 固定随机种子，多次运行结果一致",
            "✓ 基线复现: 与文献基线结果误差<5%",
            "✓ 统计显著性: 主要结果通过统计检验(p<0.05)",
            "✓ 消融验证: 各组件贡献与假设一致",
            "✓ 效率合理: 训练/推理时间符合预期",
        ]
    
    def _generate_success_indicators(self, problem: Dict) -> List[str]:
        """Generate success indicators"""
        return [
            "🎯 主要指标超越SOTA≥1%",
            "🎯 消融实验验证设计假设",
            "🎯 训练稳定收敛",
            "🎯 推理效率可接受",
        ]
    
    def _generate_failure_indicators(self, problem: Dict) -> List[str]:
        """Generate failure indicators"""
        return [
            "❌ 性能低于基线",
            "❌ 训练不稳定/发散",
            "❌ 过拟合严重",
            "❌ 推理时间不可接受",
        ]
    
    def _generate_next_steps_success(
        self, 
        problem: Dict, 
        methods: List[Dict]
    ) -> List[str]:
        """Generate next steps if experiment succeeds"""
        return [
            "1. 扩展实验: 在更多数据集上验证",
            "2. 消融补充: 深入分析各组件贡献",
            "3. 效率优化: 优化模型效率(压缩/加速)",
            "4. 论文撰写: 整理结果撰写论文",
            "5. 开源准备: 准备代码和数据开源",
        ]
    
    def _generate_next_steps_failure(
        self, 
        problem: Dict, 
        methods: List[Dict]
    ) -> List[str]:
        """Generate next steps if experiment fails"""
        return [
            "1. 诊断分析: 分析失败原因(数据/模型/训练)",
            "2. 假设修正: 基于观察修正技术假设",
            "3. 方法调整: 尝试替代方法或组件",
            "4. 范围调整: 缩小问题范围，逐步扩展",
            "5. 专家咨询: 寻求领域专家意见",
        ]
    
    def _estimate_time(self, feasibility_score: float, n_methods: int) -> str:
        """Estimate total experiment time"""
        base_days = 14
        if feasibility_score > 0.8:
            base_days = 10
        elif feasibility_score < 0.5:
            base_days = 21
        
        method_factor = max(1, n_methods - 1) * 2
        total_days = base_days + method_factor
        
        return f"{total_days}-{total_days+7}天"
    
    def _determine_difficulty(
        self, 
        feasibility_score: float, 
        novelty_score: float
    ) -> str:
        """Determine difficulty level"""
        score = feasibility_score * 0.6 + (1 - novelty_score) * 0.4
        if score > 0.7:
            return "intermediate"
        elif score > 0.4:
            return "advanced"
        return "expert"
    
    def _determine_prerequisites(self, methods: List[Dict]) -> List[str]:
        """Determine prerequisite knowledge"""
        prereqs = [
            "Python编程",
            "深度学习基础(PyTorch/TensorFlow)",
            "目标领域基础知识",
        ]
        
        # Add method-specific prerequisites
        for method in methods:
            mechanism = method.get('mechanism', '').lower()
            if 'transformer' in mechanism:
                prereqs.append("Transformer架构理解")
            if 'diffusion' in mechanism:
                prereqs.append("扩散模型原理")
            if 'rl' in mechanism or 'reinforcement' in mechanism:
                prereqs.append("强化学习基础")
        
        return list(set(prereqs))
    
    def _extract_references(self, problem: Dict, methods: List[Dict]) -> List[str]:
        """Extract relevant references"""
        refs = []
        
        # Add problem-related references if available
        if 'references' in problem:
            refs.extend(problem['references'])
        
        # Add method-related references
        for method in methods:
            if 'references' in method:
                refs.extend(method['references'])
        
        return refs if refs else ["相关论文已整理到论文库"]
    
    def to_markdown(self, guide: ExperimentGuide) -> str:
        """Convert guide to markdown format"""
        md = f"""# {guide.experiment_name}

## 实验目标
{guide.objective}

## 预期结果
{guide.expected_outcome}

## 材料清单
"""
        for mat in guide.materials:
            md += f"- **{mat['name']}**: {mat['quantity']} (来源: {mat['source']}) - {mat['purpose']}\n"
        
        md += "\n## 设备需求\n"
        for equip in guide.equipment:
            md += f"- **{equip['name']}**\n"
            md += f"  - 规格: {equip['specs']}\n"
            md += f"  - 替代方案: {equip['alternative']}\n"
            md += f"  - 用途: {equip['purpose']}\n"
        
        md += "\n## 软件要求\n"
        for sw in guide.software_requirements:
            md += f"- {sw}\n"
        
        md += "\n## 实验步骤\n"
        md += "### 准备阶段\n"
        for step in guide.preparation_steps:
            md += f"{step}\n"
        
        md += "\n### 主要实验流程\n"
        for step in guide.main_procedure:
            md += f"\n#### 步骤 {step.step_number}: {step.title}\n"
            md += f"**时间**: {step.estimated_time}\n\n"
            md += f"**描述**: {step.description}\n\n"
            md += f"**所需材料**: {', '.join(step.materials_needed)}\n\n"
            md += f"**关键点**: {', '.join(step.critical_points)}\n\n"
            md += f"**检查点**: {', '.join(step.checkpoints)}\n"
        
        md += "\n### 清理阶段\n"
        for step in guide.cleanup_steps:
            md += f"{step}\n"
        
        md += "\n## 数据收集协议\n"
        for data in guide.data_to_collect:
            md += f"- **{data['metric']}**: {data['method']} ({data['frequency']})\n"
        
        md += "\n## 安全注意事项\n"
        for note in guide.safety_notes:
            md += f"- {note}\n"
        
        md += "\n## 常见陷阱\n"
        for pitfall in guide.common_pitfalls:
            md += f"- {pitfall}\n"
        
        md += "\n## 验证标准\n"
        for criterion in guide.validation_criteria:
            md += f"- {criterion}\n"
        
        md += "\n## 结果解释\n"
        md += "### 成功指标\n"
        for indicator in guide.success_indicators:
            md += f"- {indicator}\n"
        
        md += "\n### 失败指标\n"
        for indicator in guide.failure_indicators:
            md += f"- {indicator}\n"
        
        md += "\n## 后续步骤\n"
        md += "### 如果实验成功\n"
        for step in guide.next_steps_if_success:
            md += f"{step}\n"
        
        md += "\n### 如果实验失败\n"
        for step in guide.next_steps_if_failure:
            md += f"{step}\n"
        
        md += f"\n## 元信息\n"
        md += f"- **预计总时间**: {guide.estimated_total_time}\n"
        md += f"- **难度级别**: {guide.difficulty_level}\n"
        md += f"- **前置知识**: {', '.join(guide.prerequisite_knowledge)}\n"
        
        return md


# Convenience function for API usage
def generate_experiment_guide(
    innovation_id: str,
    target_problem: Dict[str, Any],
    candidate_methods: List[Dict[str, Any]],
    rationale: str,
    feasibility_score: float,
    novelty_score: float,
    llm_client=None
) -> Dict[str, Any]:
    """
    Convenience function to generate an experiment guide.
    
    Returns the guide as a dictionary for JSON serialization.
    """
    generator = ExperimentGuideGenerator(llm_client=llm_client)
    guide = generator.generate_guide(
        innovation_id=innovation_id,
        target_problem=target_problem,
        candidate_methods=candidate_methods,
        rationale=rationale,
        feasibility_score=feasibility_score,
        novelty_score=novelty_score
    )
    
    # Convert dataclass to dict
    guide_dict = {
        "experiment_id": guide.experiment_id,
        "experiment_name": guide.experiment_name,
        "objective": guide.objective,
        "expected_outcome": guide.expected_outcome,
        "materials": guide.materials,
        "equipment": guide.equipment,
        "software_requirements": guide.software_requirements,
        "preparation_steps": guide.preparation_steps,
        "main_procedure": [
            {
                "step_number": s.step_number,
                "title": s.title,
                "description": s.description,
                "estimated_time": s.estimated_time,
                "materials_needed": s.materials_needed,
                "critical_points": s.critical_points,
                "checkpoints": s.checkpoints,
            }
            for s in guide.main_procedure
        ],
        "cleanup_steps": guide.cleanup_steps,
        "data_to_collect": guide.data_to_collect,
        "expected_data_format": guide.expected_data_format,
        "safety_notes": guide.safety_notes,
        "common_pitfalls": guide.common_pitfalls,
        "validation_criteria": guide.validation_criteria,
        "success_indicators": guide.success_indicators,
        "failure_indicators": guide.failure_indicators,
        "next_steps_if_success": guide.next_steps_if_success,
        "next_steps_if_failure": guide.next_steps_if_failure,
        "estimated_total_time": guide.estimated_total_time,
        "difficulty_level": guide.difficulty_level,
        "prerequisite_knowledge": guide.prerequisite_knowledge,
        "references": guide.references,
    }
    
    # Also add markdown version
    guide_dict["markdown_guide"] = generator.to_markdown(guide)
    
    return guide_dict