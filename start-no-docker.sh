#!/bin/bash
# Research-Nexus 智能科研系统 - 无Docker版本启动脚本
# 使用本地安装的Neo4j和Qdrant或云端版本

set -e

echo "🚀 启动 Research-Nexus (无Docker模式)..."
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}▶ 检查环境...${NC}"

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python3 未安装${NC}"
    echo "请安装 Python 3.10+: https://python.org"
    exit 1
fi

echo -e "${GREEN}✓ Python3 已安装${NC}"

# 检查Node.js
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm 未安装${NC}"
    echo "请安装 Node.js: https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✓ npm 已安装${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查并安装Python依赖
echo ""
echo -e "${BLUE}▶ 检查Python依赖...${NC}"
if [ ! -d "backend/venv" ]; then
    echo -e "${BLUE}  创建Python虚拟环境...${NC}"
    python3 -m venv backend/venv
fi

source backend/venv/bin/activate
echo -e "${BLUE}  安装依赖...${NC}"
pip install -q neo4j qdrant-client openai fastapi uvicorn python-dotenv pydantic

# 检查Neo4j连接
echo ""
echo -e "${BLUE}▶ 检查Neo4j连接...${NC}"
echo -e "${YELLOW}  提示: 如果没有本地Neo4j，可以使用:${NC}"
echo -e "  1. Neo4j Aura (云端免费): https://neo4j.com/cloud/aura/"
echo -e "  2. 下载Neo4j Desktop: https://neo4j.com/download/"
echo ""
echo -e "${BLUE}  测试连接到 ${NEO4J_URI:-bolt://localhost:7687}...${NC}"

# 检查Qdrant连接
echo ""
echo -e "${BLUE}▶ 检查Qdrant连接...${NC}"
echo -e "${YELLOW}  提示: 如果没有本地Qdrant，可以使用:${NC}"
echo -e "  1. Qdrant Cloud (免费层): https://cloud.qdrant.io/"
echo -e "  2. 内存模式: 设置 QDRANT_MODE=memory${NC}"
echo ""

# 创建环境配置文件
if [ ! -f "backend/.env" ]; then
    echo -e "${BLUE}  创建环境配置文件...${NC}"
    cat > backend/.env << 'EOF'
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Qdrant Configuration
QDRANT_HOST=localhost
QDRANT_PORT=6333
# QDRANT_API_KEY=your_api_key_here
# QDRANT_MODE=memory

# OpenAI Configuration (optional)
OPENAI_API_KEY=your_openai_key_here

# Backend Configuration
PORT=8000
HOST=0.0.0.0
EOF
    echo -e "${YELLOW}  ⚠ 请编辑 backend/.env 配置您的数据库连接${NC}"
fi

# 安装前端依赖
echo ""
echo -e "${BLUE}▶ 检查前端依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}  安装npm依赖...${NC}"
    npm install
fi
echo -e "${GREEN}✓ 前端依赖已就绪${NC}"

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  启动方式选择:${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "1) 启动后端API (Python)"
echo "2) 启动前端 (React)"
echo "3) 同时启动前后端 (推荐)"
echo ""

read -p "请选择 (1/2/3): " choice

case $choice in
    1)
        echo -e "${BLUE}▶ 启动后端API...${NC}"
        cd backend
        source venv/bin/activate
        python -m app.api.main
        ;;
    2)
        echo -e "${BLUE}▶ 启动前端...${NC}"
        npm run dev -- --host 127.0.0.1
        ;;
    3)
        echo -e "${BLUE}▶ 同时启动前后端...${NC}"
        
        # 启动后端（后台）
        cd backend
        source venv/bin/activate
        python -m app.api.main &
        BACKEND_PID=$!
        cd ..
        
        echo -e "${GREEN}✓ 后端已启动 (PID: $BACKEND_PID)${NC}"
        echo -e "${BLUE}  等待后端就绪...${NC}"
        sleep 3
        
        # 启动前端
        echo -e "${BLUE}▶ 启动前端...${NC}"
        npm run dev -- --host 127.0.0.1 &
        FRONTEND_PID=$!
        
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  系统启动成功!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "访问地址:"
        echo -e "  ${BLUE}前端可视化:${NC} http://localhost:5173/Research-Nexus-Pro-/"
        echo -e "  ${BLUE}后端API:${NC} http://localhost:8000"
        echo -e "  ${BLUE}API文档:${NC} http://localhost:8000/docs"
        echo ""
        echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
        
        # 等待中断
        wait
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac
