#!/usr/bin/env python3
"""Minimal backend for testing imported papers"""
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

DB_PATH = Path(__file__).parent / 'data/research_graph.db'

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'research-nexus-minimal'}

@app.get('/api/papers')
def get_papers():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM papers ORDER BY year DESC')
    rows = cursor.fetchall()
    conn.close()
    
    papers = []
    for row in rows:
        papers.append({
            'id': row['id'],
            'arxiv_id': row['arxiv_id'],
            'title': row['title'],
            'authors': json.loads(row['authors']) if row['authors'] else [],
            'year': row['year'],
            'venue': row['venue'],
            'category': row['category']
        })
    return {'papers': papers}

@app.get('/api/papers/count')
def get_paper_count():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM papers')
    count = cursor.fetchone()[0]
    conn.close()
    return {'count': count}

@app.get('/api/papers/categories')
def get_categories():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT category, COUNT(*) as count FROM papers GROUP BY category')
    rows = cursor.fetchall()
    conn.close()
    return {row['category']: row['count'] for row in rows}

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='warning')
