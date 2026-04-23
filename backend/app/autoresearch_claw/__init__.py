"""AutoResearchClaw 适配层

Research-Nexus Pro 与 AutoResearchClaw 的集成模块
提供：
- 深度文献搜索（OpenAlex + arXiv + Semantic Scholar）
- 实验可行性分类（AI自动执行 vs 人类指南）
- 论文生成引擎
- 创新点增强分析
- 实验执行引擎（AI 自动运行实验）
- 傻瓜式实验指南生成器
"""

from .adapter import (
    AutoResearchClawAdapter,
    ResearchContext,
    get_adapter,
    search_literature,
    classify_experiment,
    enhance_innovation,
    generate_paper_from_innovation
)

from .literature_search import (
    DeepLiteratureSearch,
    LiteraturePaper,
    LiteratureSource,
    OpenAlexClient,
    ArxivClient,
    SemanticScholarClient,
    deep_search
)

from .experiment_classifier import (
    ExperimentClassifier,
    ExperimentFeasibility,
    ExperimentMode,
    classify_experiment
)

from .paper_generator import (
    PaperGenerator,
    PaperGenerationConfig,
    GeneratedPaper,
    PaperTemplate,
    generate_paper
)

from .experiment_runner import (
    ExperimentRunner,
    ExperimentConfig,
    ExperimentResult,
    ExperimentStatus,
    ExperimentHistory,
    run_experiment_api,
    get_experiment_status_api,
    get_experiment_history_api
)

from .experiment_guide_generator import (
    ExperimentGuideGenerator,
    ExperimentGuide,
    generate_guide_api,
    export_guide_api
)

from .llm_analyzer import (
    LLMAnalyzer,
    SearchQuery,
    DeepAnalysisOutput,
    AnalysisDimension,
    KeyFinding,
    RecommendedPaper
)

__all__ = [
    # 主适配器
    "AutoResearchClawAdapter",
    "ResearchContext",
    "get_adapter",
    
    # 便捷函数
    "search_literature",
    "classify_experiment",
    "enhance_innovation",
    "generate_paper_from_innovation",
    
    # 文献搜索
    "DeepLiteratureSearch",
    "LiteraturePaper",
    "LiteratureSource",
    "OpenAlexClient",
    "ArxivClient",
    "SemanticScholarClient",
    "deep_search",
    
    # 实验分类
    "ExperimentClassifier",
    "ExperimentFeasibility",
    "ExperimentMode",
    
    # 论文生成
    "PaperGenerator",
    "PaperGenerationConfig",
    "GeneratedPaper",
    "PaperTemplate",
    "generate_paper",
    
    # 实验执行
    "ExperimentRunner",
    "ExperimentConfig",
    "ExperimentResult",
    "ExperimentStatus",
    "ExperimentHistory",
    "run_experiment_api",
    "get_experiment_status_api",
    "get_experiment_history_api",
    
    # 实验指南
    "ExperimentGuideGenerator",
    "ExperimentGuide",
    "generate_guide_api",
    "export_guide_api",

    # LLM 分析引擎
    "LLMAnalyzer",
    "SearchQuery",
    "DeepAnalysisOutput",
    "AnalysisDimension",
    "KeyFinding",
    "RecommendedPaper",
]
