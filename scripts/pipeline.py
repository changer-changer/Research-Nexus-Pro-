#!/usr/bin/env python3
"""
Full Pipeline: Discover → Read → Extract → Merge → Visualize
Orchestrates the entire paper-to-visualization flow.
"""

import json
import os
import sys
import subprocess
import time
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_DIR, "data")
PAPERS_DIR = os.path.join(PROJECT_DIR, "data", "pdfs")
FRONTEND_DATA = os.path.join(PROJECT_DIR, "research-nexus-pro", "src", "data", "real_papers.json")

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def load_json(path: str) -> dict:
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}

def run_extraction(papers: list, max_papers: int = None):
    """Run extraction on a list of papers."""
    if max_papers:
        papers = papers[:max_papers]
    
    log(f"Processing {len(papers)} papers...")
    
    results = []
    for i, paper in enumerate(papers):
        paper_id = paper.get("id", paper.get("filename", f"paper_{i}"))
        log(f"  [{i+1}/{len(papers)}] {paper_id}")
        
        # Check if already processed
        frontend_data = load_json(FRONTEND_DATA)
        existing_ids = [p.get("id") for p in frontend_data.get("papers", [])]
        if paper_id in existing_ids:
            log(f"    ⏭️  Already in dataset, skipping")
            continue
        
        # Find PDF or analysis file
        pdf_path = os.path.join(PAPERS_DIR, f"{paper_id}.pdf")
        analysis_path = os.path.join(DATA_DIR, "analysis", f"{paper_id}.md")
        
        if os.path.exists(analysis_path):
            log(f"    📄 Found analysis document")
            # In real pipeline, this would call the AI agent
            # For now, we track what needs processing
            results.append({
                "paper_id": paper_id,
                "status": "needs_agent_processing",
                "source": analysis_path
            })
        elif os.path.exists(pdf_path):
            log(f"    📕 Found PDF")
            results.append({
                "paper_id": paper_id,
                "status": "needs_pdf_analysis",
                "source": pdf_path
            })
        else:
            log(f"    ⚠️  No source found")
    
    return results

def generate_report(pending: list):
    """Generate processing report."""
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_pending": len(pending),
        "needs_agent": len([p for p in pending if p["status"] == "needs_agent_processing"]),
        "needs_pdf": len([p for p in pending if p["status"] == "needs_pdf_analysis"]),
        "papers": pending
    }
    
    report_path = os.path.join(PROJECT_DIR, "pipeline_report.json")
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    log(f"Report saved: {report_path}")
    return report

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Paper-to-Visualization Pipeline")
    parser.add_argument("--max", type=int, help="Max papers to process")
    parser.add_argument("--list", action="store_true", help="List pending papers")
    parser.add_argument("--report", action="store_true", help="Generate report only")
    args = parser.parse_args()
    
    log("=== Research-Nexus Pipeline ===")
    
    # Load paper list
    papers_file = os.path.join(DATA_DIR, "papers.json")
    csv_file = os.path.join(DATA_DIR, "paper_list.csv")
    if not os.path.exists(papers_file):
        # Try CSV in data dir
        if os.path.exists(csv_file):
            import csv
            papers = []
            with open(csv_file) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    papers.append({
                        "id": row.get("Filename", "").replace(".pdf", ""),
                        "arxiv_id": row.get("ArXiv ID", "")
                    })
        else:
            log("❌ No paper list found")
            sys.exit(1)
    else:
        papers_data = load_json(papers_file)
        if isinstance(papers_data, dict):
            papers = [{"id": k, **v} for k, v in papers_data.items()]
        else:
            papers = papers_data
    
    log(f"Found {len(papers)} papers in collection")
    
    if args.list:
        for p in papers[:20]:
            print(f"  - {p.get('id', p.get('title', 'Unknown'))}")
        return
    
    # Run extraction
    pending = run_extraction(papers, args.max)
    
    # Generate report
    report = generate_report(pending)
    
    log(f"\n📊 Summary:")
    log(f"   Total papers: {len(papers)}")
    log(f"   Pending processing: {len(pending)}")
    log(f"   Already in dataset: {len(papers) - len(pending)}")
    
    if pending:
        log(f"\n⚠️  {len(pending)} papers need agent processing")
        log(f"   Run with agent to extract structured data")

if __name__ == "__main__":
    main()
