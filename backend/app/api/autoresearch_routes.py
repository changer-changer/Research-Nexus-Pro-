"""AutoResearchClaw API 路由

提供与前端组件对接的 REST API
"""

from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
import asyncio

from app.autoresearch_claw import (
    get_adapter,
    ExperimentMode,
    LiteratureSource,
    run_experiment_api,
    get_experiment_status_api,
    get_experiment_history_api,
    generate_guide_api,
    export_guide_api
)
from app.autoresearch_claw.literature_search import deep_search
from app.autoresearch_claw.experiment_classifier import classify_experiment
from app.autoresearch_claw.paper_generator import generate_paper

# New experiment pipeline (Layer 2)
try:
    from app.experiment import FeasibilityAssessor, LLMGuideGenerator
    EXPERIMENT_AVAILABLE = True
except ImportError as e:
    import logging
    logging.warning(f"Experiment pipeline not available: {e}")
    EXPERIMENT_AVAILABLE = False

router = APIRouter(prefix="/autoresearch", tags=["AutoResearchClaw"])

# Global instances (lazy init)
_feasibility_assessor: Optional[Any] = None
_llm_guide_generator: Optional[Any] = None


def get_feasibility_assessor() -> Any:
    global _feasibility_assessor
    if _feasibility_assessor is None and EXPERIMENT_AVAILABLE:
        _feasibility_assessor = FeasibilityAssessor()
    return _feasibility_assessor


def get_llm_guide_generator() -> Any:
    global _llm_guide_generator
    if _llm_guide_generator is None and EXPERIMENT_AVAILABLE:
        _llm_guide_generator = LLMGuideGenerator()
    return _llm_guide_generator


@router.post("/search")
async def search_literature(
    query: str = Body(..., description="搜索关键词"),
    sources: List[str] = Body(default=["openalex", "arxiv", "semantic_scholar"], description="搜索来源"),
    limit: int = Body(default=20, ge=1, le=100, description="返回数量限制")
):
    """
    深度文献搜索
    
    同时搜索 OpenAlex、arXiv、Semantic Scholar，返回聚合去重后的结果
    """
    try:
        adapter = get_adapter()
        papers = await adapter.deep_literature_search(query, sources, limit)
        return papers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Literature search failed: {str(e)}")


@router.post("/analyze-innovation")
async def analyze_innovation(
    innovation: Dict[str, Any] = Body(..., description="创新点数据"),
    depth: str = Body(default="medium", description="搜索深度: light/medium/deep")
):
    """
    创新点增强分析
    
    基于深度文献搜索，为创新点提供：
    - 横向扩展建议（相关领域交叉）
    - 纵向深化建议（技术路径细化）
    - 相关论文推荐
    - 竞争分析
    """
    try:
        adapter = get_adapter()
        result = await adapter.enhance_innovation(innovation, depth)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Innovation analysis failed: {str(e)}")


@router.post("/classify-experiment")
async def classify_experiment_endpoint(
    innovation: Dict[str, Any] = Body(..., description="创新点数据")
):
    """
    实验可行性分类
    
    判断实验是否可以由 AI 自动执行，还是需要人类参与
    
    返回模式：
    - ai_auto: AI 可自动执行（纯软件）
    - human_guided: 需要人类按指南执行
    - hybrid: 混合模式
    - unknown: 无法判断
    """
    try:
        adapter = get_adapter()
        result = adapter.classify_experiment(innovation)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Experiment classification failed: {str(e)}")


@router.post("/feasibility-assess")
async def feasibility_assess_endpoint(
    innovation: Dict[str, Any] = Body(..., description="创新点数据"),
    target_venue: str = Body(default="NeurIPS", description="目标会议/期刊"),
):
    """
    LLM-based experiment feasibility pre-assessment.

    Evaluates whether experiments can be auto-run by AI, need human guidance,
    or are not recommended for automation.

    Returns:
    {
      "overall_score": 0-100,
      "decision": "ai_auto" | "human_guided" | "hybrid" | "not_recommended",
      "confidence": 0-1,
      "dimensions": {...},
      "recommendations": [...],
      "estimated_time_hours": number,
      "estimated_cost_usd": number or null,
      "required_resources": [...],
      "risk_factors": [...]
    }
    """
    if not EXPERIMENT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Experiment pipeline not available")

    assessor = get_feasibility_assessor()
    if not assessor:
        raise HTTPException(status_code=503, detail="Feasibility assessor not initialized")

    try:
        result = await assessor.assess(
            title=innovation.get("title", "Research Experiment"),
            problem_statement=innovation.get("problem_statement", ""),
            proposed_solution=innovation.get("proposed_solution", ""),
            target_venue=target_venue,
            existing_papers=innovation.get("related_papers", []),
        )
        return result.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feasibility assessment failed: {str(e)}")


@router.post("/generate-guide")
async def generate_experiment_guide_enhanced(
    innovation: Dict[str, Any] = Body(..., description="创新点数据"),
    feasibility_result: Optional[Dict[str, Any]] = Body(default=None, description="可行性评估结果"),
    target_venue: str = Body(default="NeurIPS", description="目标会议/期刊"),
    experiment_type: str = Body(default="computational", description="实验类型"),
):
    """
    Generate a detailed, innovation-specific experiment guide.

    Uses LLM-driven generation to produce foolproof step-by-step instructions
    tailored to the specific research, including:
    - Exact commands (copy-paste ready)
    - Expected output for each step
    - Troubleshooting for common problems
    - Data collection template

    If feasibility_result is not provided, a quick assessment will be performed first.
    """
    if not EXPERIMENT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Experiment pipeline not available")

    guide_gen = get_llm_guide_generator()
    if not guide_gen:
        raise HTTPException(status_code=503, detail="Guide generator not initialized")

    try:
        # If no feasibility result provided, run quick assessment
        feas = feasibility_result
        if not feas:
            assessor = get_feasibility_assessor()
            if assessor:
                feas_result = await assessor.assess(
                    title=innovation.get("title", ""),
                    problem_statement=innovation.get("problem_statement", ""),
                    proposed_solution=innovation.get("proposed_solution", ""),
                    target_venue=target_venue,
                )
                feas = feas_result.to_dict()

        guide = await guide_gen.generate_guide(
            innovation_data=innovation,
            feasibility_result=feas,
            target_venue=target_venue,
            experiment_type=experiment_type,
        )

        return {
            "success": True,
            "guide": guide.to_dict(),
            "markdown": guide.to_markdown(),
            "feasibility": feas,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Guide generation failed: {str(e)}")


@router.post("/generate-paper")
async def generate_paper_endpoint(
    innovation: Dict[str, Any] = Body(..., description="创新点数据"),
    related_papers: List[Dict[str, Any]] = Body(default=[], description="相关论文列表"),
    template: str = Body(default="neurips_2025", description="论文模板"),
    bilingual: bool = Body(default=True, description="是否生成双语版本")
):
    """
    从创新点生成论文
    
    基于创新点和相关论文，生成完整学术论文（大纲 + 草稿）
    支持双语输出和多种会议模板
    """
    try:
        adapter = get_adapter()
        paper = await adapter.generate_paper(innovation, related_papers, template, bilingual)
        return paper
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Paper generation failed: {str(e)}")


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "service": "AutoResearchClaw Adapter",
        "experiment_pipeline": {
            "available": EXPERIMENT_AVAILABLE,
            "feasibility_assessor": _feasibility_assessor is not None,
            "llm_guide_generator": _llm_guide_generator is not None,
        }
    }


@router.post("/run-experiment")
async def run_experiment(
    code: str = Body(..., description="实验代码"),
    requirements: Optional[List[str]] = Body(default=None, description="依赖包列表"),
    experiment_id: Optional[str] = Body(default=None, description="实验 ID")
):
    """
    执行实验
    
    在沙盒环境中运行实验代码，支持 Docker 和本地执行
    自动重试、超时控制、结果收集
    """
    try:
        result = await run_experiment_api(code, requirements, experiment_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Experiment execution failed: {str(e)}")


@router.get("/experiment-status/{run_id}")
async def get_experiment_status(run_id: str):
    """
    获取实验状态
    
    查询指定实验的运行状态和结果
    """
    try:
        status = get_experiment_status_api(run_id)
        if status is None:
            raise HTTPException(status_code=404, detail=f"Experiment {run_id} not found")
        return status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/experiment-history")
async def get_experiment_history():
    """
    获取实验历史
    
    返回所有已运行实验的历史记录
    """
    try:
        history = get_experiment_history_api()
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")


