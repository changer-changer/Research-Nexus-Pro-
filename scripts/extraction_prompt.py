#!/usr/bin/env python3
"""
Paper Research Agent - Structured Extraction Prompt
Generates the prompt for deep paper analysis and structured data extraction.
"""

import json
import sys
import os

def load_existing_data(data_dir: str) -> dict:
    """Load existing problems, methods, papers for context."""
    problems = []
    methods = []
    papers = []
    
    p_file = os.path.join(data_dir, 'problems.json')
    m_file = os.path.join(data_dir, 'methods.json')
    pap_file = os.path.join(data_dir, 'papers.json')
    
    if os.path.exists(p_file):
        with open(p_file) as f:
            problems = json.load(f)
    if os.path.exists(m_file):
        with open(m_file) as f:
            methods = json.load(f)
    if os.path.exists(pap_file):
        with open(pap_file) as f:
            papers = json.load(f)
    
    return {"problems": problems, "methods": methods, "papers": papers}

def generate_extraction_prompt(paper_title: str, paper_content: str, existing_data: dict) -> str:
    """Generate the structured extraction prompt for the agent."""
    
    # Simplify existing data for prompt context
    problem_summary = []
    for pid, p in existing_data.get("problems", {}).items() if isinstance(existing_data.get("problems"), dict) else []:
        problem_summary.append(f"- {pid}: {p.get('name', '')} ({p.get('status', 'unknown')})")
    
    method_summary = []
    for mid, m in existing_data.get("methods", {}).items() if isinstance(existing_data.get("methods"), dict) else []:
        method_summary.append(f"- {mid}: {m.get('name', '')} ({m.get('status', 'unknown')})")
    
    paper_ids = list(existing_data.get("papers", {}).keys()) if isinstance(existing_data.get("papers"), dict) else []

    prompt = f"""You are a research paper analyzer specializing in robotic manipulation, tactile sensing, diffusion policies, and vision-language-action models.

## Your Task

Read the paper "{paper_title}" and extract ALL structured information needed for our research knowledge graph.

## Paper Content
{paper_content[:15000]}  # Truncate for prompt

## Existing Problem Taxonomy
{chr(10).join(problem_summary[:30])}

## Existing Methods
{chr(10).join(method_summary[:20])}

## Existing Paper IDs (for citation matching)
{', '.join(paper_ids[:50])}

## Required Output Format

Output ONLY valid JSON. No explanation, no markdown, just JSON:

```json
{{
  "paper": {{
    "id": "PaperName_arxivId",
    "title": "exact title",
    "year": 2024,
    "venue": "arXiv|CoRL|ICRA|RSS|IROS",
    "arxivId": "2401.xxxxx",
    "category": "Tactile|Diffusion/Flow|VLA|Manipulation|Perception|Policy|Other",
    "methodology": "Core technique (e.g., Diffusion Policy, PointNet, VLA)",
    "authorityScore": 7.5,
    "summary": "2-3 sentence summary for display"
  }},
  "problems": [
    {{
      "id": "snake_case_id",
      "name": "Human readable name",
      "description": "What this problem is and why it matters",
      "status": "solved|partial|active|unsolved",
      "year": 2023,
      "parentId": "existing_or_new_parent_id",
      "valueScore": 85,
      "branchId": "b_tactile|b_diffusion|b_vla|b_perception|b_policy|b_manipulation",
      "solvesThisProblem": true
    }}
  ],
  "methods": [
    {{
      "id": "method_snake_case",
      "name": "Method Name",
      "status": "verified|partial|failed|untested",
      "description": "What this method does",
      "targets": ["problem_id_1"],
      "year": 2023,
      "parentId": "parent_method_id_if_any"
    }}
  ],
  "citations": [
    {{
      "from": "this_paper_id",
      "to": "cited_paper_id_from_our_collection",
      "relevance": "extends|uses|compares|validates"
    }}
  ],
  "keyFindings": [
    "Finding 1: specific result or contribution",
    "Finding 2: another key finding"
  ],
  "limitations": [
    "Limitation 1",
    "Limitation 2"
  ]
}}
```

## Critical Rules

1. **Problem Hierarchy**: Every problem MUST have parentId (except if it's a new root problem). Link to existing problems when possible.

2. **Status Assessment**:
   - `solved`: Paper provides complete solution with strong evidence
   - `partial`: Paper makes progress but doesn't fully solve
   - `active`: Paper identifies as open research direction
   - `unsolved`: Paper mentions but doesn't address

3. **Method Verification**:
   - `verified`: Paper provides strong experimental validation
   - `partial`: Some validation but limited
   - `failed`: Paper shows this approach doesn't work
   - `untested`: Mentioned but not validated

4. **Value Score (0-100)**:
   - 90-100: Fundamental breakthrough
   - 70-89: Significant advancement
   - 50-69: Solid contribution
   - 30-49: Incremental progress
   - 10-29: Minor improvement

5. **Citations**: Match to existing paper IDs when the paper cites them. Use exact IDs from our collection.

6. **Branch Assignment**: Map to the most relevant domain branch.

## Output

Return ONLY the JSON object. No other text.
"""
    return prompt

def main():
    if len(sys.argv) < 3:
        print("Usage: python extraction_prompt.py <paper_title> <paper_content_file> [data_dir]")
        sys.exit(1)
    
    paper_title = sys.argv[1]
    paper_file = sys.argv[2]
    data_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.abspath(__file__)) + "/../data"
    
    with open(paper_file) as f:
        paper_content = f.read()
    
    existing_data = load_existing_data(data_dir)
    prompt = generate_extraction_prompt(paper_title, paper_content, existing_data)
    
    print(prompt)

if __name__ == "__main__":
    main()
