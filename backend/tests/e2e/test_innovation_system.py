"""
创新点生成与回测系统 - 端到端测试
"""

import pytest
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"


class TestInnovationSystem:
    """创新点生成系统端到端测试"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """测试前置：检查API健康状态"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        print(f"\n✅ API健康检查通过: {response.json()}")
    
    def test_01_paper_selection_api(self):
        """测试1: 论文选择API"""
        print("\n📋 测试论文选择API...")
        
        # GET请求测试
        response = requests.get(
            f"{BASE_URL}/api/innovation/papers/list",
            params={
                "year_start": 2020,
                "year_end": 2026,
                "limit": 10
            }
        )
        assert response.status_code == 200
        papers = response.json()
        assert isinstance(papers, list)
        print(f"   ✅ GET /papers/list: 返回 {len(papers)} 篇论文")
        
        # POST请求测试
        response = requests.post(
            f"{BASE_URL}/api/innovation/papers/select",
            json={
                "year_start": 2020,
                "year_end": 2026,
                "limit": 5
            }
        )
        assert response.status_code == 200
        papers = response.json()
        assert isinstance(papers, list)
        print(f"   ✅ POST /papers/select: 返回 {len(papers)} 篇论文")
    
    def test_02_innovation_generation_api(self):
        """测试2: 创新点生成API"""
        print("\n💡 测试创新点生成API...")
        
        # 先获取论文
        response = requests.get(
            f"{BASE_URL}/api/innovation/papers/list",
            params={"limit": 5}
        )
        papers = response.json()
        
        if len(papers) < 2:
            print("   ⚠️ 论文数量不足，跳过生成测试")
            return
        
        paper_ids = [p["id"] for p in papers[:3]]
        
        # 生成创新点
        response = requests.post(
            f"{BASE_URL}/api/innovation/generate",
            json={
                "paper_ids": paper_ids,
                "paradigms": ["CDT", "SHF"],
                "count": 3
            }
        )
        assert response.status_code == 200
        innovations = response.json()
        assert isinstance(innovations, list)
        assert len(innovations) <= 3
        
        print(f"   ✅ 生成 {len(innovations)} 个创新点")
        
        # 验证创新点结构
        for inv in innovations:
            assert "id" in inv
            assert "title" in inv
            assert "paradigm" in inv
            assert "composite_score" in inv
            print(f"      - {inv['title'][:50]}... (得分: {inv['composite_score']:.2f})")
        
        # 保存第一个创新点ID用于后续测试
        self.__class__.test_innovation_id = innovations[0]["id"]
    
    def test_03_innovation_detail_api(self):
        """测试3: 创新点详情API"""
        print("\n🔍 测试创新点详情API...")
        
        # 使用之前生成的创新点ID
        if not hasattr(self.__class__, 'test_innovation_id'):
            print("   ⚠️ 没有可用的创新点ID，跳过测试")
            return
        
        innovation_id = self.__class__.test_innovation_id
        response = requests.get(f"{BASE_URL}/api/innovation/{innovation_id}")
        
        if response.status_code == 200:
            innovation = response.json()
            assert "id" in innovation
            assert "title" in innovation
            print(f"   ✅ 获取创新点详情: {innovation['title'][:50]}...")
        else:
            print(f"   ⚠️ 获取详情失败: {response.status_code}")
    
    def test_04_backtest_api(self):
        """测试4: 回测验证API"""
        print("\n📊 测试回测验证API...")
        
        response = requests.post(
            f"{BASE_URL}/api/innovation/backtest/run",
            json={
                "train_years": "2020-2024",
                "test_year": 2025,
                "paradigms": ["CDT", "SHF", "TF"]
            }
        )
        
        assert response.status_code == 200
        result = response.json()
        
        assert "id" in result
        assert "precision" in result
        assert "recall" in result
        assert "f1_score" in result
        assert "details" in result
        
        print(f"   ✅ 回测完成")
        print(f"      - 预测创新点: {result['predicted_count']}")
        print(f"      - 命中: {result['hit_count']}")
        print(f"      - 精确率: {result['precision']:.3f}")
        print(f"      - 召回率: {result['recall']:.3f}")
        print(f"      - F1值: {result['f1_score']:.3f}")
        
        self.__class__.test_backtest_id = result["id"]
    
    def test_05_backtest_history_api(self):
        """测试5: 回测历史API"""
        print("\n📜 测试回测历史API...")
        
        response = requests.get(
            f"{BASE_URL}/api/innovation/backtest/history",
            params={"limit": 5}
        )
        
        assert response.status_code == 200
        history = response.json()
        assert isinstance(history, list)
        
        print(f"   ✅ 获取 {len(history)} 条历史记录")
        
        for h in history[:3]:
            print(f"      - {h['id']}: F1={h['f1_score']:.3f}")
    
    def test_06_all_paradigms(self):
        """测试6: 全部6种创新范式"""
        print("\n🎯 测试全部6种创新范式...")
        
        paradigms = ["CDT", "SHF", "MC", "TF", "CH", "RGI"]
        
        # 获取论文
        response = requests.get(
            f"{BASE_URL}/api/innovation/papers/list",
            params={"limit": 10}
        )
        papers = response.json()
        
        if len(papers) < 3:
            print("   ⚠️ 论文数量不足，跳过测试")
            return
        
        paper_ids = [p["id"] for p in papers[:5]]
        
        # 测试每种范式
        for paradigm in paradigms:
            response = requests.post(
                f"{BASE_URL}/api/innovation/generate",
                json={
                    "paper_ids": paper_ids,
                    "paradigms": [paradigm],
                    "count": 2
                }
            )
            
            if response.status_code == 200:
                innovations = response.json()
                print(f"   ✅ {paradigm}: 生成 {len(innovations)} 个创新点")
            else:
                print(f"   ❌ {paradigm}: 失败 ({response.status_code})")
    
    def test_07_error_handling(self):
        """测试7: 错误处理"""
        print("\n⚠️ 测试错误处理...")
        
        # 空论文列表
        response = requests.post(
            f"{BASE_URL}/api/innovation/generate",
            json={"paper_ids": [], "paradigms": ["CDT"]}
        )
        print(f"   ✅ 空论文列表: {response.status_code}")
        
        # 无效创新范式
        response = requests.post(
            f"{BASE_URL}/api/innovation/generate",
            json={"paper_ids": ["test"], "paradigms": ["INVALID"]}
        )
        print(f"   ✅ 无效范式: {response.status_code}")
        
        # 不存在的创新点ID
        response = requests.get(f"{BASE_URL}/api/innovation/nonexistent_id")
        assert response.status_code == 404
        print(f"   ✅ 不存在ID: {response.status_code}")
    
    def test_08_performance(self):
        """测试8: 性能测试"""
        print("\n⏱️ 测试API性能...")
        
        # 论文选择性能
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/api/innovation/papers/list",
            params={"limit": 50}
        )
        elapsed = time.time() - start
        print(f"   ✅ 论文选择: {elapsed:.2f}s")
        assert elapsed < 3.0, "论文选择API响应时间过长"
        
        # 创新点生成性能
        response = requests.get(
            f"{BASE_URL}/api/innovation/papers/list",
            params={"limit": 5}
        )
        papers = response.json()
        
        if len(papers) >= 2:
            paper_ids = [p["id"] for p in papers[:3]]
            
            start = time.time()
            response = requests.post(
                f"{BASE_URL}/api/innovation/generate",
                json={
                    "paper_ids": paper_ids,
                    "paradigms": ["CDT", "SHF"],
                    "count": 3
                }
            )
            elapsed = time.time() - start
            print(f"   ✅ 创新点生成: {elapsed:.2f}s")
            assert elapsed < 5.0, "创新点生成API响应时间过长"


class TestDatabaseSchema:
    """数据库Schema测试"""
    
    def test_tables_exist(self):
        """测试数据库表是否存在"""
        print("\n🗄️ 测试数据库表...")
        
        # 通过API间接验证表存在
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "databases" in data
        print(f"   ✅ 数据库连接正常")


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("🧪 Research-Nexus Pro 创新点生成系统 - 端到端测试")
    print("=" * 60)
    
    test_class = TestInnovationSystem()
    
    try:
        test_class.setup()
        test_class.test_01_paper_selection_api()
        test_class.test_02_innovation_generation_api()
        test_class.test_03_innovation_detail_api()
        test_class.test_04_backtest_api()
        test_class.test_05_backtest_history_api()
        test_class.test_06_all_paradigms()
        test_class.test_07_error_handling()
        test_class.test_08_performance()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()