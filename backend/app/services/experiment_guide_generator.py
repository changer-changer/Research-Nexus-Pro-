"""
Experiment Guide Generator
Generates detailed experiment guides from innovation points and candidate methods.

API: POST /api/v3/experiment-guide/generate
Input: {
    "innovation_id": "...",
    "candidate_methods": ["..."],
    "target_venue": "NeurIPS"
}
Output: {
    "experiment_name": "...",
    "materials_list": [...],
    "steps": [...],
    "cautions": [...],
    "expected_results": "...",
    "acceptance_criteria": [...]
}
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from string import Template

logger = logging.getLogger(__name__)


class ExperimentGuideGenerator:
    """
    Generates comprehensive experiment guides for research validation.
    
    This generator creates detailed, actionable experiment protocols that:
    - Define clear experimental objectives
    - List required materials and resources
    - Provide step-by-step procedures
    - Highlight safety and methodological cautions
    - Define expected outcomes
    - Specify acceptance criteria for validation
    """
    
    def __init__(self, llm_client=None):
        self.llm_client = llm_client
        self._load_prompts()
        logger.info("ExperimentGuideGenerator initialized")
    
    def _load_prompts(self):
        """Load prompt templates"""
        self.prompts = {
            "experiment_guide_generation": """你是一个专业的实验设计专家，擅长为机器学习研究设计可复现的实验方案。

请为以下创新点设计一个完整的实验指南：

## 创新点信息
- 名称: {innovation_name}
- 描述: {innovation_description}
- 目标问题: {target_problem}
- 候选方法: {candidate_methods}
- 目标会议: {target_venue}

## 输出格式
请按以下格式输出实验指南：

### [实验名称]
为实验起一个清晰、专业的名称。

### [材料清单]
列出实验所需的所有资源：
- 数据集（名称、规模、来源）
- 计算资源（GPU类型、内存需求）
- 软件依赖（框架版本、关键库）
- 预处理工具

### [实验步骤]
详细的分步骤实验流程：
1. 数据准备与预处理
2. 基线模型实现
3. 创新方法实现
4. 训练流程配置
5. 评估指标设置
6. 结果记录与分析

### [注意事项]
实验中需要特别注意的事项：
- 常见陷阱和避免方法
- 超参数敏感性
- 随机性控制（种子设置）
- 计算效率优化建议

### [预期结果]
描述实验成功时的预期产出：
- 主要性能指标提升
- 消融实验结果
- 可视化图表
- 统计显著性

### [验收标准]
定义实验成功的具体标准：
- 最小性能提升阈值
- 统计显著性水平
- 可复现性要求
- 对比基线的优势

请确保实验指南：
1. 具体可操作，研究者可以直接按照步骤执行
2. 考虑计算资源限制，提供不同规模的选择
3. 包含充分的细节，确保实验可复现
4. 预见可能的失败情况并提供对策
"""
        }
    
    async def generate_guide(
        self,
        innovation_id: str,
        candidate_methods: List[str],
        target_venue: str = "NeurIPS",
        problem_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate experiment guide from innovation point.
        
        Args:
            innovation_id: ID of the innovation point
            candidate_methods: List of candidate method IDs/names
            target_venue: Target conference venue
            problem_description: Optional detailed problem description
            
        Returns:
            Complete experiment guide with all sections
        """
        logger.info(f"Generating experiment guide for innovation {innovation_id}")
        
        # Load innovation data (in production, query from database)
        innovation_data = await self._load_innovation_data(innovation_id)
        if not innovation_data:
            innovation_data = {
                "name": "Unknown Innovation",
                "description": problem_description or "No description available",
                "target_problem": "Unknown",
            }
        
        # Build prompt
        prompt = self.prompts["experiment_guide_generation"].format(
            innovation_name=innovation_data.get("name", "Unknown"),
            innovation_description=innovation_data.get("description", ""),
            target_problem=innovation_data.get("target_problem", ""),
            candidate_methods=", ".join(candidate_methods),
            target_venue=target_venue
        )
        
        # Generate guide using LLM
        try:
            if self.llm_client:
                guide_text = await self._call_llm(prompt)
            else:
                # Fallback: generate structured mock data
                guide_text = self._generate_mock_guide(innovation_data, candidate_methods, target_venue)
            
            # Parse the generated text into structured format
            guide = self._parse_guide_output(guide_text)
            guide["innovation_id"] = innovation_id
            guide["generated_at"] = datetime.now().isoformat()
            guide["target_venue"] = target_venue
            
            logger.info(f"Experiment guide generated for {innovation_id}")
            return guide
            
        except Exception as e:
            logger.error(f"Failed to generate experiment guide: {e}")
            return self._generate_fallback_guide(innovation_id, candidate_methods, target_venue)
    
    async def _load_innovation_data(self, innovation_id: str) -> Optional[Dict[str, Any]]:
        """Load innovation data from database"""
        # In production: query from LocalGraphDB
        # For now, return mock data structure
        return None
    
    async def _call_llm(self, prompt: str) -> str:
        """Call LLM to generate guide"""
        # In production: use Kimi client
        # For now, return mock
        return self._generate_mock_guide({"name": "Test"}, [], "NeurIPS")
    
    def _generate_mock_guide(
        self,
        innovation_data: Dict[str, Any],
        candidate_methods: List[str],
        target_venue: str
    ) -> str:
        """Generate mock experiment guide for testing"""
        innovation_name = innovation_data.get("name", "Test Innovation")
        
        return f"""### [实验名称]
{innovation_name} 验证实验

### [材料清单]
**数据集:**
- 主要数据集: ImageNet-1K (1.28M训练图像, 50K验证图像)
- 辅助数据集: CIFAR-10/100 (用于小规模验证)
- 数据来源: http://image-net.org/

**计算资源:**
- GPU: NVIDIA A100 40GB × 4
- 内存: 128GB RAM
- 存储: 500GB SSD (数据集 + 模型检查点)

**软件依赖:**
- Python 3.9+
- PyTorch 2.0+
- CUDA 11.8+
- transformers, datasets, accelerate

### [实验步骤]
1. **数据准备**
   - 下载并解压ImageNet数据集
   - 执行数据预处理脚本: `python scripts/preprocess_data.py`
   - 验证数据完整性: 检查MD5校验和

2. **环境配置**
   - 创建conda环境: `conda create -n exp python=3.9`
   - 安装依赖: `pip install -r requirements.txt`
   - 验证GPU可用性: `python -c "import torch; print(torch.cuda.is_available())"`

3. **基线实现**
   - 克隆官方实现: `git clone https://github.com/...`
   - 运行基线测试: `python train_baseline.py --config configs/baseline.yaml`
   - 记录基线性能指标

4. **创新方法实现**
   - 根据论文描述实现核心算法
   - 集成到现有框架
   - 代码审查和单元测试

5. **训练与评估**
   - 执行完整训练: `python train.py --config configs/experiment.yaml`
   - 监控训练过程: TensorBoard日志
   - 评估模型性能: `python evaluate.py --checkpoint best_model.pth`

6. **消融实验**
   - 逐一移除组件，评估影响
   - 记录各配置性能
   - 生成对比表格

### [注意事项]
- **随机性控制**: 设置固定随机种子 (42)，确保可复现性
- **超参数敏感**: 学习率对性能影响显著，建议使用1e-4到1e-3范围
- **内存管理**: 批量大小设置需考虑GPU显存，建议从32开始逐步增加
- **检查点保存**: 每10个epoch保存一次，防止训练中断
- **早期停止**: 监控验证集损失，10个epoch无改善则停止

### [预期结果]
**主要性能提升:**
- 相比基线方法，预期Top-1准确率提升2-5%
- 推理速度保持或提升10%以内
- 参数量和计算量控制在合理范围

**消融实验结果:**
- 每个组件贡献明确
- 核心创新点贡献>50%的性能提升

**可视化产出:**
- 训练曲线图 (损失、准确率)
- 注意力可视化
- 混淆矩阵

**统计显著性:**
- 使用5-fold交叉验证
- p-value < 0.05

### [验收标准]
- [ ] 主要数据集上性能超越SOTA基线≥2%
- [ ] 消融实验验证每个组件的有效性
- [ ] 统计显著性检验通过 (p<0.05)
- [ ] 实验可在不同机器上复现 (±0.5%误差)
- [ ] 代码通过同行评审
- [ ] 文档完整，包含使用说明
"""
    
    def _parse_guide_output(self, text: str) -> Dict[str, Any]:
        """Parse LLM output into structured format"""
        guide = {
            "experiment_name": "",
            "materials_list": [],
            "steps": [],
            "cautions": [],
            "expected_results": "",
            "acceptance_criteria": []
        }
        
        # Extract sections using simple parsing
        current_section = None
        current_content = []
        
        for line in text.split('\n'):
            line = line.strip()
            
            # Detect section headers
            if line.startswith('### [实验名称]'):
                current_section = 'experiment_name'
                continue
            elif line.startswith('### [材料清单]'):
                if current_section and current_content:
                    self._save_section(guide, current_section, current_content)
                current_section = 'materials_list'
                current_content = []
                continue
            elif line.startswith('### [实验步骤]'):
                if current_section and current_content:
                    self._save_section(guide, current_section, current_content)
                current_section = 'steps'
                current_content = []
                continue
            elif line.startswith('### [注意事项]'):
                if current_section and current_content:
                    self._save_section(guide, current_section, current_content)
                current_section = 'cautions'
                current_content = []
                continue
            elif line.startswith('### [预期结果]'):
                if current_section and current_content:
                    self._save_section(guide, current_section, current_content)
                current_section = 'expected_results'
                current_content = []
                continue
            elif line.startswith('### [验收标准]'):
                if current_section and current_content:
                    self._save_section(guide, current_section, current_content)
                current_section = 'acceptance_criteria'
                current_content = []
                continue
            
            if current_section and line:
                current_content.append(line)
        
        # Save last section
        if current_section and current_content:
            self._save_section(guide, current_section, current_content)
        
        return guide
    
    def _save_section(self, guide: Dict[str, Any], section: str, content: List[str]):
        """Save parsed section content to guide"""
        if section == 'experiment_name':
            guide['experiment_name'] = '\n'.join(content).strip()
        elif section == 'materials_list':
            guide['materials_list'] = self._parse_list_items(content)
        elif section == 'steps':
            guide['steps'] = self._parse_numbered_items(content)
        elif section == 'cautions':
            guide['cautions'] = self._parse_list_items(content)
        elif section == 'expected_results':
            guide['expected_results'] = '\n'.join(content).strip()
        elif section == 'acceptance_criteria':
            guide['acceptance_criteria'] = self._parse_checklist_items(content)
    
    def _parse_list_items(self, lines: List[str]) -> List[str]:
        """Parse bullet list items"""
        items = []
        for line in lines:
            # Remove common bullet markers
            cleaned = line.lstrip('-*•').strip()
            if cleaned:
                items.append(cleaned)
        return items
    
    def _parse_numbered_items(self, lines: List[str]) -> List[Dict[str, str]]:
        """Parse numbered list items with sub-items"""
        items = []
        current_item = None
        current_sub_items = []
        
        for line in lines:
            # Check if it's a numbered item
            if line[0].isdigit() and '. ' in line[:4]:
                if current_item:
                    items.append({
                        'title': current_item,
                        'details': current_sub_items
                    })
                current_item = line.split('. ', 1)[1].strip() if '. ' in line else line
                current_sub_items = []
            elif line.startswith('   ') and current_item:
                current_sub_items.append(line.strip())
        
        # Add last item
        if current_item:
            items.append({
                'title': current_item,
                'details': current_sub_items
            })
        
        return items
    
    def _parse_checklist_items(self, lines: List[str]) -> List[str]:
        """Parse checklist items"""
        items = []
        for line in lines:
            # Remove checkbox markers
            cleaned = line.replace('[ ]', '').replace('[x]', '').replace('- [ ]', '').strip()
            if cleaned:
                items.append(cleaned)
        return items
    
    def _generate_fallback_guide(
        self,
        innovation_id: str,
        candidate_methods: List[str],
        target_venue: str
    ) -> Dict[str, Any]:
        """Generate minimal fallback guide if main generation fails"""
        return {
            "innovation_id": innovation_id,
            "experiment_name": f"Experiment for {innovation_id}",
            "materials_list": [
                "数据集: ImageNet-1K 或同等规模数据集",
                "计算资源: GPU服务器 (建议A100或V100)",
                "软件: Python 3.9+, PyTorch 2.0+"
            ],
            "steps": [
                {"title": "环境配置", "details": ["安装依赖", "验证GPU"]}
            ],
            "cautions": [
                "设置固定随机种子确保可复现性",
                "监控GPU内存使用"
            ],
            "expected_results": "性能超越基线方法",
            "acceptance_criteria": [
                "性能提升≥2%",
                "实验可复现"
            ],
            "target_venue": target_venue,
            "generated_at": datetime.now().isoformat(),
            "is_fallback": True
        }
    
    def validate_guide(self, guide: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate experiment guide completeness.
        
        Returns validation report with missing sections.
        """
        required_sections = [
            "experiment_name",
            "materials_list",
            "steps",
            "cautions",
            "expected_results",
            "acceptance_criteria"
        ]
        
        missing = []
        for section in required_sections:
            value = guide.get(section)
            if not value or (isinstance(value, list) and len(value) == 0):
                missing.append(section)
        
        return {
            "is_valid": len(missing) == 0,
            "missing_sections": missing,
            "completeness_score": (len(required_sections) - len(missing)) / len(required_sections),
            "guide": guide
        }


# Convenience function for direct usage
async def generate_experiment_guide(
    innovation_id: str,
    candidate_methods: List[str],
    target_venue: str = "NeurIPS",
    llm_client=None
) -> Dict[str, Any]:
    """
    Generate experiment guide for an innovation point.
    
    Args:
        innovation_id: Innovation point identifier
        candidate_methods: List of candidate method names/IDs
        target_venue: Target conference venue
        llm_client: Optional LLM client
        
    Returns:
        Complete experiment guide
    """
    generator = ExperimentGuideGenerator(llm_client=llm_client)
    return await generator.generate_guide(innovation_id, candidate_methods, target_venue)
