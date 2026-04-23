"""
Innovation Generation and Backtesting System for Research-Nexus Pro
创新点生成与回测系统

Features:
- 6 Innovation Paradigms (CDT, SHF, MC, TF, CH, RGI)
- Paper Selection API
- Innovation Generation API
- Backtesting API

Schema alignment: Uses research_graph.db which has 'category' (not 'domain'),
no 'citation_count', 'assumptions', or 'keywords' columns. Fallback extraction
from titles/abstracts when JSON columns are empty.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
import random
import json
import sqlite3
import re
import hashlib

# Database imports
from app.database.local_graph import get_local_graph_db
from app.database.local_vector import get_local_vector_db
from app.database.sqlite_db import get_db_connection
from app.discovery.engine import InnovationDiscoveryEngine, ParadigmType

router = APIRouter(tags=["Innovation"])

# =============================================================================
# Fallback Extraction Helpers (when JSON columns are empty)
# =============================================================================

# Common research keywords by domain
_DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    "multi_agent": ["multi-agent", "agent", "conversation", "coordination", "llm", "language model"],
    "agent_memory": ["memory", "retrieval", "context", "long-term", "forgetting", "storage"],
    "agent_tools": ["tool", "api", "plugin", "function calling", "external"],
    "llm_reasoning": ["reasoning", "chain-of-thought", "cot", "planning", "inference"],
    "robotics": ["robot", "manipulation", "grasping", "tactile", "sensor", "hardware"],
    "general": ["machine learning", "deep learning", "neural network", "ai"],
}

# Problem-indicating phrases
_PROBLEM_PHRASES = [
    "struggle", "challenge", "bottleneck", "limitation", "difficult",
    "fails to", "unable to", "lack of", "insufficient", "poor",
    "problem", "issue", "gap", "not addressed", "remain unsolved",
    "critical", "fundamental", "key obstacle", "main barrier"
]

# Method-indicating phrases
_METHOD_PHRASES = [
    "propose", "introduce", "present", "develop", "design",
    "approach", "method", "framework", "architecture", "model",
    "algorithm", "system", "technique", "mechanism", "strategy"
]


def _extract_keywords_from_text(title: str, abstract: str, category: str) -> List[str]:
    """Extract keywords from title and abstract when keywords column is empty."""
    text = f"{title} {abstract}".lower()
    words = re.findall(r'\b[a-z][a-z0-9\-]+\b', text)

    # Important short terms that should always be included
    _IMPORTANT_SHORT = {"llm", "llms", "ai", "cot", "rag", "gpt", "nlp", "rl", "gui", "api"}
    _STOPWORDS = {"this", "that", "with", "from", "have", "been", "were", "they", "their", "which", "paper", "study", "work", "based", "using", "used"}

    # Count word frequencies
    freq: Dict[str, int] = {}
    for w in words:
        if w in _IMPORTANT_SHORT:
            freq[w] = freq.get(w, 0) + 5
        elif len(w) > 3 and w not in _STOPWORDS:
            freq[w] = freq.get(w, 0) + 1

    # Add domain-specific keywords if they appear
    domain_kws = _DOMAIN_KEYWORDS.get(category, _DOMAIN_KEYWORDS["general"])
    for kw in domain_kws:
        if kw.lower() in text:
            freq[kw.lower()] = freq.get(kw.lower(), 0) + 3  # Boost domain keywords

    # Return top keywords
    sorted_kws = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [kw for kw, _ in sorted_kws[:12]]


def _extract_problems_from_text(title: str, abstract: str, domain: str = "general") -> List[Dict[str, Any]]:
    """Extract problems from abstract when problems JSON column is empty."""
    text = f"{title}. {abstract}".lower()
    problems = []

    sentences = re.split(r'[.!?]+', text)
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        # Check if sentence contains problem indicators
        score = sum(1 for p in _PROBLEM_PHRASES if p in sent)
        if score > 0:
            # Extract a concise problem statement
            problem_text = sent[:120] if len(sent) > 120 else sent
            problems.append({
                "id": f"prob_{hashlib.md5(problem_text.encode()).hexdigest()[:8]}",
                "name": problem_text[:60].capitalize(),
                "description": problem_text,
                "domain": domain,
                "status": "unsolved",
                "keywords": [],
            })

    # If no problems found, create one from the title
    if not problems:
        problems.append({
            "id": f"prob_{hashlib.md5(title.encode()).hexdigest()[:8]}",
            "name": title[:60],
            "description": abstract[:200] if abstract else title,
            "domain": domain,
            "status": "unsolved",
            "keywords": [],
        })

    return problems[:3]  # Limit to top 3


def _extract_methods_from_text(title: str, abstract: str, domain: str = "general") -> List[Dict[str, Any]]:
    """Extract methods from abstract when methods JSON column is empty."""
    text = f"{title}. {abstract}".lower()
    methods = []

    # Vary mechanism/strength based on domain for more realistic diversity
    _MECHANISMS = ["learning-based", "optimization", "retrieval", "planning", "feedback-loop"]
    _STRENGTHS = ["generalization", "efficiency", "accuracy", "scalability", "robustness"]
    _IO_FORMATS = [("raw data", "prediction"), ("text", "embedding"), ("query", "ranking"), ("state", "action")]

    sentences = re.split(r'[.!?]+', text)
    for idx, sent in enumerate(sentences):
        sent = sent.strip()
        if not sent:
            continue
        # Check if sentence contains method indicators
        score = sum(1 for p in _METHOD_PHRASES if p in sent)
        if score > 0 and len(sent) > 20:
            method_text = sent[:120] if len(sent) > 120 else sent
            # Try to extract a method name (capitalized phrases)
            name_match = re.search(r'([A-Z][a-zA-Z\s]+(?:model|framework|method|approach|system|algorithm))', title + " " + abstract)
            name = name_match.group(1).strip() if name_match else method_text[:40]
            mech = _MECHANISMS[idx % len(_MECHANISMS)]
            strength = _STRENGTHS[idx % len(_STRENGTHS)]
            inp, out = _IO_FORMATS[idx % len(_IO_FORMATS)]
            methods.append({
                "id": f"meth_{hashlib.md5(method_text.encode()).hexdigest()[:8]}",
                "name": name[:60],
                "description": method_text,
                "domain": domain,
                "mechanism": mech,
                "keywords": [],
                "strength": strength,
                "output_format": out,
                "input_format": inp,
            })

    # If no methods found, create one from the title
    if not methods:
        methods.append({
            "id": f"meth_{hashlib.md5(title.encode()).hexdigest()[:8]}",
            "name": title[:60],
            "description": abstract[:200] if abstract else title,
            "domain": domain,
            "mechanism": "learning-based",
            "keywords": [],
            "strength": "generalization",
            "output_format": "prediction",
            "input_format": "raw data",
        })

    return methods[:3]


def _build_paper_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Build a normalized paper dict from a DB row, handling schema differences."""
    # research_graph.db schema: id, arxiv_id, title, authors, year, venue,
    #   abstract, category, problems, methods, key_contributions, url, local_path, created_at, updated_at
    # Queries may select a subset of columns, so use .get() with defaults.
    def _get(col: str, default=""):
        try:
            return row[col]
        except (IndexError, KeyError):
            return default

    paper = {
        "id": _get("id"),
        "title": _get("title", ""),
        "year": _get("year", 2024) or 2024,
        "domain": _get("category", "general") or "general",  # Map category -> domain
        "abstract": _get("abstract", ""),
        "citation_count": 0,  # Not available in research_graph.db
        "venue": _get("venue", ""),
    }

    # Parse JSON columns with fallback
    problems_raw = _get("problems", "[]")
    methods_raw = _get("methods", "[]")
    problems = json.loads(problems_raw) if problems_raw else []
    methods = json.loads(methods_raw) if methods_raw else []

    # Extract keywords first (used by problems/methods)
    keywords = _extract_keywords_from_text(
        paper["title"], paper["abstract"], paper["domain"]
    )

    # Fallback: extract from text if JSON is empty
    if not problems:
        problems = _extract_problems_from_text(paper["title"], paper["abstract"], paper["domain"])
    if not methods:
        methods = _extract_methods_from_text(paper["title"], paper["abstract"], paper["domain"])

    # Propagate keywords and citation_count to methods/problems for matching
    for m in methods:
        m["keywords"] = m.get("keywords") or keywords
        m.setdefault("citation_count", 0)
    for p in problems:
        p["keywords"] = p.get("keywords") or keywords

    paper["problems"] = problems
    paper["methods"] = methods
    paper["assumptions"] = []  # Not available, use empty
    paper["keywords"] = keywords

    return paper

# ============================================================================
# Pydantic Models
# ============================================================================

class PaperSelectRequest(BaseModel):
    domain: Optional[str] = None
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    keywords: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=200)

class PaperInfo(BaseModel):
    id: str
    title: str
    year: int
    domain: str
    abstract: Optional[str] = None
    citation_count: Optional[int] = None

class InnovationGenerateRequest(BaseModel):
    paper_ids: List[str]
    paradigms: List[str] = Field(default=["CDT", "SHF", "MC", "TF", "CH", "RGI"])
    count: int = Field(default=5, ge=1, le=20)

class InnovationDetail(BaseModel):
    id: str
    title: str
    description: str
    paradigm: str  # CDT, SHF, MC, TF, CH, RGI
    target_problem: str
    candidate_method: str
    core_insight: str
    source_papers: List[str]
    novelty_score: float  # 1-5
    feasibility_score: float  # 1-5
    impact_score: float  # 1-5
    urgency_score: float  # 1-5
    composite_score: float
    mvp_experiment: Optional[str] = None
    created_at: datetime

class BacktestRunRequest(BaseModel):
    train_years: str = "2020-2024"  # Format: "start-end"
    test_year: int = 2025
    domain: Optional[str] = None
    paradigms: List[str] = ["CDT", "SHF", "MC", "TF", "CH", "RGI"]

class BacktestResult(BaseModel):
    id: str
    train_years: str
    test_year: int
    domain: Optional[str]
    predicted_count: int
    hit_count: int
    precision: float
    recall: float
    f1_score: float
    details: List[Dict[str, Any]]
    created_at: datetime

# ============================================================================
# Innovation Paradigm Detection Algorithms
# 六大创新范式检测算法
# ============================================================================

class InnovationParadigmDetector:
    """
    [DEPRECATED / DEMO-ONLY] 演示用假数据创新范式检测器。
    所有评分使用 random.random() 生成，仅用于无真实图数据时的演示回退。
    生产环境请使用 InnovationDiscoveryEngine (基于真实图/向量数据)。
    """
    
    def __init__(self, graph_db):
        self.graph_db = graph_db
    
    def detect_cdt(self, papers: List[Dict]) -> List[Dict]:
        """
        CDT: Cross-Domain Transfer - 跨域迁移
        检测：领域A的方法M解决领域B的问题P，但尚未被应用
        """
        innovations = []
        
        # 获取所有方法和问题
        methods = self._extract_methods(papers)
        problems = self._extract_problems(papers)
        
        for method in methods:
            for problem in problems:
                # 检查方法是否已在该领域应用
                if method.get("domain") != problem.get("domain"):
                    # 检查关键词匹配度（降低阈值，适配提取数据）
                    match_score = self._keyword_match(
                        method.get("keywords", []),
                        problem.get("keywords", [])
                    )
                    # 放宽条件：有引用更好，但无引用也允许（提取数据 citation_count 常为 0）
                    # 对提取数据更宽容：跨域即候选，只要有少量关键词重叠或标题相关
                    citation_ok = method.get("citation_count", 0) > 20 or match_score >= 0.0
                    if match_score >= 0.0 and citation_ok:
                            innovations.append({
                                "paradigm": "CDT",
                                "title": f"将{method['name']}应用于{problem['domain']}的{problem['name']}",
                                "description": f"将已在{method['domain']}证明有效的{method['name']}方法，应用于解决{problem['domain']}领域的{problem['name']}问题",
                                "target_problem": problem['name'],
                                "candidate_method": method['name'],
                                "core_insight": f"{method['name']}在{method['domain']}的成功表明其对{problem['name']}类问题具有潜在有效性",
                                "source_papers": [method['paper_id'], problem['paper_id']],
                                "match_score": match_score,
                                "novelty_score": 4.0 + random.random(),
                                "feasibility_score": 3.5 + random.random(),
                                "impact_score": 4.0 + random.random(),
                            })
        
        return sorted(innovations, key=lambda x: x["match_score"], reverse=True)[:2]
    
    def detect_shf(self, papers: List[Dict]) -> List[Dict]:
        """
        SHF: Structural Hole Filling - 结构洞填补
        检测：两个方法解决同一问题的不同方面，但从未被系统结合
        """
        innovations = []
        
        # 按问题分组方法
        problem_methods = {}
        for paper in papers:
            methods = self._extract_methods([paper])
            problems = self._extract_problems([paper])
            for problem in problems:
                if problem['name'] not in problem_methods:
                    problem_methods[problem['name']] = []
                problem_methods[problem['name']].extend(methods)
        
        # 查找同一问题的不同方法组合
        for problem_name, methods in problem_methods.items():
            if len(methods) >= 2:
                for i, m1 in enumerate(methods):
                    for m2 in methods[i+1:]:
                        # 检查机制是否不同
                        if m1.get("mechanism") != m2.get("mechanism"):
                            innovations.append({
                                "paradigm": "SHF",
                                "title": f"结合{m1['name']}和{m2['name']}解决{problem_name}",
                                "description": f"{m1['name']}擅长处理{problem_name}的{m1.get('strength', '某方面')}，{m2['name']}擅长{m2.get('strength', '另一方面')}，二者互补可形成更完整解决方案",
                                "target_problem": problem_name,
                                "candidate_method": f"{m1['name']} + {m2['name']}",
                                "core_insight": f"{m1['name']}和{m2['name']}在{problem_name}上具有互补性，组合后预期性能提升20-30%",
                                "source_papers": [m1['paper_id'], m2['paper_id']],
                                "complementarity": 0.7 + random.random() * 0.3,
                                "novelty_score": 4.5 + random.random(),
                                "feasibility_score": 3.8 + random.random(),
                                "impact_score": 4.2 + random.random(),
                            })
        
        return sorted(innovations, key=lambda x: x["complementarity"], reverse=True)[:2]
    
    def detect_mc(self, papers: List[Dict]) -> List[Dict]:
        """
        MC: Method Composition - 方法组合
        检测：M1解决子问题1，M2解决子问题2 → 组合成解决大问题P的pipeline
        """
        innovations = []
        
        # 提取所有方法及其解决的子问题
        method_subproblems = []
        for paper in papers:
            methods = self._extract_methods([paper])
            for method in methods:
                subproblems = method.get("solves_subproblems", [])
                for sp in subproblems:
                    method_subproblems.append({
                        "method": method,
                        "subproblem": sp,
                        "paper_id": paper.get("id")
                    })
        
        # 查找可组合的pipeline
        for i, item1 in enumerate(method_subproblems):
            for item2 in method_subproblems[i+1:]:
                # 检查输出输入兼容性
                if self._check_compatibility(item1["method"], item2["method"]):
                    innovations.append({
                        "paradigm": "MC",
                        "title": f"端到端Pipeline: {item1['method']['name']} → {item2['method']['name']}",
                        "description": f"阶段1使用{item1['method']['name']}处理{item1['subproblem']}，阶段2使用{item2['method']['name']}处理{item2['subproblem']}，形成完整解决方案",
                        "target_problem": f"{item1['subproblem']} + {item2['subproblem']}",
                        "candidate_method": f"{item1['method']['name']} → {item2['method']['name']}",
                        "core_insight": f"{item1['method']['name']}的输出与{item2['method']['name']}的输入高度兼容，可无缝衔接",
                        "source_papers": [item1['paper_id'], item2['paper_id']],
                        "pipeline_score": 0.75 + random.random() * 0.25,
                        "novelty_score": 3.8 + random.random(),
                        "feasibility_score": 4.2 + random.random(),
                        "impact_score": 3.9 + random.random(),
                    })
        
        return sorted(innovations, key=lambda x: x["pipeline_score"], reverse=True)[:2]
    
    def detect_tf(self, papers: List[Dict]) -> List[Dict]:
        """
        TF: Temporal Frontiers - 时间前沿
        检测：最新方法(2025-2026)可能革新长期未解决的旧问题
        """
        innovations = []
        
        # 分离新方法(2025+)和老问题(2022-)
        new_methods = []
        old_problems = []
        
        for paper in papers:
            year = paper.get("year", 2024)
            methods = self._extract_methods([paper])
            problems = self._extract_problems([paper])
            
            if year >= 2025:
                new_methods.extend([(m, paper) for m in methods])
            if year <= 2022 and year > 0:
                old_problems.extend([(p, paper) for p in problems if p.get("status") == "unsolved"])
        
        # 匹配新方法vs老问题
        for method, method_paper in new_methods:
            for problem, problem_paper in old_problems:
                match_score = self._keyword_match(
                    method.get("keywords", []),
                    problem.get("keywords", [])
                )
                if match_score > 0.4:
                    innovations.append({
                        "paradigm": "TF",
                        "title": f"应用{method['name']}解决经典难题{problem['name']}",
                        "description": f"将2025年最新的{method['name']}方法应用于长期未解决的{problem['name']}问题，利用新技术突破旧瓶颈",
                        "target_problem": problem['name'],
                        "candidate_method": method['name'],
                        "core_insight": f"{method['name']}的技术特性与{problem['name']}的需求高度匹配，可能带来突破性进展",
                        "source_papers": [method_paper.get("id"), problem_paper.get("id")],
                        "time_window_score": match_score,
                        "novelty_score": 4.8 + random.random() * 0.2,
                        "feasibility_score": 3.5 + random.random(),
                        "impact_score": 4.5 + random.random(),
                    })
        
        return sorted(innovations, key=lambda x: x["time_window_score"], reverse=True)[:2]
    
    def detect_ch(self, papers: List[Dict]) -> List[Dict]:
        """
        CH: Counterfactual Hypothesis - 反事实假设
        检测：挑战领域默认假设，移除后问题P可能有新解
        """
        innovations = []
        
        # 提取领域默认假设
        assumptions = self._extract_assumptions(papers)
        
        for assumption in assumptions:
            if assumption.get("challenge_count", 0) < 3:
                # 找到依赖此假设的问题
                related_problems = self._find_problems_using_assumption(
                    assumption, papers
                )
                for problem in related_problems:
                    innovations.append({
                        "paradigm": "CH",
                        "title": f"放弃假设'{assumption['content'][:30]}...'重新定义{problem['name']}",
                        "description": f"挑战领域默认假设'{assumption['content']}'，如果该假设不成立，{problem['name']}将有全新的解决路径",
                        "target_problem": problem['name'],
                        "candidate_method": f"非{assumption['content'][:20]}方法",
                        "core_insight": f"若放弃'{assumption['content'][:30]}...'假设，{problem['name']}的约束条件将发生根本性改变",
                        "source_papers": [assumption['paper_id'], problem['paper_id']],
                        "challenge_score": 0.8 + random.random() * 0.2,
                        "novelty_score": 4.9 + random.random() * 0.1,
                        "feasibility_score": 2.8 + random.random(),
                        "impact_score": 4.7 + random.random(),
                    })
        
        return sorted(innovations, key=lambda x: x["challenge_score"], reverse=True)[:1]
    
    def detect_rgi(self, papers: List[Dict]) -> List[Dict]:
        """
        RGI: Research Gap Identification - 研究缺口识别
        检测：问题P引用量高但解决方案少，或实验结果矛盾
        """
        innovations = []
        
        # 分析问题引用vs解决方案比例
        problem_stats = self._analyze_problem_coverage(papers)
        
        for problem_stat in problem_stats:
            if problem_stat["citation_count"] > 50 and problem_stat["solution_count"] < 5:
                gap_ratio = problem_stat["citation_count"] / max(problem_stat["solution_count"], 1)
                innovations.append({
                    "paradigm": "RGI",
                    "title": f"系统性研究{problem_stat['name']}的未被解释现象",
                    "description": f"{problem_stat['name']}被引用{problem_stat['citation_count']}次，但仅有{problem_stat['solution_count']}个解决方案，存在显著研究缺口",
                    "target_problem": problem_stat['name'],
                    "candidate_method": "系统性综述 + 元分析",
                    "core_insight": f"高引用({problem_stat['citation_count']})与低解决方案({problem_stat['solution_count']})的矛盾表明该领域存在根本性未解问题",
                    "source_papers": problem_stat['source_papers'],
                    "gap_ratio": gap_ratio,
                    "novelty_score": 4.3 + random.random(),
                    "feasibility_score": 4.0 + random.random(),
                    "impact_score": 4.1 + random.random(),
                })
        
        return sorted(innovations, key=lambda x: x["gap_ratio"], reverse=True)[:1]
    
    # ============================================================================
    # Helper Methods
    # ============================================================================
    
    def _extract_methods(self, papers: List[Dict]) -> List[Dict]:
        """从论文中提取方法信息"""
        methods = []
        for paper in papers:
            # 从知识图谱查询方法节点
            paper_methods = paper.get("methods", [])
            for method in paper_methods:
                method["paper_id"] = paper.get("id")
                method["domain"] = paper.get("domain", "unknown")
                methods.append(method)
        return methods
    
    def _extract_problems(self, papers: List[Dict]) -> List[Dict]:
        """从论文中提取问题信息"""
        problems = []
        for paper in papers:
            paper_problems = paper.get("problems", [])
            for problem in paper_problems:
                problem["paper_id"] = paper.get("id")
                problem["domain"] = paper.get("domain", "unknown")
                problems.append(problem)
        return problems
    
    def _extract_assumptions(self, papers: List[Dict]) -> List[Dict]:
        """提取领域默认假设"""
        assumptions = []
        for paper in papers:
            paper_assumptions = paper.get("assumptions", [])
            for assumption in paper_assumptions:
                if assumption.get("strength") == "default":
                    assumption["paper_id"] = paper.get("id")
                    assumptions.append(assumption)
        return assumptions
    
    def _keyword_match(self, keywords1: List[str], keywords2: List[str]) -> float:
        """计算关键词匹配度"""
        if not keywords1 or not keywords2:
            return 0.0
        set1 = set(k.lower() for k in keywords1)
        set2 = set(k.lower() for k in keywords2)
        intersection = set1 & set2
        union = set1 | set2
        return len(intersection) / len(union) if union else 0.0
    
    def _check_compatibility(self, method1: Dict, method2: Dict) -> bool:
        """检查两个方法是否兼容（输出输入匹配）"""
        output_format = method1.get("output_format", "")
        input_format = method2.get("input_format", "")
        # 简化判断：如果输出输入格式相同或相关，认为兼容
        return bool(output_format and input_format and 
                   (output_format == input_format or 
                    output_format in input_format or 
                    input_format in output_format))
    
    def _find_problems_using_assumption(self, assumption: Dict, papers: List[Dict]) -> List[Dict]:
        """找到依赖特定假设的问题"""
        problems = []
        for paper in papers:
            if assumption.get("paper_id") == paper.get("id"):
                continue
            paper_problems = paper.get("problems", [])
            for problem in paper_problems:
                if assumption.get("id") in problem.get("assumptions", []):
                    problem["paper_id"] = paper.get("id")
                    problems.append(problem)
        return problems[:3]  # 限制数量
    
    def _analyze_problem_coverage(self, papers: List[Dict]) -> List[Dict]:
        """分析问题的引用覆盖和解决方案数量"""
        problem_map = {}
        for paper in papers:
            problems = paper.get("problems", [])
            for problem in problems:
                pid = problem.get("id")
                if pid not in problem_map:
                    problem_map[pid] = {
                        "id": pid,
                        "name": problem.get("name"),
                        "citation_count": 0,
                        "solution_count": 0,
                        "source_papers": []
                    }
                problem_map[pid]["citation_count"] += paper.get("citation_count", 0)
                problem_map[pid]["solution_count"] += len(paper.get("methods", []))
                problem_map[pid]["source_papers"].append(paper.get("id"))
        return list(problem_map.values())


# ============================================================================
# Real Innovation Generator — converts InnovationDiscoveryEngine output to DB schema
# ============================================================================

def _scale_score_0_1_to_1_5(score: float) -> float:
    """Map 0-1 score to 1-5 Likert scale."""
    return round(max(1.0, min(5.0, score * 4 + 1)), 2)


def _build_innovation_detail(
    opp: Dict[str, Any],
    graph_db,
    index: int
) -> InnovationDetail:
    """Convert a raw InnovationDiscoveryEngine opportunity to InnovationDetail."""

    opp_id = opp.get("opportunity_id") or f"inv_{datetime.now().strftime('%Y%m%d')}_{index:04d}"
    paradigm = opp.get("innovation_type", "cdt").upper()
    prob_id = opp.get("target_problem_id", "")
    meth_ids = opp.get("candidate_method_ids", [])
    score = opp.get("score_breakdown", {})

    # Look up node names from graph
    problem = graph_db.get_problem(prob_id) if prob_id else None
    problem_name = problem.get("name", prob_id) if problem else prob_id

    method_names = []
    for mid in meth_ids:
        m = graph_db.get_method(mid)
        method_names.append(m.get("name", mid) if m else mid)
    candidate_method = " + ".join(method_names) if method_names else "Unknown"

    # Build human-readable title
    if len(method_names) >= 2:
        title = f"[{paradigm}] 结合 {method_names[0]} 与 {method_names[1]} 解决 {problem_name}"
    elif method_names:
        title = f"[{paradigm}] 将 {method_names[0]} 应用于 {problem_name}"
    else:
        title = f"[{paradigm}] {problem_name} 的研究缺口"

    # Map 0-1 scores to 1-5
    novelty = _scale_score_0_1_to_1_5(score.get("novelty", opp.get("novelty_score", 0.5)))
    feasibility = _scale_score_0_1_to_1_5(score.get("feasibility", opp.get("feasibility_score", 0.5)))
    impact = _scale_score_0_1_to_1_5(score.get("impact", 0.5))
    evidence = score.get("evidence_strength", 0.0)

    # Urgency: high novelty + high impact = high urgency
    urgency = round((novelty * 0.4 + impact * 0.4 + feasibility * 0.2), 2)
    # Composite using the same 0.30/0.25/0.25/0.20 weights, then map to 1-5
    composite_raw = (
        0.30 * (novelty - 1) / 4 +
        0.25 * (feasibility - 1) / 4 +
        0.25 * (impact - 1) / 4 +
        0.20 * evidence
    )
    composite = _scale_score_0_1_to_1_5(composite_raw)

    return InnovationDetail(
        id=opp_id,
        title=title,
        description=opp.get("rationale", ""),
        paradigm=paradigm,
        target_problem=problem_name,
        candidate_method=candidate_method,
        core_insight=opp.get("rationale", ""),
        source_papers=opp.get("supporting_evidence_ids", []),
        novelty_score=novelty,
        feasibility_score=feasibility,
        impact_score=impact,
        urgency_score=urgency,
        composite_score=composite,
        mvp_experiment=f"2-4周实验：在标准数据集上验证 {candidate_method} 对 {problem_name} 的有效性",
        created_at=datetime.now()
    )


# ============================================================================
# API Endpoints
# ============================================================================

# Domain mapping from frontend short names to DB categories
_DOMAIN_MAP: Dict[str, List[str]] = {
    "multi_agent": ["multi_agent_collaboration"],
    "agent_memory": ["long_term_memory"],
    "agent_tools": ["tool_use"],
    "llm_reasoning": ["llm_reasoning"],
    "robotics": ["robotics"],
    "general": ["general"],
}

@router.post("/papers/select", response_model=List[PaperInfo])
async def select_papers(request: PaperSelectRequest):
    """
    论文选择API - 按领域/年份/关键词筛选论文
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT id, title, year, category, abstract
            FROM papers
            WHERE 1=1
        """
        params = []

        if request.domain:
            # Support both exact DB category and frontend short names
            mapped = _DOMAIN_MAP.get(request.domain, [request.domain])
            if len(mapped) == 1:
                query += " AND category = ?"
                params.append(mapped[0])
            else:
                placeholders = ','.join('?' * len(mapped))
                query += f" AND category IN ({placeholders})"
                params.extend(mapped)

        if request.year_start:
            query += " AND year >= ?"
            params.append(request.year_start)

        if request.year_end:
            query += " AND year <= ?"
            params.append(request.year_end)

        if request.keywords:
            query += " AND (title LIKE ? OR abstract LIKE ?)"
            keyword_pattern = f"%{request.keywords}%"
            params.extend([keyword_pattern, keyword_pattern])

        query += " ORDER BY year DESC LIMIT ?"
        params.append(request.limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        papers = []
        for row in rows:
            papers.append(PaperInfo(
                id=row[0],
                title=row[1],
                year=row[2],
                domain=row[3] or "general",
                abstract=row[4],
                citation_count=0,
            ))

        conn.close()
        return papers

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/papers/list")
async def list_papers(
    domain: Optional[str] = None,
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    keywords: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200)
):
    """
    论文列表API - GET方式查询
    """
    request = PaperSelectRequest(
        domain=domain,
        year_start=year_start,
        year_end=year_end,
        keywords=keywords,
        limit=limit
    )
    return await select_papers(request)


@router.post("/generate", response_model=List[InnovationDetail])
async def generate_innovations(request: InnovationGenerateRequest):
    """
    创新点生成API - 基于知识图谱和向量数据库生成真实创新点。

    使用 InnovationDiscoveryEngine 在真实图数据上运行六大范式检测，
    所有评分来自图距离、向量相似度、证据强度等可解释指标，无随机数。
    """
    try:
        graph_db = get_local_graph_db()
        vector_db = get_local_vector_db()
        engine = InnovationDiscoveryEngine(graph_db, vector_db)

        paradigm_map = {
            "CDT": ParadigmType.CDT,
            "SHF": ParadigmType.SHF,
            "MC": ParadigmType.MC,
            "TF": ParadigmType.TF,
            "CH": ParadigmType.CH,
            "RGI": ParadigmType.RGI,
        }

        all_opportunities = []
        for p_str in request.paradigms:
            p_enum = paradigm_map.get(p_str.upper())
            if p_enum:
                ops = engine.discover(paradigm=p_enum, limit=request.count * 3)
                all_opportunities.extend(ops)

        # Deduplicate by opportunity_id
        seen = set()
        unique_ops = []
        for op in all_opportunities:
            oid = op.get("opportunity_id")
            if oid and oid not in seen:
                seen.add(oid)
                unique_ops.append(op)

        # Sort by composite_score descending
        unique_ops.sort(key=lambda x: x.get("composite_score", 0), reverse=True)

        # Convert to InnovationDetail
        result = []
        for i, op in enumerate(unique_ops[:request.count]):
            detail = _build_innovation_detail(op, graph_db, i)
            result.append(detail)

        # Persist to database
        conn = get_db_connection()
        cursor = conn.cursor()
        for detail in result:
            cursor.execute("""
                INSERT OR REPLACE INTO innovations (
                    id, title, description, paradigm, target_problem,
                    candidate_method, core_insight, source_papers,
                    novelty_score, feasibility_score, impact_score,
                    urgency_score, composite_score, mvp_experiment, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                detail.id, detail.title, detail.description,
                detail.paradigm, detail.target_problem,
                detail.candidate_method, detail.core_insight,
                json.dumps(detail.source_papers),
                detail.novelty_score, detail.feasibility_score,
                detail.impact_score, detail.urgency_score,
                detail.composite_score, detail.mvp_experiment,
                detail.created_at
            ))
        conn.commit()
        conn.close()

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Innovation generation error: {str(e)}")


@router.get("/{innovation_id}", response_model=InnovationDetail)
async def get_innovation(innovation_id: str):
    """
    获取创新点详情
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, description, paradigm, target_problem,
                   candidate_method, core_insight, source_papers,
                   novelty_score, feasibility_score, impact_score,
                   urgency_score, composite_score, mvp_experiment, created_at
            FROM innovations WHERE id = ?
        """, (innovation_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Innovation not found")
        
        return InnovationDetail(
            id=row[0],
            title=row[1],
            description=row[2],
            paradigm=row[3],
            target_problem=row[4],
            candidate_method=row[5],
            core_insight=row[6],
            source_papers=json.loads(row[7]),
            novelty_score=row[8],
            feasibility_score=row[9],
            impact_score=row[10],
            urgency_score=row[11],
            composite_score=row[12],
            mvp_experiment=row[13],
            created_at=row[14]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/backtest/run", response_model=BacktestResult)
async def run_backtest(request: BacktestRunRequest):
    """
    回测验证API - 执行回测验证
    """
    try:
        # 解析训练年份
        train_start, train_end = map(int, request.train_years.split('-'))
        
        # 获取训练集论文（2020-2024）
        conn = get_db_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        query = """
            SELECT id, title, year, category, abstract, methods, problems
            FROM papers WHERE year >= ? AND year <= ?
        """
        params = [train_start, train_end]

        if request.domain:
            query += " AND category = ?"
            params.append(request.domain)

        cursor.execute(query, params)
        train_rows = cursor.fetchall()
        train_papers = [_build_paper_dict(row) for row in train_rows]

        # 生成创新点预测 — 使用真实图数据上的 InnovationDiscoveryEngine
        graph_db = get_local_graph_db()
        vector_db = get_local_vector_db()
        engine = InnovationDiscoveryEngine(graph_db, vector_db)

        paradigm_map = {
            "CDT": ParadigmType.CDT,
            "SHF": ParadigmType.SHF,
            "MC": ParadigmType.MC,
            "TF": ParadigmType.TF,
            "CH": ParadigmType.CH,
            "RGI": ParadigmType.RGI,
        }

        all_opportunities = []
        for p_str in request.paradigms:
            p_enum = paradigm_map.get(p_str.upper())
            if p_enum:
                ops = engine.discover(paradigm=p_enum, limit=12)
                all_opportunities.extend(ops)

        # Deduplicate and sort
        seen = set()
        predicted_innovations = []
        for op in all_opportunities:
            oid = op.get("opportunity_id")
            if oid and oid not in seen:
                seen.add(oid)
                predicted_innovations.append(op)
        predicted_innovations.sort(key=lambda x: x.get("composite_score", 0), reverse=True)

        # 获取测试集论文（test_year）
        cursor.execute("""
            SELECT id, title, year, category, abstract, methods, problems
            FROM papers WHERE year = ?
        """, (request.test_year,))
        test_rows = cursor.fetchall()
        test_papers = [_build_paper_dict(row) for row in test_rows]

        conn.close()
        
        # 计算匹配度
        hits = 0
        details = []
        
        for pred in predicted_innovations[:12]:  # 预测12个创新点
            # 查找匹配的真实论文
            matched = False
            matched_paper = None

            # 从 rationale 提取关键词用于匹配
            rationale = pred.get("rationale", "").lower()
            pred_keywords = set(re.findall(r'\b[a-z][a-z0-9\-]+\b', rationale))
            # 过滤停用词
            stopwords = {"this", "that", "with", "from", "have", "been", "were", "they", "their", "which", "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "she", "use", "her", "now", "him", "than", "like", "time", "very", "when", "come", "here", "just", "like", "long", "make", "many", "over", "such", "take", "than", "them", "well", "were"}
            pred_keywords = {w for w in pred_keywords if len(w) > 3 and w not in stopwords}

            for test_paper in test_papers:
                test_text = f"{test_paper.get('title', '')} {test_paper.get('abstract', '')}".lower()
                test_keywords = set(re.findall(r'\b[a-z][a-z0-9\-]+\b', test_text))
                test_keywords = {w for w in test_keywords if len(w) > 3 and w not in stopwords}

                match_ratio = len(pred_keywords & test_keywords) / len(pred_keywords | test_keywords) if pred_keywords else 0

                # 标题相似度检查
                title_match = any(kw in test_paper.get("title", "").lower() for kw in pred_keywords)

                if match_ratio > 0.3 or title_match:
                    matched = True
                    matched_paper = test_paper
                    break

            if matched:
                hits += 1

            details.append({
                "predicted": pred.get("rationale", "")[:120],
                "paradigm": pred.get("innovation_type", "cdt").upper(),
                "matched": matched,
                "matched_paper": matched_paper.get("title") if matched_paper else None,
                "matched_paper_id": matched_paper.get("id") if matched_paper else None
            })
        
        # 计算指标
        predicted_count = len(predicted_innovations[:12])
        precision = hits / predicted_count if predicted_count > 0 else 0
        recall = hits / len(test_papers) if test_papers else 0
        f1_score = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        
        result = BacktestResult(
            id=f"bt_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            train_years=request.train_years,
            test_year=request.test_year,
            domain=request.domain,
            predicted_count=predicted_count,
            hit_count=hits,
            precision=round(precision, 3),
            recall=round(recall, 3),
            f1_score=round(f1_score, 3),
            details=details,
            created_at=datetime.now()
        )
        
        # 保存回测结果
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO backtest_results (
                id, train_years, test_year, domain, predicted_count,
                hit_count, precision, recall, f1_score, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result.id, result.train_years, result.test_year, result.domain,
            result.predicted_count, result.hit_count, result.precision,
            result.recall, result.f1_score, json.dumps(result.details),
            result.created_at
        ))
        conn.commit()
        conn.close()
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest error: {str(e)}")


@router.get("/backtest/history")
async def get_backtest_history(limit: int = Query(default=10, ge=1, le=50)):
    """
    获取历史回测结果
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, train_years, test_year, domain, predicted_count,
                   hit_count, precision, recall, f1_score, created_at
            FROM backtest_results
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append({
                "id": row[0],
                "train_years": row[1],
                "test_year": row[2],
                "domain": row[3],
                "predicted_count": row[4],
                "hit_count": row[5],
                "precision": row[6],
                "recall": row[7],
                "f1_score": row[8],
                "created_at": row[9]
            })
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ============================================================================
# Database Schema Initialization
# ============================================================================

def init_innovation_tables():
    """初始化创新点相关的数据库表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 创新点表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS innovations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            paradigm TEXT NOT NULL,
            target_problem TEXT,
            candidate_method TEXT,
            core_insight TEXT,
            source_papers TEXT,  -- JSON array
            novelty_score REAL,
            feasibility_score REAL,
            impact_score REAL,
            urgency_score REAL,
            composite_score REAL,
            mvp_experiment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 回测结果表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS backtest_results (
            id TEXT PRIMARY KEY,
            train_years TEXT NOT NULL,
            test_year INTEGER NOT NULL,
            domain TEXT,
            predicted_count INTEGER,
            hit_count INTEGER,
            precision REAL,
            recall REAL,
            f1_score REAL,
            details TEXT,  -- JSON array
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 论文表扩展（如果还没有methods/problems等字段）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS papers (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            year INTEGER,
            domain TEXT,
            abstract TEXT,
            citation_count INTEGER DEFAULT 0,
            methods TEXT,  -- JSON
            problems TEXT,  -- JSON
            assumptions TEXT,  -- JSON
            keywords TEXT,  -- JSON
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()


# 初始化创新点相关表（papers表已在research_graph.db中存在）
init_innovation_tables()
