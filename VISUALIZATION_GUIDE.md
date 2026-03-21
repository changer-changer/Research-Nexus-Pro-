# Research Nexus Pro - 可视化组件使用指南

## 可用视图列表

### 1. Problem Tree (问题树)
**组件**: `ProblemTreeView.tsx`
**功能**: 展示问题的层级结构
**数据需求**: problems数组，包含parentId/children/depth

### 2. Method Tree (方法树)
**组件**: `MethodTree.tsx`
**功能**: 展示方法的层级结构
**数据需求**: methods数组，包含parentId/children/depth

### 3. Time Evolution (问题时间演化)
**组件**: `TimelineView.tsx`
**功能**: 按时间展示问题发展
**关键配置**:
```javascript
const minYear = 2015, maxYear = 2026
const LANE_H = 160, YEAR_W = 140
```
**数据需求**: problems含year/branchId/status/valueScore

### 4. Method Evolution (方法时间演化)
**组件**: `MethodTimelineView.tsx`
**功能**: 按时间展示方法发展
**节点形状**: 菱形 (与问题圆形区分)
**数据需求**: methods含year/branchId/status

### 5. Dual Tree Fusion (双树融合)
**组件**: `DualTreeView.tsx`
**功能**: 左右分屏显示问题树和方法树
**特点**: 显示问题-方法连接关系

### 6. Problem Evolution Network (问题演化网络)
**组件**: `ProblemEvolutionView.tsx`
**功能**: ReactFlow网络图展示问题-方法-论文关系
**布局**: 按领域泳道，时间横向排列

### 7. Paper Timeline (论文时间线)
**组件**: `PaperTimelineView.tsx`
**功能**: 展示论文发布时间分布
**节点**: 圆点大小表示authorityScore
**数据需求**: papers含year/category/authorityScore

### 8. Citation Network (引用网络)
**组件**: `CitationView.tsx`
**功能**: 展示论文引用关系
**边颜色**: 
- 蓝色 = 跨领域引用
- 灰色 = 同领域引用
**默认显示**: 所有引用边

### 9. Node Detail Panel (节点详情页)
**组件**: `NodeDetailPanel.tsx`
**触发**: 点击问题/方法节点
**内容**:
- 节点定义和边界
- 状态、年份、领域
- 瓶颈分析
- 相关方法/问题
- 相关论文列表
- 父子层级关系

## 数据字段映射

### TimelineView 必需字段
| 字段 | 类型 | 说明 |
|------|------|------|
| year | number | 节点年份 |
| status | string | 状态颜色 |
| branchId | string | 所属泳道 |
| valueScore | number | 节点大小 |

### CitationView 必需字段
| 字段 | 类型 | 说明 |
|------|------|------|
| category | string | 领域分组 |
| citations | string[] | 引用论文ID |
| authorityScore | number | 节点大小 |

### NodeDetailPanel 必需字段
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 显示名称 |
| description | string | 详细描述 |
| status | string | 状态标签 |
| year | number | 年份 |
| parentId | string | 父节点 |
| children | string[] | 子节点 |

## 布局算法

### 网格布局 (避免重叠)
```javascript
const cols = Math.ceil(Math.sqrt(nodeCount))
const offsetX = (col - (cols - 1) / 2) * spacingX
const offsetY = (row - (rows - 1) / 2) * spacingY
```

### 泳道布局
```javascript
const getY = (domainIndex) => TOP + domainIndex * LANE_H + LANE_H / 2
const getX = (year) => LEFT + ((year - minYear) / yearRange) * totalWidth
```

## 样式规范

### 颜色系统
- 背景: `#09090b` (深色), `#ffffff` (浅色)
- 边框: `#27272a` (深色), `#e5e7eb` (浅色)
- 文字: `#e4e4e7` (主要), `#71717a` (次要)

### 节点大小
- 问题节点: 10-24px (基于valueScore)
- 方法节点: 固定14px菱形
- 论文节点: 9-22px (基于authorityScore)

### 字体大小
- 标题: 14-16px
- 节点文字: 9-11px
- 提示框: 10-12px
- 标签: 10px

## 交互规范

### 点击行为
- 单击节点: 选中 + 显示详情页
- 双击节点: 展开/折叠子节点
- 点击空白: 取消选中

### Hover效果
- 节点放大: scale 1.1
- 高亮边框: 白色2px
- 显示Tooltip: 节点名称 + 年份

### 键盘快捷键
- ESC: 关闭详情页/面板
- Ctrl+Z: 撤销
- Ctrl+Y: 重做
- Ctrl+B: 显示书签

## 性能优化

### 大数据量处理
- 使用`useMemo`缓存计算结果
- 节点超过100时启用虚拟化
- 边线使用`useMemo`计算

### 渲染优化
- 节点使用`transform`而非`left/top`
- 减少不必要的重绘
- 使用`will-change`提示浏览器

## 调试技巧

### 检查数据完整性
```javascript
// 检查问题节点字段
problems.forEach(p => {
  if (!p.year || !p.status || !p.depth) {
    console.warn('Missing fields:', p.id)
  }
})
```

### 检查视图渲染
```javascript
// 检查节点位置
console.log('Node positions:', nodePositions)

// 检查边连接
console.log('Edges:', edges.length, edges)
```

### 常见错误
1. **TypeError: Cannot read property 'x' of undefined**
   - 原因: nodePositions缺少该节点
   - 解决: 检查节点ID是否正确

2. **节点不显示**
   - 原因: 缺少year/branchId
   - 解决: 补全数据字段

3. **边线不显示**
   - 原因: source/target节点不存在
   - 解决: 检查引用关系

## 扩展指南

### 添加新视图
1. 创建组件文件 `src/components/NewView.tsx`
2. 在 `App.tsx` 导入组件
3. 添加到 `NAV_ITEMS` 导航
4. 在 `renderActiveView` 添加case

### 添加新数据字段
1. 更新数据文件
2. 更新TypeScript接口
3. 在组件中使用新字段
4. 更新NodeDetailPanel显示

### 自定义主题
1. 修改 `CAT_COLORS` 领域颜色
2. 修改 `STATUS_COLORS` 状态颜色
3. 更新CSS变量

## 参考资源

- 主数据: `src/data/real_papers.json`
- 类型定义: `src/store/appStore.ts`
- 样式配置: `tailwind.config.js`
