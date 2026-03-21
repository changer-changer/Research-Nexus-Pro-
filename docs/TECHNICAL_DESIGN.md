# Research Nexus Pro - 系统设计逻辑与技术要点

## 🏗️ 一、整体架构设计

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Tree Views │  │  Timelines  │  │    Network Views        │  │
│  │  (SVG)      │  │  (SVG)      │  │    (ReactFlow)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                         State Management                         │
│                    ┌───────────────────┐                         │
│                    │   Zustand Store   │                         │
│                    │  - Centralized    │                         │
│                    │  - Reactive       │                         │
│                    └───────────────────┘                         │
├─────────────────────────────────────────────────────────────────┤
│                          Data Layer                              │
│                    ┌───────────────────┐                         │
│                    │  real_papers.json │                         │
│                    │  (Static Bundle)  │                         │
│                    └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

**设计哲学**：
- **静态数据优先**：知识图谱数据预构建为JSON，运行时直接加载，无需后端API
- **客户端渲染**：所有可视化在浏览器完成，支持离线访问
- **状态集中管理**：Zustand统一状态，组件间通信清晰

---

## 🧩 二、数据模型设计

### 2.1 三层知识表示

```
┌────────────────────────────────────────────────────────────┐
│                      Knowledge Layers                       │
├────────────────────────────────────────────────────────────┤
│  Layer 1: Papers (论文)                                     │
│  - 原始知识载体                                             │
│  - 属性: title, year, venue, citations, authorityScore     │
│  - 关系: cites → Paper, addresses → Problem, uses → Method │
├────────────────────────────────────────────────────────────┤
│  Layer 2: Problems (问题)                                   │
│  - 从论文中提取的研究问题                                    │
│  - 层级结构: L0 → L1 → L2 → L3                             │
│  - 状态: solved/partial/active/unsolved                     │
├────────────────────────────────────────────────────────────┤
│  Layer 3: Methods (方法)                                    │
│  - 解决问题的方法论                                          │
│  - 层级结构: 抽象 → 具体实现                                │
│  - 状态: verified/partial/untested/failed                   │
└────────────────────────────────────────────────────────────┘
```

### 2.2 关系网络

**六类核心关系**：

```typescript
// 1. 层级关系 (父子)
Problem.parentId → Problem
Method.parentId → Method

// 2. 问题-方法映射
Method.targets → Problem[]

// 3. 论文-问题映射
Paper.targets → Problem[]

// 4. 论文-方法映射
Paper.methods → Method[]

// 5. 引用关系
Paper.citations → Paper[]

// 6. 跨领域关系
Method.crossDomain → Branch[]
```

**设计决策**：
- 使用ID引用而非嵌套，避免数据冗余
- 双向关系由应用层计算，不存储在JSON中
- 支持多对多关系（一个问题可有多个方法）

---

## 📊 三、可视化技术要点

### 3.1 技术选型矩阵

| 视图类型 | 技术 | 选择理由 |
|----------|------|----------|
| Tree Views | SVG | 精确控制节点位置，支持复杂连线 |
| Timelines | SVG | 时间轴布局简单，SVG性能优秀 |
| Networks | ReactFlow | 内置力导向布局，交互丰富 |
| Panels | HTML/CSS | 复杂UI布局，Flexbox友好 |

**为什么没有选择 Canvas/WebGL？**
- 数据量适中（60论文/130节点），SVG性能足够
- SVG DOM可操作，便于调试和交互
- 开发速度快，无需处理底层渲染

### 3.2 树形布局算法

**递归分层布局**：

```typescript
function computeTreeLayout(nodes: Node[]): Layout {
  const levels = groupByDepth(nodes)
  
  return levels.flatMap((level, depth) => {
    const y = depth * LEVEL_GAP
    
    // 计算每个节点的x位置
    return level.map((node, index) => {
      // 考虑子树宽度的居中计算
      const subtreeWidth = getSubtreeWidth(node)
      const x = computeX(node, index, level, subtreeWidth)
      
      return { id: node.id, x, y, depth }
    })
  })
}
```

**关键优化**：
- 子树宽度预计算，确保父节点居中于子节点
- 使用 `Map` 缓存布局结果，避免重复计算
- `useMemo` 缓存布局，数据不变不重新计算

### 3.3 时间轴分散算法

**问题**：同一年份同领域多个节点会重叠

**解决方案 - 网格分散**：

```typescript
const cols = Math.ceil(Math.sqrt(totalNodes * 1.5))
const row = Math.floor(index / cols)
const col = index % cols

// 相对于基准位置的偏移
const offsetX = (col - (cols - 1) / 2) * SPACING_X
const offsetY = row * SPACING_Y
```

**效果**：
- 节点自动排列成网格
- 行列数根据节点数动态计算
- 视觉上整齐不重叠

### 3.4 节点位置确定性

**为什么不用 Math.random()？**
- 每次渲染节点位置不同，用户困惑
- React re-render 导致节点跳动

**解决方案 - 哈希定位**：

```typescript
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// 使用哈希值添加微小扰动
const jitter = ((hash % 100) / 100 - 0.5) * 20
const x = baseX + jitter
```

**优势**：
- 相同ID总是得到相同位置
- 视觉上自然随机，实际完全确定

---

## 🎨 四、视觉设计系统

### 4.1 颜色语义

```typescript
// 领域颜色 - 区分不同研究方向
const CAT_COLORS = {
  Tactile: '#f59e0b',           // 琥珀 - 触觉
  'Diffusion/Flow': '#22c55e',  // 绿 - 扩散
  VLA: '#3b82f6',               // 蓝 - VLA
  Manipulation: '#ec4899',      // 粉 - 操作
}

// 问题状态 - 研究进展
const PROBLEM_STATUS = {
  solved: '#22c55e',    // 绿 - 已解决
  partial: '#f59e0b',   // 琥珀 - 部分
  active: '#3b82f6',    // 蓝 - 进行中
  unsolved: '#ef4444',  // 红 - 未解决
}

// 方法状态 - 验证程度
const METHOD_STATUS = {
  verified: '#3b82f6',  // 蓝 - 已验证
  partial: '#f59e0b',   // 琥珀 - 部分
  untested: '#8b5cf6',  // 紫 - 未测试
  failed: '#6b7280',    // 灰 - 失败
}
```

**设计原则**：
- 颜色有语义，用户可快速理解状态
- 同一色系不同饱和度表示不同状态
- 高对比度确保可读性

### 4.2 大小编码

```typescript
// 问题节点大小 = 研究价值
const problemSize = 10 + (valueScore / 10) * 14  // 10-24px

// 论文节点大小 = 权威分数
const paperSize = 8 + (authorityScore / 10) * 14  // 8-22px

// 方法节点 = 固定大小
const methodSize = 14  // 固定14px菱形
```

**设计原则**：
- 大小编码重要性，大=重要
- 避免过大差异导致视觉不平衡
- 方法节点固定大小，突出其工具属性

---

## ⚡ 五、性能优化策略

### 5.1 渲染优化

| 技术 | 应用 | 效果 |
|------|------|------|
| `useMemo` | 布局计算、节点渲染 | 避免重复计算 |
| `useCallback` | 事件处理函数 | 稳定引用，减少子组件重渲染 |
| `React.memo` | 节点组件 | Props不变不渲染 |
| `transform` | 平移缩放 | GPU加速，60fps流畅 |

### 5.2 大数据处理

**问题**：60论文 × 100引用 = 6000条潜在边

**解决方案**：

```typescript
// 1. 默认只显示跨领域引用（减少60%边数）
const crossDomainEdges = edges.filter(e => 
  nodes[e.source].category !== nodes[e.target].category
)

// 2. 选中论文时才显示其引用邻居
const visibleEdges = selectedPaper 
  ? edges.filter(e => e.source === selectedPaper.id || e.target === selectedPaper.id)
  : crossDomainEdges

// 3. 边使用 CSS opacity 而非 display
// opacity: 0 时仍参与布局计算，不会导致跳动
```

### 5.3 内存优化

```typescript
// 使用 ID 而非对象引用
const paperIds = papers.map(p => p.id)  // ✅ 轻量
// vs
const paperRefs = papers                  // ❌ 持有整个对象

// JSON 按需加载
const data = await import('./data/real_papers.json')  // ✅ 异步
// vs
import data from './data/real_papers.json'            // ❌ 同步，阻塞启动
```

---

## 🔄 六、交互设计逻辑

### 6.1 渐进式信息展示

```
初始状态 → 悬停 → 点击 → 详情面板
   ↓         ↓       ↓         ↓
 最小信息   名称    选中高亮   完整信息
 (节点)   (Tooltip) (边框)    (面板)
```

**设计原则**：
- 不一次性展示所有信息，避免视觉过载
- 用户主动探索，层层深入
- 上下文保持（选中状态持久）

### 6.2 多视图协同

```typescript
// 全局选中状态
selectedNode: { id: string; type: 'problem' | 'method' | 'paper' } | null

// 所有视图响应同一状态
ProblemTree: 高亮选中问题
TimelineView: 高亮选中问题
NodeDetailPanel: 显示选中节点详情
```

**优势**：
- 切换视图时选中状态保持
- 跨视图导航流畅
- 统一的用户体验

### 6.3 导航链路设计

```
Paper Timeline → 点击论文 → PaperDetailPanel
                      ↓
          ┌──────────┴──────────┐
          ↓                     ↓
    点击 Problems           点击 Methods
          ↓                     ↓
    NodeDetailPanel       NodeDetailPanel
    (Problem)             (Method)
```

**设计目标**：
- 任意起点，任意终点
- 不丢失上下文
- 快速跳转

---

## 🛠️ 七、关键技术决策

### 7.1 为什么选择 Zustand 而非 Redux？

| 维度 | Zustand | Redux |
|------|---------|-------|
| 代码量 | 少（无boilerplate） | 多（Action/Reducer） |
| TypeScript | 原生支持 | 需额外配置 |
| 学习曲线 | 低 | 高 |
| 性能 | 优秀（selector自动优化） | 需手动优化 |
| 中间件 | 内置persist | 需redux-persist |

**结论**：项目规模适中，Zustand足够且简洁。

### 7.2 为什么静态 JSON 而非数据库？

**优势**：
- 无后端依赖，部署简单（GitHub Pages）
- 加载快（一次HTTP请求）
- 版本控制（数据变更可追溯）
- 离线可用

**劣势**：
- 不支持动态更新
- 数据量大时加载慢

**权衡**：知识图谱更新频率低（周/月），静态JSON更合适。

### 7.3 为什么 SVG 而非 Canvas？

| 特性 | SVG | Canvas |
|------|-----|--------|
| DOM操作 | ✅ 原生支持 | ❌ 需手动管理 |
| 事件处理 | ✅ 简单 | ❌ 需计算坐标 |
| 调试 | ✅ 浏览器DevTools | ❌ 难调试 |
| 性能（大数据） | ❌ 一般 | ✅ 优秀 |
| 交互复杂度 | ✅ 高 | ⚠️ 中等 |

**决策**：数据量<1000节点，SVG开发效率更高。

---

## 📈 八、扩展性设计

### 8.1 添加新视图

```typescript
// 1. 创建组件
const NewView = () => { ... }

// 2. 注册到导航
const NAV_ITEMS = [
  { id: 'new-view', label: 'New View', icon: Icon, group: 'custom' },
]

// 3. 添加到渲染
const renderActiveView = () => {
  switch (activeView) {
    case 'new-view': return <NewView />
  }
}
```

### 8.2 添加新数据字段

```typescript
// 1. 更新类型
interface Paper {
  newField: string
}

// 2. 更新组件
<div>{paper.newField}</div>

// 3. 更新JSON数据
```

### 8.3 支持新领域

```typescript
// 1. 添加颜色
const CAT_COLORS = {
  ...existing,
  NewDomain: '#xxxxx'
}

// 2. 更新数据
papers.forEach(p => {
  if (isNewDomain(p)) p.category = 'NewDomain'
})
```

---

## 🎯 九、核心设计原则总结

1. **数据驱动**：JSON 定义一切，视图自动渲染
2. **确定性**：相同输入，相同输出，无随机性
3. **渐进式**：信息分层展示，避免过载
4. **一致性**：跨视图统一交互和视觉语言
5. **性能优先**：useMemo/useCallback 默认使用
6. **可维护**：TypeScript 严格模式，类型即文档

---

*Last updated: 2026-03-21*
