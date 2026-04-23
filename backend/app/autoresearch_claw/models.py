"""
AutoResearchClaw 适配层 - 核心模型定义

本模块定义了文献搜索、论文生成和实验分类的数据模型
与 Research-Nexus Pro 后端风格保持一致
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


# =============================================================================
# Enums
# =============================================================================

class ExperimentFeasibility(str, Enum):
    """实验可行性分类"""
    AI_EXECUTABLE = "ai_executable"      # AI可自主执行
    HUMAN_REQUIRED = "human_required"    # 需要人类参与
    HYBRID = "hybrid"                    # 混合模式
    UNKNOWN = "unknown"                  # 未知


class ExperimentType(str, Enum):
    """实验类型"""
    SIMULATION = "simulation"            # 仿真实验
    COMPUTATIONAL = "computational"      # 计算实验
    HARDWARE = "hardware"                # 硬件实验
    HUMAN_SUBJECT = "human_subject"      # 人类被试实验
    FIELD_STUDY = "field_study"          # 现场研究
    SURVEY = "survey"                    # 调查研究


class PaperSection(str, Enum):
    """论文章节"""
    TITLE = "title"
    ABSTRACT = "abstract"
    INTRODUCTION = "introduction"
    RELATED_WORK = "related_work"
    METHODOLOGY = "methodology"
    EXPERIMENTS = "experiments"
    RESULTS = "results"
    DISCUSSION = "discussion"
    CONCLUSION = "conclusion"
    REFERENCES = "references"


# =============================================================================
# Author & Paper Models (from AutoResearchClaw)
# =============================================================================

@dataclass(frozen=True)
class Author:
    """论文作者"""
    name: str
    affiliation: str = ""

    def last_name(self) -> str:
        """返回用于引用键的姓氏（ASCII折叠）"""
        parts = self.name.strip().split()
        raw = parts[-1] if parts else "unknown"
        nfkd = unicodedata.normalize("NFKD", raw)
        ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-zA-Z]", "", ascii_name).lower() or "unknown"


@dataclass(frozen=True)
class Paper:
    """
    单篇论文数据类
    
    支持 Semantic Scholar、arXiv、OpenAlex 等多个数据源
    """
    paper_id: str
    title: str
    authors: Tuple[Author, ...] = ()
    year: int = 0
    abstract: str = ""
    venue: str = ""
    citation_count: int = 0
    doi: str = ""
    arxiv_id: str = ""
    url: str = ""
    source: str = ""  # "semantic_scholar" | "arxiv" | "openalex"
    _bibtex_override: str = field(default="", repr=False)

    @property
    def cite_key(self) -> str:
        """标准化引用键: ``lastname<year><keyword>``"""
        last = self.authors[0].last_name() if self.authors else "anon"
        yr = str(self.year) if self.year else "0000"
        kw = ""
        for word in self.title.split():
            cleaned = re.sub(r"[^a-zA-Z]", "", word).lower()
            if len(cleaned) > 3 and cleaned not in _STOPWORDS:
                kw = cleaned
                break
        return f"{last}{yr}{kw}"

    def to_bibtex(self) -> str:
        """生成 BibTeX 条目"""
        if self._bibtex_override:
            return self._bibtex_override.strip()

        key = self.cite_key
        authors_str = " and ".join(a.name for a in self.authors) or "Unknown"

        _venue = self.venue or ""
        _is_arxiv_category = bool(
            re.match(
                r"^(?:cs|math|stat|eess|physics|q-bio|q-fin|astro-ph|cond-mat|"
                r"gr-qc|hep-ex|hep-lat|hep-ph|hep-th|nlin|nucl-ex|nucl-th|"
                r"quant-ph)\.[A-Z]{2}$",
                _venue,
            )
        )

        if _venue and not _is_arxiv_category and any(
            kw in _venue.lower()
            for kw in (
                "conference", "proc", "workshop", "neurips", "icml", "iclr",
                "aaai", "cvpr", "acl", "emnlp", "naacl", "eccv", "iccv",
                "sigir", "kdd", "www", "ijcai",
            )
        ):
            entry_type = "inproceedings"
            venue_field = f"  booktitle = {{{_venue}}},"
        elif self.arxiv_id and (not _venue or _is_arxiv_category):
            entry_type = "article"
            venue_field = f"  journal = {{arXiv preprint arXiv:{self.arxiv_id}}},"
        else:
            entry_type = "article"
            venue_field = f"  journal = {{{_venue or 'Unknown'}}}," if _venue else ""

        lines = [f"@{entry_type}{{{key},"]
        lines.append(f"  title = {{{self.title}}},")
        lines.append(f"  author = {{{authors_str}}},")
        lines.append(f"  year = {{{self.year or 'Unknown'}}},")
        if venue_field:
            lines.append(venue_field)
        if self.doi:
            lines.append(f"  doi = {{{self.doi}}},")
        if self.arxiv_id:
            lines.append(f"  eprint = {{{self.arxiv_id}}},")
            lines.append("  archiveprefix = {arXiv},")
        if self.url:
            lines.append(f"  url = {{{self.url}}},")
        lines.append("}")
        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "paper_id": self.paper_id,
            "title": self.title,
            "authors": [
                {"name": a.name, "affiliation": a.affiliation} for a in self.authors
            ],
            "year": self.year,
            "abstract": self.abstract,
            "venue": self.venue,
            "citation_count": self.citation_count,
            "doi": self.doi,
            "arxiv_id": self.arxiv_id,
            "url": self.url,
            "source": self.source,
            "cite_key": self.cite_key,
        }


_STOPWORDS = frozenset({
    "the", "and", "for", "with", "from", "that", "this", "into", "over",
    "upon", "about", "through", "using", "based", "towards", "toward",
    "between", "under", "more", "than", "when", "what", "which", "where",
    "does", "have", "been", "some", "each", "also", "much", "very",
    "learning",
})


# =============================================================================
# API Request/Response Models
# =============================================================================

class LiteratureSearchRequest(BaseModel):
    """文献搜索请求"""
    query: str = Field(..., description="搜索查询词", min_length=1)
    limit: int = Field(default=20, ge=1, le=100)
    year_min: int = Field(default=0, ge=0, le=2100, description="最早年份筛选")
    sources: List[str] = Field(
        default=["openalex", "arxiv", "semantic_scholar"],
        description="数据源列表"
    )


class LiteratureSearchResponse(BaseModel):
    """文献搜索响应"""
    query: str
    total_results: int
    papers: List[Dict[str, Any]]
    sources_searched: List[str]
    search_time_ms: float


class InnovationAnalysisRequest(BaseModel):
    """创新点分析请求"""
    innovation_id: str
    title: str
    description: str
    related_papers: List[Dict[str, Any]] = Field(default_factory=list)
    target_venue: str = Field(default="NeurIPS")


class InnovationAnalysisResponse(BaseModel):
    """创新点分析响应"""
    innovation_id: str
    enhanced_description: str
    novelty_assessment: Dict[str, Any]
    potential_impact: str
    suggested_experiments: List[str]
    related_work_gaps: List[str]


class ExperimentClassificationRequest(BaseModel):
    """实验分类请求"""
    experiment_description: str
    experiment_type: Optional[ExperimentType] = None
    required_resources: List[str] = Field(default_factory=list)
    estimated_duration: Optional[str] = None


class ExperimentClassificationResponse(BaseModel):
    """实验分类响应"""
    experiment_description: str
    feasibility: ExperimentFeasibility
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    ai_executable_components: List[str]
    human_required_components: List[str]
    automation_suggestions: List[str]
    estimated_cost: Optional[str] = None
    risk_factors: List[str]


class PaperGenerationRequest(BaseModel):
    """论文生成请求"""
    innovation_id: str
    title: str = Field(..., min_length=1)
    abstract: Optional[str] = None
    target_venue: str = Field(default="NeurIPS")
    sections: List[PaperSection] = Field(
        default=[
            PaperSection.TITLE,
            PaperSection.ABSTRACT,
            PaperSection.INTRODUCTION,
            PaperSection.RELATED_WORK,
            PaperSection.METHODOLOGY,
            PaperSection.EXPERIMENTS,
            PaperSection.CONCLUSION,
        ]
    )


class PaperGenerationResponse(BaseModel):
    """论文生成响应"""
    task_id: str
    status: str
    innovation_id: str
    target_venue: str
    generated_sections: Dict[str, str] = Field(default_factory=dict)
    stream_url: Optional[str] = None


class PipelineStageInfo(BaseModel):
    """流水线阶段信息"""
    stage_id: int
    stage_name: str
    description: str
    status: str  # pending, running, done, failed
    is_gate: bool = False


class PipelineStatusResponse(BaseModel):
    """流水线状态响应"""
    pipeline_id: str
    current_stage: int
    stages: List[PipelineStageInfo]
    overall_progress: float
    status: str
