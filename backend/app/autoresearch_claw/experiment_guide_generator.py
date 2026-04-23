"""AutoResearchClaw 适配层 - 傻瓜式实验指南生成器

为需要人类参与的实验生成详细的傻瓜式指南，包括：
- 分步骤操作说明
- 故障排查
- 资源清单
- 安全检查
- 可打印格式

目标：让完全没有经验的人也能按照指南完成实验
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DifficultyLevel(str, Enum):
    """难度等级"""
    BEGINNER = "beginner"      # 初学者 - 无需编程经验
    INTERMEDIATE = "intermediate"  # 中级 - 需要基本编程
    ADVANCED = "advanced"      # 高级 - 需要专业知识


@dataclass
class Step:
    """步骤"""
    number: int
    title: str
    description: str
    commands: List[str] = field(default_factory=list)  # 命令列表
    expected_output: Optional[str] = None  # 预期输出
    tips: List[str] = field(default_factory=list)  # 提示
    warnings: List[str] = field(default_factory=list)  # 警告
    estimated_time: Optional[str] = None  # 预计时间
    image_placeholder: Optional[str] = None  # 截图占位符
    checklist: List[str] = field(default_factory=list)  # 检查清单
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TroubleshootingItem:
    """故障排查项"""
    problem: str
    symptom: str
    cause: str
    solution: str
    prevention: str = ""  # 预防措施
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ResourceList:
    """资源清单"""
    hardware: List[str] = field(default_factory=list)
    software: List[str] = field(default_factory=list)
    datasets: List[str] = field(default_factory=list)
    libraries: List[str] = field(default_factory=list)
    estimated_cost: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ExperimentGuide:
    """实验指南"""
    experiment_id: str
    title: str
    description: str
    difficulty: DifficultyLevel
    estimated_time: str
    prerequisites: List[str] = field(default_factory=list)
    resources: ResourceList = field(default_factory=ResourceList)
    safety_notes: List[str] = field(default_factory=list)
    steps: List[Step] = field(default_factory=list)
    troubleshooting: List[TroubleshootingItem] = field(default_factory=list)
    checkpoints: List[str] = field(default_factory=list)  # 检查点
    output_format: str = "markdown"  # 输出格式
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def to_markdown(self) -> str:
        """转换为 Markdown 格式"""
        md = []
        md.append(f"# {self.title}\n")
        md.append(f"**难度**: {self.difficulty.value}\n")
        md.append(f"**预计时间**: {self.estimated_time}\n")
        md.append(f"**创建时间**: {self.created_at}\n\n")
        
        md.append("## 简介\n")
        md.append(f"{self.description}\n\n")
        
        if self.prerequisites:
            md.append("## 前置条件\n")
            for prereq in self.prerequisites:
                md.append(f"- {prereq}")
            md.append("\n")
        
        if self.resources.hardware or self.resources.software:
            md.append("## 所需资源\n")
            if self.resources.hardware:
                md.append("### 硬件要求\n")
                for hw in self.resources.hardware:
                    md.append(f"- {hw}")
                md.append("")
            if self.resources.software:
                md.append("### 软件要求\n")
                for sw in self.resources.software:
                    md.append(f"- {sw}")
                md.append("")
            if self.resources.datasets:
                md.append("### 数据集\n")
                for ds in self.resources.datasets:
                    md.append(f"- {ds}")
                md.append("")
            if self.resources.libraries:
                md.append("### Python 库\n")
                for lib in self.resources.libraries:
                    md.append(f"- {lib}")
                md.append("")
            if self.resources.estimated_cost:
                md.append(f"**预计成本**: {self.resources.estimated_cost}\n")
            md.append("")
        
        if self.safety_notes:
            md.append("## ⚠️ 安全注意事项\n")
            for note in self.safety_notes:
                md.append(f"- {note}")
            md.append("\n")
        
        md.append("## 实验步骤\n")
        for step in self.steps:
            md.append(f"### 步骤 {step.number}: {step.title}\n")
            md.append(f"{step.description}\n")
            
            if step.estimated_time:
                md.append(f"**预计时间**: {step.estimated_time}\n")
            
            if step.commands:
                md.append("\n**执行命令**:\n")
                md.append("```bash")
                for cmd in step.commands:
                    md.append(cmd)
                md.append("```\n")
            
            if step.expected_output:
                md.append(f"\n**预期输出**:\n```\n{step.expected_output}\n```\n")
            
            if step.checklist:
                md.append("\n**检查清单**:")
                for check in step.checklist:
                    md.append(f"- [ ] {check}")
                md.append("")
            
            if step.tips:
                md.append("\n> 💡 **提示**:")
                for tip in step.tips:
                    md.append(f"> - {tip}")
                md.append("")
            
            if step.warnings:
                md.append("\n> ⚠️ **警告**:")
                for warn in step.warnings:
                    md.append(f"> - {warn}")
                md.append("")
            
            if step.image_placeholder:
                md.append(f"\n![{step.image_placeholder}]([截图位置])\n")
            
            md.append("")
        
        if self.checkpoints:
            md.append("## 检查点\n")
            for i, checkpoint in enumerate(self.checkpoints, 1):
                md.append(f"{i}. {checkpoint}")
            md.append("")
        
        if self.troubleshooting:
            md.append("## 故障排查\n")
            for item in self.troubleshooting:
                md.append(f"### 问题: {item.problem}\n")
                md.append(f"**症状**: {item.symptom}\n")
                md.append(f"**可能原因**: {item.cause}\n")
                md.append(f"**解决方案**: {item.solution}\n")
                if item.prevention:
                    md.append(f"**预防措施**: {item.prevention}\n")
                md.append("")
        
        md.append("\n---\n")
        md.append(f"*本指南由 Research-Nexus Pro 自动生成*\n")
        
        return "\n".join(md)
    
    def to_text(self) -> str:
        """转换为纯文本格式（用于打印）"""
        return self.to_markdown()  # Markdown 本身就是纯文本


class ExperimentGuideGenerator:
    """实验指南生成器
    
    根据实验类型和创新点，生成详细的实验指南
    """
    
    def __init__(self):
        logger.info("ExperimentGuideGenerator initialized")
    
    def generate_guide(
        self,
        experiment_type: str,
        title: str,
        description: str,
        code_template: Optional[str] = None,
        difficulty: Optional[DifficultyLevel] = None,
        custom_requirements: Optional[List[str]] = None
    ) -> ExperimentGuide:
        """
        生成实验指南
        
        Args:
            experiment_type: 实验类型 ("ml", "simulation", "data_analysis", "robotics", etc.)
            title: 实验标题
            description: 实验描述
            code_template: 代码模板（可选）
            difficulty: 难度等级
            custom_requirements: 自定义需求
        
        Returns:
            实验指南
        """
        # 自动判断难度
        if difficulty is None:
            difficulty = self._infer_difficulty(experiment_type, description)
        
        # 生成步骤
        steps = self._generate_steps(experiment_type, code_template)
        
        # 生成资源清单
        resources = self._generate_resources(experiment_type, custom_requirements)
        
        # 生成故障排查
        troubleshooting = self._generate_troubleshooting(experiment_type)
        
        # 生成安全注意事项
        safety_notes = self._generate_safety_notes(experiment_type)
        
        # 生成检查点
        checkpoints = self._generate_checkpoints(steps)
        
        # 估算时间
        estimated_time = self._estimate_time(steps)
        
        # 前置条件
        prerequisites = self._generate_prerequisites(experiment_type)
        
        experiment_id = f"guide_{title.lower().replace(' ', '_')[:30]}"
        
        guide = ExperimentGuide(
            experiment_id=experiment_id,
            title=title,
            description=description,
            difficulty=difficulty,
            estimated_time=estimated_time,
            prerequisites=prerequisites,
            resources=resources,
            safety_notes=safety_notes,
            steps=steps,
            troubleshooting=troubleshooting,
            checkpoints=checkpoints
        )
        
        logger.info(f"Generated guide: {experiment_id}")
        return guide
    
    def export_to_file(
        self,
        guide: ExperimentGuide,
        output_path: str,
        format: str = "markdown"
    ) -> str:
        """
        导出指南到文件
        
        Args:
            guide: 实验指南
            output_path: 输出文件路径
            format: 输出格式 (markdown/text)
        
        Returns:
            输出文件路径
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if format == "markdown":
            content = guide.to_markdown()
            path = path.with_suffix(".md")
        else:
            content = guide.to_text()
            path = path.with_suffix(".txt")
        
        path.write_text(content, encoding='utf-8')
        logger.info(f"Guide exported to: {path}")
        return str(path)
    
    # ========== 辅助方法 ==========
    
    def _infer_difficulty(self, experiment_type: str, description: str) -> DifficultyLevel:
        """推断难度等级"""
        hard_keywords = ["robotics", "hardware", "sensor", "actuator", "clinical", "medical"]
        medium_keywords = ["machine learning", "deep learning", "nlp", "computer vision"]
        
        desc_lower = description.lower()
        type_lower = experiment_type.lower()
        
        if any(kw in desc_lower or kw in type_lower for kw in hard_keywords):
            return DifficultyLevel.ADVANCED
        elif any(kw in desc_lower or kw in type_lower for kw in medium_keywords):
            return DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.BEGINNER
    
    def _generate_steps(self, experiment_type: str, code_template: Optional[str] = None) -> List[Step]:
        """根据实验类型生成步骤"""
        type_lower = experiment_type.lower()
        
        if type_lower in ["ml", "machine_learning", "deep_learning"]:
            return self._generate_ml_steps(code_template)
        elif type_lower in ["simulation", "sim"]:
            return self._generate_simulation_steps(code_template)
        elif type_lower in ["data_analysis", "data"]:
            return self._generate_data_analysis_steps(code_template)
        elif type_lower in ["robotics", "robot"]:
            return self._generate_robotics_steps(code_template)
        else:
            return self._generate_generic_steps(code_template)
    
    def _generate_ml_steps(self, code_template: Optional[str] = None) -> List[Step]:
        """生成机器学习实验步骤"""
        return [
            Step(
                number=1,
                title="环境准备",
                description="安装 Python 和必要的依赖库。确保您的系统已安装 Python 3.8 或更高版本。",
                commands=[
                    "python3 --version  # 检查 Python 版本",
                    "pip install --upgrade pip",
                    "pip install torch torchvision  # PyTorch",
                    "pip install numpy pandas scikit-learn  # 数据处理",
                    "pip install matplotlib seaborn  # 可视化"
                ],
                expected_output="Successfully installed torch-x.x.x ...",
                tips=[
                    "建议使用虚拟环境: python -m venv venv && source venv/bin/activate",
                    "如果遇到 CUDA 版本问题，请检查 GPU 驱动版本"
                ],
                estimated_time="10-15 分钟",
                checklist=[
                    "Python 3.8+ 已安装",
                    "pip 已更新至最新版本",
                    "所有依赖库安装成功"
                ]
            ),
            Step(
                number=2,
                title="准备数据集",
                description="下载并预处理实验所需的数据集。根据实验要求，可能需要从公开数据集获取数据，或使用合成数据。",
                commands=[
                    "mkdir -p data",
                    "# 下载数据集（示例：CIFAR-10）",
                    "python -c \"from torchvision import datasets; datasets.CIFAR10(root='data', download=True)\""
                ],
                expected_output="Files already downloaded and verified",
                tips=[
                    "大型数据集可能需要较长时间下载",
                    "确保有足够的磁盘空间",
                    "考虑使用数据缓存"
                ],
                estimated_time="5-30 分钟（取决于数据集大小）",
                checklist=[
                    "数据集已下载",
                    "数据路径正确配置",
                    "数据格式符合预期"
                ]
            ),
            Step(
                number=3,
                title="运行实验代码",
                description="执行实验代码。代码将自动完成模型训练、评估和结果保存。",
                commands=[
                    "python main.py  # 运行主实验脚本",
                    "# 或者指定参数",
                    "python main.py --epochs 10 --batch_size 32 --lr 0.001"
                ],
                expected_output="Epoch 1/10 - Loss: 0.5234 - Accuracy: 0.7234",
                tips=[
                    "观察训练过程中的损失和准确率变化",
                    "如果训练时间过长，可以适当减少 epoch 数进行快速验证",
                    "使用 --help 查看所有可用参数"
                ],
                warnings=[
                    "训练过程可能需要较长时间，请确保设备有足够电量",
                    "GPU 训练时注意温度，避免过热"
                ],
                estimated_time="30 分钟 - 数小时（取决于模型和数据集）",
                checklist=[
                    "代码执行无报错",
                    "训练指标正常输出",
                    "结果文件已保存"
                ]
            ),
            Step(
                number=4,
                title="分析结果",
                description="检查实验输出，分析模型性能指标。查看生成的图表和日志文件。",
                commands=[
                    "# 查看结果文件",
                    "ls -la results/",
                    "# 查看训练日志",
                    "cat results/training_log.txt",
                    "# 查看生成的图表",
                    "open results/accuracy_curve.png  # macOS",
                    "xdg-open results/accuracy_curve.png  # Linux"
                ],
                expected_output="accuracy: 0.85, loss: 0.32",
                tips=[
                    "对比不同实验运行的结果",
                    "注意过拟合迹象（训练准确率高，验证准确率低）",
                    "保存重要的图表用于论文"
                ],
                estimated_time="10-20 分钟",
                checklist=[
                    "结果文件已生成",
                    "关键指标符合预期",
                    "图表已保存到论文目录"
                ]
            )
        ]
    
    def _generate_simulation_steps(self, code_template: Optional[str] = None) -> List[Step]:
        """生成仿真实验步骤"""
        return [
            Step(
                number=1,
                title="安装仿真环境",
                description="安装仿真所需的软件和库。",
                commands=[
                    "pip install numpy scipy matplotlib",
                    "pip install gymnasium  # 强化学习环境",
                    "pip install mujoco-py  # 如需 MuJoCo 物理引擎"
                ],
                estimated_time="15-20 分钟",
                checklist=["所有依赖安装成功"]
            ),
            Step(
                number=2,
                title="配置仿真参数",
                description="根据实验要求配置仿真环境参数。",
                commands=[
                    "python configure_simulation.py --env custom_env --steps 10000"
                ],
                estimated_time="5 分钟",
                checklist=["配置文件已创建"]
            ),
            Step(
                number=3,
                title="运行仿真",
                description="执行仿真实验，观察结果。",
                commands=[
                    "python run_simulation.py"
                ],
                estimated_time="10-60 分钟",
                checklist=["仿真运行完成", "结果已保存"]
            )
        ]
    
    def _generate_data_analysis_steps(self, code_template: Optional[str] = None) -> List[Step]:
        """生成数据分析实验步骤"""
        return [
            Step(
                number=1,
                title="安装数据分析工具",
                description="安装 pandas、numpy 等数据分析库。",
                commands=[
                    "pip install pandas numpy matplotlib seaborn jupyter"
                ],
                estimated_time="10 分钟"
            ),
            Step(
                number=2,
                title="加载数据",
                description="加载并初步探索数据集。",
                commands=[
                    "jupyter notebook  # 启动 Jupyter",
                    "# 在 notebook 中运行:",
                    "import pandas as pd",
                    "df = pd.read_csv('data.csv')",
                    "df.head()",
                    "df.describe()"
                ],
                estimated_time="15 分钟"
            ),
            Step(
                number=3,
                title="执行分析",
                description="运行数据分析脚本。",
                commands=[
                    "python analyze.py --input data.csv --output results/"
                ],
                estimated_time="20-30 分钟"
            )
        ]
    
    def _generate_robotics_steps(self, code_template: Optional[str] = None) -> List[Step]:
        """生成机器人实验步骤（需要硬件）"""
        return [
            Step(
                number=1,
                title="硬件检查",
                description="检查机器人硬件连接和状态。",
                commands=[
                    "# 检查 USB 设备",
                    "lsusb",
                    "# 检查串口连接",
                    "ls /dev/ttyUSB*",
                    "# 测试电机",
                    "python test_motors.py"
                ],
                warnings=[
                    "确保机器人在安全区域内",
                    "佩戴防护眼镜",
                    "紧急停止按钮随时可用"
                ],
                estimated_time="15 分钟",
                checklist=[
                    "所有传感器连接正常",
                    "电机电源已接通",
                    "紧急停止功能正常"
                ]
            ),
            Step(
                number=2,
                title="安装 ROS/控制软件",
                description="安装机器人操作系统和控制软件。",
                commands=[
                    "sudo apt install ros-noetic-desktop-full  # Ubuntu",
                    "pip install pyserial",
                    "pip install ros-noetic-serial"
                ],
                estimated_time="30 分钟"
            ),
            Step(
                number=3,
                title="校准传感器",
                description="校准机器人的传感器（摄像头、激光雷达等）。",
                commands=[
                    "roslaunch robot_calibration calibrate.launch",
                    "# 按照提示完成校准流程"
                ],
                warnings=[
                    "在校准过程中不要移动机器人"
                ],
                estimated_time="20 分钟"
            ),
            Step(
                number=4,
                title="运行实验",
                description="执行机器人控制实验。",
                commands=[
                    "roslaunch robot_experiment run.launch",
                    "# 或在安全模式下测试",
                    "python safe_test.py --speed 0.1"
                ],
                warnings=[
                    "首次运行时使用低速模式",
                    "随时准备按下紧急停止",
                    "确保工作区域无人"
                ],
                estimated_time="30-60 分钟",
                checklist=[
                    "机器人按预期移动",
                    "传感器数据正常",
                    "实验数据已记录"
                ]
            )
        ]
    
    def _generate_generic_steps(self, code_template: Optional[str] = None) -> List[Step]:
        """生成通用实验步骤"""
        return [
            Step(
                number=1,
                title="环境设置",
                description="准备实验环境。",
                commands=[
                    "python3 --version",
                    "pip install -r requirements.txt"
                ],
                estimated_time="10 分钟"
            ),
            Step(
                number=2,
                title="运行实验",
                description="执行实验代码。",
                commands=[
                    "python main.py"
                ],
                estimated_time="30 分钟"
            ),
            Step(
                number=3,
                title="检查结果",
                description="验证实验结果。",
                commands=[
                    "ls -la results/"
                ],
                estimated_time="10 分钟"
            )
        ]
    
    def _generate_resources(
        self,
        experiment_type: str,
        custom_requirements: Optional[List[str]] = None
    ) -> ResourceList:
        """生成资源清单"""
        type_lower = experiment_type.lower()
        
        resources = ResourceList()
        
        # 硬件
        if type_lower in ["robotics", "robot", "hardware"]:
            resources.hardware = [
                "机器人平台（如 ROS 兼容的机器人）",
                "传感器（摄像头、激光雷达等）",
                "电源供应"
            ]
        else:
            resources.hardware = ["计算机（建议 8GB+ RAM）"]
        
        # 软件
        resources.software = [
            "Python 3.8+",
            "Git"
        ]
        
        # 库
        if type_lower in ["ml", "machine_learning", "deep_learning"]:
            resources.libraries = [
                "torch (PyTorch)",
                "numpy",
                "pandas",
                "matplotlib",
                "scikit-learn"
            ]
        elif type_lower in ["robotics"]:
            resources.libraries = [
                "ros-noetic",
                "pyserial",
                "numpy"
            ]
        else:
            resources.libraries = [
                "numpy",
                "pandas",
                "matplotlib"
            ]
        
        if custom_requirements:
            resources.libraries.extend(custom_requirements)
        
        return resources
    
    def _generate_troubleshooting(self, experiment_type: str) -> List[TroubleshootingItem]:
        """生成故障排查项"""
        return [
            TroubleshootingItem(
                problem="依赖安装失败",
                symptom="pip install 报错，显示 'Could not find a version that satisfies...'",
                cause="Python 版本不兼容或网络问题",
                solution="1. 检查 Python 版本: python3 --version\n2. 使用国内镜像: pip install -i https://pypi.tuna.tsinghua.edu.cn/simple <package>\n3. 使用虚拟环境隔离依赖",
                prevention="始终使用虚拟环境和明确的版本要求"
            ),
            TroubleshootingItem(
                problem="CUDA 相关错误",
                symptom="RuntimeError: CUDA out of memory 或 no CUDA-capable device",
                cause="GPU 内存不足或驱动问题",
                solution="1. 检查 GPU: nvidia-smi\n2. 减小 batch_size\n3. 更新 GPU 驱动\n4. 使用 CPU: export CUDA_VISIBLE_DEVICES=''",
                prevention="运行前检查 GPU 状态，预留足够内存"
            ),
            TroubleshootingItem(
                problem="数据集下载失败",
                symptom="Connection timeout 或 404 Not Found",
                cause="网络连接问题或 URL 失效",
                solution="1. 检查网络连接\n2. 手动下载数据集\n3. 使用备用下载地址",
                prevention="提前下载并缓存常用数据集"
            ),
            TroubleshootingItem(
                problem="训练结果不符合预期",
                symptom="准确率远低于论文报告值",
                cause="超参数不当、数据预处理错误或实现问题",
                solution="1. 检查超参数设置是否与论文一致\n2. 验证数据预处理流程\n3. 对比中间层输出\n4. 减少问题规模先验证小规模实验",
                prevention="分阶段验证：先在小数据集上过拟合，再扩展"
            ),
            TroubleshootingItem(
                problem="程序崩溃无报错信息",
                symptom="程序突然退出，无错误输出",
                cause="内存溢出或段错误",
                solution="1. 使用 try-except 包裹代码\n2. 添加日志输出\n3. 检查 dmesg 获取系统级错误\n4. 减小数据批次",
                prevention="添加完善的异常处理和日志"
            )
        ]
    
    def _generate_safety_notes(self, experiment_type: str) -> List[str]:
        """生成安全注意事项"""
        type_lower = experiment_type.lower()
        
        notes = [
            "请在稳定的电源环境下进行长时间训练",
            "定期保存实验进度和结果",
            "确保有足够的磁盘空间（建议预留 10GB+）"
        ]
        
        if type_lower in ["robotics", "robot", "hardware"]:
            notes.extend([
                "⚠️ 硬件实验涉及安全风险，请务必遵守安全规程",
                "首次运行新代码时，先在仿真环境中测试",
                "确保紧急停止功能始终可用",
                "佩戴适当的防护装备（护目镜、手套等）",
                "不要在无人看管的情况下运行硬件实验"
            ])
        
        if type_lower in ["ml", "machine_learning"]:
            notes.extend([
                "长时间 GPU 训练时注意散热，避免过热",
                "定期检查 GPU 温度: nvidia-smi"
            ])
        
        return notes
    
    def _generate_checkpoints(self, steps: List[Step]) -> List[str]:
        """生成检查点"""
        checkpoints = []
        for step in steps:
            if step.checklist:
                checkpoints.append(f"步骤 {step.number} 完成后: {step.checklist[-1]}")
        return checkpoints
    
    def _estimate_time(self, steps: List[Step]) -> str:
        """估算总时间"""
        # 简化的时间估算
        total_minutes = 0
        for step in steps:
            if step.estimated_time:
                # 提取数字（简化处理）
                import re
                nums = re.findall(r'(\d+)', step.estimated_time)
                if nums:
                    total_minutes += int(nums[0])
        
        if total_minutes < 60:
            return f"{total_minutes} 分钟"
        else:
            hours = total_minutes // 60
            mins = total_minutes % 60
            return f"{hours} 小时 {mins} 分钟" if mins else f"{hours} 小时"
    
    def _generate_prerequisites(self, experiment_type: str) -> List[str]:
        """生成前置条件"""
        prereqs = [
            "Python 3.8+ 已安装",
            "网络连接正常"
        ]
        
        type_lower = experiment_type.lower()
        if type_lower in ["ml", "machine_learning", "deep_learning"]:
            prereqs.append("GPU 推荐（非必需）")
            prereqs.append("至少 8GB 内存")
        elif type_lower in ["robotics", "robot"]:
            prereqs.append("机器人硬件已连接")
            prereqs.append("ROS 环境配置完成")
        
        return prereqs


# === API 函数 ===

def generate_guide_api(
    experiment_type: str,
    title: str,
    description: str,
    difficulty: Optional[str] = None
) -> Dict[str, Any]:
    """
    FastAPI 接口调用的指南生成函数
    
    Args:
        experiment_type: 实验类型
        title: 实验标题
        description: 实验描述
        difficulty: 难度等级
    
    Returns:
        指南字典
    """
    generator = ExperimentGuideGenerator()
    
    diff = DifficultyLevel(difficulty) if difficulty else None
    guide = generator.generate_guide(
        experiment_type=experiment_type,
        title=title,
        description=description,
        difficulty=diff
    )
    
    return {
        "guide": guide.to_dict(),
        "markdown": guide.to_markdown()
    }


def export_guide_api(
    guide_data: Dict[str, Any],
    output_dir: str = "/tmp/guides"
) -> str:
    """
    导出指南到文件
    
    Args:
        guide_data: 指南数据
        output_dir: 输出目录
    
    Returns:
        输出文件路径
    """
    generator = ExperimentGuideGenerator()
    
    # 重建 ExperimentGuide 对象
    guide = ExperimentGuide(**guide_data)
    
    output_path = f"{output_dir}/{guide.experiment_id}"
    return generator.export_to_file(guide, output_path)
