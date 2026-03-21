# Research Nexus Pro - 用户手册（人类版）

## 📖 系统概述

Research Nexus Pro 是一个**视触觉机器人操作领域**的研究知识图谱可视化系统。它将复杂的学术文献转化为直观的交互式可视化网络，帮助研究者快速理解领域发展脉络、技术演进路径和研究热点。

### 🎯 核心功能

1. **知识图谱可视化** - 将论文、问题、方法组织成4层树状结构
2. **时间演化追踪** - 按时间展示问题和方法的发展轨迹
3. **引用关系网络** - 可视化论文间的引用关系
4. **交互式探索** - 点击节点查看详细信息，支持多维度跳转

---

## 🚀 快速开始

### 访问方式
打开浏览器访问：`http://localhost:3000`

### 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]                    [Main Viewport]               │
│  ┌─────────┐  ┌──────────────────────────────────────────┐ │
│  │ Logo    │  │                                          │ │
│  ├─────────┤  │         Visualization Area               │ │
│  │Problem  │  │                                          │ │
│  │ Methods │  │    (Tree / Timeline / Network)          │ │
│  │ Papers  │  │                                          │ │
│  ├─────────┤  └──────────────────────────────────────────┘ │
│  │ Tools   │              [Detail Panel] (右侧滑出)        │
│  └─────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 视图详解

### 1. Problem Tree（问题树）
**功能**：展示研究问题的层级结构

**操作**：
- 单击节点：选中并查看详情
- 双击节点：展开/折叠子节点
- 滚轮：缩放
- 拖拽：平移画布

**视觉编码**：
- 节点颜色：状态（绿=已解决、黄=部分解决、蓝=进行中、红=未解决）
- 节点大小：研究价值分数
- 连接线：父子层级关系

### 2. Method Tree（方法树）
**功能**：展示研究方法的层级结构

**视觉编码**：
- 节点颜色：验证状态（绿=已验证、黄=部分验证、蓝=未测试、灰=失败）
- 其他同Problem Tree

### 3. Time Evolution（时间演化）
**功能**：按年份展示问题/方法的发展

**布局**：
- 横向：时间轴（2019-2026）
- 纵向：领域分类（泳道）

**操作**：
- 悬停节点：显示问题/方法名称
- 点击节点：查看详情

### 4. Paper Timeline（论文时间线）
**功能**：展示论文发表时间分布

**视觉编码**：
- 节点位置：发表年份 + 领域分类
- 节点大小：权威分数（authorityScore）
- 紫色星标：Best论文
- 橙色标记：Latest论文（2025+）

**操作**：
- 点击论文节点：右侧滑出论文详情页
- 论文详情页可跳转到相关问题/方法

### 5. Citation Network（引用网络）
**功能**：展示论文间的引用关系

**视觉编码**：
- 节点：论文（按领域着色）
- 蓝色边：跨领域引用
- 灰色边：同领域引用
- 边箭头：引用方向

**交互**：
- 点击论文：高亮显示该论文的引用关系

### 6. Dual Tree Fusion（双树融合）
**功能**：左右分屏显示问题树和方法树

**特点**：
- 显示问题 ↔ 方法的关联关系
- 便于理解问题-方法映射

---

## 🎨 界面操作

### 侧边栏导航
| 图标 | 名称 | 功能 |
|------|------|------|
| 🌳 | Problem Tree | 问题树视图 |
| ⏱️ | Time Evolution | 问题时间演化 |
| → | Method → Problem | 方法到问题映射 |
| 🎯 | Method Tree | 方法树视图 |
| ⏱️ | Method Evolution | 方法时间演化 |
| 🔀 | Dual Tree Fusion | 双树融合视图 |
| 📄 | Paper Timeline | 论文时间线 |
| 🕸️ | Citation Network | 引用网络 |

### 工具栏
- 🌙/☀️ **Dark/Light Mode**：切换深色/浅色主题
- 💾 **Export**：导出当前视图为图片
- ▶️ **Present**：进入演示模式
- 🔖 **Bookmarks**：查看书签
- ↩️ **Undo/Redo**：撤销/重做

### 详情面板
点击任意节点（问题/方法/论文），右侧会滑出详情面板：

**问题详情**：
- 定义和边界
- 当前状态
- 瓶颈分析
- 解决方案方法列表
- 相关论文列表

**方法详情**：
- 方法描述
- 验证状态
- 目标问题列表
- 相关论文列表

**论文详情**：
- 标题、年份、venue
- arXiv链接
- 研究类别、方法论
- 权威分数
- 解决的问题（可点击跳转）
- 使用的方法（可点击跳转）
- 引用数量

---

## 🛠️ 配套 Skill 体系

Research Nexus Pro 是一个完整的 Agent-Native 系统，需要配合以下 Skills 使用：

### 核心 Skills

| Skill | 用途 | 位置 |
|-------|------|------|
| `paper-reader-plus` | 论文全文分析、提取结构化信息 | `~/.openclaw/skills/paper-reader-plus/` |
| `academic-deep-research` | 深度文献调研、学术搜索 | `~/.openclaw/skills/academic-deep-research/` |
| `literature-search` | 学术搜索引擎聚合 | `~/.openclaw/skills/literature-search/` |

### Agent 工作流

```
1. 文献收集 (literature-search)
   ↓
2. 论文分析 (paper-reader-plus)
   ↓
3. 知识提取 (Agent分析)
   ↓
4. 数据构建 (生成real_papers.json)
   ↓
5. 可视化展示 (Research Nexus Pro)
```

---

## 📁 项目结构

```
research-nexus-pro/
├── src/
│   ├── components/          # 可视化组件
│   │   ├── ProblemTree.tsx
│   │   ├── MethodTree.tsx
│   │   ├── TimelineView.tsx
│   │   ├── PaperTimelineView.tsx
│   │   ├── CitationView.tsx
│   │   ├── NodeDetailPanel.tsx     # 问题/方法详情
│   │   └── PaperDetailPanel.tsx    # 论文详情
│   ├── store/
│   │   └── appStore.ts      # 状态管理
│   ├── data/
│   │   └── real_papers.json # 知识图谱数据
│   └── App.tsx
├── dist/                    # 构建输出
└── package.json
```

---

## 🔧 常见问题

### Q: 如何添加新论文？
A: 使用 `paper-reader-plus` 分析PDF → 提取信息 → 更新 `real_papers.json` → 重新构建

### Q: 如何修改节点颜色？
A: 编辑各组件中的 `CAT_COLORS` 或 `STATUS_COLORS` 常量

### Q: 数据更新后如何部署？
```bash
cd research-nexus-pro
npm run build
git add -A
git commit -m "update data"
git push
```

### Q: 支持哪些浏览器？
A: Chrome, Firefox, Safari, Edge (最新版本)

---

## 📚 相关文档

- **开发文档**: `DEVELOPER_GUIDE.md`
- **Agent指南**: `AGENT_GUIDE.md`
- **API参考**: `API_REFERENCE.md`

---

*Last updated: 2026-03-21*
