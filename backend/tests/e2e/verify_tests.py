#!/usr/bin/env python3
"""
测试套件验证脚本
验证所有测试文件是否正确创建并可导入
"""

import os
import sys

# 颜色代码
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✓{RESET} {msg}")

def print_error(msg):
    print(f"{RED}✗{RESET} {msg}")

def print_warning(msg):
    print(f"{YELLOW}⚠{RESET} {msg}")

def check_file_exists(path, name):
    """检查文件是否存在"""
    if os.path.exists(path):
        size = os.path.getsize(path)
        print_success(f"{name}: {size} bytes")
        return True
    else:
        print_error(f"{name}: 文件不存在")
        return False

def main():
    print("\n" + "="*60)
    print("Research Nexus Pro - 端到端测试套件验证")
    print("="*60 + "\n")
    
    # 测试目录
    test_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 需要检查的文件
    files = [
        ("__init__.py", "测试包初始化"),
        ("test_database_integration.py", "数据库集成测试"),
        ("test_api_endpoints.py", "API端点测试"),
        ("test_paper_generation_engine.py", "论文生成引擎测试"),
        ("test_feasibility_evaluator.py", "可行性评估测试"),
        ("test_sse_streaming.py", "SSE流式测试"),
        ("e2e_test.py", "端到端测试脚本"),
        ("optimize_database.py", "数据库优化脚本"),
        ("run_e2e_tests.sh", "测试运行脚本"),
        ("README.md", "测试文档"),
    ]
    
    all_ok = True
    print("[1] 检查测试文件...")
    for filename, desc in files:
        path = os.path.join(test_dir, filename)
        if not check_file_exists(path, desc):
            all_ok = False
    
    # 检查文件权限
    print("\n[2] 检查可执行权限...")
    executable_files = ["e2e_test.py", "optimize_database.py", "run_e2e_tests.sh"]
    for filename in executable_files:
        path = os.path.join(test_dir, filename)
        if os.path.exists(path):
            if os.access(path, os.X_OK):
                print_success(f"{filename}: 可执行")
            else:
                print_warning(f"{filename}: 需要添加执行权限")
                all_ok = False
    
    # 统计代码行数
    print("\n[3] 代码统计...")
    total_lines = 0
    for filename, _ in files:
        if filename.endswith('.py'):
            path = os.path.join(test_dir, filename)
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    lines = len(f.readlines())
                    total_lines += lines
    
    print(f"  Python测试代码: ~{total_lines} 行")
    
    # 验证导入（可选）
    print("\n[4] 验证Python语法...")
    syntax_errors = []
    for filename, _ in files:
        if filename.endswith('.py'):
            path = os.path.join(test_dir, filename)
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        compile(f.read(), path, 'exec')
                except SyntaxError as e:
                    syntax_errors.append((filename, str(e)))
    
    if syntax_errors:
        for filename, error in syntax_errors:
            print_error(f"{filename}: {error}")
        all_ok = False
    else:
        print_success("所有Python文件语法正确")
    
    # 总结
    print("\n" + "="*60)
    if all_ok:
        print(f"{GREEN}验证通过！{RESET} 所有测试文件已正确创建。")
        print("\n运行测试:")
        print("  ./run_e2e_tests.sh --help")
        print("  python3 e2e_test.py --verbose")
    else:
        print(f"{YELLOW}验证完成，但有一些问题需要注意。{RESET}")
    print("="*60 + "\n")
    
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
