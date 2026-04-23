#!/usr/bin/env python3
"""
Paper injection script - simplified version for direct execution
"""
import os
import json
import sqlite3

# Get all PDFs
pdf_dirs = [
    "/home/cuizhixing/.openclaw/workspace/科研内容/论文收集/06_多智能体协作",
    "/home/cuizhixing/.openclaw/workspace/科研内容/论文收集/07_智能体长时间记忆", 
    "/home/cuizhixing/.openclaw/workspace/科研内容/论文收集/08_智能体工具调用",
]

db_path = "/home/cuizhixing/.openclaw/workspace/Projects/lobster-contest-2026/research-nexus-pro/backend/data/research_graph.db"

# Map directories to categories
category_map = {
    "06_多智能体": "multi_agent",
    "07_智能体长时间记忆": "agent_memory", 
    "07_智能体记忆": "agent_memory",
    "08_智能体工具调用": "agent_tools",
}

def get_category(path):
    for key, val in category_map.items():
        if key in path:
            return val
    return "other"

# Collect PDFs
papers = []
for pdf_dir in pdf_dirs:
    if not os.path.exists(pdf_dir):
        continue
    for f in os.listdir(pdf_dir):
        if f.endswith('.pdf'):
            # Use filename as ID (without extension)
            paper_id = f.replace('.pdf', '').replace(' ', '_')
            category = get_category(pdf_dir)
            papers.append({
                'id': paper_id,
                'arxiv_id': '',
                'title': f.replace('.pdf', '').replace('_', ' '),
                'category': category,
                'year': 2024
            })

print(f"Found {len(papers)} PDFs to inject")

# Inject into database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

inserted = 0
for paper in papers:
    cursor.execute("SELECT id FROM nodes WHERE id = ?", (paper['id'],))
    if cursor.fetchone():
        continue
    
    data = json.dumps({
        'title': paper['title'],
        'arxiv_id': paper['arxiv_id'],
        'year': paper['year'],
        'category': paper['category'],
        'venue': 'arXiv',
        'tags': [paper['category'], 'agent', 'llm']
    })
    
    cursor.execute(
        "INSERT INTO nodes (id, type, data, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        (paper['id'], 'paper', data)
    )
    inserted += 1

conn.commit()
conn.close()
print(f"Injected {inserted} new papers")
print(f"Total papers in DB: {inserted + 206}")
