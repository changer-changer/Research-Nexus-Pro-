# Research Nexus Pro - 开发文档

> 面向开发者的技术文档，包含架构设计、组件说明、开发规范和扩展指南。

---

## 🏗️ 系统架构

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 18.x |
| 语言 | TypeScript | 5.x |
| 构建 | Vite | 5.x |
| 状态 | Zustand | 4.x |
| 样式 | Tailwind CSS | 3.x |
| 动画 | Framer Motion | 11.x |
| 可视化 | ReactFlow | 11.x |
| 图标 | Lucide React | latest |

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Tree Views │  │ Timeline    │  │ Network Views       │ │
│  │  (SVG)      │  │ (SVG)       │  │ (ReactFlow)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      State Management                        │
│                    ┌─────────────────┐                       │
│                    │   Zustand Store │                       │
│                    │  - appStore     │                       │
│                    │  - nexusStore   │                       │
│                    └─────────────────┘                       │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│                    ┌─────────────────┐                       │
│                    │  real_papers.json │                     │
│                    │  (Static JSON)    │                     │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
research-nexus-pro/
├── src/
│   ├── components/          # 可视化组件
│   │   ├── ProblemTree.tsx          # 问题树 (SVG)
│   │   ├── MethodTree.tsx           # 方法树 (SVG)
│   │   ├── TimelineView.tsx         # 问题时间演化 (SVG)
│   │   ├── MethodTimelineView.tsx   # 方法时间演化 (SVG)
│   │   ├── PaperTimelineView.tsx    # 论文时间线 (SVG)
│   │   ├── CitationView.tsx         # 引用网络 (ReactFlow)
│   │   ├── DualTreeView.tsx         # 双树融合 (SVG)
│   │   ├── MethodArrowView.tsx      # 方法-问题映射 (SVG)
│   │   ├── NodeDetailPanel.tsx      # 问题/方法详情
│   │   ├── PaperDetailPanel.tsx     # 论文详情
│   │   ├── BookmarkPanel.tsx        # 书签面板
│   │   └── PresentationMode.tsx     # 演示模式
│   ├── store/
│   │   ├── appStore.ts      # 主状态管理
│   │   └── nexusStore.ts    # 兼容层状态
│   ├── data/
│   │   └── real_papers.json # 知识图谱数据
│   ├── App.tsx              # 主应用
│   ├── main.tsx             # 入口
│   └── index.css            # 全局样式
├── docs/                    # 文档
├── public/                  # 静态资源
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🧩 核心组件详解

### 1. ProblemTree / MethodTree

**文件**: `src/components/ProblemTree.tsx`, `MethodTree.tsx`

**功能**: 层级树状图展示

**关键技术**:
- SVG 渲染
- 递归布局算法
- 虚拟滚动 (大数据量)

**核心算法**:
```typescript
// 树形布局算法
function computeTreeLayout(nodes: Node[]): Layout {
  const levels = groupByDepth(nodes)
  return levels.map((level, depth) => {
    const y = depth * LEVEL_GAP
    return level.map((node, index) => ({
      id: node.id,
      x: index * (NODE_W + SIBLING_GAP),
      y,
      depth
    }))
  })
}
```

### 2. TimelineView

**文件**: `src/components/TimelineView.tsx`

**功能**: 时间演化可视化

**关键技术**:
- 时间轴网格布局
- 泳道（Swimlane）分组
- 悬停 Tooltip

**布局参数**:
```typescript
const YEAR_W = 140          // 每年宽度
const LANE_H = 160          // 泳道高度
const LEFT = 180            // 左侧边距
const TOP = 70              // 顶部边距
const GRID_SPACING_X = 50   // 节点水平间距
const GRID_SPACING_Y = 40   // 节点垂直间距
```

**节点分散算法**:
```typescript
// 同一年份同领域的节点分散排列
const cols = Math.ceil(Math.sqrt(totalNodes * 1.5))
const row = Math.floor(index / cols)
const col = index % cols
const x = baseX + (col - (cols - 1) / 2) * GRID_SPACING_X
const y = baseY + row * GRID_SPACING_Y
```

### 3. CitationView

**文件**: `src/components/CitationView.tsx`

**功能**: 引用关系网络

**关键技术**:
- ReactFlow 图可视化
- 力导向布局
- 动态边渲染

**性能优化**:
- 使用 `useMemo` 缓存节点位置
- 边使用 `useMemo` 计算
- 大图启用虚拟化

### 4. NodeDetailPanel

**文件**: `src/components/NodeDetailPanel.tsx`

**功能**: 问题/方法详情展示

**Props**:
```typescript
interface NodeDetailPanelProps {
  nodeId: string | null
  nodeType: 'problem' | 'method' | null
  onClose: () => void
}
```

### 5. PaperDetailPanel

**文件**: `src/components/PaperDetailPanel.tsx`

**功能**: 论文详情展示

**特点**:
- 宽度 480px（比 NodeDetailPanel 更宽）
- 支持跳转到问题/方法详情
- 显示引用关系统计

---

## 🗄️ 状态管理

### appStore (Zustand)

**文件**: `src/store/appStore.ts`

**核心状态**:
```typescript
interface AppState {
  // 数据
  branches: Branch[]
  problems: Problem[]
  methods: Method[]
  papers: Paper[]
  
  // UI状态
  activeView: string
  viewConfig: ViewConfig
  selectedNode: { id: string; type: 'problem' | 'method' | 'paper' } | null
  
  // 交互
  expandedNodes: Set<string>
  bookmarks: Bookmark[]
  history: HistoryEntry[]
  
  // 方法
  loadData: (data: Data) => void
  selectNode: (type: string, id: string) => void
  toggleExpand: (id: string) => void
  undo: () => void
  redo: () => void
}
```

**持久化**:
```typescript
export const useAppStore = create(
  persist(
    (set, get) => ({ ... }),
    {
      name: 'research-nexus-storage',
      partialize: (state) => ({ 
        bookmarks: state.bookmarks,
        viewConfig: state.viewConfig 
      })
    }
  )
)
```

---

## 🎨 样式系统

### 颜色系统

```typescript
// 领域颜色
const CAT_COLORS: Record<string, string> = {
  Tactile: '#f59e0b',           // 琥珀色
  'Diffusion/Flow': '#22c55e',  // 绿色
  VLA: '#3b82f6',               // 蓝色
  Manipulation: '#ec4899',      // 粉色
  Other: '#6b7280',             // 灰色
  Perception: '#8b5cf6',        // 紫色
  Policy: '#14b8a6',            // 青色
}

// 问题状态颜色
const PROBLEM_STATUS = {
  solved: '#22c55e',    // 绿色
  partial: '#f59e0b',   // 琥珀色
  active: '#3b82f6',    // 蓝色
  unsolved: '#ef4444',  // 红色
}

// 方法状态颜色
const METHOD_STATUS = {
  verified: '#3b82f6',  // 蓝色
  partial: '#f59e0b',   // 琥珀色
  untested: '#8b5cf6',  // 紫色
  failed: '#6b7280',    // 灰色
}
```

### Dark/Light Mode

**实现方式**:
```tsx
const isDark = viewConfig.darkMode

// 动态类名
className={`
  ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-gray-50 text-gray-900'}
  ${isDark ? 'border-zinc-800' : 'border-gray-200'}
`}
```

---

## 🔧 开发规范

### 代码风格

1. **TypeScript**: 严格模式，所有类型必须显式声明
2. **命名**: PascalCase (组件), camelCase (变量/函数)
3. **导入**: 按类型分组（React, 第三方, 本地）
4. **注释**: 复杂算法必须加注释

### 组件规范

```typescript
// 1. Props 接口
interface ComponentProps {
  prop1: string
  prop2?: number
  onAction: () => void
}

// 2. 函数组件
export default function Component({ prop1, prop2, onAction }: ComponentProps) {
  // 3. Hooks
  const store = useAppStore()
  const [state, setState] = useState(initial)
  
  // 4. Memos
  const computed = useMemo(() => compute(data), [data])
  
  // 5. Callbacks
  const handleClick = useCallback(() => { ... }, [deps])
  
  // 6. Effects
  useEffect(() => { ... }, [deps])
  
  // 7. Render
  return (
    <div>...{
        /* JSX */
      }...</div>
  )
}
```

### 性能优化

1. **使用 `useMemo`** 缓存计算结果
2. **使用 `useCallback`** 缓存回调函数
3. **使用 `React.memo`** 包裹纯组件
4. **大数据量使用虚拟化**
5. **避免不必要的重渲染**

---

## 🚀 扩展指南

### 添加新视图

1. **创建组件文件**:
```bash
touch src/components/NewView.tsx
```

2. **基础结构**:
```typescript
import React from 'react'
import { useAppStore } from '../store/appStore'

export default function NewView() {
  const { problems, methods, papers, viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode
  
  return (
    <div className={`h-full w-full ${isDark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
      {/* 你的实现 */}
    </div>
  )
}
```

3. **注册到 App.tsx**:
```typescript
const NewView = lazy(() => import('./components/NewView'))

const NAV_ITEMS = [
  ...
  { id: 'new-view', label: 'New View', icon: Icon, group: 'custom' },
]

const renderActiveView = () => {
  switch (activeView) {
    ...
    case 'new-view': return <NewView />
  }
}
```

### 添加新数据字段

1. **更新类型定义** (`appStore.ts`):
```typescript
export interface Paper {
  ...
  newField: string
}
```

2. **更新组件**:
```typescript
// 在详情页中显示新字段
<div>{paper.newField}</div>
```

3. **更新数据文件**:
```json
{
  "papers": [
    {
      "id": "...",
      "newField": "value"
    }
  ]
}
```

---

## 🐛 调试指南

### 常见问题

**1. TypeScript 错误**
```bash
# 检查类型
npm run type-check
```

**2. 构建失败**
```bash
# 清理并重建
rm -rf dist node_modules/.vite
npm run build
```

**3. 视图不显示**
- 检查 `activeView` 是否正确
- 检查组件是否正确导入
- 检查是否有 JavaScript 错误

**4. 数据不更新**
- 检查 `loadData` 是否正确调用
- 检查 JSON 格式是否正确
- 检查浏览器缓存

### 开发工具

**React DevTools**: 检查组件状态和Props
**Redux DevTools**: 检查 Zustand 状态（需配置）
**浏览器控制台**: 查看错误和日志

---

## 📦 构建与部署

### 本地开发
```bash
cd research-nexus-pro
npm install
npm run dev
```

### 生产构建
```bash
npm run build
```

### 部署到 GitHub Pages
```bash
# 构建
cd /tmp/final-push
cp -r research-nexus-pro/dist/* .
git add -A
git commit -m "deploy"
git push origin main
```

---

## 📚 相关文档

- **用户手册**: `USER_MANUAL.md`
- **Agent指南**: `AGENT_GUIDE.md`
- **API参考**: `API_REFERENCE.md`

---

*Last updated: 2026-03-21*
