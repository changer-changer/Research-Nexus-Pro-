#!/usr/bin/env python3
"""
快速API测试脚本 - 使用requests直接调用后端API
"""
import requests
import json
import sys
from pathlib import Path

BASE_URL = "http://localhost:8000/api/cognee"

def test_health():
    """测试健康检查"""
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Health Check: {r.status_code}")
        print(f"  Response: {r.json()}")
        return r.status_code == 200
    except Exception as e:
        print(f"Health Check Failed: {e}")
        return False

def test_import_paper():
    """测试导入单篇论文"""
    paper_data = {
        "paper_text": """
Title: Sparsh: Self-supervised Touch Representations for Robotic Manipulation
Authors: Pratiksha R. Prabhakar, et al.
Year: 2024
Venue: arXiv

This paper presents Sparsh, a self-supervised learning approach for tactile representations 
in robotic manipulation. The key contributions include:

1. A universal tactile representation learned from unlabeled tactile data
2. Cross-sensor generalization across different tactile sensor types  
3. Application to multiple downstream manipulation tasks

The method addresses the problem of tactile perception and visuo-tactile fusion, 
using self-supervised pre-training and representation learning approaches.
        """,
        "paper_meta": {
            "arxiv_id": "2410.24090",
            "title": "Sparsh: Self-supervised Touch Representations for Robotic Manipulation",
            "year": 2024,
            "venue": "arXiv",
            "authors": ["Pratiksha R. Prabhakar", "et al."],
            "category": "tactile, vision, foundation"
        }
    }
    
    try:
        r = requests.post(f"{BASE_URL}/papers", json=paper_data, timeout=30)
        print(f"Import Paper: {r.status_code}")
        result = r.json()
        print(f"  Success: {result.get('success')}")
        print(f"  Paper ID: {result.get('paper_id')}")
        print(f"  Extracted Problems: {result.get('extracted_problems')}")
        print(f"  Extracted Methods: {result.get('extracted_methods')}")
        return result.get('success', False)
    except Exception as e:
        print(f"Import Paper Failed: {e}")
        return False

def test_search():
    """测试搜索功能"""
    try:
        r = requests.get(f"{BASE_URL}/search?q=tactile+representation&limit=5", timeout=10)
        print(f"Search: {r.status_code}")
        result = r.json()
        print(f"  Success: {result.get('success')}")
        print(f"  Total Found: {result.get('total_found')}")
        return result.get('success', False)
    except Exception as e:
        print(f"Search Failed: {e}")
        return False

def test_stats():
    """测试统计信息"""
    try:
        r = requests.get(f"{BASE_URL}/stats", timeout=5)
        print(f"Stats: {r.status_code}")
        result = r.json()
        print(f"  Response: {result}")
        return result.get('success', False)
    except Exception as e:
        print(f"Stats Failed: {e}")
        return False

def main():
    print("="*60)
    print("Cognee API 功能测试")
    print("="*60)
    
    results = {}
    
    # 测试1: 健康检查
    print("\n【测试1】健康检查")
    results['health'] = test_health()
    
    if not results['health']:
        print("\n⚠️ 后端服务未启动，尝试直接测试Cognee模块...")
        return test_direct()
    
    # 测试2: 导入论文
    print("\n【测试2】导入论文")
    results['import'] = test_import_paper()
    
    # 测试3: 搜索
    print("\n【测试3】搜索功能")
    results['search'] = test_search()
    
    # 测试4: 统计信息
    print("\n【测试4】统计信息")
    results['stats'] = test_stats()
    
    # 汇总
    print("\n" + "="*60)
    print("测试汇总")
    print("="*60)
    for test, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {test:15s}: {status}")
    
    all_passed = all(results.values())
    print("="*60)
    print(f"总体结果: {'✓ 全部通过' if all_passed else '✗ 部分失败'}")
    
    return all_passed

def test_direct():
    """直接测试Cognee模块（不依赖后端服务）"""
    import asyncio
    
    async def run_direct_test():
        sys.path.insert(0, str(Path(__file__).parent / "backend"))
        
        from cognee_integration.pipeline import CogneePipeline
        
        print("\n【直接测试】初始化CogneePipeline...")
        pipeline = CogneePipeline()
        await pipeline.initialize()
        
        print("✓ Pipeline初始化成功")
        
        # 测试导入
        print("\n【直接测试】导入论文...")
        paper_text = """
Title: Tactile-Visual Fusion for Robotic Manipulation
This paper explores the integration of tactile and visual sensing modalities 
for improved robotic manipulation performance. It addresses visuo-tactile fusion 
problems using deep learning methods.
        """
        meta = {
            "arxiv_id": "test_2501.00001",
            "title": "Tactile-Visual Fusion for Robotic Manipulation", 
            "year": 2025,
            "venue": "arXiv"
        }
        
        try:
            result = await pipeline.add_paper(paper_text, meta)
            print(f"✓ 导入成功: {result.get('paper_id')}")
            print(f"  提取问题数: {result.get('extracted_problems')}")
            print(f"  提取方法数: {result.get('extracted_methods')}")
        except Exception as e:
            print(f"✗ 导入失败: {e}")
            return False
        
        # 测试搜索
        print("\n【直接测试】搜索功能...")
        try:
            result = await pipeline.search("tactile fusion", limit=3)
            print(f"✓ 搜索成功: 找到 {result.get('total_found')} 条结果")
        except Exception as e:
            print(f"✗ 搜索失败: {e}")
            return False
        
        return True
    
    return asyncio.run(run_direct_test())

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
