"""LLM-driven deep analysis engine for innovation enhancement.

Uses Kimi API (via Anthropic SDK) to:
1. Generate intelligent multi-dimensional search queries from innovation context
2. Perform deep literature analysis with structured insights
3. Produce actionable, personalized research recommendations
"""

import json
import logging
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

from app.services.kimi_client import KimiExtractor

logger = logging.getLogger(__name__)


# ============================================================================
# Pydantic Models for Structured LLM Output
# ============================================================================

class SearchQuery(BaseModel):
    """A single search query with its intended dimension."""
    query: str
    dimension: str  # e.g., "core_method", "target_problem", "cross_domain", "recent_advances", "benchmark"
    rationale: str  # why this query is relevant


class SearchQueriesOutput(BaseModel):
    """LLM output for search query generation."""
    queries: List[SearchQuery]
    reasoning: str


class KeyFinding(BaseModel):
    """A single key finding within an analysis dimension."""
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_papers: List[str] = Field(default_factory=list)  # paper titles


class AnalysisDimension(BaseModel):
    """One of the five analysis dimensions."""
    summary: str
    key_findings: List[KeyFinding]
    confidence_score: float = Field(ge=0.0, le=1.0)


class RecommendedPaper(BaseModel):
    """A paper recommended with LLM-generated relevance note."""
    id: str
    title: str
    authors: List[str]
    year: Optional[int]
    venue: Optional[str]
    citation_count: int
    source: str
    relevance_note: str  # one-sentence "why this matters"
    relevance_score: float


class DeepAnalysisOutput(BaseModel):
    """Complete structured output from LLM deep analysis."""
    research_landscape: AnalysisDimension
    technical_frontier: AnalysisDimension
    competitive_analysis: AnalysisDimension
    literature_gaps: AnalysisDimension
    actionable_recommendations: AnalysisDimension
    recommended_papers: List[RecommendedPaper]
    overall_assessment: str


# ============================================================================
# LLM Analyzer
# ============================================================================

class LLMAnalyzer:
    """Kimi-powered analyzer for deep literature-based innovation analysis."""

    def __init__(self):
        self.extractor = KimiExtractor()

    async def generate_search_queries(
        self,
        title: str,
        problem_statement: str,
        proposed_solution: str,
        description: str = ""
    ) -> List[SearchQuery]:
        """
        Generate 4-6 intelligent search queries from innovation context.

        Each query targets a different dimension to ensure comprehensive coverage.
        """
        system_prompt = """You are an expert research strategist with deep knowledge of academic literature search.
Your task is to generate intelligent search queries for a literature survey based on an innovation idea.

Generate 4-6 search queries that cover different dimensions:
1. Core method/technique — the main approach being proposed
2. Target problem domain — the specific challenge being addressed
3. Cross-domain opportunities — related fields where similar ideas have been tried
4. Recent advances — latest developments in the relevant area (2023-2026)
5. Benchmark/comparison — existing baselines and state-of-the-art methods

For each query, provide:
- "query": the actual search string (concise, 3-8 words, optimized for academic databases)
- "dimension": which dimension it targets
- "rationale": why this query will find relevant papers

Output must be valid JSON matching this schema:
{
  "queries": [
    {"query": "...", "dimension": "...", "rationale": "..."}
  ],
  "reasoning": "brief explanation of your query strategy"
}

Respond in Chinese (中文)."""

        user_content = f"""Innovation Title: {title}
Problem Statement: {problem_statement}
Proposed Solution: {proposed_solution}
Description: {description}

Please generate search queries."""

        try:
            response = await self.extractor.client.messages.create(
                model=self.extractor.model,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
                temperature=0.3,
                max_tokens=2048
            )

            result_text = response.content[0].text
            result_text = self._extract_json(result_text)
            parsed = json.loads(result_text)

            queries = []
            for q in parsed.get("queries", []):
                queries.append(SearchQuery(
                    query=q.get("query", ""),
                    dimension=q.get("dimension", ""),
                    rationale=q.get("rationale", "")
                ))

            if not queries:
                raise ValueError("No queries generated")

            return queries

        except Exception as e:
            logger.warning(f"LLM query generation failed: {e}. Using fallback.")
            return self._fallback_queries(title, problem_statement, proposed_solution)

    async def analyze_literature(
        self,
        innovation_data: Dict[str, Any],
        papers: List[Dict[str, Any]]
    ) -> DeepAnalysisOutput:
        """
        Perform deep analysis of literature in context of the innovation idea.

        Uses Kimi to generate personalized insights across five dimensions.
        """
        system_prompt = """You are a world-class research scientist and peer reviewer.
Your task is to analyze a collection of academic papers in the context of a proposed innovation idea,
and produce a structured, actionable analysis.

You MUST analyze across these 5 dimensions:

1. research_landscape (研究脉络):
   - Who are the key researchers/institutions in this area?
   - What are the milestone papers and their contributions?
   - How has the field evolved over the past 5 years?

2. technical_frontier (技术前沿):
   - What are the latest methods and emerging trends?
   - What new techniques appeared in 2024-2026?
   - What paradigm shifts are happening?

3. competitive_analysis (竞争态势):
   - Who is working on similar problems?
   - What approaches have been tried and what were the results?
   - What is the differentiation opportunity for this innovation?

4. literature_gaps (文献缺口):
   - What specific assumptions remain unverified?
   - What experiments are missing from existing work?
   - What theoretical foundations are lacking?

5. actionable_recommendations (行动建议):
   - What are the concrete next steps for this research?
   - What experiments should be prioritized?
   - What baselines should be compared against?
   - What datasets would be most appropriate?

For each dimension, provide:
- "summary": a concise overview (2-3 sentences)
- "key_findings": a list of specific findings, each with "text", "confidence" (0-1), and "supporting_papers" (list of relevant paper titles)
- "confidence_score": overall confidence in this analysis (0-1)

Also provide:
- "recommended_papers": select the top 10 most relevant papers from the provided list, each with a one-sentence "relevance_note" explaining why it matters
- "overall_assessment": a brief executive summary of the innovation's position in the literature landscape

CRITICAL RULES:
- Be specific, not generic. "Researchers have explored X but left Y unverified" is better than "More research is needed"
- Reference actual paper titles in your findings
- If the innovation is genuinely novel, say so and explain why
- If there is significant prior work, be honest about overlap and differentiation
- Respond in Chinese (中文)

Output must be valid JSON."""

        # Build compact paper summaries for the prompt
        paper_summaries = []
        for i, p in enumerate(papers[:30]):  # limit to 30 papers to fit context
            summary = f"[{i+1}] {p.get('title', 'Unknown')}"
            if p.get('authors'):
                summary += f" by {', '.join(p['authors'][:3])}"
            if p.get('year'):
                summary += f" ({p['year']})"
            if p.get('venue'):
                summary += f" — {p['venue']}"
            if p.get('citation_count'):
                summary += f" [cited {p['citation_count']}]"
            if p.get('abstract'):
                abstract = p['abstract'][:300].replace('\n', ' ')
                summary += f"\n    Abstract: {abstract}..."
            paper_summaries.append(summary)

        papers_text = "\n\n".join(paper_summaries)

        user_content = f"""## Innovation Idea

Title: {innovation_data.get('title', 'Unknown')}
Problem: {innovation_data.get('problem_statement', '')}
Solution: {innovation_data.get('proposed_solution', '')}
Description: {innovation_data.get('description', '')}

## Literature Collection ({len(papers)} papers)

{papers_text}

Please perform the deep analysis. Output valid JSON only."""

        try:
            response = await self.extractor.client.messages.create(
                model=self.extractor.model,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
                temperature=0.2,
                max_tokens=8192
            )

            result_text = response.content[0].text
            result_text = self._extract_json(result_text)
            parsed = json.loads(result_text)

            return self._parse_analysis_output(parsed, papers)

        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}. Using fallback analysis.")
            return self._fallback_analysis(innovation_data, papers)

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _extract_json(self, text: str) -> str:
        """Extract JSON from markdown code blocks or raw text."""
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return text

    def _fallback_queries(
        self,
        title: str,
        problem_statement: str,
        proposed_solution: str
    ) -> List[SearchQuery]:
        """Generate fallback search queries when LLM fails."""
        queries = []

        # Query 1: core topic
        queries.append(SearchQuery(
            query=title[:60],
            dimension="core_method",
            rationale="搜索核心方法和技术"
        ))

        # Query 2: problem domain
        if problem_statement:
            q = problem_statement[:60] if len(problem_statement) <= 60 else problem_statement[:60]
            queries.append(SearchQuery(
                query=q,
                dimension="target_problem",
                rationale="搜索目标问题领域的相关工作"
            ))

        # Query 3: method + problem combination
        if proposed_solution and problem_statement:
            combo = f"{proposed_solution.split()[0]} {problem_statement.split()[0]}"
            queries.append(SearchQuery(
                query=combo[:60],
                dimension="cross_domain",
                rationale="搜索方法在问题域上的应用"
            ))

        # Query 4: recent advances
        queries.append(SearchQuery(
            query=f"{title.split()[0]} survey 2024 2025",
            dimension="recent_advances",
            rationale="搜索最新综述和进展"
        ))

        return queries

    def _parse_analysis_output(
        self,
        parsed: Dict[str, Any],
        papers: List[Dict[str, Any]]
    ) -> DeepAnalysisOutput:
        """Parse LLM JSON output into structured Pydantic models."""

        def parse_dimension(data: Dict) -> AnalysisDimension:
            findings = []
            for f in data.get("key_findings", []):
                if isinstance(f, str):
                    findings.append(KeyFinding(text=f, confidence=0.7))
                else:
                    findings.append(KeyFinding(
                        text=f.get("text", ""),
                        confidence=f.get("confidence", 0.7),
                        supporting_papers=f.get("supporting_papers", [])
                    ))
            return AnalysisDimension(
                summary=data.get("summary", ""),
                key_findings=findings,
                confidence_score=data.get("confidence_score", 0.7)
            )

        # Build paper lookup by title for ID mapping
        paper_by_title = {}
        for p in papers:
            paper_by_title[p.get("title", "").lower()] = p

        rec_papers = []
        for rp in parsed.get("recommended_papers", []):
            title = rp.get("title", "")
            # Find matching paper from search results
            matched = paper_by_title.get(title.lower(), {})
            if not matched:
                # Try partial match
                for pt, p in paper_by_title.items():
                    if title.lower() in pt or pt in title.lower():
                        matched = p
                        break

            rec_papers.append(RecommendedPaper(
                id=matched.get("id", rp.get("id", "unknown")),
                title=title or matched.get("title", "Unknown"),
                authors=matched.get("authors", rp.get("authors", [])),
                year=matched.get("year", rp.get("year")),
                venue=matched.get("venue", rp.get("venue")),
                citation_count=matched.get("citation_count", rp.get("citation_count", 0)),
                source=matched.get("source", rp.get("source", "unknown")),
                relevance_note=rp.get("relevance_note", "相关论文"),
                relevance_score=rp.get("relevance_score", 0.7)
            ))

        return DeepAnalysisOutput(
            research_landscape=parse_dimension(parsed.get("research_landscape", {})),
            technical_frontier=parse_dimension(parsed.get("technical_frontier", {})),
            competitive_analysis=parse_dimension(parsed.get("competitive_analysis", {})),
            literature_gaps=parse_dimension(parsed.get("literature_gaps", {})),
            actionable_recommendations=parse_dimension(parsed.get("actionable_recommendations", {})),
            recommended_papers=rec_papers,
            overall_assessment=parsed.get("overall_assessment", "")
        )

    def _fallback_analysis(
        self,
        innovation_data: Dict[str, Any],
        papers: List[Dict[str, Any]]
    ) -> DeepAnalysisOutput:
        """Generate fallback analysis when LLM fails."""
        title = innovation_data.get("title", "该创新点")

        # Build simple stats from papers
        recent_count = sum(1 for p in papers if p.get("year") and p.get("year") >= 2020)
        highly_cited = sum(1 for p in papers if p.get("citation_count", 0) > 100)
        sources = {}
        for p in papers:
            s = p.get("source", "unknown")
            sources[s] = sources.get(s, 0) + 1

        top_venues = {}
        for p in papers:
            v = p.get("venue", "Unknown")
            if v:
                top_venues[v] = top_venues.get(v, 0) + 1

        # Create recommended papers from search results
        rec_papers = []
        for p in sorted(papers, key=lambda x: x.get("citation_count", 0), reverse=True)[:10]:
            rec_papers.append(RecommendedPaper(
                id=p.get("id", "unknown"),
                title=p.get("title", "Unknown"),
                authors=p.get("authors", []),
                year=p.get("year"),
                venue=p.get("venue"),
                citation_count=p.get("citation_count", 0),
                source=p.get("source", "unknown"),
                relevance_note="基于引用数和相关性排序的推荐论文",
                relevance_score=0.6
            ))

        return DeepAnalysisOutput(
            research_landscape=AnalysisDimension(
                summary=f"在{title}相关领域，共检索到{len(papers)}篇论文。其中{recent_count}篇发表于2020年后，{highly_cited}篇为高被引论文。",
                key_findings=[
                    KeyFinding(text=f"文献主要来源于: {', '.join(f'{k}({v}篇)' for k, v in list(sources.items())[:3])}", confidence=0.8),
                    KeyFinding(text=f"主要发表 venue: {', '.join(list(top_venues.keys())[:3])}", confidence=0.7),
                ],
                confidence_score=0.6
            ),
            technical_frontier=AnalysisDimension(
                summary="由于LLM分析服务暂时不可用，无法提供详细的技术前沿分析。建议手动查看最新会议论文（NeurIPS、ICML、ICLR）。",
                key_findings=[
                    KeyFinding(text="建议关注2024-2026年的最新进展", confidence=0.5),
                ],
                confidence_score=0.4
            ),
            competitive_analysis=AnalysisDimension(
                summary="竞争态势分析需要LLM支持。已收集的文献可作为手动分析的基础。",
                key_findings=[
                    KeyFinding(text=f"共找到{len(papers)}篇相关文献，建议筛选核心工作进行对比", confidence=0.6),
                ],
                confidence_score=0.4
            ),
            literature_gaps=AnalysisDimension(
                summary="文献缺口识别需要LLM的深度推理。建议基于已收集的文献，手动梳理未验证的假设和缺失实验。",
                key_findings=[
                    KeyFinding(text="建议关注：实验可重复性、跨领域验证、大规模评估", confidence=0.5),
                ],
                confidence_score=0.4
            ),
            actionable_recommendations=AnalysisDimension(
                summary="基于现有文献，建议优先复现核心baseline方法，并在此之上进行改进。",
                key_findings=[
                    KeyFinding(text="第一步：精读高被引论文，理解核心方法论", confidence=0.8),
                    KeyFinding(text="第二步：实现baseline并在标准数据集上验证", confidence=0.7),
                    KeyFinding(text="第三步：引入创新方法并进行消融实验", confidence=0.6),
                ],
                confidence_score=0.6
            ),
            recommended_papers=rec_papers,
            overall_assessment=f"由于分析服务暂时受限，仅提供基于统计的初步评估。共收集{len(papers)}篇文献，建议结合人工判断进行深度分析。"
        )
