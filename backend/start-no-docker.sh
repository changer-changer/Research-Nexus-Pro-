#!/bin/bash
# Research-Nexus 智能科研系统 - 零Docker一键启动脚本
# Zero-Docker Research Intelligence Platform

set -e

echo "🚀 启动 Research-Nexus 智能科研系统 (零Docker版)..."
echo "======================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python3 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python3 已安装${NC}"

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo ""
    echo -e "${BLUE}▶ 创建虚拟环境...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✓ 虚拟环境已创建${NC}"
fi

# 激活虚拟环境
echo ""
echo -e "${BLUE}▶ 激活虚拟环境...${NC}"
source venv/bin/activate
echo -e "${GREEN}✓ 虚拟环境已激活${NC}"

# 安装依赖
echo ""
echo -e "${BLUE}▶ 检查依赖...${NC}"
if ! pip show fastapi &> /dev/null; then
    echo -e "${BLUE}  安装依赖...${NC}"
    pip install -q fastapi uvicorn networkx numpy python-dotenv
fi
echo -e "${GREEN}✓ 依赖已就绪${NC}"

# 创建数据目录
mkdir -p data/vectors

# 检查是否有提取的数据需要导入
if [ -f "../EXTRACTED_DATA.json" ]; then
    echo ""
    echo -e "${BLUE}▶ 发现提取的数据，自动导入...${NC}"
    echo -e "${YELLOW}  (启动后访问 /api/import 导入数据)${NC}"
fi

# 启动后端
echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  系统启动成功！${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""
echo -e "访问地址:"
echo -e "  ${BLUE}API 文档:${NC} http://localhost:8000/docs"
echo -e "  ${BLUE}健康检查:${NC} http://localhost:8000/health"
echo -e "  ${BLUE}问题列表:${NC} http://localhost:8000/api/problems"
echo -e "  ${BLUE}方法列表:${NC} http://localhost:8000/api/methods"
echo ""
echo -e "使用指南:"
echo -e "  1. 打开 ${BLUE}http://localhost:8000/docs${NC} 查看API文档"
echo -e "  2. 前端访问上述API获取数据"
echo -e "  3. 数据存储在 ${BLUE}backend/data/${NC} (SQLite + JSON)"
echo ""
echo -e "特点:"
echo -e "  ✅ 无需Docker"
echo -e "  ✅ 一键启动"
echo -e "  ✅ SQLite + NumPy 本地存储"
echo -e "  ✅ 虚拟环境隔离"
echo ""
echo -e "${GREEN}======================================================${NC}"
echo ""

# 启动服务
echo -e "${BLUE}▶ 启动后端服务...${NC}"
python -m app.api.main_local
