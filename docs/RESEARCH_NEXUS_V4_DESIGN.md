# Research-Nexus Pro v4: 统一科研发现操作系统设计白皮书

> **Research-Nexus Pro v4: Unified Scientific Discovery Operating System (RND-OS v4)**
> 
> *让知识可见，让创新可计算。*

---

## 目录

1. [设计哲学：科研知识的本质与创新产生的形而上学](#1-设计哲学科研知识的本质与创新产生的形而上学)
2. [系统架构总览：五层发现操作系统](#2-系统架构总览五层发现操作系统)
3. [多模态数据库架构：时空交错的混合智能存储](#3-多模态数据库架构时空交错的混合智能存储)
4. [RNOS v4 本体论设计：科研世界的原子与分子](#4-rnos-v4-本体论设计科研世界的原子与分子)
5. [知识抽取 Pipeline v4：从混沌 PDF 到结构化宇宙](#5-知识抽取-pipeline-v4从混沌-pdf-到结构化宇宙)
6. [创新发现引擎：六种创新生产范式](#6-创新发现引擎六种创新生产范式)
7. [AI Scientist Society：多智能体科研实验室](#7-ai-scientist-society多智能体科研实验室)
8. [GraphRAG 科学推理层：让大模型拥有科研记忆](#8-graphrag-科学推理层让大模型拥有科研记忆)
9. [前端交互架构：可对话的科研界面](#9-前端交互架构可对话的科研界面)
10. [实施路线图：从原型到操作系统](#10-实施路线图从原型到操作系统)

---

## 1. 设计哲学：科研知识的本质与创新产生的形而上学

### 1.1 科研知识的三种形态

在 Research-Nexus 的设计哲学中，任何科研知识在逻辑上都可以被分解为三种不可再约的本体形态：

1. **问题 (Problem)**：`世界是什么？` → 描述性知识，定义了现状与理想之间的差距。
2. **方法 (Method)**：`如何让世界变成应有的样子？` → 程序性知识，定义了从现状到理想的变换函数。
3. **条件 (Condition)**：`在什么前提下方法才能作用于问题？` → 规范性知识，包括假设 (Assumption)、约束 (Constraint)、限制 (Limitation) 和评价指标 (Metric)。

这三者构成了一个完整的「科研命题三元组」：**在条件 C 的约束下，使用方法 M 解决问题 P，期望达到指标 Metric**。任何论文、任何实验、任何学术主张，都可以被还原为这个三元组的某个子集或变体。

### 1.2 创新的结构洞理论 (Structural Holes)

根据社会学家 Ronald Burt 的结构洞理论，**创新并非凭空产生，而是产生于两个原本不相连的稠密网络之间的桥梁位置**。在科研领域中，这意味着：

- **跨域迁移**：A 领域的方法从未被应用到 B 领域的问题上。
- **组合创新**：方法 M1 和方法 M2 各自存在，但从未被系统性地组合以解决 P。
- **时序前沿**：问题 P 已被提出多年，但近期出现的新方法 M 可能彻底改变其可解性。
- **反事实假设**：如果移除某个被默认接受的方法假设，问题 P 是否有全新的解法？

Research-Nexus v4 的核心使命，就是通过计算手段自动发现这些「结构洞」，并评估其被填补后的预期价值。

### 1.3 证据本体论：从相信到确证

传统的文献综述依赖人的阅读和记忆，其脆弱性在于无法确证。v4 引入「证据层」(Evidence Layer) 作为整个系统的地基：

- 每一个 Problem、Method、Relation 都不是抽象的概念，而是由一组带有精确出处的 **PaperClaim** 支撑的。
- 每一个 Claim 都必须锚定到原始 PDF 的 **EvidenceSpan**（段落、句子、页码）。
- 系统必须能够回答：「你说方法 M 能解决问题 P，证据在哪里？请把原文高亮给我看。」

这种「可确证性」(Verifiability) 是 Research-Nexus 区别于简单的 LLM 聊天机器人的根本特征。

---

## 2. 系统架构总览：五层发现操作系统

Research-Nexus v4 不是简单的「图谱可视化工具」，而是一个 **发现操作系统 (Discovery Operating System)**。其架构从上到下分为五个功能层：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 5: Interaction & Cognition Layer（交互认知层）                        │
│  可对话界面 · 多视图图谱 · 实时协作 · 沉浸演示                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Discovery & Generation Layer（发现生成层）                         │
│  AI Scientist Society · 6种创新范式 · GraphRAG 推理 · 顶会提案生成           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Knowledge Graph Layer（知识图谱层）                                │
│  多模态 Graph DB · 向量 DB · 时序索引 · 本体推理引擎                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Extraction & Alignment Layer（抽取对齐层）                         │
│  多模态 PDF 解析 · 层次化 Claim 提取 · LLM Arbiter · 证据锚定               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Evidence & Ingestion Layer（证据摄入层）                           │
│  PDF/ArXiv/网页 采集 · 图表 OCR · 元数据标准化 · 版本控制                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 数据流：从混沌到创新

**主数据流 —— 「论文→知识→创新」流水线**：

1. **Ingest**（摄入）：PDF 进入系统，进行文本、图表、公式、参考文献的联合解析。
2. **Extract**（抽取）：LLM 以 Pydantic Schema 为指导，提取层次化的 `PaperClaim` 列表，每个 Claim 绑定 `EvidenceSpan`。
3. **Align**（对齐）：通过 `LocalEmbedder` + `VectorDB` + `LLM Arbiter` 三重机制，将局部 Claim 对齐到全局 Canonical Node（问题/方法），决定是否 MERGE（合并到现有概念）或 MINT（铸造新概念）。
4. **Graphify**（图化）：将对齐后的节点写入图数据库，建立类型化的关系边（SOLVES, ADDRESSES, SUB_TYPE_OF, IMPROVES_UPON, CONTRADICTS 等）。
5. **Discover**（发现）：创新引擎在图上运行六种发现算法，识别结构洞并生成 `InnovationOpportunity`。
6. **Generate**（生成）：AI Scientist Society 对高价值的 Innovation Opportunity 进行多轮辩论，最终输出顶会级别的 `InnovationInsightDTO`。

### 2.2 反馈环：从创新回推知识

发现层生成的洞察不仅仅是输出，还会反向丰富知识图谱：

- 新提出的「假设实验」会被记录为新的 `Experiment` 节点。
- 生成过程中发现的新关系会被写入为 `HYPOTHESIZED` 边（与 `EVIDENCED` 边区分）。
- 被用户采纳的创新提案会触发下一轮精确检索，补充支撑文献。

这形成了一个**自我增强的科研发现循环 (Self-Reinforcing Discovery Loop)**。

---

## 3. 多模态数据库架构：时空交错的混合智能存储

单一数据库无法满足科研发现的多维需求。v4 采用「多模态混合架构」(Polyglot Persistence)，让每种数据形态都存储在最适配它的引擎中，并通过统一的 ID 空间进行联邦查询。

### 3.1 数据库联邦：四库一体

| 数据形态 | 存储引擎 | 选型理由 | 核心职责 |
|---------|---------|---------|---------|
| **图结构** | KùzuDB + NetworkX (内存缓存) | Cypher 查询、ACID、本地嵌入、比 Neo4j 更轻量 | 节点关系遍历、子图匹配、路径发现 |
| **向量** | LanceDB | Arrow-native、零部署、与 Cognee 原生集成、支持向量+标量混合过滤 | 语义搜索、跨域相似度计算、RAG 检索 |
| **文档/全文** | SQLite FTS5 + 对象存储 | 零依赖、全文检索、轻量持久化 | 精确片段召回、PDF 原始文本缓存 |
| **时序/分析** | DuckDB (内存) | 分析型 OLAP、SQL 接口、零部署 | 趋势分析、影响力演化、统计聚合 |

### 3.2 KùzuDB 图模型设计

Kùzu 是一个嵌入式的 Cypher 图数据库，非常适合作为科研知识图谱的底层。v4 的图 schema 扩展为丰富的科研本体：

```cypher
// 节点类型
CREATE NODE TABLE Paper (
    id STRING PRIMARY KEY,
    title STRING,
    authors STRING[],
    year INT64,
    venue STRING,
    abstract STRING,
    doi STRING,
    arxiv_id STRING,
    ranking STRING,       // 'Foundational' | 'SOTA' | 'Supporting'
    citation_count INT64 DEFAULT 0
);

CREATE NODE TABLE Problem (
    id STRING PRIMARY KEY,
    name STRING,
    domain STRING,
    definition STRING,
    description STRING,
    resolution_status STRING,  // 'unsolved' | 'partial' | 'solved' | 'active'
    year_identified INT64,
    constraints STRING,
    evaluation_metrics STRING,
    embedding FLOAT[1536]
);

CREATE NODE TABLE Method (
    id STRING PRIMARY KEY,
    name STRING,
    domain STRING,
    mechanism STRING,
    description STRING,
    complexity STRING,
    assumptions STRING,
    limitations STRING,
    year_introduced INT64,
    embedding FLOAT[1536]
);

CREATE NODE TABLE Experiment (
    id STRING PRIMARY KEY,
    name STRING,
    dataset STRING,
    metrics_result STRING,
    baseline_comparison STRING
);

CREATE NODE TABLE Dataset (
    id STRING PRIMARY KEY,
    name STRING,
    modality STRING,   // image, text, tactile, multi-modal
    size_description STRING
);

CREATE NODE TABLE Metric (
    id STRING PRIMARY KEY,
    name STRING,
    definition STRING,
    higher_is_better BOOLEAN
);

// 边类型
CREATE REL TABLE ADDRESSES(METHOD Problem, TO Method);
CREATE REL TABLE SOLVES(FROM Method TO Problem, effectiveness STRING, limitations STRING, evidence_ids STRING[]);
CREATE REL TABLE SUB_PROBLEM_OF(FROM Problem TO Problem);
CREATE REL TABLE SUB_TYPE_OF(FROM Method TO Method);
CREATE REL TABLE IMPROVES_UPON(FROM Method TO Method, quantitative_gain STRING);
CREATE REL TABLE CONTRADICTS(FROM Paper TO Paper, claim_context STRING);
CREATE REL TABLE BUILDS_ON(FROM Paper TO Paper);
CREATE REL TABLE USES_DATASET(FROM Paper TO Dataset);
CREATE REL TABLE EVALUATES_ON(FROM Experiment TO Metric);
CREATE REL TABLE HAS_CLAIM(FROM Paper TO Claim);
```

> **注**：Claim 节点可以存储在 Kùzu 中作为轻量级节点，也可以主要存 SQLite（鉴于 Claim 数量庞大）。推荐采用「Kùzu 存储图骨架，SQLite 存储证据原文」的混合策略。

### 3.3 LanceDB 向量架构

LanceDB 的 Schema 设计需要支持「跨域搜索」和「时序过滤」：

```python
# Problems 表向量空间
problems_table = db.create_table(
    "problems_vec",
    data=[{
        "id": "prob_001",
        "vector": [0.1, -0.2, ...],  # 1536-dim
        "name": "High-frequency tactile sensing",
        "domain": "tactile_perception",
        "resolution_status": "unsolved",
        "year_identified": 2018,
        "embedding_model": "text-embedding-3-large"
    }],
    mode="overwrite"
)

# Methods 表向量空间
methods_table = db.create_table(
    "methods_vec",
    data=[{
        "id": "meth_001",
        "vector": [0.3, 0.1, ...],
        "name": "Diffusion Policy",
        "domain": "robot_learning",
        "year_introduced": 2023,
        "cross_domain_potential": 0.85  # 预计算的跨域迁移潜力分数
    }],
    mode="overwrite"
)

# Hybrid ANN Index
problems_table.create_index(
    metric="cosine",
    index_type="ivf_pq",  # 或 hnsw_pq，平衡本地精度与速度
    num_partitions=16,
    num_sub_vectors=96
)
```

**跨域迁移查询示例**：

```python
# 1. 获取目标问题的向量
prob_vec = problems_table.search().where("id = 'prob_001'").to_list()[0]["vector"]

# 2. 用问题向量跨域搜索方法（排除同域）
results = methods_table.search(prob_vec)\
    .where(f"domain != 'tactile_perception'")\
    .where("cross_domain_potential > 0.6")\
    .limit(10)\
    .to_list()
```

### 3.4 统一查询抽象层 (Unified Query Fabric)

为避免前端直接对四种数据库写查询，后端提供统一的 `ResearchQueryEngine`：

```python
class ResearchQueryEngine:
    """
    联邦查询引擎：根据查询意图自动选择最优执行路径。
    """
    def __init__(self, graph_db, vector_db, text_db, analytic_db):
        self.graph_db = graph_db      # Kùzu / NetworkX
        self.vector_db = vector_db    # LanceDB
        self.text_db = text_db        # SQLite FTS5
        self.analytic_db = analytic_db  # DuckDB

    async def query(self, intent: QueryIntent) -> QueryResult:
        """
        路由逻辑示例：
        - "Find methods similar to X" -> vector_db.search
        - "Find shortest path from A to B" -> graph_db.shortest_path
        - "Show papers containing phrase Y" -> text_db.ft5_search
        - "Trend of citations for method Z" -> analytic_db.time_series
        - "Cross-domain opportunities for P" -> vector_db + graph_db + LLM fusion
        """

---

## 4. RNOS v4 本体论设计：科研世界的原子与分子

v3 的 `domain_schema.py` 已经打下了良好的 Pydantic 基础。v4 将其扩展为一个完整、层级化、可演化的科研本体论 (Scientific Ontology)。

### 4.1 本体论金字塔：从微观到宏观

科研知识的组织不是平面的，而是分层的。v4 的本体论分为四个层级：

```
┌─────────────────────────────────────────┐
│  L4: Macro-Science (宏观)               │
│  Domain · Paradigm · ResearchProgram    │
├─────────────────────────────────────────┤
│  L3: Meso-Concepts (中观)               │
│  Problem · Method · Theory              │
├─────────────────────────────────────────┤
│  L2: Operational Entities (操作层)      │
│  Experiment · Dataset · Metric · Code   │
├─────────────────────────────────────────┤
│  L1: Atomic Evidence (原子证据)         │
│  PaperClaim · EvidenceSpan · Assumption │
└─────────────────────────────────────────┘
```

### 4.2 L1: 原子证据层 (Atomic Evidence Layer)

这是整个系统的「真理之源」。没有任何一个 L2-L4 的节点可以脱离 L1 独立存在。

#### EvidenceSpan - 最小不可分证据单元

```python
class EvidenceSpan(BaseModel):
    paper_id: str
    section: str              # "Introduction", "Method", "Results"
    subsection: Optional[str] # "3.2 Proposed Architecture"
    snippet: str              # 原始文本片段（严格控制长度 50-300 tokens）
    confidence: float = Field(ge=0.0, le=1.0)
    page_num: Optional[int]
    line_start: Optional[int]
    line_end: Optional[int]
    bounding_box: Optional[BoundingBox]  # 未来支持 PDF 高亮渲染
```

#### PaperClaim - 论文局部主张

```python
class ClaimType(str, Enum):
    PROBLEM_STATEMENT = "problem_statement"       # 论文识别出的问题
    METHOD_MECHANISM = "method_mechanism"         # 核心方法机制
    EXPERIMENT_RESULT = "experiment_result"       # 实验结果
    LIMITATION = "limitation"                     # 方法的局限性
    FUTURE_WORK = "future_work"                   # 未来工作
    THEORETICAL_ASSERTION = "theoretical_assertion"  # 理论断言
    CONTRADICTS_PRIOR = "contradicts_prior"       # 反驳前人工作

class PaperClaim(BaseModel):
    claim_id: str
    paper_id: str
    claim_type: ClaimType
    text: str                    # LLM 提炼后的主张文本
    canonical_id: Optional[str]  # 对齐到全局本体的 ID
    evidence: List[EvidenceSpan]
    metadata: Dict[str, Any]     # 类型特定的元数据
    consensus_score: float = 0.0 # 跨论文共识度（多少其他论文支持/反对）
    version: int = 1             # 如果 LLM 重提炼，版本递增
```

> **metadata 的 schema 因 claim_type 而异**：
> - `problem_statement`: `constraints`, `evaluation_metrics`, `severity_level`
> - `method_mechanism`: `assumptions`, `limitations`, `hyperparameters`, `input_output_spec`
> - `experiment_result`: `dataset_used`, `metric_values`, `statistical_significance`
> - `future_work`: `expected_difficulty`, `related_problems`

### 4.3 L2: 操作实体层

#### Experiment（实验）- 验证的场域

```python
class Experiment(BaseModel):
    experiment_id: str
    paper_id: str
    name: str
    task_description: str
    dataset_ids: List[str]
    baseline_method_ids: List[str]
    proposed_method_ids: List[str]
    metric_results: List[MetricResult]
    ablation_studies: Optional[List[AblationStudy]]
```

#### Metric（评价指标）- 成功的度量衡

```python
class Metric(BaseModel):
    metric_id: str
    name: str
    full_name: str
    definition: str
    higher_is_better: bool
    domain: str
    unit: Optional[str]  # e.g., "%", "mAP", "FPS"
```

### 4.4 L3: 中观概念层

这是 v3 已有的核心层，但 v4 进行了深度扩展。

#### Problem（问题）- 科研的指南针

```python
class Problem(BaseModel):
    canonical_id: str
    name: str
    aliases: List[str]
    domain: str
    super_domain: Optional[str]  # 更宏观的领域分类
    
    # 知识内容
    definition: str              # 一句话精确定义
    description: str             # LLM 生成的详细描述
    development_progress: str    # 历史演化和解决现状
    
    # 条件与约束
    constraints: str             # 物理/数学/硬件约束
    evaluation_metrics: str      # 通常用什么指标衡量解决程度
    
    # 状态机
    resolution_status: ResolutionStatus
    year_identified: Optional[int]
    
    # 拓扑关系（由图数据库动态计算，不持久化）
    # sub_problems: List[str]    # 通过 SUB_PROBLEM_OF 边获取
    # addressing_methods: List[str]  # 通过 SOLVES 边获取
    
    # LLM 生成的洞察（定期由 AI Scientist Society 更新）
    ai_insight: Optional[ProblemInsight]
```

#### Method（方法）- 解决问题的武器

```python
class Method(BaseModel):
    canonical_id: str
    name: str
    aliases: List[str]
    domain: str
    
    # 知识内容
    mechanism: str               # 核心数学/物理机制
    description: str
    development_progress: str    # 从提出到 SOTA 的演化史
    
    # 条件与边界
    complexity: str              # 时间/空间复杂度，或定性描述
    assumptions: str             # 前提假设
    limitations: str             # 已知盲点
    
    year_introduced: Optional[int]
    
    # 跨域潜力（由系统动态计算）
    cross_domain_potential_score: float = 0.0
    
    ai_insight: Optional[MethodInsight]
```

#### Relation（关系）- 不再是单纯的字符串

```python
class RelationType(str, Enum):
    SOLVES = "SOLVES"                        # Method -> Problem
    ADDRESSES = "ADDRESSES"                  # Method -> Problem (较弱)
    SUB_TYPE_OF = "SUB_TYPE_OF"              # Method -> Method / Problem -> Problem
    IMPROVES_UPON = "IMPROVES_UPON"          # Method -> Method
    COMPOSED_OF = "COMPOSED_OF"              # Method -> Method
    CONTRADICTS = "CONTRADICTS"              # Paper -> Paper / Claim -> Claim
    BUILDS_ON = "BUILDS_ON"                  # Paper -> Paper
    TRANSFERS_TO = "TRANSFERS_TO"            # Method -> Problem (跨域)
    HYPOTHESIZED = "HYPOTHESIZED"            # AI 生成的假设关系（待验证）

class EvidenceBackedRelation(BaseModel):
    relation_id: str
    source_id: str
    target_id: str
    relation_type: RelationType
    strength_score: float        # 由证据数量和一致性计算
    evidence_claim_ids: List[str]
    
    # 如果是假设关系，标记来源
    is_hypothesized: bool = False
    hypothesized_by: Optional[str]  # AI Agent ID
    hypothesis_rationale: Optional[str]
```

### 4.5 L4: 宏观领域层（新增）

v4 引入 Domain 和 Paradigm 作为宏观容器，用于更高层次的发现：

```python
class Domain(BaseModel):
    domain_id: str
    name: str
    description: str
    core_problems: List[str]
    core_methods: List[str]
    adjacent_domains: List[str]  # 邻近领域（用于跨域推荐）
    
class Paradigm(BaseModel):
    paradigm_id: str
    name: str                    # e.g., "Diffusion Models Era", "Transformer Era"
    description: str
    start_year: int
    end_year: Optional[int]
    key_methods: List[str]
    dominant_problems: List[str]
    successor_paradigm: Optional[str]
```

### 4.6 本体论版本控制

科研知识是演化的。v4 支持「软删除」和「概念合并」：

- **MINT**: 新概念诞生，分配新的 canonical_id。
- **MERGE**: 两个概念被判定为等价，系统创建 `MERGED_INTO` 元关系，旧 ID 转发到新 ID。
- **SPLIT**: 一个概念被细分为多个子概念，保留父概念的泛化意义。
- **DEPRECATE**: 概念被更精确的表述替代，标记为 `deprecated=True` 但保留历史兼容性。

---

## 5. 知识抽取 Pipeline v4：从混沌 PDF 到结构化宇宙

v3 的抽取 Pipeline 已经具备四阶段架构，但 PDF 解析使用 PyPDF2，在复杂排版（双栏、公式、图表混排）下效果堪忧。v4 将其升级为**多模态、可验证、层次化的工业级 pipeline**。

### 5.1 Pipeline 架构图

```
PDF Input
│
├─► Stage 0: Multi-Modal Parsing（多模态解析）
│     ├─ Text Stream (GROBID / Marker / Nougat)
│     ├─ Figure/Table Extraction (PDFPlumber + OCR)
│     ├─ Citation Graph (anystyle / GROBID ref)
│     └─ Output: StructuredPaper JSON
│
├─► Stage 1: Section Segmentation（章节切分）
│     └─ Output: Hierarchical sections (Intro, Related, Method, Exp, Conclusion)
│
├─► Stage 2: Claim Extraction（声明提取）
│     └─ LLM extracts typed PaperClaims with EvidenceSpans
│
├─► Stage 3: Grounding & Verification（证据锚定）
│     ├─ Fuzzy string matching (v3)
│     ├─ NEW: LLM-as-Judge hallucination detection
│     └─ Output: VerifiedClaims
│
├─► Stage 4: Canonical Alignment（本体对齐）
│     ├─ Vector similarity pre-screening
│     ├─ LLM Arbiter (MERGE vs MINT)
│     └─ Output: AlignedNodes
│
├─► Stage 5: Graph Write & Consistency Check（图写入与一致性校验）
│     ├─ Transactional write to KùzuDB/SQLite
│     ├─ Constraint validation (no orphaned claims)
│     └─ Output: Persisted Graph Delta
│
└─► Stage 6: Innovation Trigger（创新触发）
      └─ Async dispatch to Discovery Engine
```

### 5.2 Stage 0: 多模态解析升级

#### 文本解析策略

| 场景 | 推荐工具 | 原因 |
|-----|---------|-----|
| 学术论文（标准 LaTeX） | **GROBID** | 结构化提取最成熟，支持 header/figure/table/ref |
| 扫描版/旧 PDF | **Marker** / Nougat | OCR + 布局解析能力更强 |
| 快速轻量处理 | **pdfplumber** | 纯 Python，易于调试和定制 |

v4 的解析层采用**解析器路由器 (Parser Router)**：

```python
class ParserRouter:
    def route(self, pdf_path: str) -> PaperParser:
        # 1. 检查是否有文本层
        has_text_layer = self._check_text_layer(pdf_path)
        # 2. 检查是否包含大量公式/图表
        complexity_score = self._assess_complexity(pdf_path)
        
        if not has_text_layer:
            return MarkerParser()  # OCR 优先
        elif complexity_score > 0.7:
            return GrobidParser()  # 结构化优先
        else:
            return PdfPlumberParser()  # 快速处理
```

#### 图表提取

学术论文中的图表是知识的重要载体。v4 引入 `FigureExtractor`：

```python
class FigureExtractor:
    def extract(self, pdf_path) -> List[Figure]:
        # 1. 用 PDFPlumber 定位图表页面和边界框
        # 2. 将页面转为高分辨率图像 (pdftoppm / pdf2image)
        # 3. 用多模态 LLM (GPT-4V / Kimi-Vision) 描述图表内容
        # 4. 关联到最近的 "Method" 或 "Experiment" 段落
```

提取后的图表描述会被加入 `PaperClaim` 的 `metadata["figure_caption"]` 中，作为对齐的证据补充。

### 5.3 Stage 2: 层次化 Claim 提取

v4 不再一次性把整篇论文文本喂给 LLM，而是**按章节分段提取**，降低幻觉率并提高召回：

```python
class ClaimExtractor:
    async def extract(self, structured_paper: StructuredPaper) -> List[PaperClaim]:
        claims = []
        
        # 按语义块并行提取
        tasks = [
            self._extract_from_intro(structured_paper.intro),
            self._extract_from_method(structured_paper.method),
            self._extract_from_results(structured_paper.results),
            self._extract_from_conclusion(structured_paper.conclusion),
        ]
        results = await asyncio.gather(*tasks)
        
        for section_claims in results:
            claims.extend(section_claims)
        
        # 跨章节去重与矛盾检测
        claims = self._deduplicate_and_detect_contradictions(claims)
        return claims
```

**LLM Prompt 工程**：

每个章节使用专门的 prompt 模板。例如 Method 章节的 prompt 会特别强调：
- "提取该方法的核心数学/物理机制，不是应用领域"
- "如果文中对比了 baseline，记录 performance gap"
- "明确指出该方法依赖的前提假设"

### 5.4 Stage 3: 防幻觉的三层验证

v3 的 fuzzy grounding 是好的开端，v4 引入「三层验证塔」：

```python
class GroundingEngine:
    def verify(self, claim: PaperClaim, source_text: str) -> VerificationResult:
        # Level 1: Fuzzy N-gram Match (v3 已有的快速过滤)
        l1_score = fuzzy_ngram_score(claim.evidence[0].snippet, source_text)
        
        # Level 2: Embedding Semantic Match
        snippet_vec = embed(claim.evidence[0].snippet)
        context_vec = embed(source_text)
        l2_score = cosine_similarity(snippet_vec, context_vec)
        
        # Level 3: LLM-as-Judge (最终仲裁)
        l3_decision = llm_judge_verify(
            claim_text=claim.text,
            snippet=claim.evidence[0].snippet,
            source_text=source_text
        )
        
        decision = aggregate(l1_score, l2_score, l3_decision)
        return decision
```

**LLM Judge Prompt**：

```
You are a strict scientific fact-checker. 
Given:
- CLAIM: "{claim_text}"
- SNIPPET: "{snippet}" (allegedly from the source)
- SOURCE: "{source_text}" (the full section text)

Task: Determine if the CLAIM is SUPPORTED, CONTRADICTED, or NOT_MENTIONED by the SOURCE.
If the SNIPPET is a paraphrase but accurately reflects the source, output SUPPORTED.
If the SNIPPET hallucinates content not in the source, output NOT_MENTIONED.

Output ONLY a JSON: {"verdict": "SUPPORTED|CONTRADICTED|NOT_MENTIONED", "confidence": 0.0-1.0}
```

### 5.5 Stage 4: 本体对齐的升级（LLM Arbiter 2.0）

v3 的 LLM Arbiter 只能做二元判断（MERGE vs MINT）。v4 的 Arbiter 支持更细粒度的对齐决策：

```python
class AlignmentDecision(str, Enum):
    MERGE = "MERGE"                    # 完全等价，合并到现有节点
    SUB_TYPE = "SUB_TYPE"              # 新概念是现有概念的子类型
    SUPER_TYPE = "SUPER_TYPE"          # 新概念是现有概念的父类型
    RELATED = "RELATED"                # 相关但不等价，建立 RELATED_TO 边
    MINT = "MINT"                      # 全新概念，创建新节点
    MERGE_AND_EXPAND = "MERGE_AND_EXPAND"  # 合并，但扩展现有节点定义

class LLMArbiterV2:
    async def decide(self, claim: PaperClaim, candidate_nodes: List[CanonicalNode]) -> AlignmentResult:
        # 1. 用向量相似度召回 top-3 候选
        candidates = vector_db.search(claim.text, top_k=3)
        
        # 2. 构建富含上下文的 prompt
        prompt = build_arbiter_prompt(claim, candidates)
        
        # 3. LLM 输出结构化决策
        decision = await llm.structured_output(prompt, schema=AlignmentResultSchema)
        return decision
```

Arbiter 不仅判断对齐关系，还会输出**对齐理由** (alignment_rationale)，这对于后续的人工审计和系统透明性至关重要。

### 5.6 Stage 5: 图写入的事务性保证

科研图谱的一致性非常重要。v4 的图写入层采用**原子事务**：

```python
@transactional
async def write_graph_delta(delta: GraphDelta, db: GraphDB):
    """
    原子性写入图变更。如果任何约束检查失败，整体回滚。
    """
    # 1. 写入节点
    for node in delta.new_nodes:
        db.create_node(node)
    
    # 2. 写入关系
    for edge in delta.new_edges:
        db.create_edge(edge)
    
    # 3. 写入证据
    for claim in delta.new_claims:
        db.create_claim(claim)
    
    # 4. 约束检查
    assert db.has_no_orphaned_claims()
    assert db.has_no_self_loops(except_types=[SUB_TYPE_OF])
    assert db.all_evidence_claims_have_papers()
```

---

## 6. 创新发现引擎：六种创新生产范式

这是 Research-Nexus v4 的核心引擎。创新不是玄学，而是可以被**系统性计算的结构洞**。v4 定义了六种互补的创新发现范式，每一种都对应着特定的图算法、向量运算和 LLM 推理策略。

### 6.1 范式一：跨域迁移 (Cross-Domain Transfer, CDT)

**原理**：如果方法 M 的语义空间与问题 P 的需求空间存在显著重叠，但 M 和 P 分属不同领域且历史上没有直接关联，则存在跨域创新的机会。

**算法**：

```python
def discover_cdt(problem_id: str, graph_db, vector_db) -> List[InnovationOpportunity]:
    problem = graph_db.get_problem(problem_id)
    prob_vec = vector_db.get_problem_vector(problem_id)
    
    # 搜索跨域方法（排除同域）
    candidates = vector_db.search_similar_methods(
        query_vector=prob_vec,
        exclude_domain=problem.domain,
        top_k=20
    )
    
    opportunities = []
    for cand in candidates:
        # 结构洞检查：图上没有直接边
        if graph_db.has_edge(cand.id, problem_id, relation_type="SOLVES"):
            continue
            
        # 甜蜜点：相似度不能太高（否则就是已知方法），也不能太低（否则不相关）
        if 0.40 <= cand.score <= 0.85:
            # LLM 生成迁移可行性评估
            transfer_rationale = llm_assess_transfer(cand, problem)
            
            opportunities.append(InnovationOpportunity(
                target_problem_id=problem_id,
                candidate_method_ids=[cand.id],
                rationale=transfer_rationale,
                feasibility_score=cand.score,
                novelty_score=1.0 - cand.score,
                innovation_type="cross_domain_transfer"
            ))
    
    return opportunities
```

**已有基础**：v3 的 `_trigger_innovation_discovery` 已实现此范式的雏形。v4 的升级在于引入 `cross_domain_potential_score` 预计算和 LLM 迁移评估。

### 6.2 范式二：结构洞填补 (Structural Hole Filling, SHF)

**原理**：在一个科研子领域内，如果多个方法都声称解决某个问题，但使用不同的底层机制，且它们之间没有互相引用或比较的关系，则可能存在「方法组合」或「统一框架」的创新机会。

**图算法**：

```cypher
// Cypher 查询：找到针对同一个问题但没有 IMPROVES_UPON 或 COMPOSED_OF 关系的方法对
MATCH (p:Problem)<-[:SOLVES]-(m1:Method), (p)<-[:SOLVES]-(m2:Method)
WHERE m1.domain = m2.domain
  AND m1.id < m2.id
  AND NOT EXISTS((m1)-[:IMPROVES_UPON|COMPOSED_OF]-(m2))
  AND NOT EXISTS((m1)-[:CONTRADICTS]-(m2))
RETURN p.id AS problem_id, 
       m1.id AS method_a, 
       m2.id AS method_b,
       count{ (m1)-[:BUILDS_ON*..3]->(m2) } AS indirect_connection_depth
```

这些 (`m1`, `m2`) 对就像是同一问题下的「平行宇宙」。填补它们之间的结构洞，可能产生：
- **统一理论**：发现 m1 和 m2 的数学同构性。
- **混合方法**：组合 m1 和 m2 的优势模块。

### 6.3 范式三：方法组合创新 (Method Composition, MC)

**原理**：如果方法 M1 解决子问题 P1，方法 M2 解决子问题 P2，而 P1 和 P2 都是大 Problem P 的子问题，那么将 M1 和 M2 组合成 pipeline 可能就是解决 P 的新方案。

**算法**：

```python
def discover_mc(problem_id: str, graph_db) -> List[InnovationOpportunity]:
    # 1. 获取 P 的所有子问题
    sub_problems = graph_db.get_sub_problems(problem_id)
    
    # 2. 为每个子问题获取最佳方法
    methods_per_sub = {
        sp.id: graph_db.get_best_solving_methods(sp.id)
        for sp in sub_problems
    }
    
    # 3. 如果多个子问题的最佳方法来自不同论文且从未被组合报道过...
    # 生成组合创新机会
    combinations = generate_combinations(methods_per_sub)
    
    for combo in combinations:
        # LLM 评估组合兼容性和潜在瓶颈
        assessment = llm_assess_compatibility(combo)
        if assessment.compatibility_score > 0.7:
            opportunities.append(...)
```

### 6.4 范式四：时序前沿推断 (Temporal Frontiers, TF)

**原理**：某些问题的可解性并不是静态的，而是随着时间（新数据集、新算力、新数学工具）而变化的。通过分析「问题提出时间」与「方法出现时间」的时序关系，可以发现「刚刚变得可解」的问题。

**时序分析查询**：

```python
def discover_tf(graph_db, year_threshold: int = 3) -> List[InnovationOpportunity]:
    """
    发现 "近期出现的新方法可能解决老问题" 的机会。
    """
    query = """
    MATCH (p:Problem)<-[:SOLVES]-(m:Method)
    WHERE p.year_identified < m.year_introduced - $year_threshold
      AND p.resolution_status IN ['unsolved', 'partial']
      AND m.year_introduced >= $recent_year
    RETURN p.id AS problem_id, m.id AS method_id,
           p.year_identified AS problem_year,
           m.year_introduced AS method_year
    ORDER BY method_year DESC
    """
    results = graph_db.run_query(query, {"recent_year": datetime.now().year - year_threshold})
    
    opportunities = []
    for row in results:
        # 判断这是否是 "新方法首次有机会解决老问题"
        older_methods = graph_db.get_methods_for_problem_before(row.problem_id, row.method_year)
        if len(older_methods) < 2:  # 历史上鲜有解法
            opportunities.append(...)
    
    return opportunities
```

此外，v4 还引入 **Paradigm Shift Detection（范式转移检测）**：通过追踪某个领域内方法引用网络的突变点（如突然大量论文从 RNN 转向 Transformer），自动识别新范式的诞生。

### 6.5 范式五：反事实假设 (Counterfactual Hypothesis, CH)

**原理**：科学史上许多重大突破来自于「如果去掉某个默认假设，会怎样？」的追问。反事实引擎系统地识别方法中的关键假设，并检查是否存在被默认假设排除掉的解题路径。

**算法**：

```python
def discover_ch(method_id: str, graph_db, vector_db) -> List[InnovationOpportunity]:
    method = graph_db.get_method(method_id)
    assumptions = parse_assumptions(method.assumptions)
    
    opportunities = []
    for assumption in assumptions:
        # 1. 将该假设取反作为查询向量
        negated_assumption_vec = vector_db.embed(f"without assuming that {assumption}")
        
        # 2. 搜索在「无此假设」空间中最活跃的方法或问题
        alternative_methods = vector_db.search_similar_methods(negated_assumption_vec, top_k=5)
        
        for alt in alternative_methods:
            # 3. 如果这些替代方法解决的问题与当前方法类似...
            shared_problems = graph_db.get_common_target_problems(method_id, alt.id)
            if shared_problems:
                opportunities.append(InnovationOpportunity(
                    target_problem_id=shared_problems[0],
                    candidate_method_ids=[alt.id, method_id],
                    rationale=f"If we relax the assumption '{assumption}' of {method.name}, "
                              f"{alt.name} offers an alternative mechanism.",
                    innovation_type="counterfactual_hypothesis"
                ))
    
    return opportunities
```

### 6.6 范式六：研究空白识别 (Research Gap Identification, RGI)

**原理**：识别那些「重要但研究不足」的区域。这可以通过两种图信号来检测：

1. **高中心度但低覆盖**：某个 Problem 节点被很多 Paper 提及（高 PageRank），但只有很少的方法声称解决它（低 SOLVES 出度）。
2. **矛盾聚集**：多个 Paper 对同一个 Problem-Method 对给出了矛盾的 effectiveness 评价，说明该领域缺乏一致的基准或理解。

**图查询**：

```cypher
// 高提及度但低解法覆盖的问题
MATCH (p:Problem)
OPTIONAL MATCH (p)<-[:ADDRESSES|SOLVES]-(m:Method)
WITH p, count(DISTINCT m) AS method_count
MATCH (paper:Paper)-[:MENTIONS]->(p)
WITH p, method_count, count(DISTINCT paper) AS paper_count
WHERE paper_count > 10 AND method_count < 2
RETURN p.id, p.name, paper_count, method_count
ORDER BY paper_count DESC, method_count ASC
```

### 6.7 创新机会评分机制

六个范式可能产生大量候选机会。v4 采用多维度评分进行排序：

```python
class InnovationScorer:
    def score(self, opp: InnovationOpportunity, graph_db, vector_db) -> InnovationScore:
        # 维度 1: 新颖性 (Novelty) —— 候选方法与问题的图上距离
        graph_distance = graph_db.shortest_path_length(opp.candidate_methods[0], opp.target_problem_id)
        novelty = normalize(graph_distance)  # 距离越远，图结构上越新颖
        
        # 维度 2: 可行性 (Feasibility) —— 向量语义相似度
        feasibility = opp.feasibility_score
        
        # 维度 3: 影响力 (Impact) —— 问题的重要性和方法的通用性
        problem_pagerank = graph_db.pagerank(opp.target_problem_id)
        method_generality = graph_db.degree_centrality(opp.candidate_methods[0])
        impact = (problem_pagerank + method_generality) / 2
        
        # 维度 4: 证据强度 (Evidence Strength) —— 支撑声明的数量和质量
        evidence_count = len(opp.supporting_evidence_ids)
        evidence_strength = min(evidence_count / 5.0, 1.0)
        
        # 加权总分
        total_score = (
            0.30 * novelty +
            0.25 * feasibility +
            0.25 * impact +
            0.20 * evidence_strength
        )
        
        return InnovationScore(
            novelty=novelty,
            feasibility=feasibility,
            impact=impact,
            evidence_strength=evidence_strength,
            total=total_score
        )
```

只有总评分超过阈值（如 0.65）的机会才会被推送到 **AI Scientist Society** 进行深度提案生成。

---

## 7. AI Scientist Society：多智能体科研实验室

v3 已经实现了 Generator + Devil's Advocate 的双智能体辩论。v4 将其扩展为一个完整的 **AI Scientist Society**，模拟真实科研团队的协作流程。

### 7.1 六大智能体角色

| 智能体 | 职责 | 对应 LLM 角色 | 输出 |
|-------|------|--------------|------|
| **Ontologist** (本体学家) | 评估新概念的对齐、命名、分类是否合理 | 严谨的分类学家 | AlignmentReport |
| **Extractor** (提取师) | 从 PDF 中提取 claims 和 evidence | 细致的阅读者 | PaperClaim[] |
| **Hypothesizer** (假设生成者) | 基于结构洞提出创新假设 | 创造性科学家 | InnovationHypothesis |
| **Critic** (批判者) | 寻找假设中的逻辑漏洞和物理矛盾 | 恶魔审稿人 | CritiqueReport |
| **Experimentalist** (实验家) | 设计验证假设的实验方案 | 实验设计师 | ExperimentDesign |
| **Reviewer** (综述者) | 综合所有观点，输出最终提案 | 资深 PI | InnovationInsight |

### 7.2 多智能体工作流

#### 工作流 A：论文摄入与对齐

```
Extractor ──► Ontologist ──► Graph Writer
     │              │
     └──────────────┘ (循环：Ontologist 不满意对齐时返回给 Extractor 重提炼)
```

#### 工作流 B：创新提案生成（核心）

```
Hypothesizer 提出假设 H
      │
      ▼
Critic 批判 H，指出矛盾和风险
      │
      ▼
Experimentalist 设计实验 E 来验证或排除 Critic 的质疑
      │
      ▼
Hypothesizer 根据 Critic + Experimentalist 的反馈，修改 H 为 H'
      │
      ▼
Reviewer 综合 H' 的所有讨论，输出最终 InnovationInsight
```

这本质上是一个 **LLM Multi-Agent Debate 的 DAG 工作流**。v4 使用一个轻量级的编排器来管理：

```python
class AgentOrchestrator:
    async def run_innovation_workflow(self, opportunity: InnovationOpportunity) -> InnovationInsight:
        # 1. Hypothesizer 提出初稿
        hypothesis = await self.hypothesizer.generate(opportunity)
        
        # 2. Critic 多轮批判（可配置轮数，默认 2 轮）
        for round in range(MAX_CRITIQUE_ROUNDS):
            critique = await self.critic.evaluate(hypothesis, opportunity)
            if critique.severity < LOW:
                break
            hypothesis = await self.hypothesizer.revise(hypothesis, critique)
        
        # 3. Experimentalist 设计验证实验
        experiment_design = await self.experimentalist.design(hypothesis, opportunity)
        
        # 4. Reviewer 输出最终报告
        insight = await self.reviewer.synthesize(
            hypothesis=hypothesis,
            critiques=critiques,
            experiment=experiment_design,
            opportunity=opportunity
        )
        
        return insight
```

### 7.3 记忆与上下文管理

Agent Society 需要共享上下文记忆。v4 引入 `AgentContextMemory`：

```python
class AgentContextMemory:
    """
    一个基于知识图谱的智能体共享记忆。
    不同于简单的 prompt history，它将每次讨论的关键论点固化为图中的 HYPOTHESIZED 边和节点。
    """
    def store_debate(self, debate_id: str, arguments: List[AgentArgument]):
        for arg in arguments:
            # 将论点存储为临时 "Argument" 节点
            self.graph_db.create_node(
                id=f"arg_{debate_id}_{arg.agent_name}",
                type="argument",
                data={"content": arg.content, "agent": arg.agent_name}
            )
            # 关联到原始机会
            self.graph_db.create_edge(
                source=f"arg_{debate_id}_{arg.agent_name}",
                target=debate_id,
                type="ARGUES_FOR"
            )
```

这使得 Agent 的推理过程不再是黑盒，而是可以被追踪、审计和复用的知识资产。

### 7.4 SSE 流式输出与人机协作

v3 已经在 `generate_insight_stream` 中实现了 SSE 流式输出。v4 将其扩展为**过程可视化**：

- 前端不仅显示最终结果，还实时显示每个 Agent 的「思考过程」卡片。
- 用户可以在 Critic 环节**介入**，提供自己的观点和约束条件。
- 用户的反馈会被重新注入工作流，形成**人机回环 (Human-in-the-Loop)**。

---

## 8. GraphRAG 科学推理层：让大模型拥有科研记忆

### 8.1 从 RAG 到 GraphRAG 的跃迁

传统 RAG 将文档切片为文本块进行向量检索，其致命弱点在于**丧失了文档之间的结构关系**。在科研领域，知道「论文 A 引用论文 B」和「方法 M 解决问题 P」比单纯知道「某段落提到了 diffusion model」重要得多。

**GraphRAG 的核心思想**：将 LLM 的上下文窗口视为 CPU 的寄存器，而知识图谱是外部 DRAM。推理时，通过图查询将高度相关的子图加载到上下文中。

### 8.2 子图检索策略

v4 的 GraphRAG 引擎支持多种子图检索模式：

#### 模式 1: Ego Graph（自我中心子图）

给定一个节点（如 Problem P），检索其 1-2 跳邻居：

```cypher
MATCH path = (p:Problem {id: $problem_id})-[*1..2]-(neighbor)
RETURN path
```

适用于：节点详情面板、生成节点描述。

#### 模式 2: Multi-Hop Reasoning Path（多跳推理路径）

给定两个节点，检索它们之间的最短路径或 top-k 路径：

```cypher
MATCH path = shortestPath((m:Method {id: $m_id})-[*]-(p:Problem {id: $p_id}))
RETURN path
```

适用于：解释为什么方法 M 和问题 P 相关、创新机会的关联解释。

#### 模式 3: Community Summarization（社区摘要）

基于图聚类（如 Louvain 算法）识别紧密连接的子领域，为每个社区生成 LLM 摘要：

```python
communities = nx.community.louvain_communities(graph)
for comm in communities:
    summary = llm_summarize_subgraph(graph.subgraph(comm))
    store_community_summary(comm_id, summary)
```

适用于：宏观领域概览、趋势分析。

### 8.3 GraphRAG 查询流程

```python
class GraphRAGEngine:
    async def answer(self, user_query: str) -> str:
        # Step 1: 查询意图识别
        intent = await self.llm.identify_intent(user_query)
        
        # Step 2: 图检索
        if intent == "node_detail":
            subgraph = self.graph_db.get_ego_graph(extracted_node_id, depth=2)
        elif intent == "relationship":
            subgraph = self.graph_db.get_paths_between(node_a, node_b, max_depth=3)
        elif intent == "trend":
            subgraph = self.graph_db.get_temporal_subgraph(domain, years=(2020, 2025))
        else:
            # 默认：混合向量检索 + 图扩展
            seed_nodes = self.vector_db.search(user_query, top_k=5)
            subgraph = self.graph_db.expand_from_seeds(seed_nodes, depth=1)
        
        # Step 3: 子图文本化
        context = self._subgraph_to_text(subgraph)
        
        # Step 4: LLM 生成答案
        answer = await self.llm.generate(
            system_prompt=SCIENTIFIC_REASONING_PROMPT,
            context=context,
            user_query=user_query
        )
        
        return answer
```

### 8.4 Cypher-LLM：让模型学会图查询

v4 探索使用经过微调的 LLM（或 prompt engineering）直接将自然语言问题转化为 Cypher 查询：

```python
class CypherLLM:
    async def nl_to_cypher(self, question: str) -> str:
        prompt = f"""
        You are an expert in Cypher graph query language.
        The graph schema is:
        - Nodes: Paper, Problem, Method, Experiment, Dataset
        - Relations: SOLVES, ADDRESSES, SUB_TYPE_OF, IMPROVES_UPON, BUILDS_ON
        
        Translate the following question into a valid Cypher query.
        Question: {question}
        Cypher:
        """
        cypher = await self.llm.generate(prompt)
        # Validation and execution guardrails...
        return cypher
```

这使得非技术用户也能通过自然语言与科研图谱进行深度交互。

---

## 9. 前端交互架构：可对话的科研界面

v3 的前端已经是一个 gorgeous 的可视化系统（8 种视图、GSAP 动画、ReactFlow）。v4 在此基础上增加**对话式探索和沉浸式创新工作流**。

### 9.1 核心交互范式

#### 范式 1：多视图 + 对话侧边栏 (Split-View Chat)

用户可以在任何视图中打开右侧聊天栏，向 Agent Society 提问：
- "这个方法为什么还没有应用到目标领域上？"
- "发现三个最有潜力的跨域创新机会。"
- "为当前选中的节点生成一篇顶会提案。"

GraphRAG 引擎负责将问题映射到图谱子图，并将子图可视化结果与文本回答同步展示。

#### 范式 2：创新工作流工作室 (Innovation Studio)

为一个独立的沉浸模式，包含三个相连的组件：

1. **机会地图**：展示所有被评分排序的创新机会（气泡图：x=可行性, y=新颖性, size=影响力）。
2. **辩论舞台**：选中一个机会后，以卡片流的形式观看 AI Scientist Society 的辩论过程。
3. **提案编辑器**：最终生成的顶会提案以可编辑的 Markdown/JSON 呈现，用户可以修改并导出为 PDF。

#### 范式 3：证据高亮阅读器 (Evidence Reader)

当用户点击某个 Claim 或 Relation 时，系统直接打开原始 PDF 的对应页面，并用高亮框标出 `EvidenceSpan` 的位置。这是「可确证性」在前端的最直接体现。

### 9.2 视图矩阵（v3 + v4 新视图）

| 视图 | 来源 | 描述 |
|-----|-----|-----|
| Innovation Board | v3 | 系统推荐的创新机会卡片墙 |
| Problem Tree | v3 | 问题的层级演化树 |
| Method Tree | v3 | 方法的分类与演进树 |
| Method Arrows | v3 | 方法指向问题的关联箭头 |
| Dual Tree Fusion | v3 | 问题+方法双树融合 |
| Citation Network | v3 | 论文引用关系网络 |
| Timeline | v3 | 时间线演化 |
| **Agent Debate Flow** | v4 新增 | 多智能体辩论过程可视化 |
| **Research Gap Heatmap** | v4 新增 | 领域热度的热力图-like 视图 |
| **Paradigm Timeline** | v4 新增 | 范式演替的宏观时间轴 |

### 9.3 实时协作（Realtime Collaboration）

v4 前端架构预留了实时协作的能力：
- 用户的选中节点、展开状态、书签通过 WebSocket 同步（或基于 y.js 的 CRDT）。
- 多个研究者可以在同一张图谱上协作注释，AI Agent 也能以「虚拟协作者」身份加入。

---

## 10. 实施路线图：从原型到操作系统

将 v4 的宏大设计落地为可执行的开发计划，分为三个阶段：

### Phase 1：基础设施升级（1-2 个月）

**目标**：把 v3 的「玩具级」组件升级为生产级组件，为上层算法打好基础。

| 任务 | 具体内容 |
|-----|---------|
| DB 重构 | 引入 KùzuDB（或保留 NetworkX 但优化 schema），LanceDB 替代 numpy JSON |
| PDF 解析升级 | 集成 GROBID / Marker，替换 PyPDF2 |
| 本体扩展 | 将 `domain_schema.py` 扩展为完整的 L1-L4 本体 |
| 向量嵌入 | 接入 text-embedding-3-large 或本地 embedding 模型 |
| API 标准化 | 统一 `/api/v4/*` 路由，完善 OpenAPI 文档 |

### Phase 2：发现引擎与 Agent Society（2-3 个月）

**目标**：实现六种创新范式和 AI Scientist Society。

| 任务 | 具体内容 |
|-----|---------|
| CDT 引擎 | 完善跨域迁移发现，引入 cross_domain_potential_score |
| SHF 引擎 | 实现结构洞填补的图算法和机会生成 |
| MC 引擎 | 实现方法组合创新的路径发现 |
| TF 引擎 | 实现时序前沿推断和范式转移检测 |
| CH 引擎 | 实现反事实假设生成（可先限定于假设改写） |
| RGI 引擎 | 实现研究空白识别的 PageRank 分析 |
| Agent Society | 完成 6 个 Agent 的基础 Workflow，重点打磨 Hypothesizer+Critic+Reviewer 三角 |
| SSE 流式 UI | 将辩论过程可视化到前端 |

### Phase 3：GraphRAG 与沉浸式交互（2-3 个月）

**目标**：让图谱从「被看」变成「被对话」和「被使用」。

| 任务 | 具体内容 |
|-----|---------|
| GraphRAG 引擎 | 实现 Ego Graph、Path Retrieval、Community Summarization |
| Cypher-LLM | 自然语言到图查询的转换原型 |
| 聊天侧边栏 | 前端集成 GraphRAG 驱动的对话式探索 |
| Innovation Studio | 创新工作流的全流程沉浸 UI |
| Evidence Reader | 证据高亮 PDF 阅读器（需要后端支持 PDF 页码定位） |
| 实时协作 | 基于 CRDT 的多用户协作注释 |

### 持续迭代项

- **数据质量飞轮**：用户的每次反馈（接受/拒绝一个对齐、修正一个节点描述）都会被记录为训练信号，用于微调 LLM Arbiter 和 Extractor。
- **领域扩展**：从当前示例领域扩展到机器人学、CV、NLP 等更多领域。
- **开源与社区**：考虑将核心引擎（抽取、对齐、发现）作为独立 Python 包发布，前端作为参考实现。

---

## 结语

Research-Nexus Pro v4 的愿景，是成为人类科研的**「外接大脑」**——不是替代科学家思考，而是将浩瀚的文献海洋结构化为可导航的知识星系，将隐藏的创新机会计算为可评估的提案，将孤独的阅读过程转化为与 AI 同事协作的发现之旅。

**让知识可见，让创新可计算。**







