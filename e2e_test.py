#!/usr/bin/env python3
"""
Research-Nexus Pro 端到端测试脚本（V3 API）
覆盖健康检查、领域图谱、创新面板与服务状态。
"""
import json
import time
from pathlib import Path

import requests

BASE_URL = "http://localhost:8000"
TEST_RESULTS = {}


def test_health():
    """测试健康检查端点"""
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        TEST_RESULTS["health"] = resp.status_code == 200
        print(f"✓ Health check: {resp.json() if resp.status_code == 200 else 'FAILED'}")
        return TEST_RESULTS["health"]
    except Exception as e:
        TEST_RESULTS["health"] = False
        print(f"✗ Health check failed: {e}")
        return False


def test_domain_map():
    """测试 V3 领域图谱端点"""
    try:
        resp = requests.get(f"{BASE_URL}/api/v3/domain-map", timeout=10)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}")

        data = resp.json()
        problems = len(data.get("problems", []))
        methods = len(data.get("methods", []))
        relations = len(data.get("relations", []))

        TEST_RESULTS["domain_map"] = {
            "problems": problems,
            "methods": methods,
            "relations": relations,
        }
        print(f"✓ Domain map: {problems} problems, {methods} methods, {relations} relations")
        return TEST_RESULTS["domain_map"]
    except Exception as e:
        TEST_RESULTS["domain_map"] = {"problems": 0, "methods": 0, "relations": 0}
        print(f"✗ Domain map failed: {e}")
        return TEST_RESULTS["domain_map"]


def test_innovation_board():
    """测试创新面板端点"""
    try:
        resp = requests.get(f"{BASE_URL}/api/v3/innovation-board", timeout=10)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}")

        data = resp.json()
        opportunities = data.get("opportunities", [])
        total_opportunities = data.get("total_opportunities", 0)
        problems_index = len(data.get("problems_index", {}))
        methods_index = len(data.get("methods_index", {}))

        TEST_RESULTS["innovation_board"] = {
            "opportunities_len": len(opportunities),
            "total_opportunities": total_opportunities,
            "problems_index_len": problems_index,
            "methods_index_len": methods_index,
        }
        print(
            "✓ Innovation board: "
            f"{len(opportunities)} opportunities, "
            f"total={total_opportunities}, "
            f"{problems_index} indexed problems, "
            f"{methods_index} indexed methods"
        )
        return TEST_RESULTS["innovation_board"]
    except Exception as e:
        TEST_RESULTS["innovation_board"] = {
            "opportunities_len": 0,
            "total_opportunities": 0,
            "problems_index_len": 0,
            "methods_index_len": 0,
        }
        print(f"✗ Innovation board failed: {e}")
        return TEST_RESULTS["innovation_board"]


def test_services_health():
    """测试论文生成相关服务健康端点"""
    try:
        resp = requests.get(f"{BASE_URL}/api/v3/services/health", timeout=5)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}")
        data = resp.json()
        TEST_RESULTS["services_health"] = data
        print(f"✓ Services health: {data.get('status', 'unknown')}")
        return data
    except Exception as e:
        TEST_RESULTS["services_health"] = {"status": "unreachable", "error": str(e)}
        print(f"✗ Services health failed: {e}")
        return TEST_RESULTS["services_health"]


def test_data_consistency():
    """测试关键数据一致性"""
    domain_map = TEST_RESULTS.get("domain_map", {})
    innovation = TEST_RESULTS.get("innovation_board", {})

    map_has_data = domain_map.get("problems", 0) > 0 and domain_map.get("methods", 0) > 0
    innovation_total_match = innovation.get("opportunities_len", 0) <= innovation.get(
        "total_opportunities", 0
    )
    index_has_data = innovation.get("problems_index_len", 0) > 0 and innovation.get(
        "methods_index_len", 0
    ) > 0

    consistent = map_has_data and innovation_total_match and index_has_data
    TEST_RESULTS["data_consistent"] = consistent

    print(f"\n✓ Data consistency: {'PASS' if consistent else 'FAIL'}")
    print(f"  - Domain map has data: {map_has_data}")
    print(f"  - Innovation total matches: {innovation_total_match}")
    print(f"  - Innovation indexes ready: {index_has_data}")
    return consistent


def generate_report():
    """生成测试报告"""
    report = {
        "test_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "test_results": TEST_RESULTS,
        "summary": {
            "problems": TEST_RESULTS.get("domain_map", {}).get("problems", 0),
            "methods": TEST_RESULTS.get("domain_map", {}).get("methods", 0),
            "relations": TEST_RESULTS.get("domain_map", {}).get("relations", 0),
            "innovation_opportunities": TEST_RESULTS.get("innovation_board", {}).get(
                "total_opportunities", 0
            ),
            "data_consistent": TEST_RESULTS.get("data_consistent", False),
            "all_tests_pass": all(
                [
                    TEST_RESULTS.get("health", False),
                    TEST_RESULTS.get("domain_map", {}).get("problems", 0) > 0,
                    TEST_RESULTS.get("domain_map", {}).get("methods", 0) > 0,
                    TEST_RESULTS.get("data_consistent", False),
                ]
            ),
        },
    }

    report_file = Path(__file__).parent / "e2e_test_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Test report saved: {report_file}")
    return report


def main():
    print("=" * 60)
    print("Research-Nexus Pro 端到端测试（V3）")
    print("=" * 60)

    print("\n【测试1】健康检查")
    test_health()

    print("\n【测试2】领域图谱")
    test_domain_map()

    print("\n【测试3】创新面板")
    test_innovation_board()

    print("\n【测试4】服务健康状态")
    test_services_health()

    print("\n【测试5】数据一致性检查")
    test_data_consistency()

    print("\n" + "=" * 60)
    print("测试完成，生成报告")
    print("=" * 60)

    report = generate_report()

    print("\n📊 测试摘要:")
    print(f"  问题节点: {report['summary']['problems']}")
    print(f"  方法节点: {report['summary']['methods']}")
    print(f"  关系边数: {report['summary']['relations']}")
    print(f"  创新机会: {report['summary']['innovation_opportunities']}")
    print(f"  数据一致性: {'✓' if report['summary']['data_consistent'] else '✗'}")
    print(f"  全部通过: {'✓' if report['summary']['all_tests_pass'] else '✗'}")

    return report["summary"]["all_tests_pass"]


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
