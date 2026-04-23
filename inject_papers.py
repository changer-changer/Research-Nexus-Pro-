#!/usr/bin/env python3
"""
Extract metadata from PDFs and inject into research_graph.db
"""

import os
import sys
import json
import sqlite3
import re
from pathlib import Path
from typing import Dict, Any, List
import subprocess

# PDF directories
PDF_DIRS = [
    "/home/cuizhixing/.openclaw/workspace/科研内容/论文收集/06_多智能体协作",
    "/home/cuizhixing/.openclaw/workspace/科研内容/论文收集/07_智能体长时间记忆",
    "/home/cuizhixing/.openclaw/workspace/科研内容/论文收集/08_智能体工具调用",
]

DB_PATH = "/home/cuizhixing/.openclaw/workspace/Projects/lobster-contest-2026/research-nexus-pro/backend/data/research_graph.db"


def extract_arxiv_id_from_filename(filename: str) -> str:
    """Extract arXiv ID from filename like arxiv_2401_12345.pdf"""
    match = re.search(r'(\d{4})[_\.](\d{4,5})', filename)
    if match:
        return f"{match.group(1)}.{match.group(2)}"
    return None


def get_category_from_path(path: str) -> str:
    """Determine category from path"""
    if "06_多智能体" in path:
        return "multi_agent"
    elif "07_智能体长时间记忆" in path or "07_智能体记忆" in path:
        return "agent_memory"
    elif "08_智能体工具调用" in path:
        return "agent_tools"
    return "other"


def extract_text_from_pdf_first_page(pdf_path: str) -> str:
    """Try to extract text from PDF first page using pdftotext"""
    try:
        result = subprocess.run(
            ['pdftotext', '-f', '1', '-l', '1', pdf_path, '-'],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout[:3000]  # First 3000 chars
    except:
        return ""


def extract_title_from_text(text: str) -> str:
    """Try to extract title from PDF text"""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if len(lines) > 0:
        # Title is usually first substantial line
        for line in lines[:20]:
            if len(line) > 20 and len(line) < 200:
                return line
    return "Unknown Title"


def process_pdfs() -> List[Dict[str, Any]]:
    """Process all PDFs and extract metadata"""
    papers = []
    
    for pdf_dir in PDF_DIRS:
        if not os.path.exists(pdf_dir):
            print(f"Directory not found: {pdf_dir}")
            continue
            
        category = get_category_from_path(pdf_dir)
        
        for pdf_file in sorted(os.listdir(pdf_dir)):
            if not pdf_file.endswith('.pdf'):
                continue
                
            pdf_path = os.path.join(pdf_dir, pdf_file)
            arxiv_id = extract_arxiv_id_from_filename(pdf_file)
            
            if not arxiv_id:
                print(f"Skipping {pdf_file} - no arXiv ID found")
                continue
            
            # Extract text and title
            text = extract_text_from_pdf_first_page(pdf_path)
            title = extract_title_from_text(text)
            
            paper = {
                "id": f"arxiv_{arxiv_id.replace('.', '_')}",
                "type": "paper",
                "arxiv_id": arxiv_id,
                "title": title,
                "category": category,
                "pdf_filename": pdf_file,
                "pdf_path": pdf_path,
                "year": 2024 if arxiv_id.startswith('24') else 2023,
            }
            papers.append(paper)
            print(f"Processed: {arxiv_id} - {title[:60]}...")
    
    return papers


def inject_into_database(papers: List[Dict[str, Any]]):
    """Inject papers into SQLite database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    inserted = 0
    skipped = 0
    
    for paper in papers:
        # Check if already exists
        cursor.execute("SELECT id FROM nodes WHERE id = ?", (paper["id"],))
        if cursor.fetchone():
            print(f"Skipping (exists): {paper['arxiv_id']}")
            skipped += 1
            continue
        
        # Prepare data JSON
        data_json = json.dumps({
            "title": paper["title"],
            "arxiv_id": paper["arxiv_id"],
            "year": paper["year"],
            "category": paper["category"],
            "pdf_path": paper["pdf_path"],
            "venue": "arXiv",
            "authors": [],
            "abstract": "",
            "keywords": [paper["category"]],
        }, ensure_ascii=False)
        
        # Insert into database
        cursor.execute(
            "INSERT INTO nodes (id, type, data, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
            (paper["id"], "paper", data_json)
        )
        inserted += 1
        print(f"Inserted: {paper['arxiv_id']} - {paper['title'][:50]}...")
    
    conn.commit()
    conn.close()
    
    print(f"\n=== Summary ===")
    print(f"Inserted: {inserted}")
    print(f"Skipped (already exists): {skipped}")
    print(f"Total processed: {len(papers)}")


if __name__ == "__main__":
    print("=== Extracting PDF metadata ===")
    papers = process_pdfs()
    
    if papers:
        print(f"\n=== Injecting {len(papers)} papers into database ===")
        inject_into_database(papers)
    else:
        print("No papers found to process")
