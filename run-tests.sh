#!/bin/bash

# Research-Nexus Pro 全面测试脚本
# 测试所有组件和功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 项目路径（自动推导，支持任意目录）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT"

# 测试计数
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Research-Nexus Pro 全面测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 测试1: 环境变量检查
echo -e "${YELLOW}[测试1/10] 环境变量检查...${NC}"
if [ -f "$PROJECT_ROOT/.env" ]; then
    if grep -q "COGNEE_LLM_API_KEY" "$PROJECT_ROOT/.env"; then
        echo -e "${GREEN}✓ API Key已配置${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ API Key未配置${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}✗ .env文件不存在${NC}"
    ((TESTS_FAILED++))
fi

# 测试2: 数据文件检查
echo -e "${YELLOW}[测试2/10] 数据文件检查...${NC}"
if [ -f "$PROJECT_ROOT/EXTRACTED_DATA.json" ]; then
    PAPERS_COUNT=$(grep -o '"title"' "$PROJECT_ROOT/EXTRACTED_DATA.json" | wc -l)
    echo -e "${GREEN}✓ EXTRACTED_DATA.json存在 (约$PAPERS_COUNT篇论文)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ EXTRACTED_DATA.json不存在${NC}"
    ((TESTS_FAILED++))
fi

# 测试3: 前端文件检查
echo -e "${YELLOW}[测试3/10] 前端文件检查...${NC}"
COMPONENTS_COUNT=$(find "$PROJECT_ROOT/src/components" -name "*.tsx" | wc -l)
if [ $COMPONENTS_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ 前端组件存在 ($COMPONENTS_COUNT个)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ 前端组件不存在${NC}"
    ((TESTS_FAILED++))
fi

# 测试4: 后端文件检查
echo -e "${YELLOW}[测试4/10] 后端文件检查...${NC}"
if [ -f "$BACKEND_DIR/cognee_integration/routers/v2_routes.py" ]; then
    echo -e "${GREEN}✓ 后端路由文件存在${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ 后端路由文件不存在${NC}"
    ((TESTS_FAILED++))
fi

# 测试5: Cognee Hook检查
echo -e "${YELLOW}[测试5/10] Cognee Hook检查...${NC}"
if [ -f "$PROJECT_ROOT/src/hooks/useCogneeData.ts" ]; then
    echo -e "${GREEN}✓ useCogneeData.ts存在${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ useCogneeData.ts不存在${NC}"
    ((TESTS_FAILED++))
fi

# 测试6: 启动脚本检查
echo -e "${YELLOW}[测试6/10] 启动脚本检查...${NC}"
if [ -x "$PROJECT_ROOT/start-research-nexus.sh" ]; then
    echo -e "${GREEN}✓ 启动脚本存在且可执行${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ 启动脚本不存在或不可执行${NC}"
    ((TESTS_FAILED++))
fi

# 测试7: Python环境检查
echo -e "${YELLOW}[测试7/10] Python环境检查...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Python $PYTHON_VERSION${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Python3未安装${NC}"
    ((TESTS_FAILED++))
fi

# 测试8: Node.js环境检查
echo -e "${YELLOW}[测试8/10] Node.js环境检查...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"
    ((TESTS_FAILED++))
else
    echo -e "${RED}✗ Node.js未安装${NC}"
    ((TESTS_FAILED++))
fi

# 测试9: 依赖文件检查
echo -e "${YELLOW}[测试9/10] 依赖文件检查...${NC}"
if [ -f "$PROJECT_ROOT/package.json" ] && [ -f "$BACKEND_DIR/requirements.txt" ]; then
    echo -e "${GREEN}✓ package.json和requirements.txt存在${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ 依赖文件缺失${NC}"
    ((TESTS_FAILED++))
fi

# 测试10: 交付文档检查
echo -e "${YELLOW}[测试10/10] 交付文档检查...${NC}"
if [ -f "$PROJECT_ROOT/FINAL_DELIVERY.md" ]; then
    echo -e "${GREEN}✓ FINAL_DELIVERY.md存在${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FINAL_DELIVERY.md不存在${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试结果${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "${RED}失败: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！系统可以正常运行。${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ 有$TESTS_FAILED项测试失败，请检查上述问题。${NC}"
    exit 1
fi
