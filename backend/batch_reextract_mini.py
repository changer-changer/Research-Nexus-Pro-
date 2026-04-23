import sys
import os
import re
import json
import asyncio
import logging
import sqlite3
from pathlib import Path
from datetime import datetime

BACKEND_DIR = Path(__file__).parent.resolve()
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('reextract')

DB_PATH = BACKEND_DIR / 'data' / 'research_graph.db'
PAPER_LIBRARY = Path(os.environ.get('PAPER_LIBRARY', str(BACKEND_DIR.parent / 'papers')))
PROGRESS_FILE = Path('/tmp/batch_reextract_progress.json')
BATCH_SIZE = 5


def get_pdf_path(paper_id: str):
    candidates = []
    for root, _, files in os.walk(PAPER_LIBRARY):
        for f in files:
            if not f.endswith('.pdf'):
                continue
            key = f[:-4]
            full = os.path.join(root, f)
            if key == paper_id:
                return full
            if paper_id in key or key in paper_id:
                candidates.append((full, len(key)))
    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]
    return None


def get_orphan_papers():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM nodes WHERE type='paper'")
    all_papers = [r[0] for r in c.fetchall()]
    c.execute("SELECT DISTINCT paper_id FROM claims")
    claimed = set(r[0] for r in c.fetchall())
    conn.close()
    return [pid for pid in all_papers if pid not in claimed]


async def process_one(pipeline, pid):
    pdf_path = get_pdf_path(pid)
    if not pdf_path:
        logger.warning(f'⚠️ {pid}: no PDF found, skipped')
        return {'paper_id': pid, 'status': 'skipped'}
    try:
        meta = {'paper_id': pid, 'title': pid, 'authors': ['Unknown'], 'year': '2024', 'venue': 'ArXiv'}
        m = re.search(r'\d{4}', pid)
        if m and m.group(0).startswith(('19', '20')):
            meta['year'] = m.group(0)
        result = await pipeline.process_paper(pdf_path, meta)
        logger.info(f'✅ {pid}: {result.get("claims_extracted", 0)} claims')
        return {'paper_id': pid, 'status': 'success', 'claims': result.get('claims_extracted', 0)}
    except Exception as e:
        logger.error(f'❌ {pid}: {e}')
        return {'paper_id': pid, 'status': 'error', 'error': str(e)}


async def main():
    from app.database.local_graph import LocalGraphDB
    from app.database.local_vector import LocalVectorDB
    from app.services.ingestion_pipeline import IngestionPipeline

    graph_db = LocalGraphDB(str(DB_PATH))
    vector_db = LocalVectorDB()
    pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)

    while True:
        orphans = get_orphan_papers()
        done_ids = set()
        if PROGRESS_FILE.exists():
            with open(PROGRESS_FILE) as f:
                progress = json.load(f)
            done_ids = set(progress.get('done', []))

        remaining = [pid for pid in orphans if pid not in done_ids]
        logger.info(f'Orphans: {len(orphans)} | Done: {len(done_ids)} | Remaining: {len(remaining)}')

        if not remaining:
            logger.info('All caught up. Exiting.')
            break

        batch = remaining[:BATCH_SIZE]
        results = []
        for pid in batch:
            results.append(await process_one(pipeline, pid))

        done_ids.update(r['paper_id'] for r in results)
        with open(PROGRESS_FILE, 'w') as f:
            json.dump({
                'done': sorted(done_ids),
                'total': len(orphans),
                'timestamp': datetime.now().isoformat()
            }, f)
        logger.info(f'Batch saved. Progress: {len(done_ids)}/{len(orphans)}')
        await asyncio.sleep(10)


if __name__ == '__main__':
    asyncio.run(main())
