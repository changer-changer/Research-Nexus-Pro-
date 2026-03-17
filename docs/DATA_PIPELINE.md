# Paper Research Agent → Visualization Pipeline

## Overview

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│ 1. Discover │───▶│ 2. Deep Read │───▶│ 3. Extract   │───▶│ 4. Visualize│
│   Papers    │    │   & Analyze  │    │  & Structure │    │   & Update  │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
     arXiv              PDF               JSON Schema         React App
     Search             Parse             Validate            Hot Reload
```

## Step 1: Paper Discovery

Agent searches for papers using:
- arXiv API queries
- Citation graph traversal
- Keyword-based search
- Seed paper expansion

Output: `papers_queue.json`

## Step 2: Deep Reading

For each paper, extract:
- **Title, Authors, Year, Venue**
- **Abstract summary** (2-3 sentences)
- **Core methodology** (what technique/approach)
- **Problems addressed** (which research problems)
- **Key innovations** (what's new)
- **Experimental results** (metrics, benchmarks)
- **Limitations** (what it doesn't solve)
- **References** (papers it cites from our collection)

## Step 3: Structured Extraction

Agent MUST output in this exact JSON format:

```json
{
  "paper": {
    "id": "PaperName_arxivId",
    "title": "Full Title",
    "year": 2024,
    "venue": "arXiv|CoRL|ICRA|RSS|IROS|CORL",
    "arxivId": "2401.12345",
    "category": "Tactile|Diffusion/Flow|VLA|Manipulation|Perception|Policy",
    "methodology": "Core technique name",
    "authorityScore": 8.5,
    "summary": "2-3 sentence summary"
  },
  
  "problems": [
    {
      "id": "descriptive_problem_id",
      "name": "Human-readable problem name",
      "description": "What this problem is about",
      "status": "solved|partial|active|unsolved",
      "year": 2023,
      "parentId": "parent_problem_id",
      "valueScore": 85,
      "solvesPaper": true
    }
  ],
  
  "methods": [
    {
      "id": "method_id",
      "name": "Method Name",
      "status": "verified|partial|failed|untested",
      "description": "What this method does",
      "targets": ["problem_id_1", "problem_id_2"],
      "year": 2023,
      "parentId": "parent_method_id"
    }
  ],
  
  "citations": [
    {
      "from": "this_paper_id",
      "to": "cited_paper_id",
      "type": "extends|uses|compares|critiques"
    }
  ],
  
  "innovations": [
    {
      "description": "Key innovation",
      "significance": "high|medium|low",
      "buildsOn": "previous_work_id"
    }
  ]
}
```

## Step 4: Data Pipeline

### 4.1 Validation
```bash
python scripts/validate_extraction.py output.json
# Checks: required fields, valid status values, valid references
```

### 4.2 Merge into dataset
```bash
python scripts/merge_papers.py output.json
# Merges into: src/data/real_papers.json
# - Deduplicates papers
# - Updates problem hierarchy
# - Adds new methods
# - Maintains citation graph
```

### 4.3 Hot reload
```bash
# Dev server auto-reloads on data change
# Or trigger manual refresh:
curl -X POST http://localhost:3000/api/refresh
```

## Agent Prompt Template

```
You are a research paper analyzer. Read the provided paper and extract structured information.

PAPER: {paper_title}
CONTENT: {paper_text}

Your task:
1. Identify the core research problem(s) this paper addresses
2. Map these to existing problems in our taxonomy (if any)
3. Identify the methodology/approach used
4. Determine verification status (verified/partial/failed/untested)
5. Extract citation relationships to papers in our collection
6. Assess the significance/value of contributions

EXISTING PROBLEMS:
{existing_problems_json}

EXISTING METHODS:
{existing_methods_json}

EXISTING PAPERS:
{existing_papers_json}

IMPORTANT RULES:
- Every problem MUST have a parentId (except root)
- Every method MUST have targets (problem IDs it addresses)
- Status must be one of: solved|partial|active|unsolved
- Method status: verified|partial|failed|untested
- Value scores: 0-100 based on significance
- Include all papers this paper cites from our collection

Output ONLY valid JSON matching the schema above.
```

## Quality Metrics

Track extraction quality:
- **Completeness**: % of required fields populated
- **Accuracy**: spot-check vs manual review
- **Consistency**: cross-paper relationship validation
- **Coverage**: % of papers in collection analyzed

## Automation Flow

```bash
# Full pipeline
./scripts/full_pipeline.sh "tactile diffusion policy" --max 20

# Steps:
# 1. Search arXiv
# 2. Download PDFs  
# 3. Run agent on each paper
# 4. Validate outputs
# 5. Merge into dataset
# 6. Trigger frontend refresh
# 7. Generate summary report
```
