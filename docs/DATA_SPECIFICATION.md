# Research-Nexus-Pro 数据规范映射文档

> 目标：把后端引擎存储的每一个字段，映射到前端可视化的每一个元素，明确来源、fallback 行为与待修复项。

---

## 1. 后端数据层（SQLite + NetworkX）

### 1.1 数据库表结构

```
nodes (id TEXT PK, type TEXT CHECK('problem','method','paper'), data TEXT JSON, created_at, updated_at)
edges (source TEXT, target TEXT, type TEXT, data TEXT JSON, created_at, PK(source,target,type))
claims (id TEXT PK, paper_id TEXT, canonical_id TEXT, type TEXT, text TEXT, evidence_json TEXT, created_at)
innovations (id TEXT PK, target_problem_id TEXT, data TEXT JSON, created_at)
```

### 1.2 Node 类型实际存储字段

#### Problem Node (`type='problem'`)

| 字段名 | 示例值/类型 | 是否可为空 | 说明 |
|--------|-------------|------------|------|
| `name` | string | 否 | 问题名称 |
| `definition` | string | 是 | 问题定义 |
| `domain` | string | 是 | 所属领域 |
| `resolution_status` | `"unsolved"` / `"active"` / `"solved"` / `"partial"` | 是 | 解决状态 |
| `year` | number \| null | 是 | 识别年份 |
| `constraints` | string | 是 | 物理/硬件约束 |
| `evaluation_metrics` | string \| null | 是 | 评估指标 |
| `description` | string | 是 | AI/人工生成描述 |
| `development_progress` | string | 是 | 发展进度描述 |
| `papers` | `[]` | 是 | 关联论文列表 |
| `methods` | `[]` | 是 | 关联方法列表 |

> ⚠️ **关键发现：后端没有存储 `valueScore`（评分）字段。**

#### Method Node (`type='method'`)

| 字段名 | 示例值/类型 | 是否可为空 | 说明 |
|--------|-------------|------------|------|
| `name` | string | 否 | 方法名称 |
| `mechanism` | string | 是 | 机制描述 |
| `complexity` | `"Unknown"` / ... | 是 | 复杂度 |
| `domain` | string | 是 | 所属领域 |
| `year` | number \| null | 是 | 出现年份 |
| `assumptions` | string | 是 | 前提假设 |
| `limitations` | string | 是 | 已知局限 |
| `description` | string | 是 | 描述 |
| `development_progress` | string | 是 | 发展进度 |
| `papers` | `[]` | 是 | 关联论文 |
| `targets` | `[]` | 是 | 目标问题列表 |

> ⚠️ **关键发现：后端同样没有存储 `valueScore` 或任何评分字段。**

#### Paper Node (`type='paper'`)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `title` | string | 标题 |
| `authors` | string[] | 作者 |
| `year` | string/number | 年份 |
| `venue` | string | 会议/期刊 |
| `abstract` | string | 摘要 |
| `arxiv_id` | string | arXiv ID |
| `ranking` | string | 论文级别 |

### 1.3 Edge 类型实际存储字段

Edge 的 `data` JSON 可包含：
- `effectiveness` (SOLVES 边)
- `limitations` (SOLVES 边)
- 其他边类型目前 `data` 为空对象 `{}`

常见 `type` 值：`SOLVES`, `ADDRESSES_PROBLEM`, `USES_METHOD`, `SUB_TYPE_OF`, `SUB_PROBLEM_OF`, `IMPROVES_UPON`

---

## 2. 后端 API 到前端 DTO 映射

### 2.1 `GET /api/v3/domain-map` → `DomainMapDTO`

后端把 `nodes` 表中的原始字段直接转换成 Pydantic 模型：

```python
Problem(
    canonical_id=rp.get("id"),
    name=rp.get("name", "Unknown Problem"),
    domain=rp.get("domain", "Unknown Domain"),
    definition=rp.get("definition", ""),
    resolution_status=rp.get("resolution_status", "unsolved"),
    description=rp.get("description", "..."),
    development_progress=rp.get("development_progress", "...")
)
```

**缺失字段：** `year_identified` 这里实际返回了 `rp.get("year")`，但 Pydantic 模型里的 `year_identified` 并没有被正确填充（代码里没传这个参数）。

### 2.2 前端 Store 类型对照

| Store | Problem 类型包含字段 | 是否含 `valueScore` | 数据来源 |
|-------|---------------------|---------------------|----------|
| `v3Store.ts` | `canonical_id, name, domain, definition, resolution_status, year_identified, description, development_progress` | ❌ 不包含 | 后端 `/api/v3/domain-map` |
| `appStore.ts` | `id, name, year, status, parentId, children, depth, branchId, valueScore, unsolvedLevel, description, papers, methods, aiAnalysis` | ✅ 包含 | legacy JSON / Cognee |
| `nexusStore.ts` | `id, name, year, status, branchId, description, children, evolvedFrom, parentId, depth, valueScore, unsolvedLevel, papers` | ✅ 包含 | legacy JSON / Cognee |

> ⚠️ **核心矛盾：** V3 页面（Method→Problem Arrows、部分 Timeline）使用 `v3Store`，没有 `valueScore`；而 Tree 类页面使用 `appStore`/`nexusStore`，虽然有 `valueScore` 字段，但数据来源（Cognee 或 EXTRACTED_DATA.json）中该字段也经常缺失，导致前端大量 fallback 到 `50`。

---

## 3. 前端显示元素 → 真实数据溯源

### 3.1 Method → Problem 页面（MethodArrowView）

| UI 元素 | 源码位置 | 数据绑定 | 当前问题 |
|---------|----------|----------|----------|
| Problem 卡片左侧色条 | `statusColor(p.status)` | `p.resolution_status` | 正常 |
| Problem 卡片右下角评分 badge | `{p.valueScore \|\| 50}` | 无真实来源 | **全部显示 50** |
| Method 卡片右侧色条 | `statusColor(m.status)` | 硬编码 `m.status='solved'` | 无真实状态 |
| 连线颜色 | `statusColor(method.status)` | 硬编码 `m.status='solved'` | 无真实状态 |

### 3.2 问题树（ProblemTreeView）

| UI 元素 | 源码位置 | 数据绑定 | 当前问题 |
|---------|----------|----------|----------|
| 节点大小 | `radius = 15 + node.valueScore / 10` | `node.valueScore` | fallback 到 50，所有节点大小一致 |
| 节点颜色（进度环） | `valueScore > 70 ? green : valueScore > 40 ? yellow : red` | `node.valueScore` | fallback 到 50，全部黄色 |
| 右侧面板评分条形图 | `selectedNode.valueScore` | `node.valueScore` | fallback 到 50 |

### 3.3 时间演化 / TimelineView

| UI 元素 | 源码位置 | 数据绑定 | 当前问题 |
|---------|----------|----------|----------|
| 节点评分显示 | `const score = node.valueScore \|\| 50` | `node.valueScore` | 全部显示 50 |
| 节点大小 | `6 + (score) / 12` | `score` | 全部大小一致 |

### 3.4 方法树（TreeView）

| UI 元素 | 源码位置 | 数据绑定 | 当前问题 |
|---------|----------|----------|----------|
| 节点评分 badge | `node.valueScore` | `node.valueScore` | `map.set(..., valueScore: p.valueScore \|\| 50)` |
| 详情面板 Value Score | `node.valueScore \|\| 50` | `node.valueScore` | 全部显示 50 |

---

## 4. 需要修复的数据与来源方案

### 4.1 方案 A：后端真实计算 `valueScore`

**计算规则建议：**
- **Problem.valueScore**: 基于关联 method 数量、resolution_status、claims 数量综合计算
  - `solved` → 80-100
  - `partial` → 50-79
  - `active` → 30-69
  - `unsolved` → 10-40
  - 再按关联方法数 / claims 数微调 ±10
- **Method.valueScore**: 基于 targets 数量、关联论文数、complexity 综合计算
  - `verified` → 80-100
  - `partial` → 50-79
  - `untested` → 20-49
  - `failed` → 10-30

**实施步骤：**
1. 后端 `local_graph.py` 的 `get_problem()` / `get_all_problems()` / `get_method()` / `get_all_methods()` 里动态计算 `value_score`
2. 后端 Pydantic `Problem` / `Method` 模型增加 `value_score: Optional[float] = None`
3. 前端 V3 DTO (`v3Store.ts`) 增加 `value_score` 字段
4. 前端所有 `\|\| 50` fallback 逻辑：只在 `value_score === null/undefined` 时显示 `--` 或 `N/A`，而不是硬编码 50

### 4.2 方案 B：前端基于真实字段实时计算

如果暂时不改后端，前端可以在 `v3Store` 里加 computed getter：
```typescript
getProblemValueScore(problem: Problem): number {
  const claimCount = /* fetch from backend or count relations */;
  const methodCount = /* count edges */;
  return computeFromStatusAndCounts(problem.resolution_status, claimCount, methodCount);
}
```

**推荐：** 方案 A（后端计算）更规范，因为其他前端组件（appStore/nexusStore）也可以统一复用同一接口。

---

## 5. 其他系统级问题汇总

| 问题 | 影响范围 | 根因 | 修复建议 |
|------|----------|------|----------|
| 亮色模式只切换 sidebar | 所有页面 | `viewConfig.darkMode` 只传给 sidebar，主 canvas 未消费 | 把 `viewConfig.darkMode` 注入全局 CSS 变量或顶层 container |
| English 只切换 sidebar | 所有页面 | 主 canvas 的 label/legend 是硬编码中文 | 所有可视化组件统一使用 `useI18n` 或同级翻译字典 |
| 书签 (Ctrl+B) 点击无响应 | 全局 | 可能是 store action 异常或 UI 未渲染 | 检查 `appStore.ts` 里 `isBookmarked` / `addBookmark` 的状态与绑定 |
| 问题树 22 FPS | ProblemTreeView | 大量节点 + framer-motion 重渲染 | ReactFlow 节点数 >100 时开启 `onlyRenderVisibleElements`，减少动画节点 |
| b_agent 行方法重叠 | Method Evolution NEW | 273 个方法挤在单行 | 增加行高或开启缩放/聚合 |
| Time Evolution 跳转到 Paper Timeline | Time Evolution 按钮 | App.tsx 路由映射错误 | 确认 `e5` (Time Evolution) 对应的路由组件 |

---

## 6. 前端 Store 职责建议重构

当前三个 Store 并存导致数据不同步（同义字段在不同 store 里值不同）。建议：

1. **以 `v3Store.ts` 为唯一真实数据源**：所有后端 API 数据只进这里。
2. **UI 状态（theme、language、bookmarks）集中到 `appStore.ts`**：不再让它存储论文/问题/方法业务数据。
3. **废弃 `nexusStore.ts` 中的业务数据**：只保留持久化配置（如用户偏好）。

---

*文档版本: v1.0*  
*生成时间: 2026-04-13*  
*下一步: 按本规范逐条修复并截图验收*
