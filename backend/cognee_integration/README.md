# Cognee Integration for Research-Nexus Pro

This module provides deep integration between Cognee knowledge graph engine and Research-Nexus Pro.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Research-Nexus Pro Frontend                    │
│                     (React + ReactFlow)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Research-Nexus API (FastAPI)                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  local_routes   │  │  cognee_routes   │  │  unified_routes│  │
│  │  (existing)     │  │  (new)           │  │  (new)         │  │
│  └─────────────────┘  └──────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cognee Integration Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Config     │  │   Pipeline   │  │   Schema/Models      │  │
│  │   Manager    │  │   Wrapper    │  │   (Pydantic)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Custom Research Prompts                      │  │
│  │   (generate_research_graph_prompt.txt)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Cognee Engine                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │
│  │  add()   │  │cognify() │  │ search() │  │ Graph Store  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

1. **Configure Cognee**:
```python
from cognee_integration import CogneeConfig

config = CogneeConfig(
    llm_api_key="your-api-key",
    llm_endpoint="https://api.kimi.com/coding",
    llm_model="anthropic/k2p5",
    embedding_provider="fastembed",
    embedding_model="BAAI/bge-base-en-v1.5"
)
config.apply()
```

2. **Process a Paper**:
```python
from cognee_integration import ResearchPaperProcessor

processor = ResearchPaperProcessor()
result = await processor.process_paper(paper_text, paper_meta)
```

3. **Search Knowledge Graph**:
```python
results = await processor.search("tactile perception methods")
```

## File Structure

```
cognee_integration/
├── __init__.py                 # Main exports
├── config.py                   # Configuration management
├── schemas.py                  # Pydantic models
├── pipeline.py                 # Cognee pipeline wrapper
├── adapter.py                  # Data format adapter
├── prompts/
│   └── generate_research_graph_prompt.txt
├── routers/
│   ├── __init__.py
│   └── cognee_routes.py        # FastAPI routes
└── tests/
    └── test_integration.py
```

## Environment Variables

```bash
# LLM Configuration
COGNEE_LLM_API_KEY=your-api-key
COGNEE_LLM_ENDPOINT=https://api.kimi.com/coding
COGNEE_LLM_MODEL=anthropic/k2p5

# Embedding Configuration
COGNEE_EMBEDDING_PROVIDER=fastembed
COGNEE_EMBEDDING_MODEL=BAAI/bge-base-en-v1.5
COGNEE_EMBEDDING_DIMENSIONS=768

# Storage
COGNEE_SYSTEM_ROOT=./cognee_data
```
