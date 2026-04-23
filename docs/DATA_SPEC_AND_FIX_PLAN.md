# Research-Nexus-Pro 数据规范与系统修复总计划

> 目标：理清所有数据流、修复所有显示/功能缺陷、重构 Innovation Board。

---

## 一、数据资产全景图

### 1.1 后端数据源 (SQLite + NetworkX in-memory)
| 实体 | 表/节点 | 核心字段 | 计算来源 |
|------|---------|----------|----------|
| **Problem** | `nodes` (type='problem') | `id`, `name`, `domain`, `definition`, `resolution_status`, `description`, `development_progress`, `value_score`, `constraints`, `evaluation_metrics` | `local_graph.py` 注入 `value_score` |
| **Method** | `nodes` (type='method') | `id`, `name`, `domain`, `mechanism`, `complexity`, `description`, `development_progress`, `value_score`, `assumptions`, `limitations` | `local_graph.py` 注入 `value_score` |
| **Paper** | `nodes` (type='paper') | `id`, `title`, `authors`, `year`, `venue`, `abstract`, `arxiv_id`, `ranking` | 原始 ingestion |
| **Claim** | `claims` | `claim_id`, `canonical_id`, `paper_id`, `claim_type`, `text`, `evidence[]` | Kimi extraction |
| **Relation** | `relations` + NetworkX edges | `source`, `target`, `type` (ADDRESSES_PROBLEM/SOLVES/USES_METHOD) | Pipeline inference |
| **Innovation** | `innovations` | `id`, `target_problem_id`, `candidate_method_ids[]`, `rationale`, `risks[]`, `feasibility_score`, `novelty_score` | Structural analysis |

### 1.2 前端状态层
| Store | 负责数据 | 持久化 |
|-------|----------|--------|
| `v3Store.ts` | V3 Domain Map (`problems`, `methods`, `relations`), node details | 内存 (API `/api/v3/...`) |
| `appStore.ts` | Legacy V2 data (`appProblems`, `appMethods`, `appPapers`), bookmarks, viewConfig (darkMode, lang), history, undo/redo | `localStorage` (书签+配置) |
| `nexusStore.ts` | Cognee V2 graph data | 内存 |

### 1.3 `value_score` 计算规则（已落地）
- **Problem**: solved=90, partial=65, active=50, unsolved=30 基础分；每关联 solving method +5，每 claim +2，上限 100。
- **Method**: verified=85, partial=60, untested=40, failed=20 基础分；每 target problem +3，每 related paper +2，上限 100。
- **原则**：UI 仅用 `value_score ?? '--'`，禁止任何 `|| 50` 回退。

---

## 二、问题清单与修复计划

### P0 - 数据真实性（已解决）
- [x] Method→Problem 视图评分全 50 → **已修复**（Vite 缓存导致，清缓存重启后验证通过）

### P1 - Innovation Board 重构（核心需求）
- [ ] **分页管理**：将 163 张卡片分页，默认 12/页，支持页码跳转
- [ ] **搜索/筛选**：按 target problem name、method name、rationale 关键词实时过滤
- [ ] **卡片溢出修复**：AI Action Plan 弹窗/卡片不能超出视口，需限制 max-height + scroll
- [ ] **AI 结果持久化**：生成后的 `InnovationInsightDTO` 存入 SQLite `insights` 表（或 localStorage），避免每次关闭后重生成
- [ ] **快速预览模式**：卡片默认折叠 rationale，hover/点击展开，减少信息密度

### P2 - 全局功能修复
- [ ] **书签系统**：`appStore` 中 `bookmarks` 列表在 UI 中无法打开/无高亮，需修复 `BookmarkPanel` 渲染与 toggle
- [ ] **暗色/亮色模式切换**：`viewConfig.darkMode` 切换后部分组件硬编码 `bg-zinc-950` 不跟随，需统一使用 `viewConfig.darkMode` 条件
- [ ] **中英文切换 (i18n)**：当前 `中文` 按钮无响应，需检查 `i18n.changeLanguage` 与语言包完整性

### P3 - 性能优化
- [ ] **ReactFlow 大图卡顿**：`DualTreeView` / `MethodTree` / `ProblemTree` 等使用 `reactflow` 的视图，节点数 >100 时 FPS 低，需开启 `onlyRenderVisibleElements`、虚拟化或节点聚合
- [ ] **TimelineView 渲染优化**：大量 SVG DOM 节点导致重绘成本高，考虑 canvas 或 DOM 复用
- [ ] **vite 构建体积**：`dist/assets/index-*.js` 过大（200KB+ gzip），检查 tree-shaking

### P4 - 显示问题逐个修复
- [ ] **Problem Tree 空白**：当前只显示一条横线，需排查 `TreeView.tsx` 或 `ProblemTreeView.tsx` 的数据映射
- [ ] **Innovation Board 卡片对齐**：当前 2 列布局在窗口缩放时错位，改用 CSS Grid + auto-fill
- [ ] **Node Detail Panel 滚动**：内容过长时无滚动条
- [ ] **全局 Tooltip/Popover 截断**：部分 hover 提示被父容器 `overflow:hidden` 截断

---

## 三、执行策略

### 阶段 1：文档与基线（当前）
1. 输出本数据规范文档 ✅
2. 设置 10 分钟自动推进 cron
3. 启动 coder 子代理处理 Innovation Board 重构

### 阶段 2：功能修复（并行）
- Coder A：Innovation Board（分页+搜索+持久化+弹窗修复）
- Coder B：书签系统 + 暗色/亮色 + i18n
- Coder C：性能优化（ReactFlow + Timeline）

### 阶段 3：端到端验收（由我负责）
- 每个视图截图验证
- 检查控制台报错
- 验证数据真实性
- 每 5 分钟向 Walker 汇报进度

---

## 四、验收标准

| 检查项 | 通过标准 |
|--------|----------|
| 评分真实性 | 任意视图无硬编码 50，缺失显示 `--` |
| Innovation Board | 分页可用、搜索可用、AI 计划持久化、弹窗不溢出 |
| 书签系统 | 点击书签图标可展开列表，添加/删除即时生效 |
| 主题切换 | Light/Dark 切换后所有视图颜色正确 |
| 语言切换 | 中文/英文 切换后导航与标签正确翻译 |
| 性能 | 主要视图 FPS >= 30，无肉眼卡顿 |
