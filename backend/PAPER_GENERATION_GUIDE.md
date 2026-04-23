# Paper Generation Engine - Implementation Guide

## Overview

The Paper Generation Engine provides automated paper generation from innovation opportunities, with support for SSE streaming, feasibility evaluation, and quality validation.

## Components

### 1. PaperGenerationEngine (`engine.py`)
Main orchestrator for paper generation.

```python
from app.services.paper_generation import PaperGenerationEngine

# Initialize engine
engine = PaperGenerationEngine(llm_client=kimi_client)

# Generate paper
result = await engine.generate(innovation_id="innov-001", target_venue="NeurIPS")

# Stream generation
async for event in engine.stream_generate(task_id, innovation_id, target_venue):
    print(event)  # SSE formatted events
```

### 2. ExperimentFeasibilityEvaluator (`feasibility_evaluator.py`)
Evaluates experiment design practicality.

```python
from app.services.paper_generation import evaluate_experiment_feasibility

design = {
    "slots": [
        {"slot_id": "exp_1", "type": "main_performance", "estimated_weeks": 2},
        {"slot_id": "exp_2", "type": "ablation_study", "estimated_weeks": 1}
    ],
    "resources": {"compute_budget": 80, "data_access": 70}
}

result = evaluate_experiment_feasibility(design)
# Returns: overall_score, breakdown, recommendations, risk_mitigation
```

### 3. ProgressStreamer (`streamer.py`)
Manages SSE streaming for real-time progress updates.

```python
from app.services.paper_generation import ProgressStreamer

streamer = ProgressStreamer(task_id, engine)
async for event in streamer.stream_generation(innovation_id, target_venue):
    yield f"data: {event}\n\n"  # SSE format
```

### 4. PaperAssembler (`engine.py`)
Assembles paper sections into complete documents.

```python
from app.services.paper_generation import PaperAssembler

# Markdown
markdown = PaperAssembler.assemble_markdown(sections, experiment_slots)

# LaTeX
latex = PaperAssembler.assemble_latex(sections, experiment_slots)
```

### 5. Validators (`validators/`)
- `quality_checker.py`: Validates against venue standards
- `completeness_checker.py`: Checks section completeness

## API Endpoints

### Start Generation
```bash
POST /paper-generation/generate/{innovation_id}?target_venue=NeurIPS
Response: {"task_id": "...", "stream_url": "..."}
```

### Stream Progress
```bash
GET /paper-generation/stream/{task_id}?innovation_id=...&target_venue=...
Response: text/event-stream
```

### Evaluate Feasibility
```bash
POST /paper-generation/evaluate-feasibility
Body: {"slots": [...], "resources": {...}}
Response: feasibility report
```

### Check Status
```bash
GET /paper-generation/status/{task_id}
Response: {"status": "...", "progress": 50, ...}
```

## Generated Paper Structure

```
# Title
**Authors:** [To be filled]

## Abstract
[PMR format: Problem, Method, Result]

## 1. Introduction
[Problem background, contributions, paper structure]

## 2. Related Work
[Literature review]

## 3. Methodology
[Method overview, technical details, comparison]

## 4. Experimental Setup
[Design document + Data collection slots]

## 5. Results and Analysis
[Analysis framework]

## 6. Conclusion
[Summary, future work]

## References
[Citations to be added]
```

## Experiment Slots

Generated papers include placeholder slots for real data collection:

```json
{
  "slot_id": "exp_1",
  "type": "main_performance",
  "description": "Main performance evaluation",
  "placeholder": "[PENDING:实验1-主性能评估-预计2周]",
  "estimated_weeks": 2
}
```

## Prompt Templates

Located in `app/services/paper_generation/prompts/`:
- `title_generation.txt` - Generate paper titles
- `abstract_pmr.txt` - PMR format abstracts
- `introduction.txt` - Introduction sections
- `methodology.txt` - Methodology sections
- `experiment_design.txt` - Experiment design
- `analysis_framework.txt` - Analysis sections
- `conclusion.txt` - Conclusion sections
- `related_work.txt` - Literature review

## Testing

Run tests:
```bash
cd backend
./venv/bin/python test_paper_generation.py
```

## Integration

Add to main FastAPI app:
```python
from app.api import paper_generation_routes
app.include_router(paper_generation_routes.router)
```

## Configuration

Requires `KIMI_API_KEY` in environment or `.env` file for LLM generation.
