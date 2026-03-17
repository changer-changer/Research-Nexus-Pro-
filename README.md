# Research-Nexus Pro 🦞

[![Lobster 2026](https://img.shields.io/badge/Lobster-2026-orange)]()
[![React](https://img.shields.io/badge/React-18-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

> **AI-Native Research Exploration System**
> 
> 多智能体协作 × 三视图可视化 × 问题演化分析

## 🎯 一句话介绍

Research-Nexus Pro 是一个 **AI 原生的学术探索系统**，通过 Paper Research Agent 自动完成论文调研，并以**三视图正交可视化**呈现领域知识结构，帮助研究者快速识别 Research Gap。

## 🌟 系统架构

```
┌────────────────────────────────────────────────────────────┐
│                  Research-Nexus Pro                        │
├─────────────────────────┬──────────────────────────────────┤
│  🔍 Paper Research      │  🌿 Research Nexus               │
│       Agent             │      Visualizer                  │
├─────────────────────────┼──────────────────────────────────┤
│ • 自动论文搜索           │ • 问题拓扑树 (层级分解)          │
│ • PDF 下载与解析         │ • 时间泳道图 (X=时间 Y=领域)     │
│ • 并行 Agent 分析        │ • 引用关系网络 (论文连线)        │
│ • 结构化数据输出         │ • 三视图联动 + 数据导出          │
└─────────────────────────┴──────────────────────────────────┘
```

## 🚀 快速开始

### 安装与运行

```bash
# 安装依赖
cd research-nexus-pro
npm install

# 启动开发服务器
npm run dev
# 浏览器打开 http://localhost:3000
```

### Docker 部署

```bash
cd research-nexus-pro
./deploy.sh docker
# 访问 http://localhost:3000
```

## 📊 三视图设计

### 1. 问题拓扑树 (Problem Tree)
从终极目标（通用机器人操作）向下拆解到叶子问题：
- **根节点**: 终极目标（价值100，最难）
- **中间层**: 子领域（感知/策略/硬件）
- **叶子节点**: 具体问题（最易发论文）

点击叶子节点 `+` 按钮可添加到时间线视图。

### 2. 时间泳道图 (Timeline)
- **X轴**: 时间 (2015-2026)，红色 NOW 标记
- **Y轴**: 研究领域（泳道）
- **节点大小**: 价值评分
- **节点颜色**: 解决状态（绿=已解决，红=未解决）
- 支持领域筛选、拖拽平移、缩放

### 3. 引用关系网络 (Citation Network)
- 论文按类别着色（触觉=黄，扩散=绿，VLA=蓝）
- 同类别论文自动连线
- 点击论文显示详情和连接关系

## 📁 项目结构

```
lobster-contest-2026/
├── paper-research-agent/       # 论文调研 Agent
│   ├── scripts/
│   │   └── research_pipeline.py
│   ├── references/
│   │   └── analysis_standards.md
│   └── SKILL.md
│
├── research-nexus-pro/         # 可视化前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── TreeView.tsx         # 问题拓扑树
│   │   │   ├── TimelineView.tsx     # 时间泳道图
│   │   │   ├── CitationView.tsx     # 引用关系网络
│   │   │   ├── MethodTargetView.tsx # 方法瞄准图
│   │   │   ├── ExportPanel.tsx      # 数据导出
│   │   │   └── LayerOverlay.tsx     # 图层控制
│   │   ├── store/
│   │   │   └── nexusStore.ts        # Zustand 状态
│   │   └── data/
│   │       └── real_papers.json     # 论文数据 (42篇)
│   ├── Dockerfile
│   └── deploy.sh
│
├── docs/                       # 文档
│   ├── PROJECT_MANUAL.md       # 项目说明书
│   ├── TECHNICAL_WHITEPAPER.md # 技术白皮书
│   ├── PRESENTATION_SCRIPT.md  # 演示脚本
│   └── PRODUCT_SHOWCASE.md     # 产品展示
│
├── demo/                       # 演示脚本
├── assets/                     # 静态资源
├── README.md                   # 本文件
└── SUBMISSION_CHECKLIST.md     # 提交清单
```

## 📄 数据格式

### 问题节点
```json
{
  "id": "prob_diffusion",
  "name": "Diffusion Policy",
  "year": 2023,
  "status": "active",
  "depth": 2,
  "parentId": "sub_policy",
  "valueScore": 92,
  "unsolvedLevel": 35,
  "description": "Denoising diffusion for action generation"
}
```

### 论文
```json
{
  "id": "3DDiffusionPolicy_2403.03954",
  "title": "3D Diffusion Policy",
  "year": 2024,
  "venue": "arXiv",
  "category": "Diffusion/Flow",
  "authorityScore": 7.5
}
```

## 🛠 技术栈

- **前端**: React 18 + TypeScript + Vite 5
- **样式**: Tailwind CSS
- **状态**: Zustand (持久化)
- **动画**: Framer Motion
- **可视化**: SVG (自研)
- **图标**: Lucide React
- **部署**: Docker + Nginx

## 📈 当前数据集

- **42 篇论文** (2021-2025)
- **12 个研究问题** (4级层级)
- **8 个方法** (已验证/未验证)
- **6 个领域** (感知/策略/触觉/扩散/VLA/操作)

## 🏆 比赛提交

- **项目说明书**: `docs/PROJECT_MANUAL.md`
- **技术白皮书**: `docs/TECHNICAL_WHITEPAPER.md`
- **演示脚本**: `docs/PRESENTATION_SCRIPT.md`
- **代码仓库**: 本目录

## 📝 License

MIT
