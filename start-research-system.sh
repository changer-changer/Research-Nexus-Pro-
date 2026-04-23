#!/bin/bash
# Research-Nexus 智能科研系统 - 一键启动脚本
# Zero-Configuration Research Intelligence Platform

set -e

echo "🚀 启动 Research-Nexus 智能科研系统..."
echo "======================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查依赖
echo -e "${BLUE}▶ 检查依赖...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose 未安装${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 所有依赖已安装${NC}"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 启动后端数据库
echo ""
echo -e "${BLUE}▶ 启动后端数据库...${NC}"
cd backend

if docker-compose ps | grep -q "research-nexus"; then
    echo -e "${YELLOW}⚠ 数据库容器已存在，跳过启动${NC}"
else
    docker-compose up -d
    echo -e "${GREEN}✓ 数据库已启动${NC}"
    
    # 等待数据库就绪
    echo -e "${BLUE}  等待数据库就绪...${NC}"
    sleep 5
    
    # 初始化数据库
    echo -e "${BLUE}  初始化数据库 Schema...${NC}"
    python3 scripts/database_setup.py || echo -e "${YELLOW}⚠ 数据库初始化可能已存在${NC}"
fi

cd ..

# 安装前端依赖
echo ""
echo -e "${BLUE}▶ 检查前端依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}  安装 npm 依赖...${NC}"
    npm install
fi
echo -e "${GREEN}✓ 前端依赖已就绪${NC}"

# 启动前端
echo ""
echo -e "${BLUE}▶ 启动前端开发服务器...${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  系统启动成功！${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "访问地址:"
echo -e "  ${BLUE}前端可视化:${NC} http://localhost:5173/Research-Nexus-Pro-/"
echo -e "  ${BLUE}Neo4j 浏览器:${NC} http://localhost:7474"
echo -e "  ${BLUE}Qdrant 控制台:${NC} http://localhost:6333/dashboard"
echo ""
echo -e "使用指南:"
echo -e "  1. 打开 ${BLUE}http://localhost:5173/Research-Nexus-Pro-/${NC}"
echo -e "  2. 告诉我: ${YELLOW}'调查[方向]的论文'${NC}"
echo -e "  3. 我会自动完成所有分析"
echo ""
echo -e "${GREEN}======================================${NC}"

# 启动前端（阻塞）
npm run dev -- --host 127.0.0.1
