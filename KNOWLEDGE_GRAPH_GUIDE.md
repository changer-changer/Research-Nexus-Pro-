# Research Nexus Pro - 知识图谱构建指南

## 项目概述

Research Nexus Pro 是一个视触觉机器人操作领域的研究知识图谱可视化系统。

## 核心数据结构

### 1. 问题节点 (Problem)
```typescript
interface Problem {
  id: string           // 唯一标识，如 "p_diffusion_policy_l2_1"
  name: string         // 显示名称
  year: number         // 出现年份
  status: 'solved' | 'partial' | 'active' | 'unsolved'
  parentId?: string    // 父节点ID
  children: string[]   // 子节点ID列表
  depth: number        // 层级 0-3
  branchId: string     // 所属分支，如 "b_diffusion"
  valueScore: number   // 研究价值 0-10
  unsolvedLevel: number // 未解决程度 0-5
  description: string  // 描述
  papers: string[]     // 相关论文ID
  methods: string[]    // 相关方法ID
}
```

### 2. 方法节点 (Method)
```typescript
interface Method {
  id: string
  name: string
  year: number
  status: 'verified' | 'partial' | 'untested' | 'failed'
  parentId?: string
  children: string[]
  depth: number
  branchId: string
  targets: string[]    // 能解决哪些问题
  crossDomain: string[] // 跨领域应用
  description: string
}
```

### 3. 论文 (Paper)
```typescript
interface Paper {
  id: string
  title: string
  year: number
  venue: string
  arxivId?: string
  category: string     // 所属类别
  methodology: string  // 方法论
  authorityScore: number // 权威分数
  targets: string[]    // 研究的问题
  methods: string[]    // 使用的方法
  citations: string[]  // 引用论文
  isLatest?: boolean
  isBest?: boolean
}
```

## 4层树状结构

```
L0 (根)
└── 视触觉机器人操作核心挑战

L1 (领域)
├── 扩散策略学习 (2024-2025)
├── VLA与触觉增强 (2025)
├── 触觉表征学习 (2020-2025)
├── 触觉传感器硬件 (2020-2025)
├── Sim-to-Real迁移 (2021)
└── 力觉控制 (2025)

L2 (具体问题/方法)
├── 3D扩散策略推理速度难以满足实时控制
├── VLA模型缺乏触觉感知能力
└── ...

L3 (技术挑战/子方法)
├── 点云条件扩散计算开销大
├── 迭代去噪步数过多导致延迟
└── ...
```

## 数据收集要点

### 1. 论文分析流程

使用 `paper-reader-plus` 工具分析每篇论文：

```bash
python3 ~/.openclaw/skills/paper-reader-plus/read_paper_plus.py paper.pdf
```

生成文件：
- `output/{arxiv_id}_analysis.md` - 结构化分析
- `output/{arxiv_id}_text.txt` - 全文提取

### 2. 提取知识图谱数据

从分析文件中提取：
- **问题节点**: 研究问题、科学问题、技术挑战
- **方法节点**: 核心方法、子方法、具体技术
- **关系**: 方法→问题映射

### 3. 数据字段补全

必须确保所有节点有完整字段：
- 问题: year, status, depth, branchId, valueScore, unsolvedLevel
- 方法: year, status, depth, branchId, targets
- 论文: title, venue, category, methodology, authorityScore

## 可视化视图配置

### 时间轴范围
- TimelineView: 2015-2026
- MethodTimelineView: 2019-2026
- PaperTimelineView: 2019-2026

### 节点间距
- 网格布局: 水平50px, 垂直40px
- 泳道高度: 160px
- 年份宽度: 140px

### 颜色编码
- 问题状态: solved(绿), partial(黄), active(蓝), unsolved(红)
- 方法状态: verified(绿), partial(黄), untested(蓝), failed(红)
- 领域颜色: VLA(蓝), Diffusion(绿), Tactile(橙), Hardware(红)

## 常见问题与解决

### 1. Timeline节点重叠
**原因**: 同一年份同领域多个节点
**解决**: 使用网格布局，自动分散排列

### 2. 年份显示错误
**原因**: 节点year字段与论文实际年份不符
**解决**: 根据论文年份分布重新分配节点年份

### 3. 视图空白/报错
**原因**: 缺少必要字段如status/depth
**解决**: 补全所有字段后再构建

### 4. Citation网络无边
**原因**: 默认只显示选中节点的边
**解决**: 修改为默认显示所有边

## 快速检查清单

- [ ] 所有节点有year字段
- [ ] 所有节点有status字段
- [ ] 所有节点有depth字段
- [ ] 问题节点有valueScore和unsolvedLevel
- [ ] 方法节点有targets
- [ ] 年份范围覆盖所有论文
- [ ] 节点在视图中不重叠
- [ ] 所有引用关系正确建立

## 相关文件位置

- 主数据: `research-nexus-pro/src/data/real_papers.json`
- 论文分析: `科研内容/论文收集/output/`
- 组件代码: `research-nexus-pro/src/components/`
- 构建输出: `research-nexus-pro/dist/`

## 部署命令

```bash
cd research-nexus-pro
npm run build
cd /tmp/final-push
cp -r research-nexus-pro/dist/* .
git add -A
git commit -m "update"
git push origin main
```
