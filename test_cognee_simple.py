#!/usr/bin/env python3
"""
简化版Cognee测试 - 验证基本功能
"""
import asyncio
import sys
import os
from pathlib import Path

# 添加后端路径
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# 设置环境变量
os.environ["COGNEE_LLM_API_KEY"] = "sk-kimi-ZwXDR6atKnmOREaIC4QBSz2QDCK8BoxXQSxpSHD0oOJremJc3pedgabgxYtRcMhB"
os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"
os.environ["ENABLE_BACKEND_ACCESS_CONTROL"] = "false"

async def test_basic():
    """基础测试"""
    from cognee_integration.pipeline import CogneePipeline
    
    print("【测试1】初始化Pipeline...")
    pipeline = CogneePipeline()
    await pipeline.initialize()
    print("✓ Pipeline初始化成功")
    
    # 测试导入
    print("\n【测试2】导入测试论文...")
    paper_text = """
Title: Tactile-Visual Fusion for Robotic Manipulation
Authors: Test Author et al.
Year: 2025
Venue: arXiv

This paper explores the integration of tactile and visual sensing for robotic manipulation.
It addresses visuo-tactile fusion problems using deep learning methods including 
diffusion policies and self-supervised representation learning.
    """
    meta = {
        "arxiv_id": "test_2025.00001",
        "title": "Tactile-Visual Fusion for Robotic Manipulation", 
        "year": 2025,
        "venue": "arXiv",
        "authors": ["Test Author", "Co-author"]
    }
    
    try:
        result = await pipeline.add_paper(paper_text, meta)
        print(f"✓ 论文导入: {result.get('paper_id')}")
        print(f"  success: {result.get('success')}")
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 测试搜索
    print("\n【测试3】搜索功能...")
    try:
        result = await pipeline.search("tactile visual", limit=3)
        print(f"✓ 搜索成功: 找到 {result.get('total_found')} 条结果")
    except Exception as e:
        print(f"✗ 搜索失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 测试统计
    print("\n【测试4】获取统计...")
    try:
        stats = await pipeline.processor.get_statistics()
        print(f"✓ 统计获取成功")
        print(f"  Papers: {stats.total_papers}")
        print(f"  Problems: {stats.total_problems}")
        print(f"  Methods: {stats.total_methods}")
    except Exception as e:
        print(f"✗ 统计失败: {e}")
    
    return True

async def import_latest_papers():
    """导入2024-2026年论文"""
    import json
    from cognee_integration.pipeline import CogneePipeline
    
    # 加载论文数据
    papers_file = Path(__file__).parent / "src" / "data" / "real_papers_enriched.json"
    with open(papers_file, "r") as f:
        data = json.load(f)
    
    papers = data.get("papers", [])
    
    # 筛选2024-2026年的论文（触觉视觉融合相关）
    latest_papers = [
        p for p in papers 
        if p.get("year") in [2024, 2025, 2026] 
        and "tactile" in p.get("category", "").lower()
    ]
    print(f"\n找到 {len(latest_papers)} 篇2024-2026年触觉相关论文")
    
    # 显示前10篇
    print("\n前10篇论文:")
    for i, p in enumerate(latest_papers[:10]):
        print(f"  {i+1}. [{p.get('year')}] {p.get('title', '')[:60]}...")
    
    # 初始化pipeline
    pipeline = CogneePipeline()
    await pipeline.initialize()
    
    # 导入前3篇测试
    results = []
    print("\n开始导入...")
    for paper in latest_papers[:3]:
        paper_id = paper.get("arxivId") or paper.get("id")
        print(f"\n  导入: {paper_id}")
        
        text = f"""
Title: {paper.get('title', '')}
Year: {paper.get('year')}
Venue: {paper.get('venue', 'arXiv')}
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
            "category": paper.get('category')
        }
        
        try:
            result = await pipeline.add_paper(text, meta)
            results.append({
                "paper_id": paper_id,
                "success": result.get("success", False)
            })
            print(f"    ✓ 成功")
        except Exception as e:
            print(f"    ✗ 失败: {str(e)[:50]}")
            results.append({
                "paper_id": paper_id,
                "success": False,
                "error": str(e)[:100]
            })
    
    return results

async def main():
    print("="*60)
    print("Cognee 基础功能测试")
    print("="*60)
    
    # 基础测试
    basic_ok = await test_basic()
    
    if not basic_ok:
        print("\n✗ 基础测试失败，跳过后续测试")
        return
    
    # 导入论文
    print("\n" + "="*60)
    print("导入最新触觉论文")
    print("="*60)
    import_results = await import_latest_papers()
    
    # 汇总
    success_count = sum(1 for r in import_results if r.get("success"))
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)
    print(f"  基础测试: {'✓ PASS' if basic_ok else '✗ FAIL'}")
    print(f"  论文导入: {success_count}/{len(import_results)} 成功")
    
    if import_results:
        print("\n  详情:")
        for r in import_results:
            status = "✓" if r.get("success") else "✗"
            print(f"    {status} {r['paper_id']}")

if __name__ == "__main__":
    asyncio.run(main())
