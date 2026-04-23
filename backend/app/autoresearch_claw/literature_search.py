"""AutoResearchClaw 适配层 - 深度文献搜索模块

从 AutoResearchClaw 提取核心功能，集成到 Research-Nexus Pro
支持：OpenAlex + arXiv + Semantic Scholar 多源搜索
"""

from typing import Optional, List, Dict, Any
import aiohttp
import asyncio
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class LiteratureSource(str, Enum):
    """文献来源枚举"""
    OPENALEX = "openalex"
    ARXIV = "arxiv"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    ALL = "all"


@dataclass
class LiteraturePaper:
    """文献数据模型"""
    id: str
    title: str
    authors: List[str]
    abstract: Optional[str]
    year: Optional[int]
    venue: Optional[str]
    url: Optional[str]
    pdf_url: Optional[str]
    citation_count: int = 0
    source: LiteratureSource = LiteratureSource.OPENALEX
    relevance_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "authors": self.authors,
            "abstract": self.abstract,
            "year": self.year,
            "venue": self.venue,
            "url": self.url,
            "pdf_url": self.pdf_url,
            "citation_count": self.citation_count,
            "source": self.source.value,
            "relevance_score": self.relevance_score
        }


class OpenAlexClient:
    """OpenAlex API 客户端"""
    
    BASE_URL = "https://api.openalex.org"
    
    def __init__(self, email: Optional[str] = None):
        self.email = email or "research@nexus.pro"
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search(
        self, 
        query: str, 
        limit: int = 10,
        filters: Optional[Dict] = None
    ) -> List[LiteraturePaper]:
        """搜索 OpenAlex 文献"""
        if not self.session:
            raise RuntimeError("Client not initialized. Use async with context.")
        
        # 构建查询
        search_filter = f"?search={query.replace(' ', '+')}"
        filter_params = ""
        if filters:
            if "year_from" in filters:
                filter_params += f"&filter=publication_year:>{filters['year_from']}"
            if "venue" in filters:
                filter_params += f"&filter=host_venue.display_name:{filters['venue']}"
        
        url = f"{self.BASE_URL}/works{search_filter}{filter_params}&per-page={limit}&mailto={self.email}"
        
        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status != 200:
                    logger.warning(f"OpenAlex API error: {resp.status}")
                    return []
                
                data = await resp.json()
                results = []
                
                for work in data.get("results", []):
                    paper = self._parse_work(work)
                    if paper:
                        results.append(paper)
                
                return results
        except Exception as e:
            logger.error(f"OpenAlex search failed: {e}")
            return []
    
    def _parse_work(self, work: Dict) -> Optional[LiteraturePaper]:
        """解析 OpenAlex work 对象"""
        try:
            authors = []
            for auth in work.get("authorships", []):
                author_name = auth.get("author", {}).get("display_name", "")
                if author_name:
                    authors.append(author_name)
            
            venue = work.get("host_venue", {}).get("display_name") or \
                   work.get("primary_location", {}).get("source", {}).get("display_name")
            
            # 获取 PDF URL
            pdf_url = None
            for loc in work.get("locations", []):
                if loc.get("is_oa") and loc.get("pdf_url"):
                    pdf_url = loc.get("pdf_url")
                    break
            
            return LiteraturePaper(
                id=work.get("id", "").replace("https://openalex.org/", ""),
                title=work.get("display_name", ""),
                authors=authors,
                abstract=work.get("abstract"),
                year=work.get("publication_year"),
                venue=venue,
                url=work.get("doi") or work.get("id"),
                pdf_url=pdf_url,
                citation_count=work.get("cited_by_count", 0),
                source=LiteratureSource.OPENALEX,
                relevance_score=work.get("relevance_score", 0.5)
            )
        except Exception as e:
            logger.warning(f"Failed to parse OpenAlex work: {e}")
            return None


class ArxivClient:
    """arXiv API 客户端"""
    
    BASE_URL = "http://export.arxiv.org/api/query"
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search(
        self, 
        query: str, 
        limit: int = 10,
        categories: Optional[List[str]] = None
    ) -> List[LiteraturePaper]:
        """搜索 arXiv 文献"""
        if not self.session:
            raise RuntimeError("Client not initialized.")
        
        # 构建 arXiv 查询
        search_query = query.replace(" ", "+")
        if categories:
            cat_filter = "+OR+".join([f"cat:{c}" for c in categories])
            search_query = f"({search_query})+AND+({cat_filter})"
        
        url = f"{self.BASE_URL}?search_query={search_query}&start=0&max_results={limit}&sortBy=relevance&sortOrder=descending"
        
        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status != 200:
                    logger.warning(f"arXiv API error: {resp.status}")
                    return []
                
                # 解析 XML 响应
                import xml.etree.ElementTree as ET
                text = await resp.text()
                root = ET.fromstring(text)
                
                # arXiv Atom 命名空间
                ns = {
                    'atom': 'http://www.w3.org/2005/Atom',
                    'arxiv': 'http://arxiv.org/schemas/atom'
                }
                
                results = []
                for entry in root.findall('atom:entry', ns):
                    paper = self._parse_entry(entry, ns)
                    if paper:
                        results.append(paper)
                
                return results
        except Exception as e:
            logger.error(f"arXiv search failed: {e}")
            return []
    
    def _parse_entry(self, entry, ns) -> Optional[LiteraturePaper]:
        """解析 arXiv entry"""
        try:
            id_elem = entry.find('atom:id', ns)
            arxiv_id = id_elem.text.split('/')[-1] if id_elem else ""
            
            title_elem = entry.find('atom:title', ns)
            title = title_elem.text.strip() if title_elem else ""
            
            authors = []
            for author in entry.findall('atom:author', ns):
                name_elem = author.find('atom:name', ns)
                if name_elem is not None:
                    authors.append(name_elem.text)
            
            summary_elem = entry.find('atom:summary', ns)
            abstract = summary_elem.text.strip() if summary_elem else ""
            
            # 获取年份
            published = entry.find('atom:published', ns)
            year = None
            if published is not None:
                year = int(published.text[:4])
            
            # PDF URL
            pdf_url = f"http://arxiv.org/pdf/{arxiv_id}.pdf"
            
            return LiteraturePaper(
                id=arxiv_id,
                title=title,
                authors=authors,
                abstract=abstract,
                year=year,
                venue="arXiv",
                url=f"http://arxiv.org/abs/{arxiv_id}",
                pdf_url=pdf_url,
                source=LiteratureSource.ARXIV,
                relevance_score=0.7  # arXiv 预印本权重较高
            )
        except Exception as e:
            logger.warning(f"Failed to parse arXiv entry: {e}")
            return None


class SemanticScholarClient:
    """Semantic Scholar API 客户端"""
    
    BASE_URL = "https://api.semanticscholar.org/graph/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        headers = {}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        self.session = aiohttp.ClientSession(headers=headers)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search(
        self, 
        query: str, 
        limit: int = 10,
        fields: Optional[List[str]] = None
    ) -> List[LiteraturePaper]:
        """搜索 Semantic Scholar 文献"""
        if not self.session:
            raise RuntimeError("Client not initialized.")
        
        default_fields = ["title", "authors", "abstract", "year", "venue", 
                         "citationCount", "openAccessPdf", "externalIds"]
        fields = fields or default_fields
        
        url = f"{self.BASE_URL}/paper/search"
        params = {
            "query": query,
            "limit": limit,
            "fields": ",".join(fields)
        }
        
        try:
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 429:
                    logger.warning("Semantic Scholar rate limited")
                    return []
                if resp.status != 200:
                    logger.warning(f"Semantic Scholar API error: {resp.status}")
                    return []
                
                data = await resp.json()
                results = []
                
                for paper_data in data.get("data", []):
                    paper = self._parse_paper(paper_data)
                    if paper:
                        results.append(paper)
                
                return results
        except Exception as e:
            logger.error(f"Semantic Scholar search failed: {e}")
            return []
    
    def _parse_paper(self, data: Dict) -> Optional[LiteraturePaper]:
        """解析 Semantic Scholar paper"""
        try:
            authors = []
            for author in data.get("authors", []):
                name = author.get("name", "")
                if name:
                    authors.append(name)
            
            # 获取 PDF URL
            pdf_url = None
            oa_info = data.get("openAccessPdf")
            if oa_info:
                pdf_url = oa_info.get("url")
            
            # 获取 DOI/URL
            external_ids = data.get("externalIds", {})
            url = None
            if "DOI" in external_ids:
                url = f"https://doi.org/{external_ids['DOI']}"
            elif "ArXiv" in external_ids:
                url = f"https://arxiv.org/abs/{external_ids['ArXiv']}"
            
            paper_id = data.get("paperId", "")
            
            return LiteraturePaper(
                id=paper_id,
                title=data.get("title", ""),
                authors=authors,
                abstract=data.get("abstract"),
                year=data.get("year"),
                venue=data.get("venue"),
                url=url,
                pdf_url=pdf_url,
                citation_count=data.get("citationCount", 0),
                source=LiteratureSource.SEMANTIC_SCHOLAR,
                relevance_score=data.get("score", 0.5)
            )
        except Exception as e:
            logger.warning(f"Failed to parse Semantic Scholar paper: {e}")
            return None


class DeepLiteratureSearch:
    """深度文献搜索引擎 - 聚合多源搜索"""
    
    def __init__(
        self,
        openalex_email: Optional[str] = None,
        s2_api_key: Optional[str] = None
    ):
        self.openalex = OpenAlexClient(email=openalex_email)
        self.arxiv = ArxivClient()
        self.semantic_scholar = SemanticScholarClient(api_key=s2_api_key)
    
    async def search_multi_source(
        self,
        query: str,
        sources: List[LiteratureSource] = None,
        limit_per_source: int = 10
    ) -> Dict[LiteratureSource, List[LiteraturePaper]]:
        """
        多源并行搜索
        
        Args:
            query: 搜索关键词
            sources: 要搜索的来源列表，默认全部
            limit_per_source: 每个来源的结果数量
        
        Returns:
            按来源分组的文献列表
        """
        sources = sources or [LiteratureSource.OPENALEX, LiteratureSource.ARXIV, 
                             LiteratureSource.SEMANTIC_SCHOLAR]
        
        results = {}
        
        # 并行搜索所有来源
        async with self.openalex, self.arxiv, self.semantic_scholar:
            tasks = []
            
            if LiteratureSource.OPENALEX in sources:
                tasks.append((LiteratureSource.OPENALEX, 
                            self.openalex.search(query, limit_per_source)))
            if LiteratureSource.ARXIV in sources:
                tasks.append((LiteratureSource.ARXIV, 
                            self.arxiv.search(query, limit_per_source)))
            if LiteratureSource.SEMANTIC_SCHOLAR in sources:
                tasks.append((LiteratureSource.SEMANTIC_SCHOLAR, 
                            self.semantic_scholar.search(query, limit_per_source)))
            
            # 等待所有搜索完成
            search_results = await asyncio.gather(
                *[task[1] for task in tasks],
                return_exceptions=True
            )
            
            # 组织结果
            for i, (source, _) in enumerate(tasks):
                result = search_results[i]
                if isinstance(result, Exception):
                    logger.error(f"{source.value} search failed: {result}")
                    results[source] = []
                else:
                    results[source] = result
        
        return results
    
    async def search_aggregated(
        self,
        query: str,
        total_limit: int = 20
    ) -> List[LiteraturePaper]:
        """
        聚合搜索并去重排序
        
        Args:
            query: 搜索关键词
            total_limit: 最终结果数量
        
        Returns:
            去重排序后的文献列表
        """
        # 从各来源获取更多结果用于去重
        multi_results = await self.search_multi_source(
            query, 
            limit_per_source=total_limit // 2 + 5
        )
        
        # 合并所有结果
        all_papers = []
        for source_papers in multi_results.values():
            all_papers.extend(source_papers)
        
        # 去重（基于标题相似度）
        unique_papers = self._deduplicate(all_papers)
        
        # 按引用数和相关性综合排序
        sorted_papers = self._rank_papers(unique_papers)
        
        return sorted_papers[:total_limit]
    
    def _deduplicate(self, papers: List[LiteraturePaper]) -> List[LiteraturePaper]:
        """基于标题相似度去重"""
        seen_titles = set()
        unique = []
        
        for paper in papers:
            # 标准化标题用于比较
            normalized = paper.title.lower().strip()
            normalized = "".join(c for c in normalized if c.isalnum() or c.isspace())
            
            if normalized not in seen_titles:
                seen_titles.add(normalized)
                unique.append(paper)
        
        return unique
    
    def _rank_papers(self, papers: List[LiteraturePaper]) -> List[LiteraturePaper]:
        """综合排序：引用数 + 相关性 + 时效性"""
        def score(paper: LiteraturePaper) -> float:
            # 基础分：相关性
            s = paper.relevance_score * 100
            
            # 引用分（对数压缩）
            if paper.citation_count > 0:
                s += min(50, 10 * (paper.citation_count ** 0.5))
            
            # 时效分（近5年加分）
            if paper.year and paper.year >= 2020:
                s += 20
            
            # arXiv 预印本稍微降权（未经过同行评审）
            if paper.source == LiteratureSource.ARXIV:
                s *= 0.9
            
            return s
        
        return sorted(papers, key=score, reverse=True)


# 便捷函数
async def deep_search(
    query: str,
    sources: List[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    便捷搜索函数
    
    Usage:
        results = await deep_search("multi-agent reinforcement learning")
    """
    search_engine = DeepLiteratureSearch()
    
    if sources:
        source_list = [LiteratureSource(s) for s in sources]
        multi_results = await search_engine.search_multi_source(query, source_list)
        # 合并结果
        all_papers = []
        for papers in multi_results.values():
            all_papers.extend(papers)
        papers = all_papers[:limit]
    else:
        papers = await search_engine.search_aggregated(query, limit)
    
    return [p.to_dict() for p in papers]