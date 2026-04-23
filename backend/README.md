# Research-Nexus Backend: Agent-Native Knowledge Discovery Engine

## Architecture Overview

This backend implements a **dual-track (Graph + Vector) research knowledge discovery engine** designed specifically for AI Agents to traverse, reason, and discover insights across academic literature.

### Core Philosophy

- **Agent-First Design**: Every component is optimized for programmatic access, not human reading
- **Token Efficiency**: Minimal, structured outputs that fit within LLM context windows
- **Cross-Domain Discovery**: Vector similarity + Graph topology enables finding hidden connections
- **Honest Science**: Every "solution" relationship includes explicit limitations

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AGENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │Skill 1      │  │Skill 2      │  │Skill 3      │  │Skill 4  │ │
│  │Extract      │  │Query Gaps   │  │Cross-Domain │  │Merge    │ │
│  │Triplets     │  │             │  │Innovation   │  │Nodes    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │
│         │                │                │              │      │
└─────────┼────────────────┼────────────────┼──────────────┼──────┘
          │                │                │              │
          ▼                ▼                ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE LAYER                             │
│                                                                  │
│   ┌──────────────────┐        ┌──────────────────┐              │
│   │   Neo4j          │        │   Qdrant         │              │
│   │   (Graph DB)     │◄──────►│   (Vector DB)    │              │
│   │                  │        │                  │              │
│   │  Problems        │        │  Problem         │              │
│   │  Methods         │        │  Embeddings      │              │
│   │  Papers          │        │  Method          │              │
│   │  Relationships   │        │  Embeddings      │              │
│   └──────────────────┘        └──────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                              │
│              (Your Existing React App - Unchanged)               │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │   Research-Nexus Pro (React + GSAP)                  │      │
│   │   - Problem/Method Trees                             │      │
│   │   - Timeline Views                                   │      │
│   │   - Citation Networks                                │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Infrastructure

```bash
cd backend
docker-compose up -d
```

This starts:
- Neo4j at http://localhost:7474 (browser) and bolt://localhost:7687
- Qdrant at http://localhost:6333

### 2. Initialize Database Schema

```bash
python scripts/database_setup.py
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set Environment Variables

```bash
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="password"
export QDRANT_HOST="localhost"
export QDRANT_PORT="6333"
export OPENAI_API_KEY="your-api-key"
```

## The Four Agent Skills

### Skill 1: `extract_and_store_triplets(paper_text, paper_meta)`

**Purpose**: Convert unstructured paper text into structured knowledge graph triplets.

**Key Design**:
- Ultra-minimal LLM prompt (see `skill_1_extract.py`)
- Outputs ONLY JSON, no summaries
- Extracts: Problems, Methods, Relationships
- Every SOLVES relationship includes effectiveness + limitations
- Simultaneously stores in Neo4j (graph) and Qdrant (vectors)

**Usage**:
```python
result = extract_and_store_triplets(
    paper_text="Abstract: We propose...",
    paper_meta={
        "title": "RT-2: Vision-Language-Action Models",
        "authors": ["Brohan et al."],
        "year": 2023,
        "venue": "CoRL"
    },
    neo4j_driver=driver,
    qdrant_client=client
)
```

### Skill 2: `query_structural_gaps(domain=None)`

**Purpose**: Find structural vulnerabilities in the knowledge graph - opportunities for research.

**Discovery Patterns**:
1. **Isolated Abyss**: Problems addressed by papers but with no solving methods
2. **Bottleneck**: High-centrality problems with limited solution diversity

**Cypher Strategy**: Uses centrality algorithms and pattern matching to identify gaps.

### Skill 3: `cross_domain_innovation_search(problem_description, current_domain)`

**Purpose**: Find cross-domain analogies for unsolved problems.

**Mechanism**:
1. Embed the problem description
2. Search vector DB globally (all domains)
3. Filter out current domain
4. Return methods from other domains with similar mechanisms

**Example**: A robotics sim-to-real problem might find insights from climate modeling's ensemble methods.

### Skill 4: `merge_equivalent_nodes(node_id_1, node_id_2)`

**Purpose**: Knowledge alignment - merge duplicate concepts with different names.

**Trigger**: When vector similarity > 0.95 between two nodes

## Data Schema

### Nodes

| Type | Key Properties |
|------|----------------|
| Problem | id, name, definition, domain, resolution_status, embedding_id |
| Method | id, name, mechanism, complexity, embedding_id |
| Paper | id, title, authors, year, venue |

### Relationships

| Type | Source → Target | Key Properties |
|------|-----------------|----------------|
| SUB_PROBLEM_OF | Problem → Problem | - |
| EVOLVED_FROM | Problem → Problem | year |
| VARIANT_OF | Method → Method | - |
| COMPLEMENTARY_TO | Method → Method | - |
| SOLVES | Method → Problem | **effectiveness**, **limitations** |
| APPLIES_METHOD | Paper → Method | - |
| ADDRESSES_PROBLEM | Paper → Problem | - |

## Integration with Existing Frontend

**Important**: This backend is designed to coexist with your existing Research-Nexus Pro React app.

### Option 1: Side-by-Side (Recommended)

Your existing app continues to work unchanged. The backend provides:
- Enhanced data persistence
- Cross-domain discovery capabilities
- Agent-accessible API endpoints

### Option 2: Gradual Migration

You can incrementally migrate data from JSON files to the graph database:
```python
# Migrate existing problems
for problem in existing_problems:
    extract_and_store_triplets(
        paper_text=f"{problem['name']}: {problem.get('description', '')}",
        paper_meta={"title": "Legacy Data Import", "year": 2024, ...}
    )
```

## Agent Workflow Example

```python
# 1. Ingest new paper
result = extract_and_store_triplets(paper_text, paper_meta)

# 2. Discover research gaps
gaps = query_structural_gaps(domain="Robotics")
# Output: ["Problem X has 5 papers but only 1 method - bottleneck detected"]

# 3. Find cross-domain inspiration
inspirations = cross_domain_innovation_search(
    problem_description="Sim-to-real transfer gap",
    current_domain="Robotics"
)
# Output: ["Climate ensemble methods from Meteorology"]

# 4. Agent generates hypothesis
# "Perhaps ensemble domain randomization could help..."
```

## Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Neo4j schema design
- [x] Qdrant collections
- [x] Skill 1: Extraction
- [ ] Skill 2: Gap Query
- [ ] Skill 3: Cross-Domain
- [ ] Skill 4: Merge

### Phase 2: API Layer
- [ ] FastAPI endpoints
- [ ] Authentication
- [ ] Rate limiting

### Phase 3: Frontend Integration
- [ ] API client in React
- [ ] Real-time updates
- [ ] Visualization enhancements

## License

MIT - For research and educational use.

---

**Built for Agents, by Agents.** 🚀
