#!/bin/bash

# Research-Nexus Pro 启动脚本
# 一键启动前后端服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径（自动推导，支持任意目录）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT"

# 端口配置
BACKEND_PORT=8000
FRONTEND_PORT=5173

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Research-Nexus Pro 启动脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查环境变量
echo -e "${YELLOW}[1/6] 检查环境变量...${NC}"
if [ -z "$COGNEE_LLM_API_KEY" ]; then
    echo -e "${YELLOW}  警告: COGNEE_LLM_API_KEY 未设置${NC}"
    echo "   如果需要LLM功能，请设置: export COGNEE_LLM_API_KEY='your-api-key'"
    echo ""
fi

# 检查 Python 环境
echo -e "${YELLOW}[2/6] 检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}  错误: Python3 未安装${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}  Python 版本: $PYTHON_VERSION${NC}"

# 检查 Node.js 环境
echo -e "${YELLOW}[3/6] 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}  错误: Node.js 未安装${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}  Node.js 版本: $NODE_VERSION${NC}"

# 检查数据文件
echo -e "${YELLOW}[4/6] 检查数据文件...${NC}"
if [ ! -f "$PROJECT_ROOT/EXTRACTED_DATA.json" ]; then
    echo -e "${RED}  错误: EXTRACTED_DATA.json 不存在${NC}"
    exit 1
fi
echo -e "${GREEN}  EXTRACTED_DATA.json 存在${NC}"

# 检查依赖
echo -e "${YELLOW}[5/6] 检查依赖...${NC}"

# 检查后端依赖
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo -e "${YELLOW}  后端虚拟环境不存在，正在创建...${NC}"
    cd "$BACKEND_DIR"
    python3 -m venv venv
fi

cd "$BACKEND_DIR"
source venv/bin/activate

# 安装后端依赖
echo "   安装后端依赖..."
pip install -q -r requirements.txt 2>/dev/null || echo -e "${YELLOW}   部分后端依赖可能未安装${NC}"

# 检查前端依赖
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  前端依赖未安装，正在安装...${NC}"
    npm install
fi
echo -e "${GREEN}  依赖检查完成${NC}"

# 启动服务
echo -e "${YELLOW}[6/6] 启动服务...${NC}"
echo ""

# 启动后端
echo -e "${BLUE}启动后端服务 (端口: $BACKEND_PORT)...${NC}"
cd "$BACKEND_DIR"
source venv/bin/activate

# 使用 main_local.py 启动（包含完整的 API 路由和错误处理）
python -m app.api.main_local &

BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"

# 等待后端启动
sleep 3

# 检查后端是否成功启动
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}  后端启动失败${NC}"
    exit 1
fi

echo -e "${GREEN}  后端服务已启动: http://localhost:$BACKEND_PORT${NC}"
echo ""

# 启动前端
echo -e "${BLUE}启动前端服务 (端口: $FRONTEND_PORT)...${NC}"
cd "$FRONTEND_DIR"
npm run dev &

FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"

# 等待前端启动
sleep 5

# 检查前端是否成功启动
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}  前端启动失败${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}  前端服务已启动: http://localhost:$FRONTEND_PORT${NC}"
echo ""

# 保存 PID 以便后续停止
echo $BACKEND_PID > "$PROJECT_ROOT/.backend.pid"
echo $FRONTEND_PID > "$PROJECT_ROOT/.frontend.pid"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Research-Nexus Pro 启动成功!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  前端: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  后端: ${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo -e "  API文档: ${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
echo ""
echo "  按 Ctrl+C 停止服务"
echo ""

# 等待用户中断
trap "echo ''; echo -e '${YELLOW}正在停止服务...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; rm -f '$PROJECT_ROOT/.backend.pid' '$PROJECT_ROOT/.frontend.pid'; echo -e '${GREEN}服务已停止${NC}'; exit 0" INT

wait
