"""AutoResearchClaw 适配层 - 主适配器

统一入口，封装所有 AutoResearchClaw 集成功能
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from .literature_search import DeepLiteratureSearch, LiteratureSource, LiteraturePaper
from .experiment_classifier import ExperimentClassifier, ExperimentMode
from .paper_generator import PaperGenerator, PaperGenerationConfig, GeneratedPaper
from .llm_analyzer import LLMAnalyzer

logger = logging.getLogger(__name__)


@dataclass
class ResearchContext:
    """研究上下文"""
    topic: str
    innovation_data: Dict[str, Any]
    related_papers: List[Dict[str, Any]]
    feasibility: Optional[Dict[str, Any]] = None
    generated_paper: Optional[Dict[str, Any]] = None


class AutoResearchClawAdapter:
    """AutoResearchClaw 主适配器

    为 Research-Nexus Pro 提供统一的 AutoResearchClaw 功能调用接口
    """

    def __init__(self):
        self.literature_search = DeepLiteratureSearch()
        self.experiment_classifier = ExperimentClassifier()
        self.paper_generator = PaperGenerator()
        self.llm_analyzer = LLMAnalyzer()

    async def deep_literature_search(
        self,
        query: str,
        sources: List[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        深度文献搜索

        Args:
            query: 搜索查询
            sources: 来源列表 ["openalex", "arxiv", "semantic_scholar"]
            limit: 返回结果数量

        Returns:
            文献列表
        """
        if sources:
            source_list = [LiteratureSource(s) for s in sources]
            results = await self.literature_search.search_multi_source(
                query, source_list, limit_per_source=limit // len(source_list) + 5
            )
            # 合并所有来源
            all_papers = []
            for papers in results.values():
                all_papers.extend(papers)
            papers = all_papers[:limit]
        else:
            papers = await self.literature_search.search_aggregated(query, limit)

        return [p.to_dict() for p in papers]

    def classify_experiment(
        self,
        innovation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        分类实验可行性

        Args:
            innovation_data: 创新点数据
                - title: 标题
                - problem_statement: 问题陈述
                - proposed_solution: 解决方案
                - required_skills: 所需技能列表
                - implementation_path: 实现路径

        Returns:
            可行性评估结果
        """
        feasibility = self.experiment_classifier.classify(
            title=innovation_data.get("title", ""),
            problem=innovation_data.get("problem_statement", ""),
            solution=innovation_data.get("proposed_solution", ""),
            skills=innovation_data.get("required_skills", []),
            implementation_path=innovation_data.get("implementation_path")
        )
        return feasibility.to_dict()

    async def generate_paper(
        self,
        innovation_data: Dict[str, Any],
        related_papers: List[Dict[str, Any]],
        template: str = "neurips_2025",
        bilingual: bool = True
    ) -> Dict[str, Any]:
        """
        从创新点生成论文

        Args:
            innovation_data: 创新点数据
            related_papers: 相关论文列表
            template: 论文模板
            bilingual: 是否生成双语版本

        Returns:
            生成的论文
        """
        from .paper_generator import PaperTemplate

        config = PaperGenerationConfig(
            template=PaperTemplate(template),
            language="bilingual" if bilingual else "en"
        )

        paper = await self.paper_generator.generate_from_innovation(
            innovation_data, related_papers, config
        )

        return paper.to_dict()

    async def enhance_innovation(
        self,
        innovation_data: Dict[str, Any],
        search_depth: str = "medium"  # light | medium | deep
    ) -> Dict[str, Any]:
        """
        创新点深度分析（Deep Analysis）

        基于多源文献搜索 + Kimi LLM 智能分析，为创新点提供：
        - 研究脉络分析（谁在做什么，关键里程碑）
        - 技术前沿扫描（最新方法、新兴趋势）
        - 竞争态势分析（差异化机会、已被覆盖的方向）
        - 文献缺口识别（具体未验证的假设、缺失的实验）
        - 可执行研究建议（具体下一步、实验设计）
        - 精选推荐文献（带一句话相关性说明）

        Args:
            innovation_data: 创新点数据
            search_depth: 搜索深度
                - light: 快速分析，约30篇文献
                - medium: 标准分析，约60篇文献（默认）
                - deep: 深度分析，约120篇文献

        Returns:
            结构化深度分析结果
        """
        # Step 1: Generate intelligent search queries via LLM
        logger.info(f"[DeepAnalysis] Step 1/4: Generating search queries for '{innovation_data.get('title', 'Unknown')}'")
        queries = await self.llm_analyzer.generate_search_queries(
            title=innovation_data.get("title", ""),
            problem_statement=innovation_data.get("problem_statement", ""),
            proposed_solution=innovation_data.get("proposed_solution", ""),
            description=innovation_data.get("description", "")
        )

        # Step 2: Multi-source parallel search
        logger.info(f"[DeepAnalysis] Step 2/4: Searching {len(queries)} queries across OpenAlex/arXiv/SemanticScholar")

        limits = {"light": 8, "medium": 15, "deep": 30}
        limit_per_query = limits.get(search_depth, 15)

        all_papers: List[LiteraturePaper] = []
        for sq in queries:
            try:
                papers = await self.literature_search.search_aggregated(sq.query, limit_per_query)
                all_papers.extend(papers)
            except Exception as e:
                logger.warning(f"Search failed for query '{sq.query}': {e}")

        # Deduplicate and re-rank
        unique_papers = self.literature_search._deduplicate(all_papers)
        ranked_papers = self.literature_search._rank_papers(unique_papers)

        # Limit total papers based on depth
        total_limits = {"light": 30, "medium": 60, "deep": 120}
        max_papers = total_limits.get(search_depth, 60)
        final_papers = ranked_papers[:max_papers]

        logger.info(f"[DeepAnalysis] Collected {len(final_papers)} unique papers after dedup")

        # Step 3: LLM-driven deep analysis
        logger.info("[DeepAnalysis] Step 3/4: Running LLM deep analysis via Kimi API")
        paper_dicts = [p.to_dict() for p in final_papers]
        analysis = await self.llm_analyzer.analyze_literature(innovation_data, paper_dicts)

        # Step 4: Build structured response
        logger.info("[DeepAnalysis] Step 4/4: Building response")

        # Build source distribution
        source_dist = {}
        year_dist = {}
        venue_dist = {}
        for p in final_papers:
            s = p.source.value
            source_dist[s] = source_dist.get(s, 0) + 1
            if p.year:
                yr = str(p.year)
                year_dist[yr] = year_dist.get(yr, 0) + 1
            if p.venue:
                v = p.venue[:50]
                venue_dist[v] = venue_dist.get(v, 0) + 1

        # Convert Pydantic models to dict for JSON serialization
        def dim_to_dict(dim):
            return {
                "summary": dim.summary,
                "key_findings": [
                    {"text": f.text, "confidence": f.confidence, "supporting_papers": f.supporting_papers}
                    for f in dim.key_findings
                ],
                "confidence_score": dim.confidence_score
            }

        return {
            "original_innovation": innovation_data,
            "analysis": {
                "research_landscape": dim_to_dict(analysis.research_landscape),
                "technical_frontier": dim_to_dict(analysis.technical_frontier),
                "competitive_analysis": dim_to_dict(analysis.competitive_analysis),
                "literature_gaps": dim_to_dict(analysis.literature_gaps),
                "actionable_recommendations": dim_to_dict(analysis.actionable_recommendations),
            },
            "recommended_papers": [
                {
                    "id": p.id,
                    "title": p.title,
                    "authors": p.authors,
                    "year": p.year,
                    "venue": p.venue,
                    "citation_count": p.citation_count,
                    "source": p.source,
                    "relevance_note": p.relevance_note,
                    "relevance_score": p.relevance_score,
                    "url": None,  # populated below
                    "pdf_url": None
                }
                for p in analysis.recommended_papers
            ],
            "overall_assessment": analysis.overall_assessment,
            "literature_landscape": {
                "source_distribution": source_dist,
                "year_distribution": dict(sorted(year_dist.items(), reverse=True)[:10]),
                "top_venues": dict(sorted(venue_dist.items(), key=lambda x: x[1], reverse=True)[:8])
            },
            "novelty_indicators": {
                "recent_works_2020_plus": sum(1 for p in final_papers if p.year and p.year >= 2020),
                "highly_cited": sum(1 for p in final_papers if p.citation_count > 100),
                "open_access": sum(1 for p in final_papers if p.pdf_url),
                "total_collected": len(final_papers)
            },
            "search_metadata": {
                "queries": [{"query": q.query, "dimension": q.dimension, "rationale": q.rationale} for q in queries],
                "total_found": len(final_papers),
                "search_depth": search_depth
            }
        }


# 单例模式
_adapter_instance: Optional[AutoResearchClawAdapter] = None


def get_adapter() -> AutoResearchClawAdapter:
    """获取适配器单例"""
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = AutoResearchClawAdapter()
    return _adapter_instance


# 便捷函数
async def search_literature(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """便捷文献搜索"""
    adapter = get_adapter()
    return await adapter.deep_literature_search(query, limit=limit)


def classify_experiment(innovation: Dict[str, Any]) -> Dict[str, Any]:
    """便捷实验分类"""
    adapter = get_adapter()
    return adapter.classify_experiment(innovation)


async def enhance_innovation(innovation: Dict[str, Any], search_depth: str = "medium") -> Dict[str, Any]:
    """便捷创新点增强"""
    adapter = get_adapter()
    return await adapter.enhance_innovation(innovation, search_depth)


async def generate_paper_from_innovation(
    innovation: Dict[str, Any],
    papers: List[Dict[str, Any]],
    template: str = "neurips_2025"
) -> Dict[str, Any]:
    """便捷论文生成"""
    adapter = get_adapter()
    return await adapter.generate_paper(innovation, papers, template)
