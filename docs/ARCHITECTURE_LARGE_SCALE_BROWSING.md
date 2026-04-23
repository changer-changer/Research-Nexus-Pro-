# Research-Nexus-Pro 大规模数据浏览架构设计文档

**版本**: v1.0  
**日期**: 2026-04-13  
**目标**: 为系统从当前 ~200 篇论文规模扩展至数千~数万篇论文提供可落地的浏览与加载架构方案。

---

## 1. 核心设计原则

| 原则 | 说明 |
|------|------|
| **分层浏览** | 用户不应一次性面对全部节点，而是通过领域 → 子领域 → 聚类 → 单篇的层级逐步深入 |
| **按需加载** | 仅加载视口内/当前上下文需要的数据，避免一次性拉取完整图谱 |
| **搜索优先** | 当数据规模超过人类可手动浏览的阈值时，搜索成为主要发现入口 |
| **渐进降级** | 在极端规模下，复杂可视化（如全局 ReactFlow）应有降级策略 |
| **预计算加速** | 聚类、布局、统计指标等通过离线/后台任务预计算，避免实时计算 |

---

## 2. 当前状态与瓶颈分析

### 2.1 当前规模（2026-04-13）
- 论文: ~200 篇
- Problem: 155
- Method: 250
- Relation: 316
- Innovation Opportunity: 163

### 2.2 已确认的瓶颈
| 视图 | 当前问题 | 规模放大后的风险 |
|------|----------|------------------|
| Problem Tree | 400+ 节点 + 300+ 边同时渲染 | 5,000 节点时浏览器直接卡死 |
| Method Tree | 同理 | 同理 |
| Method→Problem | 边数量随方法×问题指数增长 | O(M×P) 复杂度不可持续 |
| Innovation Board | 已修复分页（12/页） | 搜索仍需全量过滤，后端需支持 |
| Domain Map | 一次性加载全部 problems/methods/relations | 需改为层级切片 |
| 论文时间线 | 全部论文平铺 | 需按领域/年份聚合 |

### 2.3 临界点估算
| 视图 | 安全上限 | 临界点 | 应对策略 |
|------|----------|--------|----------|
| ReactFlow 全量渲染 | ~500 节点 | 1,000 节点 | 按需渲染 + 聚类聚合 + 层级展开 |
| DOM 列表平铺 | ~500 条 | 2,000 条 | 虚拟滚动 + 分页 |
| 一次性 JSON 响应 | ~5 MB | 10 MB | 分页/流式/GraphQL 按需字段 |
| SQLite 全表扫描 | ~10,000 行 | 100,000 行 | 索引 + 预计算表 + 搜索索引 |

---

## 3. 层级浏览范式（Hierarchical Browsing）

### 3.1 信息架构层级

```
Level 0: Domain（领域）
    └─ e.g. "Embodied AI", "Multi-Agent Systems", "Tactile Learning"

Level 1: Sub-domain（子领域）
    └─ e.g. "Vision-Language-Action Models", "Dexterous Manipulation"

Level 2: Research Cluster（研究聚类）
    └─ 由算法自动生成的语义聚类，如 "Diffusion Policy for Robotics"

Level 3: Canonical Node（规范节点）
    └─ Problem / Method / Paper 实体

Level 4: Detail View（详情视图）
    └─ 单篇论文、单个问题/方法的完整信息
```

### 3.2 入口重新设计：Global Overview

新增 **「全景概览」** 视图作为默认 landing page，替代当前直接显示全量图谱：

- **左侧**: 领域导航树（Domain / Sub-domain）
- **中央**: 2D 语义投影地图（UMAP/TSNE，可交互）
- **右侧**: 热点聚类榜单 + 搜索框
- **底部**: 快速跳转至时间线、创新画板、引用网络

用户行为路径：
1. 搜索 → 直达结果
2. 点击领域 → 进入该领域的过滤视图
3. 点击聚类 → 进入聚类内的节点子图
4. 点击节点 → 详情面板

---

## 4. 渐进式加载策略

### 4.1 后端 API 改造

#### 4.1.1 分页标准化
所有列表型接口统一支持：
```
GET /api/v3/papers?page=1&page_size=20&domain=embodied-ai&sort=citation_count
GET /api/v3/problems?page=1&page_size=50&subdomain=vla
GET /api/v3/methods?cursor=xxx&limit=50
```

#### 4.1.2 按需字段（Field Selection）
卡片预览只需 `id`, `title`, `year`, `authors[0]`, `abstract_snippet`；详情页再拉取完整字段。
```json
{
  "fields": ["id", "title", "year", "authors", "abstract_snippet"]
}
```

#### 4.1.3 子图切片 API
为 ReactFlow 视图提供「以某节点为中心、深度为 N 的子图」接口：
```
GET /api/v3/subgraph?center_id=prob_xxx&depth=2&relation_types=ADDRESSES_PROBLEM
```
返回该节点周围 50~100 个节点即可，避免全量加载。

### 4.2 前端加载策略

| 视图 | 加载策略 | 实现方式 |
|------|----------|----------|
| 论文列表 | 虚拟滚动 + 分页 | `react-window` 或 `@tanstack/react-virtual` |
| 创新画板 | 分页（已完成）+ 后端过滤 | 搜索词传后端 `?q=keyword` |
| Problem Tree | 按需子树展开 | 初始只渲染根节点 + 直接子节点，双击展开 |
| Method Tree | 按需子树展开 | 同上 |
| Method→Problem | 以方法为入口，延迟加载其 target problems | 点击方法节点后再拉取关联边 |
| 双树融合 | 仅渲染当前聚焦区域的节点 | 视口裁剪 + LOD（Level of Detail）|
| 时间线 | 按年份聚合 | 默认显示年度统计，展开后显示该年论文 |

### 4.3 数据预取与缓存

- **Zustand Store 分层缓存**:
  - `L1`: 当前视口数据（内存，随视图切换清理）
  - `L2`: 最近浏览的领域/聚类数据（localStorage，TTL 1 小时）
  - `L3`: 完整元数据索引（IndexedDB，存储论文标题/作者/年份的轻量索引，支持离线搜索）

---

## 5. 聚类与降维导航

### 5.1 语义聚类（Research Cluster）

**目标**: 自动将数千篇论文/问题/方法聚合成人类可理解的「研究主题」。

**算法选型**:
- **Embedding**: 使用预训练的 SPECTER2 或 OpenAI `text-embedding-3-large` 生成论文/问题/方法的向量
- **降维**: UMAP（保留局部结构，适合可视化）或 t-SNE
- **聚类**: HDBSCAN（无需预设聚类数，可处理噪声）

**后端实现**:
1. 后台 Celery/APScheduler 任务：每天晚上对新增论文重新计算 embedding
2. 聚类结果写入 `clusters` 表，包含：`cluster_id`, `label`（LLM 自动命名）, `centroid`, `member_ids`, `domain_tags`
3. API 暴露：`GET /api/v3/clusters?domain=xxx&limit=20`

**前端呈现**:
- **Cluster Bubble Map**: 2D 散点图，每个气泡是一个聚类，大小=论文数，颜色=领域
- **Cluster Sidebar**: 点击气泡后显示该聚类内的热点问题、核心方法、代表性论文

### 5.2 2D 语义投影地图

新增 **「Knowledge Landscape」** 视图：
- X/Y 轴无具体语义，由 UMAP 自动学习
- 每个点是一篇论文/问题/方法
- 相同颜色 = 同一聚类
- 支持框选放大、悬浮预览、点击进入详情

**性能保障**:
- 使用 `deck.gl` 或 `regl` 进行 GPU 加速渲染，可流畅显示 10,000+ 点
- 超过 10,000 点时，显示聚类中心点而非单篇论文点

---

## 6. 搜索驱动的发现模式

### 6.1 Faceted Search（分面搜索）

搜索栏支持以下过滤维度：
- **时间范围**: 年份 slider
- **领域**: 多选 Domain / Sub-domain
- **聚类**: 多选 Research Cluster
- **实体类型**: Papers / Problems / Methods / All
- **排序**: Relevance / Citation Count / Year / Novelty Score

### 6.2 自动补全与建议

- 基于 Elasticsearch / Meilisearch / SQLite FTS5 实现快速前缀匹配
- 建议类型：论文标题、作者名、问题关键词、方法名
- 延迟 < 100ms（通过 IndexedDB 本地索引缓存热词）

### 6.3 自然语言查询（未来扩展）

- 支持类似："Find methods that solve dexterous manipulation published after 2024"
- 后端通过 LLM 将自然语言转换为结构化查询（Text2SQL/Text2Filter）

---

## 7. 各视图在大规模下的性能边界与降级方案

### 7.1 ReactFlow 视图族（Problem Tree / Method Tree / 双树融合）

| 规模 | 策略 |
|------|------|
| < 500 节点 | 全量渲染，保持现有交互 |
| 500 ~ 2,000 节点 | 按需渲染 `onlyRenderVisibleElements` + 聚合卫星节点 |
| 2,000 ~ 10,000 节点 | 强制进入「聚类模式」，每个节点代表一个 cluster，双击展开 |
| > 10,000 节点 | 禁用 ReactFlow，改用 2D Landscape 或列表视图 |

### 7.2 时间线视图

| 规模 | 策略 |
|------|------|
| < 500 篇 | 按论文平铺 |
| 500 ~ 3,000 篇 | 按年份折叠，展开后显示该年论文 |
| > 3,000 篇 | 按年份+领域双重聚合，显示热力图 |

### 7.3 引文网络

| 规模 | 策略 |
|------|------|
| < 1,000 节点 | 全量力导向图 |
| > 1,000 节点 | 仅显示高被引论文（Top 10%）的引文骨架网络 |

### 7.4 创新画板

- 已具备分页，可持续扩展
- 未来可改为「按聚类推荐」：每个聚类 Top-3 机会，避免 1,000+ 机会平铺

---

## 8. 数据层优化

### 8.1 SQLite 优化

当前 SQLite 在单表 10 万行以下表现良好，但需要做以下优化：

1. **全文搜索索引**:
   ```sql
   CREATE VIRTUAL TABLE paper_fts USING fts5(
     title, abstract, authors,
     content='papers',
     content_rowid='id'
   );
   ```

2. **预计算统计表**:
   ```sql
   CREATE TABLE stats_by_domain (
     domain TEXT,
     year INTEGER,
     paper_count INTEGER,
     citation_count INTEGER,
     top_cluster_id TEXT
   );
   ```

3. **分页索引**:
   - `papers(year, citation_count)`
   - `problems(domain_tag, year_identified)`
   - `relations(source_canonical_id, relation_type)`

### 8.2 Embedding 与向量存储

- **短期**: 使用 `sqlite-vec` 插件在 SQLite 中存储向量，支持余弦相似度搜索
- **中期**（> 5,000 篇）: 引入轻量级向量数据库如 Chroma 或 LanceDB
- **预计算流水线**: 后台任务每天更新新增论文的 embedding 和聚类归属

---

## 9. 实施路线图

### Phase 1: 基础设施（2 周）
- [ ] 后端所有列表接口添加分页 + 排序
- [ ] SQLite 添加 FTS5 全文搜索索引
- [ ] 前端引入虚拟滚动组件
- [ ] Zustand 缓存分层设计实现

### Phase 2: 搜索与过滤（2 周）
- [ ] Faceted Search UI
- [ ] 自动补全组件
- [ ] 搜索词高亮与结果排序
- [ ] Innovation Board 后端过滤（当前是前端过滤全量数据）

### Phase 3: 层级浏览（3 周）
- [ ] Domain / Sub-domain 分类体系落地
- [ ] 新增 Global Overview 视图
- [ ] ReactFlow 视图改造为「按需子树展开」
- [ ] 子图切片 API 实现

### Phase 4: 聚类与可视化（3 周）
- [ ] Embedding 生成流水线
- [ ] HDBSCAN + UMAP 聚类计算
- [ ] Knowledge Landscape 2D 地图视图
- [ ] Cluster 推荐与导航

### Phase 5: 性能与扩展（持续）
- [ ] 加载时间监控
- [ ] 渐进降级自动化（根据数据量自动切换视图模式）
- [ ] IndexedDB 本地索引缓存
- [ ] 考虑后端分页游标（Cursor-based Pagination）

---

## 10. 与现有架构的对接

### 10.1 最小破坏性原则
- 现有视图（Problem Tree / Method Tree 等）保留，但增加「数据量超过阈值时自动提示切换视图」
- 新增视图作为可选入口，不强制替换现有工作流
- 后端 API 采用版本兼容策略：`/api/v3/...` 保持现有行为，`/api/v4/...` 引入新范式

### 10.2 需要新增的核心组件
| 组件 | 职责 |
|------|------|
| `GlobalOverview.tsx` | 新的默认入口视图 |
| `KnowledgeLandscape.tsx` | 2D UMAP 语义地图 |
| `FacetSearchPanel.tsx` | 分面搜索面板 |
| `VirtualPaperList.tsx` | 虚拟滚动论文列表 |
| `SubgraphLoader.ts` | 按需加载子图数据 |
| `EmbeddingPipeline.py` | 后台 embedding 计算 |
| `ClusterService.py` | 聚类计算与存储 |

---

## 11. 结论

Research-Nexus-Pro 当前的前端修复已完成，系统具备良好的扩展基础。要支撑数千~数万篇论文的规模，核心挑战不是单一技术点，而是**从「全量平铺」到「分层发现」的信息架构转型**。

本方案通过以下三条主线解决：
1. **搜索优先**（Faceted Search + 自动补全）
2. **层级浏览**（Domain → Cluster → Node 的渐进深入）
3. **按需渲染**（分页、虚拟滚动、子图切片、ReactFlow 降级）

建议从 **Phase 1（分页 + FTS5 + 虚拟滚动）** 开始落地，这是所有后续优化的基础设施。
