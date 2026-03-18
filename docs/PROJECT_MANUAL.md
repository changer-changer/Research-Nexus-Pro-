# Research-Nexus Pro
## 多智能体学术探索系统

**项目定位**: AI原生科研辅助工具，重构文献调研 workflow
**核心创新**: 多Agent协作 × 正交可视化 × 问题演化分析

---

## 1. 产品概述

### 1.1 解决了什么问题？

传统文献调研的三大痛点：

| 痛点 | 传统方式 | Research-Nexus方案 |
|------|----------|-------------------|
| **信息过载** | 读100篇论文，手动记笔记，难以关联 | Agent自动提炼结构化知识图谱 |
| **认知局限** | 线性阅读，只见树木不见森林 | 三维正交视图：时间×领域×方法 |
| **决策困难** | 难以识别Research Gap | 可视化高亮"蓝海"机会点 |

### 1.2 核心能力

```
用户Query → PaperResearchAgent(调研) → ResearchNexus(可视化) → 决策洞察
     ↓              ↓                           ↓                    ↓
 自然语言    自动搜索/下载/分析          问题演化树+方法瞄准图     Research Gap
```

---

## 2. 系统架构

### 2.1 双模块架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Research-Nexus Pro                       │
├──────────────────────────┬──────────────────────────────────┤
│  Module 1: PaperResearch │  Module 2: ResearchNexus          │
│        Agent             │         Visualizer               │
├──────────────────────────┼──────────────────────────────────┤
│  • 意图理解              │  • 问题演化树                    │
│  • 4级深度搜索           │  • 方法瞄准图                    │
│  • 自动PDF下载           │  • 领域泳道时间线                │
│  • 并行Agent分析         │  • 灵感发射井识别                │
│  • 6段式报告             │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

### 2.2 技术栈

- **Backend**: Python + OpenClaw Agent框架
- **Frontend**: Streamlit + Plotly (当前) / React + D3 (Pro版)
- **Storage**: JSON-based 知识图谱 (零外部依赖)

---

## 3. Module 1: Paper Research Agent

### 3.1 功能特性

**Phase 1: Research Probe（研究探针）**
- 理解用户query的4个层级：现象→机制→方法→数据集
- 自动生成分层搜索策略
- 支持垂直搜索（深入单领域）和水平搜索（跨领域关联）

**Phase 2: Paper Acquisition（论文获取）**
- 自动从arXiv/Google Scholar检索
- 标准命名：`{title}-{arxiv_id}.pdf`
- 去重和权威性排序

**Phase 3: Agent Cluster Analysis（智能体集群分析）**
- 并行spawn多个sub-agent
- 每篇论文生成6段式报告：
  1. Background & Motivation
  2. Problem Definition
  3. Innovation & Methodology
  4. Experiments & Results
  5. Insights & Limitations
  6. Future Directions

### 3.2 创新点

**References-based Quality Control**
- Agent必须阅读`analysis_standards.md`才能开始分析
- 内置质量检查清单（10+ citations, 3+ tables, etc.）
- 输出JSON结构化数据，直接对接可视化模块

---

## 4. Module 2: Research-Nexus Visualizer

### 4.1 核心视图

**View 1: 问题演化树 (Problem Evolution Tree)**
- **Y轴**: 领域层级（根问题 → 子领域 → 具体技术）
- **X轴**: 时间线（2015-2027）
- **节点**: 研究问题，颜色=状态（绿/蓝/红/黄）
- **连线**: 演化关系（旧问题解决→新问题诞生）

**View 2: 方法瞄准图 (Method Targeting Graph)**
- **中心**: 待解决问题
- **箭头**: 方法对问题的"瞄准"
- **颜色**: 验证状态（绿=有效/红=无效/灰=未验证）
- **价值**: 一眼看出"哪些方法还没试过"

**View 3: 领域泳道时间线**
- 类似Git分支图的可视化
- 每个泳道=一个子领域
- 跨泳道演化用曲线连接

### 4.2 数据格式

完全JSON驱动，Agent可直接生成：

```json
{
  "problems": [
    {
      "id": "P_TACTILE_ENCODE",
      "name": "触觉点云编码",
      "year": 2021,
      "status": "ACTIVE",
      "branch": "编码器",
      "evolved_from": "P_POINT_PERM",
      "solved_by": ["PointNet++"]
    }
  ],
  "methods": [
    {
      "id": "M_DIFFUSION_TAC",
      "name": "扩散策略+触觉",
      "type": "untested",
      "targets": ["P_TACTILE_ENCODE"]
    }
  ]
}
```

---

## 5. 使用场景示例

### 场景: Walker的Tac3D研究

**Step 1**: 输入"Tac3D触觉点云与Diffusion Policy结合"

**Step 2**: PaperResearchAgent自动执行：
- 搜索Tac3D相关论文（10篇）
- 搜索Diffusion Policy在机器人上的应用（15篇）
- 搜索多模态融合相关（10篇）
- 并行分析生成6段式报告

**Step 3**: ResearchNexus可视化输出：

```
问题演化树:
├─ 编码器领域
│  ├─ 点云置换不变性 [2017, SOLVED] → PointNet
│  └─ 触觉点云编码 [2021, ACTIVE] → 从点云方法演化
└─ 策略学习领域
   └─ 扩散策略触觉化 [2024, ACTIVE] → Research Gap! 

方法瞄准图:
🎯 问题: 触觉点云编码
   ↓
   ├── PointNet++ [验证有效]
   ├── Point Transformer [验证有效] 
   └── Diffusion Policy [未验证] ⭐机会!
```

**Step 4**: 决策洞察
- 发现Gap: "Diffusion Policy从未用于触觉点云"
- 确定方向: "用扩散策略生成6D触觉特征"

---

## 6. 技术亮点

### 6.1 多Agent协作

- **ResearchProbeAgent**: 理解意图，设计搜索策略
- **PaperDownloadAgent**: 获取PDF，标准化命名
- **AnalysisAgent (×N)**: 并行分析，生成结构化报告
- **IntegrationAgent**: 整合多源分析，识别冲突和共识

### 6.2 正交可视化

借鉴工程制图的"三视图"思想：
- 一个数据库 → 三个正交视图
- 每个视图回答不同问题
- 联动高亮，降低认知负荷

### 6.3 零配置部署

```bash
pip install -r requirements.txt
streamlit run app.py
```
- 无需外部数据库
- 无需复杂配置
- JSON文件即知识库

---

## 7. 效果展示

### 7.1 处理效率

| 任务 | 传统方式 | Research-Nexus | 提升 |
|------|----------|---------------|------|
| 10篇论文精读 | 2天 | 30分钟 | **96x** |
| 领域图谱构建 | 1周 | 实时 | **∞** |
| Research Gap识别 | 依赖经验 | 自动高亮 | **N/A** |

### 7.2 案例数据

- **测试领域**: 机器人操作（Robot Manipulation）
- **测试论文数**: 42篇（VLA/扩散策略/触觉）
- **生成节点**: 15个问题 + 12个方法
- **识别Gap**: 3个高潜力研究方向

---

## 8. 未来规划

### 8.1 短期（1个月）
- React + D3.js 重构，实现丝滑交互
- 接入真实数据库（Neo4j）
- 支持协作编辑

### 8.2 中期（3个月）
- 接入LLM自动生成演化描述
- 支持论文推荐（基于图谱相似度）
- 可视化导出（PNG/PDF/交互HTML）

### 8.3 长期（6个月）
- 云端部署，SaaS化
- 领域知识图谱众包构建
- 对接实验数据，形成闭环

---

## 9. 团队与致谢

**开发者**: Walker + AI Agents (OpenClaw)
**指导老师**: [待定]
**特别致谢**: 
- OpenClaw团队提供的Agent框架
- HuggingFace LeRobot社区

---

## 10. 快速开始

### 安装
```bash
git clone https://github.com/yourusername/research-nexus.git
cd research-nexus
pip install -r requirements.txt
```

### 启动
```bash
# 模块1: 论文调研
python -m paper_research_agent.research_probe "你的研究主题"

# 模块2: 可视化
streamlit run research_nexus/app_v6.py
```

### 访问
浏览器打开: http://localhost:8501

---

**Project Repository**: [GitHub链接]
**Demo Video**: [视频链接]
**Contact**: [邮箱]

*Built with 🦞 by Walker & Agents*
