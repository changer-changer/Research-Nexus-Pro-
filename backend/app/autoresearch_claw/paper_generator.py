"""AutoResearchClaw 适配层 - 论文生成引擎

调用 AutoResearchClaw 核心功能生成论文
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import subprocess
import json
import os
from pathlib import Path


class PaperTemplate(str, Enum):
    """论文模板类型"""
    NEURIPS = "neurips_2025"
    ICLR = "iclr_2026"
    ICML = "icml_2026"
    ACL = "acl_2025"
    CVPR = "cvpr_2025"
    GENERIC = "generic"


@dataclass
class PaperGenerationConfig:
    """论文生成配置"""
    template: PaperTemplate = PaperTemplate.NEURIPS
    target_length: int = 6000  # 目标字数
    include_experiments: bool = True
    include_figures: bool = True
    language: str = "bilingual"  # bilingual | en | zh
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "template": self.template.value,
            "target_length": self.target_length,
            "include_experiments": self.include_experiments,
            "include_figures": self.include_figures,
            "language": self.language
        }


@dataclass
class GeneratedPaper:
    """生成的论文"""
    title: str
    title_zh: Optional[str]
    abstract: str
    abstract_zh: Optional[str]
    sections: Dict[str, str]
    sections_zh: Optional[Dict[str, str]]
    references: List[Dict[str, str]]
    latex_content: str
    experiment_guide: Optional[str]
    figures: List[str]  # base64 encoded images or paths
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "title_zh": self.title_zh,
            "abstract": self.abstract,
            "abstract_zh": self.abstract_zh,
            "sections": self.sections,
            "sections_zh": self.sections_zh,
            "references": self.references,
            "latex_content": self.latex_content,
            "experiment_guide": self.experiment_guide,
            "figures": self.figures
        }


class PaperGenerator:
    """论文生成引擎
    
    基于 AutoResearchClaw 的 Stages 16-17 (Paper Outline + Paper Draft)
    适配 Research-Nexus Pro 的创新点数据格式
    """
    
    def __init__(self, autoresearch_path: Optional[str] = None):
        self.autoresearch_path = autoresearch_path or "/home/cuizhixing/AutoResearchClaw"
        self.prompts = self._load_prompts()
    
    def _load_prompts(self) -> Dict[str, str]:
        """加载论文生成 Prompts"""
        return {
            "title_guidelines": """
Title Guidelines:
- 8-14 words, use colon format: "[Method]: [What it does] for [Domain]"
- Be specific: name your method/approach
- Avoid vague terms like "novel", "efficient", "improved"
- Include key domain terms
""",
            "abstract_structure": """
Abstract Structure (PMR+ format, 180-220 words):
S1-S2: PROBLEM — What gap exists? Why does it matter? (2 sentences)
S3-S4: METHOD — Name your system. One-sentence description of key insight. (2 sentences)
S5-S6: RESULTS — At most 3 specific numbers. (2 sentences)
S7 (optional): IMPACT — What does this enable? (1 sentence)
""",
            "writing_structure": """
Section word targets:
- Abstract: 180-220
- Introduction: 800-1000
- Related Work: 600-800
- Method: 1000-1500
- Experiments: 800-1200
- Results: 600-800
- Discussion: 400-600
- Limitations: 200-300
- Conclusion: 200-300

Writing rules:
1. Every claim needs evidence
2. Methodology → Evidence chain must be tight
3. Use specific numbers, not vague adjectives
4. Cite primary sources, not secondary reviews
5. Explain limitations honestly
""",
            "academic_style": """
Academic Writing Style:
- Clear > Clever
- Precise > Flowery
- Evidence > Assertion
- Specific > General
- Honest > Boastful

Avoid:
- "Revolutionary", "breakthrough", "state-of-the-art" (unless proven)
- Weasel words: "quite", "very", "extremely", "significantly" (without numbers)
- Uncited claims
- Future work disguised as contributions
"""
        }
    
    async def generate_from_innovation(
        self,
        innovation_data: Dict[str, Any],
        related_papers: List[Dict[str, Any]],
        config: Optional[PaperGenerationConfig] = None
    ) -> GeneratedPaper:
        """
        从创新点生成论文
        
        Args:
            innovation_data: 创新点数据
                - title: 标题
                - problem_statement: 问题陈述
                - proposed_solution: 解决方案
                - expected_impact: 预期影响
                - implementation_path: 实现路径
            related_papers: 相关论文列表
            config: 生成配置
        
        Returns:
            生成的论文
        """
        config = config or PaperGenerationConfig()
        
        # 1. 生成大纲
        outline = self._generate_outline(innovation_data, related_papers, config)
        
        # 2. 生成各章节
        sections = {}
        sections_zh = {} if config.language == "bilingual" else None
        
        for section_name, section_outline in outline.items():
            content = self._generate_section(
                section_name, 
                section_outline,
                innovation_data,
                related_papers,
                config
            )
            sections[section_name] = content
            
            if config.language == "bilingual":
                content_zh = self._translate_section(content, section_name)
                sections_zh[section_name] = content_zh
        
        # 3. 生成标题和摘要
        title = self._generate_title(innovation_data, sections.get("abstract", ""))
        abstract = sections.get("abstract", "")
        
        title_zh = None
        abstract_zh = None
        if config.language == "bilingual":
            title_zh = self._translate_title(title)
            abstract_zh = sections_zh.get("abstract") if sections_zh else None
        
        # 4. 提取参考文献
        references = self._extract_references(related_papers)
        
        # 5. 生成 LaTeX
        latex = self._generate_latex(
            title, abstract, sections, references, config.template
        )
        
        # 6. 生成实验指南（占位符形式）
        experiment_guide = self._generate_experiment_guide(innovation_data)
        
        return GeneratedPaper(
            title=title,
            title_zh=title_zh,
            abstract=abstract,
            abstract_zh=abstract_zh,
            sections=sections,
            sections_zh=sections_zh,
            references=references,
            latex_content=latex,
            experiment_guide=experiment_guide,
            figures=[]  # 暂不支持自动生成图表
        )
    
    def _generate_outline(
        self,
        innovation: Dict[str, Any],
        papers: List[Dict[str, Any]],
        config: PaperGenerationConfig
    ) -> Dict[str, str]:
        """生成论文大纲"""
        # 基于创新点和相关论文生成结构化大纲
        outline = {
            "abstract": "PMR+ format: Problem, Method, Results (+Impact)",
            "introduction": f"""
1. Hook: {innovation.get('problem_statement', '')[:100]}...
2. Problem: Specific research gap
3. Challenge: Why existing methods fail
4. Solution: {innovation.get('proposed_solution', '')[:100]}...
5. Contributions: 2-3 concrete claims
6. Structure: Section roadmap
""",
            "related_work": f"""
1. Foundational work in this area (2-3 papers)
2. Recent advances ({len(papers)} papers analyzed)
3. Key limitations of prior work
4. How this work differs
""",
            "method": f"""
1. Problem formulation
2. Approach overview
3. Detailed algorithm/ architecture
4. Theoretical analysis (if applicable)
""",
        }
        
        if config.include_experiments:
            outline["experiments"] = """
1. Experimental setup
2. Datasets
3. Baselines
4. Metrics
5. Implementation details
"""
            outline["results"] = """
1. Main results (quantitative)
2. Ablation studies
3. Qualitative analysis
"""
            outline["discussion"] = """
1. Key findings
2. Implications
3. Limitations
"""
        
        outline["conclusion"] = """
1. Summary of contributions
2. Future work
"""
        
        return outline
    
    def _generate_section(
        self,
        section_name: str,
        outline: str,
        innovation: Dict[str, Any],
        papers: List[Dict[str, Any]],
        config: PaperGenerationConfig
    ) -> str:
        """生成单个章节内容"""
        # 这里应该是调用 LLM 生成
        # 简化版本：返回结构化模板
        
        templates = {
            "abstract": f"""[Abstract will be generated based on:
- Problem: {innovation.get('problem_statement', '')[:200]}...
- Method: {innovation.get('proposed_solution', '')[:200]}...
- Expected results: {innovation.get('expected_impact', '')[:200]}...]""",
            
            "introduction": f"""[Introduction placeholder:
- Hook and problem statement
- Literature context ({len(papers)} papers)
- Proposed approach
- Contributions]
""",
            
            "related_work": f"""[Related Work based on {len(papers)} papers:
{chr(10).join([f"- {p.get('title', 'Unknown')}" for p in papers[:5]])}
...]
""",
            
            "method": f"""[Method section:
{innovation.get('proposed_solution', '[Method details to be elaborated]')}

Implementation path:
{chr(10).join([f"{i+1}. {step.get('description', 'Step')}" for i, step in enumerate(innovation.get('implementation_path', [])[:5])])}]
""",
            
            "experiments": """[Experiment section - PLACEHOLDER]

[PENDING: Experiment data to be collected]
- Dataset details
- Baseline comparisons
- Ablation studies
""",
            
            "results": """[Results section - PLACEHOLDER]

[PENDING: Experimental results to be filled]
- Quantitative metrics
- Qualitative analysis
""",
            
            "discussion": """[Discussion section]

Key findings and implications based on results.
Limitations and future work.
""",
            
            "conclusion": f"""[Conclusion]

Summary of contributions:
- Problem: {innovation.get('problem_statement', '')[:100]}...
- Solution: {innovation.get('proposed_solution', '')[:100]}...

Future work directions.
"""
        }
        
        return templates.get(section_name, f"[{section_name} content]")
    
    def _translate_section(self, content: str, section_name: str) -> str:
        """将章节内容翻译为中文"""
        return f"[{section_name} 中文版本]\n\n[翻译待生成]\n\n{content[:500]}..."
    
    def _generate_title(self, innovation: Dict[str, Any], abstract: str) -> str:
        """生成论文标题"""
        base_title = innovation.get("title", "Research Paper")
        # 改进标题格式
        return f"{base_title}: A Novel Approach to {innovation.get('expected_impact', 'Target Problem')[:50]}"
    
    def _translate_title(self, title: str) -> str:
        """翻译标题为中文"""
        return f"{title}（中文标题待翻译）"
    
    def _extract_references(self, papers: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """从论文列表提取参考文献"""
        refs = []
        for i, paper in enumerate(papers[:20], 1):  # 最多20篇
            ref = {
                "id": f"ref{i:02d}",
                "title": paper.get("title", "Unknown"),
                "authors": ", ".join(paper.get("authors", ["Unknown"])),
                "year": str(paper.get("year", "2024")),
                "venue": paper.get("venue", "Unknown"),
                "url": paper.get("url", "")
            }
            refs.append(ref)
        return refs
    
    def _generate_latex(
        self,
        title: str,
        abstract: str,
        sections: Dict[str, str],
        references: List[Dict[str, str]],
        template: PaperTemplate
    ) -> str:
        """生成 LaTeX 代码"""
        # 简化版本：返回模板框架
        # 生成 LaTeX 章节
        latex_sections = []
        for s, c in sections.items():
            if s != "abstract":
                section_title = s.title()
                latex_sections.append(f"\\section{{{section_title}}}\n{c}")
        
        latex_sections_str = "\n\n".join(latex_sections)
        
        latex = f"""\\documentclass{{article}}
\\usepackage{{amsmath, amssymb}}
\\usepackage{{graphicx}}
\\usepackage{{hyperref}}
\\usepackage{{natbib}}

\\title{{{title}}}
\\author{{Anonymous}}
\\date{{\\today}}

\\begin{{document}}

\\maketitle

\\begin{{abstract}}
{abstract}
\\end{{abstract}}

{latex_sections_str}

\\bibliography{{references}}
\\bibliographystyle{{plainnat}}

\\end{{document}}
"""
        return latex
    
    def _generate_experiment_guide(self, innovation: Dict[str, Any]) -> str:
        """生成实验指南（占位符形式）"""
        guide = f"""# Experiment Guide

## Overview
Based on: {innovation.get('title', 'Research Topic')}

## Implementation Steps
"""
        for i, step in enumerate(innovation.get("implementation_path", []), 1):
            guide += f"\n### Step {i}: {step.get('description', f'Step {i}')}\n"
            guide += f"- Expected output: {step.get('output', 'TBD')}\n"
            guide += f"- Verification: {step.get('verification', 'TBD')}\n"
            guide += f"- [PENDING: Detailed instructions to be generated]\n"
        
        return guide


# 便捷函数
def generate_paper(
    innovation: Dict[str, Any],
    related_papers: List[Dict[str, Any]],
    template: str = "neurips_2025",
    bilingual: bool = True
) -> Dict[str, Any]:
    """
    便捷论文生成函数
    
    Usage:
        paper = generate_paper(
            innovation={...},
            related_papers=[...],
            template="neurips_2025"
        )
    """
    import asyncio
    
    config = PaperGenerationConfig(
        template=PaperTemplate(template),
        language="bilingual" if bilingual else "en"
    )
    
    generator = PaperGenerator()
    
    # 运行异步生成
    result = asyncio.run(generator.generate_from_innovation(
        innovation, related_papers, config
    ))
    
    return result.to_dict()