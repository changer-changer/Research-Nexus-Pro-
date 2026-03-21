# Research Nexus Pro - Agent 操作指南

> **核心目标**：让 Agent 理解如何正确分析论文、提取知识、构建关系网络，并将数据按正确格式输出到可视化系统。

---

## 🎯 Agent 职责

作为 Agent，你的核心任务是：

1. **论文收集与筛选** - 找到相关的高质量论文
2. **深度分析** - 提取论文的研究问题、方法、贡献
3. **关系构建** - 建立问题↔方法、论文↔问题、方法↔方法的关系
4. **数据格式化** - 按标准格式输出到 `real_papers.json`

---

## 📊 数据模型详解

### 1. 问题节点 (Problem)

```typescript
interface Problem {
  id: string              // 格式: "p_{branch}_{level}_{index}"
  name: string            // 人类可读的问题名称
  year: number           // 问题首次出现的年份
  status: 'solved' | 'partial' | 'active' | 'unsolved'
  parentId?: string      // 父节点ID (L0除外)
  children: string[]     // 子节点ID列表
  depth: number          // 层级 0-3
  branchId: string       // 所属分支: "b_vla" | "b_diffusion" | ...
  valueScore: number     // 研究价值 0-10
  unsolvedLevel: number  // 未解决程度 0-5
  description: string    // 问题描述
  papers: string[]       // 解决该问题的论文ID
  methods: string[]      // 解决该问题的方法ID
}
```

**ID命名规范**：
- L0: `p_root`
- L1: `p_vla`, `p_diffusion`, `p_tactile` (分支名)
- L2: `p_vla_l2_1`, `p_diffusion_l2_3`
- L3: `p_vla_l3_1`, `p_diffusion_l3_5`

**状态定义**：
- `solved`: 已有效解决
- `partial`: 部分解决，仍有挑战
- `active`: 当前研究热点
- `unsolved`: 尚未解决

### 2. 方法节点 (Method)

```typescript
interface Method {
  id: string              // 格式: "m_{branch}_{level}_{index}"
  name: string            // 方法名称
  year: number           // 方法首次提出的年份
  status: 'verified' | 'partial' | 'untested' | 'failed'
  parentId?: string      // 父节点ID
  children: string[]     // 子节点ID列表
  depth: number          // 层级 0-3
  branchId: string       // 所属分支
  targets: string[]      // 能解决哪些问题ID
  crossDomain: string[]  // 跨领域应用的分支ID
  description: string    // 方法描述
}
```

**状态定义**：
- `verified`: 已在多个场景验证有效
- `partial`: 部分场景有效
- `untested`: 尚未充分验证
- `failed`: 已被证明效果不佳

### 3. 论文 (Paper)

```typescript
interface Paper {
  id: string              // 格式: "paper_{arxiv_id}"
  title: string           // 论文标题
  year: number           // 发表年份
  venue: string          // 会议/期刊
  arxivId?: string       // arXiv ID
  category: string       // 领域分类
  methodology: string    // 方法论简述
  authorityScore: number // 权威分数 0-10
  targets: string[]      // 研究的问题ID
  methods: string[]      // 使用的方法ID
  citations: string[]    // 引用的论文ID
  isLatest?: boolean     // 是否最新(2025+)
  isBest?: boolean       // 是否高影响力
}
```

---

## 🔧 标准工作流程

### Step 1: 论文收集

使用 `literature-search` skill 搜索相关论文：

```bash
# 搜索特定领域的论文
literature-search "visuo-tactile manipulation" --limit 20

# 搜索特定方法
literature-search "diffusion policy robot manipulation" --limit 15
```

**筛选标准**：
- 发表年份 >= 2020 (除非是奠基性工作)
- 来自顶级会议/期刊 (CoRL, ICRA, IROS, RSS, NeurIPS, ICML)
- 与视触觉操作强相关

### Step 2: 论文分析

使用 `paper-reader-plus` 进行深度分析：

```bash
python3 ~/.openclaw/skills/paper-reader-plus/read_paper_plus.py paper.pdf
```

**必须提取的信息**：
- 研究问题（明确、具体）
- 核心方法（技术细节）
- 方法能解决的问题
- 与现有工作的关系
- 局限性和未来方向

### Step 3: 知识提取

从分析结果中提取结构化信息：

```javascript
// 示例提取结果
{
  paper: {
    id: "paper_2503.02881",
    title: "Tactile-Augmented Radiance Fields",
    year: 2025,
    venue: "arXiv",
    arxivId: "2503.02881",
    category: "Tactile",
    methodology: "NeRF + Tactile Fusion",
    authorityScore: 7.5,
    targets: ["p_tactile_repr_l2_1", "p_fusion_arch_l3_2"],
    methods: ["m_tactile_vla_l3_1"],
    citations: ["paper_2403.03954", "paper_2303.12076"]
  },
  problems: [
    {
      id: "p_tactile_repr_l2_1",
      name: "高维触觉信号难以有效表征",
      year: 2025,
      status: "active",
      depth: 2,
      branchId: "b_tactile",
      valueScore: 8,
      unsolvedLevel: 3
    }
  ],
  methods: [
    {
      id: "m_tactile_vla_l3_1", 
      name: "触觉增强的NeRF表征",
      year: 2025,
      status: "untested",
      depth: 3,
      branchId: "b_tactile",
      targets: ["p_tactile_repr_l2_1"]
    }
  ]
}
```

### Step 4: 关系构建

**关键关系类型**：

1. **问题层级** (parent-child)
   - L0 → L1 → L2 → L3
   - 例如：`p_root` → `p_vla` → `p_vla_l2_1` → `p_vla_l3_1`

2. **方法层级** (parent-child)
   - 抽象方法 → 具体实现
   - 例如：`m_diffusion` → `m_dp_3d` → `m_dp3_enc`

3. **问题-方法映射** (targets)
   - 方法能解决哪些问题
   - 存储在 `method.targets` 中

4. **论文-问题映射** (targets)
   - 论文研究哪些问题
   - 存储在 `paper.targets` 中

5. **论文-方法映射** (methods)
   - 论文使用哪些方法
   - 存储在 `paper.methods` 中

6. **引用关系** (citations)
   - 论文引用哪些论文
   - 存储在 `paper.citations` 中

### Step 5: 数据验证

**必须检查的项目**：

```javascript
// 1. 所有节点有完整字段
problems.forEach(p => {
  assert(p.id && p.name && p.year && p.status && p.depth !== undefined)
  assert(p.branchId && p.valueScore !== undefined && p.unsolvedLevel !== undefined)
})

// 2. 层级关系正确
problems.forEach(p => {
  if (p.depth > 0) assert(p.parentId)
  if (p.parentId) {
    const parent = problems.find(x => x.id === p.parentId)
    assert(parent.depth === p.depth - 1)
  }
})

// 3. 年份在合理范围
papers.forEach(p => assert(p.year >= 2019 && p.year <= 2026))

// 4. 引用关系存在
papers.forEach(p => {
  p.citations?.forEach(citeId => {
    assert(papers.some(x => x.id === citeId), `Missing citation: ${citeId}`)
  })
})
```

### Step 6: 数据输出

输出到 `research-nexus-pro/src/data/real_papers.json`：

```json
{
  "branches": [...],
  "problems": [...],
  "methods": [...],
  "papers": [...]
}
```

---

## ⚠️ 常见错误与避免方法

### ❌ 错误1: 问题描述笼统
**错误**: "触觉表征困难"
**正确**: "高维触觉信号(32768维)难以压缩到有效的低维表征空间，同时保留足够的接触几何信息"

### ❌ 错误2: 节点缺少必要字段
**错误**: 忘记设置 `valueScore` 或 `unsolvedLevel`
**后果**: Timeline 视图无法正常显示

### ❌ 错误3: 年份与论文不符
**错误**: 所有问题节点使用相同年份
**正确**: 根据论文实际发表年份分配

### ❌ 错误4: 引用关系指向不存在的论文
**错误**: `paper.citations` 包含未收录的论文
**正确**: 只引用知识图谱中存在的论文

### ❌ 错误5: 层级跳跃
**错误**: L1 节点直接连接到 L3 节点
**正确**: 必须通过 L2 节点

### ❌ 错误6: 重复ID
**错误**: 两个节点使用相同ID
**后果**: 数据覆盖，视图显示错误

---

## 📝 问题描述最佳实践

### 格式模板

```
[问题主体] + [具体挑战] + [技术细节]

示例：
✓ "扩散策略在3D点云条件下的推理速度难以满足实时控制要求(>30Hz)"
✓ "重训练触觉融合编码器导致视觉-触觉联合表征的计算开销过大"
✗ "触觉融合很难"
```

### 分类标准

**L1 (领域级)**: 宽泛但具体的领域问题
- "扩散策略学习中的实时性挑战"
- "VLA模型的触觉感知增强"

**L2 (问题级)**: 具体的技术问题
- "3D扩散策略推理速度难以满足实时控制"
- "VLA模型缺乏触觉反馈融合机制"

**L3 (挑战级)**: 具体的技术挑战
- "点云条件扩散计算开销大"
- "迭代去噪步数过多导致延迟"

---

## 🔍 调试技巧

### 检查数据完整性

```bash
# 统计节点数量
cat real_papers.json | jq '.problems | length'
cat real_papers.json | jq '.methods | length'  
cat real_papers.json | jq '.papers | length'

# 检查孤立节点
cat real_papers.json | jq '.problems[] | select(.parentId == null and .depth != 0)'

# 检查缺失字段
cat real_papers.json | jq '.problems[] | select(.year == null or .status == null)'
```

### 视图调试

如果某个视图显示异常：

1. **Timeline 节点重叠** → 检查 `year` 和 `branchId` 字段
2. **Citation 无边** → 检查 `citations` 数组
3. **Tree 不显示** → 检查 `parentId` 和 `children` 字段
4. **详情页空白** → 检查 `description` 和 `papers` 字段

---

## 🚀 快速检查清单

在提交数据前，确认以下项目：

- [ ] 所有问题节点有 `year`, `status`, `depth`, `branchId`
- [ ] 所有问题节点有 `valueScore` 和 `unsolvedLevel`
- [ ] 所有方法节点有 `year`, `status`, `depth`, `branchId`, `targets`
- [ ] 所有论文有 `title`, `year`, `category`, `methodology`
- [ ] 年份范围覆盖 2019-2026
- [ ] 引用关系指向的论文都存在
- [ ] 没有重复的节点ID
- [ ] 层级关系正确（L0→L1→L2→L3）
- [ ] 问题描述具体、不笼统

---

## 📚 参考文档

- **数据格式规范**: `DATA_SCHEMA.md`
- **可视化配置**: `VISUALIZATION_GUIDE.md`
- **论文分析模板**: `ANALYSIS_TEMPLATE.md`

---

*Last updated: 2026-03-21*
