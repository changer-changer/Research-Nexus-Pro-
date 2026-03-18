#!/usr/bin/env python3
"""
Merge agent-extracted paper data into the frontend dataset.
Takes agent JSON output and merges into real_papers.json.
"""

import json
import sys
import os
import copy
from datetime import datetime

FRONTEND_DATA = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../research-nexus-pro/src/data/real_papers.json"
)

def load_frontend_data() -> dict:
    """Load current frontend dataset."""
    if os.path.exists(FRONTEND_DATA):
        with open(FRONTEND_DATA) as f:
            return json.load(f)
    return {"problems": [], "methods": [], "papers": [], "branches": []}

def validate_extraction(data: dict) -> list:
    """Validate agent output. Returns list of errors."""
    errors = []
    
    if "paper" not in data:
        errors.append("Missing 'paper' field")
    else:
        paper = data["paper"]
        for field in ["id", "title", "year", "category"]:
            if field not in paper:
                errors.append(f"Paper missing '{field}'")
    
    if "problems" in data:
        for i, p in enumerate(data["problems"]):
            if "id" not in p:
                errors.append(f"Problem {i} missing 'id'")
            if "name" not in p:
                errors.append(f"Problem {i} missing 'name'")
            if "status" not in p:
                errors.append(f"Problem {i} missing 'status'")
            if p.get("status") not in ["solved", "partial", "active", "unsolved"]:
                errors.append(f"Problem {i} invalid status: {p.get('status')}")
    
    if "methods" in data:
        for i, m in enumerate(data["methods"]):
            if "id" not in m:
                errors.append(f"Method {i} missing 'id'")
            if "status" not in m:
                errors.append(f"Method {i} missing 'status'")
            if m.get("status") not in ["verified", "partial", "failed", "untested"]:
                errors.append(f"Method {i} invalid status: {m.get('status')}")
    
    return errors

def merge_paper(frontend: dict, extraction: dict) -> dict:
    """Merge extracted paper data into frontend dataset."""
    result = copy.deepcopy(frontend)
    
    # Merge paper
    paper = extraction.get("paper", {})
    paper_exists = False
    for i, p in enumerate(result["papers"]):
        if p.get("id") == paper.get("id"):
            result["papers"][i] = {**p, **paper}
            paper_exists = True
            break
    if not paper_exists and paper.get("id"):
        result["papers"].append(paper)
    
    # Merge problems
    for new_prob in extraction.get("problems", []):
        exists = False
        for i, p in enumerate(result["problems"]):
            if p.get("id") == new_prob.get("id"):
                # Update existing
                result["problems"][i] = {**p, **new_prob}
                exists = True
                break
        if not exists:
            # Add paper reference
            new_prob["papers"] = [paper.get("id")]
            result["problems"].append(new_prob)
        else:
            # Add paper to existing problem
            if paper.get("id") not in result["problems"][i].get("papers", []):
                result["problems"][i].setdefault("papers", []).append(paper["id"])
    
    # Merge methods
    for new_method in extraction.get("methods", []):
        exists = False
        for i, m in enumerate(result["methods"]):
            if m.get("id") == new_method.get("id"):
                result["methods"][i] = {**m, **new_method}
                exists = True
                break
        if not exists:
            result["methods"].append(new_method)
    
    # Update paper's target references
    if paper.get("id"):
        prob_ids = [p["id"] for p in extraction.get("problems", []) if p.get("solvesThisProblem")]
        method_ids = [m["id"] for m in extraction.get("methods", [])]
        
        for i, p in enumerate(result["papers"]):
            if p.get("id") == paper.get("id"):
                result["papers"][i]["targets"] = list(set(p.get("targets", []) + prob_ids))
                result["papers"][i]["methods"] = list(set(p.get("methods", []) + method_ids))
    
    return result

def save_frontend_data(data: dict):
    """Save merged data back to frontend."""
    os.makedirs(os.path.dirname(FRONTEND_DATA), exist_ok=True)
    with open(FRONTEND_DATA, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def main():
    if len(sys.argv) < 2:
        print("Usage: python merge_papers.py <extraction_output.json>")
        sys.exit(1)
    
    extraction_file = sys.argv[1]
    
    with open(extraction_file) as f:
        extraction = json.load(f)
    
    # Validate
    errors = validate_extraction(extraction)
    if errors:
        print("Validation errors:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    
    # Load current data
    frontend = load_frontend_data()
    
    # Merge
    merged = merge_paper(frontend, extraction)
    
    # Save
    save_frontend_data(merged)
    
    # Report
    paper = extraction.get("paper", {})
    print(f"✅ Merged: {paper.get('title', 'Unknown')}")
    print(f"   Problems: +{len(extraction.get('problems', []))}")
    print(f"   Methods: +{len(extraction.get('methods', []))}")
    print(f"   Citations: {len(extraction.get('citations', []))}")
    print(f"   Total papers: {len(merged['papers'])}")
    print(f"   Total problems: {len(merged['problems'])}")
    print(f"   Total methods: {len(merged['methods'])}")

if __name__ == "__main__":
    main()
