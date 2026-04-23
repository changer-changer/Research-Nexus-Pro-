#!/usr/bin/env python3
"""
导入2024-2026年触觉融合论文到Cognee知识库
"""
import asyncio
import json
import sys
import os
from pathlib import Path

# 添加后端路径
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# 设置环境变量
os.environ["COGNEE_LLM_API_KEY"] = "sk-kimi-ZwXDR6atKnmOREaIC4QBSz2QDCK8BoxXQSxpSHD0oOJremJc3pedgabgxYtRcMhB"

async def import_papers():
    """导入论文到Cognee"""
    from cognee_integration.pipeline import CogneePipeline
    
    # 加载论文数据
    papers_file = Path(__file__).parent / "src" / "data" / "real_papers_enriched.json"
    with open(papers_file, "r") as f:
        data = json.load(f)
    
    papers = data.get("papers", [])
    
    # 筛选2024-2026年的论文
    latest_papers = [p for p in papers if p.get("year") in [2024, 2025, 2026]]
    print(f"找到 {len(latest_papers)} 篇2024-2026年论文")
    
    # 初始化pipeline
    pipeline = CogneePipeline()
    await pipeline.initialize()
    
    results = []
    
    # 导入前5篇测试
    for paper in latest_papers[:5]:
        paper_id = paper.get("arxivId") or paper.get("id")
        print(f"\n导入论文: {paper_id}")
        
        # 准备文本内容
        text = f"""
Title: {paper.get('title', '')}
Category: {paper.get('category', '')}
Methodology: {paper.get('methodology', '')}

This paper addresses the following problems: {', '.join(paper.get('problems', []))}
Uses methods: {', '.join(paper.get('methods', []))}
"""
        
        meta = {
            "arxiv_id": paper_id,
            "title": paper.get('title'),
            "year": paper.get('year'),
            "venue": paper.get('venue'),
            "category": paper.get('category'),
            "problems": paper.get('problems', []),
            "methods": paper.get('methods', [])
        }
        
        try:
            result = await pipeline.add_paper(text, meta)
            results.append({
                "paper_id": paper_id,
                "success": result.get("success", False),
                "extracted_problems": result.get("extracted_problems", 0),
                "extracted_methods": result.get("extracted_methods", 0)
            })
            print(f"  ✓ 成功导入")
        except Exception as e:
            print(f"  ✗ 导入失败: {e}")
            results.append({
                "paper_id": paper_id,
                "success": False,
                "error": str(e)
            })
    
    return results

async def test_search():
    """测试搜索功能"""
    from cognee_integration.pipeline import CogneePipeline
    
    pipeline = CogneePipeline()
    await pipeline.initialize()
    
    test_queries = [
        "tactile perception",
        "visuo-tactile fusion",
        "diffusion policy manipulation"
    ]
    
    search_results = []
    for query in test_queries:
        print(f"\n搜索: {query}")
        try:
            result = await pipeline.search(query, limit=5)
            search_results.append({
                "query": query,
                "success": result.get("success", False),
                "total_found": result.get("total_found", 0)
            })
            print(f"  找到 {result.get('total_found', 0)} 条结果")
        except Exception as e:
            print(f"  搜索失败: {e}")
            search_results.append({
                "query": query,
                "success": False,
                "error": str(e)
            })
    
    return search_results

async def main():
    print("="*60)
    print("开始导入2024-2026年触觉融合论文到Cognee")
    print("="*60)
    
    # 1. 导入论文
    print("\n【步骤1】导入论文")
    import_results = await import_papers()
    
    # 2. 测试搜索
    print("\n【步骤2】测试搜索功能")
    search_results = await test_search()
    
    # 3. 生成报告
    print("\n【步骤3】生成测试报告")
    report = {
        "import_summary": {
            "total_attempted": len(import_results),
            "successful": sum(1 for r in import_results if r.get("success")),
            "failed": sum(1 for r in import_results if not r.get("success"))
        },
        "import_details": import_results,
        "search_summary": {
            "total_queries": len(search_results),
            "successful": sum(1 for r in search_results if r.get("success"))
        },
        "search_details": search_results
    }
    
    # 保存报告
    report_file = Path(__file__).parent / "import_test_report.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\n报告已保存到: {report_file}")
    print("\n" + "="*60)
    print("测试完成!")
    print(f"导入成功: {report['import_summary']['successful']}/{report['import_summary']['total_attempted']}")
    print(f"搜索成功: {report['search_summary']['successful']}/{report['search_summary']['total_queries']}")
    print("="*60)
    
    return report

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result["import_summary"]["successful"] > 0 else 1)
