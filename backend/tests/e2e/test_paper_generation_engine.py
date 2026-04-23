#!/usr/bin/env python3
"""
论文生成引擎测试 (Paper Generation Engine Tests)

测试PaperGenerationEngine的完整流程和各组件
"""

import pytest
import asyncio
import json
import os
import tempfile
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime


# 导入被测试的模块
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'app', 'services', 'paper_generation'))

from engine import PaperGenerationEngine, PaperAssembler, GenerationStage
from feasibility_evaluator import ExperimentFeasibilityEvaluator, evaluate_experiment_feasibility
from validators.quality_checker import QualityChecker
from validators.completeness_checker import CompletenessChecker


class TestPaperGenerationEngine:
    """论文生成引擎测试"""
    
    @pytest.fixture
    def engine(self):
        """创建测试引擎实例"""
        mock_llm = Mock()
        mock_llm.messages = Mock()
        mock_llm.messages.create = AsyncMock(return_value=Mock(
            content=[Mock(text="Mock response")]
        ))
        return PaperGenerationEngine(llm_client=mock_llm)
    
    @pytest.fixture
    def sample_innovation(self):
        """示例创新点数据"""
        return {
            "id": "innov_test_001",
            "type": "cross_domain",
            "title": "Cross-Domain Transfer for Tactile Perception",
            "description": "Applying acoustic metamaterial principles to tactile sensor design",
            "sourcePapers": [
                {"title": "High-Frequency Tactile Sensing", "year": 2024},
                {"title": "Acoustic Metamaterials Review", "year": 2023}
            ],
            "targetProblem": {
                "name": "High-Frequency Tactile Signal Capture",
                "description": "Current tactile sensors struggle to capture vibrations above 500Hz.",
                "questions": ["How to capture high-frequency tactile signals?"]
            },
            "proposedMethod": {
                "name": "Metamaterial-Inspired Tactile Sensor",
                "description": "A novel sensor design inspired by acoustic metamaterial principles",
                "components": ["Metamaterial core", "Optical readout", "Signal processing"],
                "architecture": "Layered metamaterial structure"
            },
            "confidenceScore": 0.85,
            "expectedImpact": "Enable next-generation robotic manipulation"
        }
    
    # ==================== 阶段测试 ====================
    
    @pytest.mark.asyncio
    async def test_generate_title(self, engine, sample_innovation):
        """测试标题生成"""
        title = await engine.generate_title(sample_innovation, "NeurIPS")
        
        assert isinstance(title, str)
        assert len(title) > 0
        assert title != "Untitled Paper"
    
    @pytest.mark.asyncio
    async def test_generate_abstract(self, engine, sample_innovation):
        """测试摘要生成 (PMR格式)"""
        title = "Metamaterial-Inspired Tactile Sensor: A Cross-Domain Approach"
        abstract = await engine.generate_abstract(sample_innovation, title, "NeurIPS")
        
        assert isinstance(abstract, dict)
        assert "full_text" in abstract
        assert "problem" in abstract
        assert "method" in abstract
        assert "result" in abstract
        assert "word_count" in abstract
    
    @pytest.mark.asyncio
    async def test_generate_introduction(self, engine, sample_innovation):
        """测试引言生成"""
        title = "Test Paper Title"
        abstract = {"full_text": "Test abstract content"}
        
        introduction = await engine.generate_introduction(sample_innovation, title, abstract)
        
        assert isinstance(introduction, str)
        assert len(introduction) > 0
    
    @pytest.mark.asyncio
    async def test_generate_methodology(self, engine, sample_innovation):
        """测试方法论生成"""
        paper_sections = {
            "title": "Test Paper",
            "abstract": {"full_text": "Test abstract"},
            "introduction": "Test introduction"
        }
        
        methodology = await engine.generate_methodology(sample_innovation, paper_sections)
        
        assert isinstance(methodology, str)
        assert len(methodology) > 0
    
    @pytest.mark.asyncio
    async def test_generate_experiment_design(self, engine, sample_innovation):
        """测试实验设计生成"""
        paper_sections = {
            "title": "Test Paper",
            "methodology": "Test methodology"
        }
        
        exp_design = await engine.generate_experiment_design(sample_innovation, paper_sections)
        
        assert isinstance(exp_design, dict)
        assert "design_text" in exp_design
        assert "slots" in exp_design
        assert isinstance(exp_design["slots"], list)
        assert len(exp_design["slots"]) > 0
    
    @pytest.mark.asyncio
    async def test_generate_analysis_framework(self, engine, sample_innovation):
        """测试分析框架生成"""
        paper_sections = {
            "title": "Test Paper",
            "experiment_design": {"slots": []}
        }
        
        analysis = await engine.generate_analysis_framework(sample_innovation, paper_sections)
        
        assert isinstance(analysis, str)
        assert len(analysis) > 0
    
    @pytest.mark.asyncio
    async def test_generate_conclusion(self, engine, sample_innovation):
        """测试结论生成"""
        paper_sections = {
            "title": "Test Paper",
            "abstract": {"full_text": "Test abstract"},
            "methodology": "Test methodology",
            "experiment_design": {"design_text": "Test experiments"}
        }
        
        conclusion = await engine.generate_conclusion(paper_sections)
        
        assert isinstance(conclusion, str)
        assert len(conclusion) > 0
    
    # ==================== 完整流程测试 ====================
    
    @pytest.mark.asyncio
    async def test_generate_complete_paper(self, engine, sample_innovation):
        """测试完整论文生成流程"""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine.db_path = os.path.join(tmpdir, "test.db")
            
            paper = await engine.generate(
                innovation_id="innov_test_001",
                target_venue="NeurIPS"
            )
            
            # 验证所有必需字段
            assert "innovation_id" in paper
            assert "target_venue" in paper
            assert "title" in paper
            assert "abstract" in paper
            assert "introduction" in paper
            assert "methodology" in paper
            assert "experiment_design" in paper
            assert "analysis" in paper
            assert "conclusion" in paper
            assert "quality_report" in paper
            assert "created_at" in paper
    
    @pytest.mark.asyncio
    async def test_stream_generate(self, engine, sample_innovation):
        """测试流式生成"""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine.db_path = os.path.join(tmpdir, "test.db")
            
            events = []
            async for event in engine.stream_generate(
                task_id="task_001",
                innovation_id="innov_test_001",
                target_venue="NeurIPS"
            ):
                events.append(event)
                assert "stage" in event
                assert "progress" in event
                assert "message" in event
            
            # 验证事件序列
            assert len(events) > 0
            assert events[0]["stage"] == "init"
            assert events[-1]["stage"] == "complete"
            assert events[-1]["progress"] == 100
    
    # ==================== 验证器测试 ====================
    
    @pytest.mark.asyncio
    async def test_quality_validation(self, engine, sample_innovation):
        """测试质量验证"""
        with tempfile.TemporaryDirectory() as tmpdir:
            engine.db_path = os.path.join(tmpdir, "test.db")
            
            paper = await engine.generate("innov_test_001", "NeurIPS")
            quality_report = paper.get("quality_report", {})
            
            assert "quality" in quality_report
            assert "completeness" in quality_report
            assert "passed" in quality_report
            assert isinstance(quality_report["passed"], bool)
    
    # ==================== 工具方法测试 ====================
    
    def test_assemble_paper_text(self, engine):
        """测试论文文本组装"""
        paper_sections = {
            "title": "Test Paper Title",
            "abstract": {"full_text": "Test abstract content"},
            "introduction": "Test introduction",
            "methodology": "Test methodology",
            "experiment_design": {
                "design_text": "Test experiments",
                "slots": [
                    {"slot_id": "exp_1", "placeholder": "[PENDING:exp1]"}
                ]
            },
            "analysis": "Test analysis",
            "conclusion": "Test conclusion"
        }
        
        paper_text = engine._assemble_paper_text(paper_sections)
        
        assert isinstance(paper_text, str)
        assert "Test Paper Title" in paper_text
        assert "Test abstract" in paper_text
        assert "Test methodology" in paper_text
        assert "[PENDING:exp1]" in paper_text
    
    def test_generate_experiment_slots(self, engine, sample_innovation):
        """测试实验占位符生成"""
        slots = engine._generate_experiment_slots(sample_innovation)
        
        assert isinstance(slots, list)
        assert len(slots) >= 3  # 至少有3个实验槽
        
        for slot in slots:
            assert "slot_id" in slot
            assert "type" in slot
            assert "description" in slot
            assert "placeholder" in slot
            assert "estimated_weeks" in slot
    
    def test_fill_template(self, engine):
        """测试模板填充"""
        template = "Title: ${title}, Venue: ${venue}"
        variables = {
            "title": "Test Paper",
            "venue": "NeurIPS"
        }
        
        result = engine._fill_template(template, variables)
        
        assert "Test Paper" in result
        assert "NeurIPS" in result


class TestPaperAssembler:
    """论文组装器测试"""
    
    @pytest.fixture
    def sample_sections(self):
        """示例论文章节"""
        return {
            "title": "Test Paper Title",
            "target_venue": "NeurIPS",
            "abstract": {
                "full_text": "This is the abstract. Problem: X. Method: Y. Result: Z."
            },
            "introduction": "Test introduction section.",
            "methodology": "Test methodology section.",
            "experiment_design": {
                "design_text": "Test experiment design."
            },
            "analysis": "Test analysis framework.",
            "conclusion": "Test conclusion.",
            "innovation_id": "innov_001"
        }
    
    @pytest.fixture
    def sample_slots(self):
        """示例实验槽"""
        return [
            {
                "slot_id": "exp_1",
                "type": "main_performance",
                "description": "Main performance evaluation",
                "expected_outcome": "Table with results",
                "placeholder": "[PENDING:实验1-主性能评估]",
                "estimated_weeks": 2
            },
            {
                "slot_id": "exp_2",
                "type": "ablation_study",
                "description": "Ablation study",
                "expected_outcome": "Bar chart",
                "placeholder": "[PENDING:实验2-消融研究]",
                "estimated_weeks": 1
            }
        ]
    
    def test_assemble_markdown(self, sample_sections, sample_slots):
        """测试Markdown组装"""
        markdown = PaperAssembler.assemble_markdown(sample_sections, sample_slots)
        
        assert isinstance(markdown, str)
        assert "# Test Paper Title" in markdown
        assert "## Abstract" in markdown
        assert "## 1. Introduction" in markdown
        assert "## 3. Methodology" in markdown
        assert "[PENDING:实验1-主性能评估]" in markdown
        assert "[PENDING:实验2-消融研究]" in markdown
    
    def test_assemble_latex(self, sample_sections, sample_slots):
        """测试LaTeX组装"""
        latex = PaperAssembler.assemble_latex(sample_sections, sample_slots)
        
        assert isinstance(latex, str)
        assert "\\documentclass" in latex
        assert "\\title{Test Paper Title}" in latex
        assert "\\begin{document}" in latex
        assert "\\section{Introduction}" in latex
        assert "\\section{Experiments}" in latex
    
    def test_to_latex_conversion(self):
        """测试Markdown到LaTeX转换"""
        markdown = """
# Title
## Section 1
**Bold text** and *italic text*
```code
print("hello")
```
`inline code`
"""
        
        latex = PaperAssembler.to_latex(markdown)
        
        assert isinstance(latex, str)
        assert "\\section{Title}" in latex
        assert "\\subsection{Section 1}" in latex
        assert "\\textbf{Bold text}" in latex
        assert "\\textit{italic text}" in latex
        assert "\\texttt{inline code}" in latex


class TestQualityChecker:
    """质量检查器测试"""
    
    @pytest.fixture
    def checker(self):
        return QualityChecker("NeurIPS")
    
    def test_check_abstract_quality(self, checker):
        """测试摘要质量检查"""
        abstract = {
            "full_text": "This paper addresses the problem of X. We propose a novel method Y. Our results show Z."
        }
        
        checker._check_abstract(abstract)
        
        # 检查应该能识别PMR结构
        assert len(checker.issues) == 0 or all("Abstract" not in i for i in checker.issues)
    
    def test_check_abstract_too_short(self, checker):
        """测试摘要过短检测"""
        abstract = {"full_text": "Too short."}
        
        checker._check_abstract(abstract)
        
        assert any("too short" in i.lower() for i in checker.issues)
    
    def test_check_citations(self, checker):
        """测试引用检查"""
        content = "This paper [1] builds on previous work [2, 3]. Smith et al. proposed..."
        
        checker._check_citations(content)
        
        # 有引用的内容不应该报警告
        assert len(checker.warnings) == 0 or all("Low citation" not in w for w in checker.warnings)
    
    def test_check_writing_quality(self, checker):
        """测试写作质量检查"""
        content = "This is very very very good. The thing is clear."
        
        checker._check_writing_quality(content)
        
        # 应该检测到重复使用的weak words
        assert len(checker.warnings) > 0
    
    def test_calculate_score(self, checker):
        """测试分数计算"""
        checker.issues = ["Issue 1", "Issue 2"]
        checker.warnings = ["Warning 1"]
        
        score = checker._calculate_score()
        
        # 100 - 2*10 - 1*5 = 75
        assert score == 75
    
    def test_get_grade(self, checker):
        """测试等级转换"""
        assert checker._get_grade(95) == "A"
        assert checker._get_grade(85) == "B"
        assert checker._get_grade(75) == "C"
        assert checker._get_grade(65) == "D"
        assert checker._get_grade(55) == "F"
    
    def test_full_paper_check(self, checker):
        """测试完整论文检查"""
        paper_content = "This paper [1] is very very good. " * 50
        metadata = {
            "abstract": {"full_text": "Problem X. Method Y. Result Z. " * 20},
            "sections": ["introduction", "method", "experiment", "conclusion"]
        }
        
        report = checker.check_paper(paper_content, metadata)
        
        assert "score" in report
        assert "grade" in report
        assert "issues" in report
        assert "warnings" in report
        assert "venue" in report
        assert "passes_minimum" in report
        assert isinstance(report["passes_minimum"], bool)


class TestCompletenessChecker:
    """完整性检查器测试"""
    
    @pytest.fixture
    def checker(self):
        return CompletenessChecker()
    
    def test_check_complete_sections(self, checker):
        """测试完整章节检查"""
        paper_data = {
            "abstract": {"content": "This is a long abstract with enough words to pass the minimum requirement. " * 5},
            "introduction": "Introduction content. " * 100,
            "related_work": "Related work content. " * 100,
            "methodology": "Methodology content with detailed explanation. " * 100,
            "experiments": [
                {"status": "completed"}
            ],
            "conclusion": "Conclusion content. " * 50,
            "references": ["ref1", "ref2"],
            "figures": ["fig1"],
            "tables": ["table1"]
        }
        
        report = checker.check_completeness(paper_data)
        
        assert "is_complete" in report
        assert "completion_rate" in report
        assert "ready_for_review" in report
        assert report["completion_rate"] >= 80
    
    def test_check_incomplete_sections(self, checker):
        """测试不完整章节检测"""
        paper_data = {
            "abstract": "",  # 缺失
            "introduction": "Short.",  # 太短
            "references": ["ref1"]  # 引用太少
        }
        
        report = checker.check_completeness(paper_data)
        
        assert len(report["missing_sections"]) > 0
        assert len(report["incomplete_sections"]) > 0
        assert report["completion_rate"] < 100
    
    def test_check_experiments_pending(self, checker):
        """测试实验待完成检测"""
        paper_data = {
            "experiments": [
                {"status": "pending"},
                {"status": "completed"}
            ]
        }
        
        report = checker.check_completeness(paper_data)
        
        assert any(
            "pending" in str(i.get("issue", "")).lower()
            for i in report["incomplete_sections"]
        )
    
    def test_get_next_steps(self, checker):
        """测试下一步建议"""
        paper_data = {
            "abstract": "",
            "introduction": "Test content that is long enough to pass the minimum word count for the introduction section. " * 10,
            "references": []
        }
        
        checker.check_completeness(paper_data)
        steps = checker.get_next_steps()
        
        assert len(steps) > 0
        assert any("abstract" in step.lower() for step in steps)
    
    def test_estimated_completion_time(self, checker):
        """测试完成时间估算"""
        paper_data = {
            "abstract": "",
            "introduction": "Short.",
            "methodology": ""
        }
        
        checker.check_completeness(paper_data)
        time_estimate = checker.get_estimated_completion_time()
        
        assert isinstance(time_estimate, str)
        assert "hours" in time_estimate


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
