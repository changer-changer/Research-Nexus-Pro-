import os
import sys
import sqlite3
import asyncio
import logging
from pathlib import Path
from datetime import datetime

# Setup paths
BACKEND_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(BACKEND_DIR))

from app.database.local_graph import LocalGraphDB
from app.database.local_vector import LocalVectorDB
from app.services.ingestion_pipeline import IngestionPipeline

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('/tmp/batch_reextract.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

DB_PATH = BACKEND_DIR / 'data' / 'research_graph.db'
PAPER_LIBRARY = Path(os.environ.get('PAPER_LIBRARY', str(BACKEND_DIR.parent / 'papers')))
PROGRESS_FILE = Path('/tmp/batch_reextract_progress.json')


def get_pdf_path(paper_id: str) -> str | None:
    """Find PDF path for a paper_id."""
    candidates = []
    for root, _, files in os.walk(PAPER_LIBRARY):
        for f in files:
            if not f.endswith('.pdf'):
                continue
            key = f[:-4]
            if key == paper_id:
                return os.path.join(root, f)
            if paper_id in key or key in paper_id:
                candidates.append((os.path.join(root, f), len(key)))
    if candidates:
        # Prefer longest match
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
    orphans = [pid for pid in all_papers if pid not in claimed]
    return orphans


async def process_one(pipeline: IngestionPipeline, paper_id: str, pdf_path: str, semaphore: asyncio.Semaphore):
    async with semaphore:
        try:
            meta = {
                "paper_id": paper_id,
                "title": paper_id,
                "authors": ["Unknown"],
                "year": "2024",
                "venue": "ArXiv"
            }
            # Try to extract year from paper_id if it looks like arxiv
            import re
            m = re.search(r'\d{4}', paper_id)
            if m:
                year_str = m.group(0)
                if year_str.startswith('20') or year_str.startswith('19'):
                    meta["year"] = year_str

            result = await pipeline.process_paper(pdf_path, meta)
            logger.info(f"✅ {paper_id}: {result.get('claims_extracted', 0)} claims")
            return {"paper_id": paper_id, "status": "success", "claims": result.get('claims_extracted', 0)}
        except Exception as e:
            logger.error(f"❌ {paper_id}: {e}")
            return {"paper_id": paper_id, "status": "error", "error": str(e)}


async def main():
    orphans = get_orphan_papers()
    logger.info(f"Found {len(orphans)} orphan papers to re-extract")

    # Load progress if exists
    done_ids = set()
    if PROGRESS_FILE.exists():
        import json
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
        done_ids = set(progress.get('done', []))
        logger.info(f"Resuming from previous run: {len(done_ids)} already done")

    remaining = [pid for pid in orphans if pid not in done_ids]
    logger.info(f"Remaining to process: {len(remaining)}")

    graph_db = LocalGraphDB(str(DB_PATH))
    vector_db = LocalVectorDB()
    pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)

    semaphore = asyncio.Semaphore(2)  # 2 concurrent API calls

    results = []
    batch_size = 10

    for i in range(0, len(remaining), batch_size):
        batch = remaining[i:i+batch_size]
        tasks = []
        for pid in batch:
            pdf_path = get_pdf_path(pid)
            if not pdf_path:
                logger.warning(f"⚠️ No PDF found for {pid}, skipping")
                results.append({"paper_id": pid, "status": "skipped", "reason": "no_pdf"})
                continue
            tasks.append(process_one(pipeline, pid, pdf_path, semaphore))

        if tasks:
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

        # Save progress
        done_ids.update(r['paper_id'] for r in results if r['status'] in ('success', 'error', 'skipped'))
        import json
        with open(PROGRESS_FILE, 'w') as f:
            json.dump({
                'done': sorted(done_ids),
                'total': len(orphans),
                'processed': len(done_ids),
                'timestamp': datetime.now().isoformat()
            }, f, indent=2)
        logger.info(f"Progress saved: {len(done_ids)}/{len(orphans)}")

    # Final stats
    success = sum(1 for r in results if r['status'] == 'success')
    errors = sum(1 for r in results if r['status'] == 'error')
    skipped = sum(1 for r in results if r['status'] == 'skipped')
    logger.info(f"Batch re-extraction complete. Success: {success}, Errors: {errors}, Skipped: {skipped}")


if __name__ == '__main__':
    asyncio.run(main())
