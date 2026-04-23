#!/usr/bin/env python3
"""
端到端测试套件 (End-to-End Test Suite)
Research Nexus Pro - 论文生成系统测试

运行所有测试:
    python -m pytest backend/tests/e2e/ -v
    
运行单个测试文件:
    python -m pytest backend/tests/e2e/test_database_integration.py -v
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
