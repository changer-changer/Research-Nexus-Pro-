# Research Nexus Pro 🦞

**AI-powered research paper analysis and knowledge graph visualization system**

Research Nexus Pro 是一个完整的论文研究管线：从 PDF 论文输入 → AI 深度分析 → 知识图谱可视化。由三个核心组件构成：

```
PDF 论文 → [paper-reader-plus] → 结构化数据 → [Paper Mining] → 知识图谱 → [网站] → 7种可视化视图
```

---

## 🏗️ 系统架构

### 三个核心组件

| 组件 | 位置 | 功能 |
|------|------|------|
| **paper-reader-plus** | `paper-reader-plus/` | PDF 论文深度阅读：文字+图片+表格+引用提取 |
| **paper-research-agent** | `paper-research-agent/` | 论文搜索+并行分析管线 |
| **Research Nexus Pro** | `research-nexus-pro/` | 知识图谱可视化网站 (React+TypeScript) |

### 数据流

```
                    ┌──────────────────────────────────────┐
                    │         论文 PDF 文件夹              │
                    │  (用户自己的论文收藏)                │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     paper-reader-plus                │
                    │  read_paper_plus.py --batch          │
                    │  • 提取文字(按章节)                   │
                    │  • 提取图片(过滤装饰图)               │
                    │  • 提取表格(CSV)                     │
                    │  • 提取引用(arxiv IDs)               │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     结构化数据                        │
                    │  • *_analysis.md (每篇分析)           │
                    │  • citation_network.json (引用网络)   │
                    │  • *_figures/ (图片)                  │
                    │  • *_tables/ (表格CSV)                │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     知识图谱构建                       │
                    │  • 问题树(多层)                       │
                    │  • 方法树(多层)                       │
                    │  • 引用网络                           │
                    │  • 问题-方法映射                       │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     real_papers.json                  │
                    │  {problems, methods, papers,          │
                    │   branches, citation_edges}           │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     Research Nexus Pro 网站           │
                    │  7 种可视化视图                       │
                    └──────────────────────────────────────┘
```

---

## 📦 组件 1: paper-reader-plus

**位置**: `paper-reader-plus/read_paper_plus.py`

**功能**: 从 PDF 提取一切内容

### 使用方法

```bash
# 单篇论文完整分析
python3 paper-reader-plus/read_paper_plus.py paper.pdf --full --output ./output/

# 批量处理整个文件夹
python3 paper-reader-plus/read_paper_plus.py --batch --input ./论文收集/ --output ./output/

# 仅提取引用
python3 paper-reader-plus/read_paper_plus.py paper.pdf --citations

# 仅提取图片(过滤装饰图，保留≥300px的图表)
python3 paper-reader-plus/read_paper_plus.py paper.pdf --images --min-img-size 300
```

### 输出格式

```
output/
├── {arxiv_id}_analysis.md    # 结构化分析(文字+章节+引用)
├── {arxiv_id}_text.txt       # 全文文字
├── {arxiv_id}_figures/       # 关键图片(已过滤)
├── {arxiv_id}_tables/        # 表格CSV
└── citation_network.json     # 引用关系网络
```

### 依赖

```bash
pip install pdfplumber pymupdf
```

---

## 📦 组件 2: paper-research-agent

**位置**: `paper-research-agent/`

**功能**: 自动搜索+下载+并行分析论文

### 使用方法

触发词: "research papers on X", "帮我调研XXX领域的论文"

### 工作流程

1. **搜索**: 用 arxiv/Semantic Scholar 搜索相关论文
2. **下载**: 自动下载 PDF
3. **并行分析**: 多个子代理同时分析不同论文
4. **整合**: 生成综合调研报告

### 分析标准

每篇论文生成 6 节分析（参考 `paper-research-agent/references/analysis_standards.md`）:
1. 研究背景
2. 研究问题
3. 核心创新
4. 实验设计（含真实数据表格）
5. 关键洞察
6. 未来工作

---

## 📦 组件 3: Research Nexus Pro 网站

**位置**: `research-nexus-pro/`

**技术栈**: React + TypeScript + Zustand + ReactFlow + Vite + Tailwind

### 启动

```bash
cd research-nexus-pro
npm install
npm run dev    # 开发模式 http://localhost:5173
npm run build  # 生产构建
```

### 7 种可视化视图

| 视图 | 说明 |
|------|------|
| **Problem Tree** | 问题树：大问题→子问题（多层可折叠） |
| **Time Evolution** | 问题随时间演化 |
| **Method → Problem** | 方法解决哪些问题（箭头图） |
| **Method Tree** | 方法树：大方法→具体技术 |
| **Dual Tree** | 问题树+方法树双树融合 |
| **Paper Timeline** | 论文时间线（可点击查看详情） |
| **Citation Network** | 论文引用关系图 |

---

## 📊 数据格式规范

### real_papers.json 格式

```json
{
  "problems": [
    {
      "id": "p1",
      "name": "问题名称",
      "year": 2024,
      "branch": "perception|policy|sim2real|hardware|manipulation|fusion",
      "status": "active|solved|partial|unsolved",
      "level": 0,
      "parent": null,
      "children": ["p1.1", "p1.2"],
      "papers": ["paper_id_1"],
      "methods": ["method_id_1"]
    }
  ],
  "methods": [
    {
      "id": "m1",
      "name": "方法名称",
      "targets": ["p1", "p2"],
      "level": 0,
      "parent": null,
      "children": ["m1.1", "m1.2"],
      "approach": "diffusion|transformer|rl|bc|contrastive|mae|gnn|other",
      "crossDomain": []
    }
  ],
  "papers": [
    {
      "id": "2403.03954",
      "title": "论文标题",
      "year": 2024,
      "venue": "arXiv|ICRA|CoRL|NeurIPS",
      "status": "survived",
      "arxivId": "2403.03954",
      "authorityScore": 8.5,
      "citations": ["cited_by_paper_ids"],
      "targets": ["problem_ids_this_paper_addresses"],
      "methods": ["method_ids_this_paper_uses"]
    }
  ],
  "branches": [
    {"id": "perception", "name": "Tactile Perception", "y_position": 1, "color": "#8b5cf6"}
  ],
  "citation_edges": [
    {"from": "paper_id_1", "to": "paper_id_2"}
  ]
}
```

---

## 🔄 工作流程

### 新论文加入流程

1. **放入 PDF** 到 `科研内容/论文收集/`
2. **运行 paper-reader-plus**：
   ```bash
   python3 paper-reader-plus/read_paper_plus.py \
     科研内容/论文收集/new_paper.pdf --full --output ./output/
   ```
3. **提取数据**：
   - 从 `*_analysis.md` 提取问题、方法、洞察
   - 从 `citation_network.json` 提取引用关系
4. **更新 `real_papers.json`**：
   - 添加新问题/方法到对应的树
   - 添加新论文节点
   - 添加新的引用边
5. **更新网站**：
   ```bash
   cd research-nexus-pro && npm run build
   ```
6. **推送到 GitHub**

### 问题树更新规则

- **Level 0**: 根问题（如 "Dexterous Manipulation"）
- **Level 1**: 主类别（感知、融合、策略、仿真、硬件）
- **Level 2**: 子问题（交叉传感器泛化、力估计、滑移检测...）
- **Level 3**: 具体挑战

### 方法树更新规则

- **Level 0**: 主方法（Diffusion Policy、Self-supervised...）
- **Level 1**: 具体技术（DP3、MAE、Sparsh...）
- 每个方法有 `targets` 指向它解决的问题 ID

---

## 📁 文件结构

```
项目根目录/
├── paper-reader-plus/          # PDF阅读工具
│   ├── SKILL.md
│   └── read_paper_plus.py
├── paper-research-agent/       # 论文搜索+分析管线
│   ├── SKILL.md
│   ├── references/
│   │   └── analysis_standards.md
│   ├── scripts/
│   └── scripts/research_pipeline.py
├── research-nexus-pro/         # 可视化网站
│   ├── src/
│   │   ├── components/         # 7个视图组件
│   │   ├── data/               # real_papers.json
│   │   ├── store/              # Zustand状态管理
│   │   └── styles/
│   ├── package.json
│   └── vite.config.ts
├── data/                       # 分析数据
│   ├── analysis/               # 论文分析md文件
│   └── paper_mining_output.json
├── scripts/                    # 数据处理脚本
├── docs/                       # 项目文档
├── SUBMISSION.md               # 比赛项目书
├── POSTER_PROMPT.md            # 海报提示词
└── README.md                   # 本文件
```

---

## 🚀 快速开始（给新 Agent）

你是新接手这个项目的 Agent？按以下步骤：

### Step 1: 理解架构
读本 README + 各组件的 SKILL.md

### Step 2: 检查数据
```bash
# 查看当前知识图谱
cat research-nexus-pro/src/data/real_papers.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'Problems: {len(d[\"problems\"])}, Methods: {len(d[\"methods\"])}, Papers: {len(d[\"papers\"])}, Citations: {len(d[\"citation_edges\"])}')
"
```

### Step 3: 添加新论文
```bash
# 用 paper-reader-plus 分析新论文
python3 paper-reader-plus/read_paper_plus.py new_paper.pdf --full --output ./output/
# 然后更新 real_papers.json
```

### Step 4: 更新网站
```bash
cd research-nexus-pro && npm run build
```

### Step 5: 推送
```bash
git add -A && git commit -m "update: 描述" && git push origin main
```

---

## 📜 已知 Bug / 待优化

- [ ] 图片过滤阈值需要调优（目前 300px，仍有很多装饰图）
- [ ] 图表内容理解需要 vision model 集成
- [ ] 引用上下文提取（为什么引用这篇论文）
- [ ] 问题-方法映射需要更精准（目前基于关键词）
- [ ] 论文时间线组件交互优化
- [ ] 方法树展开/折叠交互

---

*由 Research Nexus Pro 团队维护*
*Paper Mining = 读论文 → 提取知识 → 构建图谱 → 可视化*

---

## 🐛 踩过的坑 / 数据格式规范（给新 Agent 的血泪教训）

### 规则 1: branch ID 必须对齐

问题的 `branch` 字段必须等于 branches 数组里某个 branch 的 `id`：

```json
// ✅ 正确
"branches": [{"id": "perception", "name": "Tactile Perception", ...}]
"problems": [{"id": "p1", "branch": "perception", ...}]

// ❌ 错误（网站不显示问题树）
"problems": [{"id": "p1", "branch": "b_perception", ...}]  // ID不匹配
```

当前有效的 branch ID: `manipulation`, `perception`, `policy`, `sim2real`, `hardware`, `fusion`

### 规则 2: Methods 必须有 targets

每个 method 必须有 `targets` 数组，指向它解决的问题 ID：

```json
// ✅ 正确
{"id": "m_dp", "name": "Diffusion Policy", "targets": ["p_contact", "p_data"]}

// ❌ 错误（网站显示"0 targets"）
{"id": "m_dp", "name": "Diffusion Policy", "targets": []}
```

### 规则 3: Problems 必须有 children

父问题必须有 `children` 数组列出子问题 ID：

```json
// ✅ 正确
{"id": "p_root", "name": "Dexterous", "children": ["p_perception", "p_policy"]}

// ❌ 错误（树展不开）
{"id": "p_root", "name": "Dexterous", "children": []}
```

### 规则 4: Papers 必须连接到 problems 和 methods

每个 paper 需要 `targets`（解决的问题）和 `methods`（使用的方法）：

```json
// ✅ 正确
{"id": "2403.03954", "targets": ["p_generalize"], "methods": ["m_dp1"], "citations": ["2303.04137"]}

// ❌ 错误（论文节点没连接）
{"id": "2403.03954", "targets": [], "methods": [], "citations": []}
```

### 规则 5: Citation edges 用 paper ID

```json
// ✅ 正确
{"from": "2403.03954", "to": "2303.04137"}

// ❌ 错误
{"from": "paper1", "to": "paper2"}
```

### 规则 6: Website 数据加载路径

网站从 `research-nexus-pro/src/data/real_papers.json` 加载数据。

格式：
```json
{
  "problems": [...],
  "methods": [...],
  "papers": [...],
  "branches": [...],
  "citation_edges": [...]
}
```

### 常见 Bug 及修复

| Bug | 原因 | 修复 |
|-----|------|------|
| 问题树只有2个节点 | branch ID 不匹配 | 确保 problem.branch = branch.id |
| 方法树全部显示 "Untested" | 缺少 status 字段 | 添加 status: "verified\|partial\|untested" |
| 点击论文没反应 | papers 缺少连接 | 填充 targets, methods, citations |
| 引用网络没有线 | citation_edges 为空或 ID 不对 | 用实际 arxiv ID 构建边 |
| 时间轴点分布奇怪 | year 字段不准确 | 从 arxiv ID 提取正确年份 |
| 方法树展不开 | methods 缺少 children | 从 parent 字段推导 children |


## Recent Fixes (2026-03-18)

### Time Evolution Network (问题随时间演化) - COMPLETE REWRITE
- **Interactive network graph** using ReactFlow: X-axis = time, Y-axis = domain lanes
- **8 domain lanes**: Root Goal, Perception, Fusion, Policy, Diffusion, Tactile, VLA, Manipulation
- **Problem nodes**: Full cards with branch-colored borders, positioned by year
- **Method nodes**: Dashed cards (italic), positioned near their domain lane
- **Paper nodes**: Small dots (6px), mapped by category to domain lanes, spread by hash
- **70 papers** visible as dots from 2017 to 2026 (32 papers in 2025, 2 in 2026)
- **Click interaction**: Click any node → highlight connected graph, dim others; click again to deselect
- **Parent-child edges**: Smooth step arrows between related problems
- **Method→Problem edges**: Dashed lines from methods to their target problems
- **Paper→Problem edges**: Subtle lines from paper dots to their target problems

### Data Store Sync Fix
- **Root cause**: App.tsx loaded data into `appStore` but 7 components read from `nexusStore` (empty!)
- **Fix**: After `loadData()`, also sync to `useNexusStore.getState().loadData()`
- Affected: ProblemEvolutionView, ProblemTreeView, TreeView, MethodTargetView, DataPanel, ExportPanel, LayerOverlay

### Default Expanded State Fix
- `expandedNodes` default changed from `'root'` to `'p_root'` (matching actual data ID)
- Also fixed in `collapseAll()` and persisted state restore

### Method Status
- Root methods (level 0): `status: "verified"` (5 methods)
- Sub-methods (level 1): `status: "partial"` (12 methods)

### Data Fields (required by components)
- Problems: `branchId`, `parentId`, `depth` (not `branch`, `parent`, `level`)
- All nodes have `branchId` (simple string like `'b_perception'`, not prefixed)
