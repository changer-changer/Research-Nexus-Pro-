# Research-Nexus Pro — Engineering Documentation

> Version: 3.0-hierarchy  
> Last updated: 2026-04-20  
> Branch: gh-pages

---

## 1. 项目概述

Research-Nexus Pro 是一个通用的全栈研究知识图谱可视化系统，可将任意领域的研究论文转化为问题树、方法树和引文网络的交互式图谱。

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 状态管理 | Zustand (6 stores) |
| 可视化 | ReactFlow (dagre layout) + D3 (timeline) |
| 动画 | GSAP + Framer Motion |
| 后端 | Python FastAPI + SQLite + NetworkX + NumPy |
| 部署 | GitHub Pages (frontend) + local server (backend) |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │App Store │  │ V3 Store │  │ Config   │  │ PaperGen │   │
│  │          │  │          │  │ Store    │  │ Store    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│  ┌────▼─────────────▼─────────────▼─────────────▼─────┐   │
│  │              App.tsx / AppRoutes.tsx                │   │
│  │  ProblemTree │ MethodTree │ DualTree │ Innovation │   │
│  └────┬────────────────────────┬──────────────────────┘   │
│       │   HTTP / REST API      │                          │
└───────┼────────────────────────┼──────────────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ /api/v3/     │  │ /api/papers  │  │ /api/cognee  │    │
│  │ domain-map   │  │              │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │            │
│  ┌──────▼──────────────────▼──────────────────▼──────┐   │
│  │          main_local.py (FastAPI v2.1.0)          │   │
│  │  CORS: localhost 3000-3005, 5173-5184            │   │
│  └──────┬────────────────────────────────────────────┘   │
│         │                                                   │
│  ┌──────▼──────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ local_graph │  │local_vector  │  │ Skills System  │   │
│  │ SQLite+     │  │ NumPy-based  │  │ 4 skill modules│   │
│  │ NetworkX    │  │ vector DB    │  │                │   │
│  └─────────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心数据流 — 端到端层级树

### 3.1 数据产生

```
论文PDF → Kimi LLM提取 → Pydantic Schema验证 → fastembed向量化
                                              ↓
                                    ┌─────────────────────┐
                                    │  research_graph.db  │
                                    │  (SQLite+NetworkX)  │
                                    │                     │
                                    │  nodes: problems,   │
                                    │        methods,     │
                                    │        papers       │
                                    │  edges: SUB_PROBLEM │
                                    │        SUB_TYPE_OF  │
                                    │        IMPROVES_UPON│
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │ local_graph.py       │
                                    │ get_domain_map()     │
                                    │ (v3_graph_routes.py) │
                                    └──────────┬──────────┘
                                               │
                                               ▼ JSON/REST
                                    ┌─────────────────────┐
                                    │  Frontend           │
                                    │  App.tsx hydrateData│
                                    │  ProblemTree.tsx    │
                                    │  MethodTree.tsx     │
                                    └─────────────────────┘
```

### 3.2 关键修复：后端 API 层级保留

**Bug 描述**（已修复）  
`get_domain_map()` 曾按 domain 分组节点，并为每个 domain 创建虚假的 `domain_root_*` 父节点，完全覆盖了节点数据中真实的 `parent_id` 关系。

**修复方案**

```python
# backend/app/api/v3_graph_routes.py
# 修复前（错误）：
# domain_parent = f"domain_root_{domain}"
# if domain_parent not in node_map:
#     node_map[domain_parent] = {...parent_id: None...}
# p['parent_id'] = domain_parent  # ← 覆盖真实 parent！

# 修复后（正确）：
p['parent_id'] = node_data.get('parent_id') or node_data.get('parentId') or node_data.get('parent')
if not p['parent_id']:
    # 仅在没有 parent 时才从边推断
    for u, v, edge_data in graph.edges(data=True):
        if edge_data.get('type') in ('SUB_PROBLEM_OF', 'SUB_TYPE_OF', 'IMPROVES_UPON'):
            # 推断 parent 关系
```

**验证结果**

| 数据类型 | 总数 | 有 parent | 占比 |
|---------|------|----------|------|
| Problems | 155 | 153 | 98.7% |
| Methods | 250 | 246 | 98.4% |

### 3.3 前端数据接收

`App.tsx` 的 `hydrateData()` 确保 `parent` 字段被正确传递：

```typescript
backendProblems = (domainMapRes.problems || []).map((p: any) => ({
  ...p,
  id: p.canonical_id || p.id,
  parent: p.parent_id || p.parent || null,  // ← 保留层级
}))
```

### 3.4 ReactFlow 渲染流程

```
原始数据 (problems/methods)
    ↓ 映射 + parentId 标准化
计算 childrenMap + parentMap（useMemo）
    ↓
expandedNodes: Set<string>（用户展开状态）
    ↓
visibleNodeIds = 根节点 + 展开路径（useMemo）
    ↓
构建 nodes + edges（仅可见节点）
    ↓
dagre.layout() → 计算层级位置
    ↓
setNodes / setEdges → ReactFlow 渲染
    ↓
fitView() → 自动适配视口
```

---

## 4. 组件设计

### 4.1 ProblemTree / MethodTree — 统一架构

两个树组件遵循相同的设计模式：

| 模块 | 职责 |
|------|------|
| `dagre.layout()` | 层级布局计算（TB 方向，ranksep=120, nodesep=40）|
| `TreeNode` | 自定义 ReactFlow 节点：圆角卡片 + 域色条 + 状态点 |
| `SidebarTree` | 递归缩进列表导航，支持展开/折叠/搜索 |
| `visibleNodeIds` | 基于 expandedNodes 的可见节点计算 |
| `Detail Panel` | 右侧滑出面板：描述、子节点、关联论文 |

### 4.2 关键设计决策

**dagre Graph 单例模式**

```typescript
// 模块级单例，避免重复创建
const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))
```

每次布局前清除旧节点，确保状态干净。JavaScript 单线程模型保证无竞态条件。

**可见节点计算（剪枝）**

```typescript
const visibleNodeIds = useMemo(() => {
  const visible = new Set<string>()
  const addNodeAndDescendants = (id: string) => {
    visible.add(id)
    if (expandedNodes.has(id)) {
      childrenMap.get(id)?.forEach(childId => addNodeAndDescendants(childId))
    }
  }
  rootIds.forEach(id => addNodeAndDescendants(id))
  return visible
}, [rootIds, childrenMap, expandedNodes])
```

这确保 ReactFlow 只渲染展开的节点子树，而非全部扁平节点。

**ReactFlowProvider 包装**

```typescript
// 必须使用 Provider，因为内部使用了 useReactFlow()
export default function ProblemTree() {
  return (
    <ReactFlowProvider>
      <ProblemTreeInner />
    </ReactFlowProvider>
  )
}
```

### 4.3 交互设计

| 操作 | 行为 |
|------|------|
| 点击节点 | 展开/折叠子树 + 选中节点 |
| 侧边栏点击 | 选中 + 自动展开所有祖先 |
| 搜索 | 实时过滤（名称匹配） |
| 领域过滤 | 仅显示选中领域的节点 |
| Expand All | 展开所有节点 |
| Collapse All | 仅保留根节点展开 |

---

## 5. 测试策略与结果

### 5.1 测试覆盖

| 类别 | 用例数 | 通过 | 失败 | 说明 |
|------|--------|------|------|------|
| API Endpoints | 14 | 13 | 1 | test_get_nonexistent_task 返回 200 而非 404 |
| Database Integration | 12 | 9 | 3 | 测试数据顺序/外键约束问题 |
| Innovation System | 8 | 7 | 1 | error_handling 返回 500 而非 404 |
| SSE Streaming | 18 | 18 | 0 | 全部通过 |
| V4 Components | 1 | 1 | 0 | 通过 |
| **总计** | **72** | **66** | **6** | **91.7%** |

### 5.2 端到端数据流验证

```bash
# 验证 API 返回正确的层级关系
curl http://localhost:8000/api/v3/domain-map

# 结果：155 problems, 153 有 parent_id
#       250 methods, 246 有 parent_id
```

### 5.3 前端构建验证

```bash
npx tsc --noEmit      # ✅ 0 errors
npm run build         # ✅ 3.08s, 322KB index bundle (gzip: 103KB)
```

### 5.4 已知测试失败（非本改动引入）

| 测试 | 原因 |
|------|------|
| `test_get_nonexistent_task` | API 对不存在的 task 返回 200 而非 404 |
| `test_favorites_crud_read` | 测试期望 innov_002 但数据中有 innov_000 |
| `test_foreign_key_constraint` | SQLite 未启用外键约束 |
| `test_cascade_delete` | 同上，级联删除未生效 |
| `test_07_error_handling` | 错误路由返回 500 而非 404 |

---

## 6. 性能优化

### 6.1 已实施的优化

| 优化点 | 实现 |
|--------|------|
| 节点剪枝 | `visibleNodeIds` useMemo，仅渲染展开路径 |
| DAG布局缓存 | dagre 单例，清除+重建模式 |
| 组件 memo | `TreeNode` 和 `MethodDetailPanel` 使用 `memo()` |
| 防抖 fitView | setTimeout 100ms + cleanup 函数 |
| 仅渲染可见 | ReactFlow `onlyRenderVisibleElements` |
| Bundle 分割 | Vite 自动 code-splitting，67 个 chunk |

### 6.2 潜在优化（TODO）

| 优化点 | 优先级 | 说明 |
|--------|--------|------|
| 虚拟滚动侧边栏 | Medium | 超过 500 节点时 SidebarTree 递归渲染可能卡顿 |
| dagre layout 缓存 | Medium | 相同 expandedNodes 可缓存布局结果 |
| Web Worker 布局 | Low | 大数据集时在 worker 中计算 dagre |
| 图片懒加载 | Low | Detail Panel 中的论文缩略图 |

### 6.3 Bundle 分析

```
dist/ 总大小: 1.4MB
├── index ........ 322 KB (gzip 103KB) — 主入口
├── style ........ 236 KB (gzip 79KB) — Tailwind + design-system
├── motion ....... 99 KB (gzip 33KB) — Framer Motion
├── real_papers .. 35 KB (gzip 5.8KB) — 静态数据
└── 其他 chunks .. ~600 KB — 懒加载视图
```

---

## 7. 设计系统

### 7.1 CSS 变量体系

```css
:root {
  /* Background */
  --bg-base: #0a0a0f;
  --bg-elevated: #13131a;
  --bg-surface: #1c1c24;

  /* Text */
  --text-primary: #f0f0f5;
  --text-secondary: #9ca3af;
  --text-tertiary: #6b7280;

  /* Accent */
  --accent: #6366f1;
  --accent-light: #818cf8;

  /* Border */
  --border-subtle: rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.09);
}
```

### 7.2 新增效果

| 类名 | 效果 |
|------|------|
| `.rn-ambient-bg` | 动态径向渐变背景，20s 循环动画 |
| `.rn-glass` | backdrop-filter 毛玻璃效果 |
| `.rn-glow-*` | 发光边框（accent/success/warning/error）|
| `.rn-skeleton` | 骨架屏 shimmer 动画 |
| `.rn-view-enter` | 视图切换淡入+缩放动画 |

---

## 8. 部署指南

### 8.1 本地开发

```bash
# One-shot（前端 + 后端）
./start-research-nexus.sh

# 前端单独
npm install && npm run dev     # http://localhost:5173

# 后端单独
cd backend
source venv/bin/activate
python -m app.api.main_local   # http://localhost:8000
```

### 8.2 GitHub Pages 部署

```bash
npm run build
# dist/ 内容自动部署到 gh-pages 分支
# base path: /Research-Nexus-Pro-/ (vite.config.ts)
```

### 8.3 环境变量

```bash
# .env
COGNEE_LLM_API_KEY=xxx   # 可选，LLM 功能需要
```

---

## 9. 已知问题与 TODO

### 9.1 当前版本

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | 后端 5 个测试失败（数据状态/API 行为）| 低 | 已记录，非本改动引入 |
| 2 | `dagreGraph` 单例在严格模式双渲染时可能残留状态 | 极低 | 已缓解（每次 layout 前 clear） |
| 3 | 侧边栏无虚拟滚动，500+ 节点可能卡顿 | 中 | TODO |
| 4 | MethodTree 直接请求 `localhost:8000`，无配置化 base URL | 低 | 需改进 |

### 9.2 未来方向

- [ ] **增量加载**：大数据集时分页/懒加载节点
- [ ] **搜索高亮**：SidebarTree 中匹配项的高亮样式
- [ ] **键盘导航**：方向键在树中导航
- [ ] **导出 SVG/PDF**：将当前树视图导出为矢量图
- [ ] **协作编辑**：WebSocket 实时同步展开状态

---

## 10. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/app/api/v3_graph_routes.py` | Fix | 保留节点真实 parent_id，移除 domain 虚假分组 |
| `src/App.tsx` | Fix | hydrateData 传递 parent 字段；添加 ambient bg |
| `src/components/ProblemTree.tsx` | Rewrite | dagre 层级布局 + 侧边栏 + 搜索 |
| `src/components/MethodTree.tsx` | Rewrite | dagre 层级布局 + 侧边栏 + 领域过滤 |
| `src/styles/design-system.css` | Enhance | ambient bg, glass, glow, skeleton, view-enter |

---

## 11. 快速诊断

### 11.1 树不显示层级

```bash
# 1. 检查 API 返回
curl http://localhost:8000/api/v3/domain-map | jq '.problems[0].parent_id'
# 应该返回 parent 字符串，不是 null

# 2. 检查前端数据
# DevTools → Application → Local Storage → appStore
# problems 数组中每个对象应有 parentId 字段
```

### 11.2 ReactFlow 报错 "useReactFlow was called outside of ReactFlowProvider"

确保组件导出使用 Provider 包装：

```typescript
export default function XxxTree() {
  return <ReactFlowProvider><XxxTreeInner /></ReactFlowProvider>
}
```

### 11.3 后端启动失败

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python -m app.api.main_local
```

---

*文档结束。如有问题，参考 `CLAUDE.md` 获取开发环境配置。*
