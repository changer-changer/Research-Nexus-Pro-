"""
Paper Library Routes - Independent filesystem-based paper management
Manages a local paper repository with PDFs, markdown analyses, and categories.
Separate from the knowledge graph - papers can be imported into the graph optionally.
"""

import os
import json
import shutil
import uuid
import re
import random
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from app.database.local_graph import get_local_graph_db
from app.services.ingestion_pipeline import IngestionPipeline
from app.database.local_vector import get_local_vector_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/library", tags=["paper_library"])

# Default categories aligned with domain model
DEFAULT_CATEGORIES = [
    "multi_agent",
    "agent_memory",
    "agent_tools",
    "llm_reasoning",
    "robotics",
    "general"
]

CONFIG_KEY = "paper_library_path"


def _get_library_path() -> Optional[str]:
    """Get configured library path from database."""
    try:
        graph_db = get_local_graph_db()
        path = graph_db.get_config(CONFIG_KEY)
        if path and os.path.isdir(path):
            return path
    except Exception as e:
        logger.warning(f"Could not get library path: {e}")
    return None


def _ensure_library_structure(library_path: str):
    """Create directory structure if missing."""
    root = Path(library_path)
    root.mkdir(parents=True, exist_ok=True)
    (root / "categories").mkdir(exist_ok=True)
    for cat in DEFAULT_CATEGORIES:
        (root / "categories" / cat).mkdir(exist_ok=True)
    (root / "favorites").mkdir(exist_ok=True)


def _get_index_path(library_path: str) -> Path:
    return Path(library_path) / "index.json"


def _load_index(library_path: str) -> Dict[str, Any]:
    """Load or create index.json."""
    index_path = _get_index_path(library_path)
    if index_path.exists():
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load index.json: {e}")
    # Return default structure
    return {
        "version": "1.0.0",
        "schema": "research-nexus-paper-library",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "config": {
            "library_path": library_path,
            "categories": DEFAULT_CATEGORIES.copy()
        },
        "papers": [],
        "favorites": [],
        "stats": {
            "total_papers": 0,
            "total_categories": len(DEFAULT_CATEGORIES),
            "favorited": 0,
            "in_graph": 0
        }
    }


def _save_index(library_path: str, index: Dict[str, Any]):
    """Save index.json to disk."""
    index["updated_at"] = datetime.utcnow().isoformat()
    # Recalculate stats
    papers = index.get("papers", [])
    index["stats"] = {
        "total_papers": len(papers),
        "total_categories": len(index.get("config", {}).get("categories", [])),
        "favorited": len([p for p in papers if p.get("favorited")]),
        "in_graph": len([p for p in papers if p.get("in_graph")])
    }
    index_path = _get_index_path(library_path)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def _generate_paper_id(title: str, arxiv_id: Optional[str] = None) -> str:
    """Generate a unique paper ID."""
    base = arxiv_id if arxiv_id else title.lower().replace(" ", "_")[:30]
    return f"{base}_{uuid.uuid4().hex[:8]}"


def _sanitize_filename(title: str) -> str:
    """Sanitize title for filesystem use."""
    safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in title)
    return safe.strip().replace(" ", "_")


# =============================================================================
# CONFIG ENDPOINTS
# =============================================================================

@router.get("/config")
async def get_library_config():
    """Get current paper library configuration."""
    path = _get_library_path()
    return {
        "configured": path is not None,
        "library_path": path,
        "default_categories": DEFAULT_CATEGORIES
    }


@router.post("/config")
async def set_library_config(data: Dict[str, Any]):
    """Set the paper library root path."""
    library_path = data.get("library_path")
    if not library_path:
        raise HTTPException(status_code=400, detail="library_path is required")

    path = Path(library_path)
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)

    if not path.is_dir():
        raise HTTPException(status_code=400, detail="library_path must be a directory")

    # Persist in database
    graph_db = get_local_graph_db()
    graph_db.set_config(CONFIG_KEY, str(path.resolve()))

    # Ensure structure
    _ensure_library_structure(str(path))

    # Create index if missing
    index = _load_index(str(path))
    _save_index(str(path), index)

    return {
        "success": True,
        "library_path": str(path.resolve()),
        "message": "Library configured successfully"
    }


# =============================================================================
# INDEX ENDPOINTS
# =============================================================================

@router.get("/index")
async def get_library_index():
    """Read the library index.json."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured. POST /config first.")
    index = _load_index(path)
    return index


# Directories to skip during recursive scan
_SKIP_DIRS = {".venv", ".git", ".trae", "node_modules", "__pycache__", "favorites", "categories", "收藏"}
_SKIP_PREFIXES = (".", "_")


def _should_skip_dir(p: Path) -> bool:
    name = p.name
    if name in _SKIP_DIRS:
        return True
    if name.startswith(_SKIP_PREFIXES):
        return True
    return False


def pdf_path_to_stem(pdf_file: Path) -> str:
    """Extract a clean stem from a PDF filename."""
    return pdf_file.stem


# Generic subdir names that shouldn't be used as categories
_GENERIC_DIRS = {"pdfs", "papers", "docs", "documents", "pdf", "paper", "files", "archives", "download", "downloads"}


def _infer_category(pdf_path: Path, root: Path) -> str:
    """Infer category from the PDF's parent directory name.
    Removes numeric prefixes like '01_' and sanitizes.
    Skips generic subdirs like 'pdfs', 'papers' and uses the grandparent instead."""
    parent = pdf_path.parent
    if parent == root:
        return "general"

    cat = parent.name
    # If parent is a generic container dir, try grandparent
    if cat.lower() in _GENERIC_DIRS and parent.parent != root:
        cat = parent.parent.name

    # Remove numeric prefix like "01_", "02_" etc.
    if "_" in cat and cat.split("_")[0].isdigit():
        cat = "_".join(cat.split("_")[1:])
    return cat.strip()


def _find_markdown(pdf_path: Path, root: Path) -> Optional[Path]:
    """Find a markdown file associated with the PDF.
    Tries: same dir same stem, same dir with _analysis/_深度分析 suffix,
           or a sibling '分析稿' directory."""
    stem = pdf_path.stem
    parent = pdf_path.parent

    # 1. Same directory, same stem
    candidates = [
        parent / f"{stem}.md",
        parent / f"{stem}_analysis.md",
        parent / f"{stem}_深度分析.md",
    ]
    # Try each stem variant (handles filenames with underscores, spaces, etc.)
    for c in candidates:
        if c.exists():
            return c

    # 2. Sibling '分析稿' directory
    analysis_dir = parent / "分析稿"
    if analysis_dir.is_dir():
        # Find any .md that contains the stem (loose match)
        for md in analysis_dir.glob("*.md"):
            # Normalize: remove _analysis suffix and compare
            md_stem = md.stem
            for suffix in ("_analysis", "_深度分析"):
                if md_stem.endswith(suffix):
                    md_stem = md_stem[: -len(suffix)]
            if stem.lower() in md_stem.lower() or md_stem.lower() in stem.lower():
                return md
            # Also try removing trailing version numbers from PDF stem
            clean_stem = stem
            for sfx in ("v1", "v2", "v3", "v4"):
                if clean_stem.endswith(sfx):
                    clean_stem = clean_stem[: -len(sfx)]
            if clean_stem.lower() in md_stem.lower() or md_stem.lower() in clean_stem.lower():
                return md

    return None


def _extract_arxiv_id(stem: str) -> Optional[str]:
    """Try to extract arxiv ID from filename stem."""
    # Patterns: 2502.12191, 2301.00001, 2509.17684v1, etc.
    match = re.search(r"(\d{4}\.\d{4,5}[v\d]*)", stem)
    if match:
        return match.group(1)
    return None


@router.post("/index/rebuild")
async def rebuild_library_index():
    """Recursively scan the library root for all PDF files and rebuild index.json."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    root = Path(path)

    papers = []
    # Recursively find all PDFs, skipping system/hidden directories
    for pdf_file in root.rglob("*.pdf"):
        # Skip if any directory between root and the PDF should be skipped
        rel_parts = pdf_file.relative_to(root).parts[:-1]  # exclude filename
        skip = False
        for part in rel_parts:
            if part.startswith((".", "_")) or part in _SKIP_DIRS:
                skip = True
                break
        if skip:
            continue

        stem = pdf_path_to_stem(pdf_file)
        md_file = _find_markdown(pdf_file, root)
        arxiv_id = _extract_arxiv_id(stem)
        category = _infer_category(pdf_file, root)

        papers.append({
            "id": _generate_paper_id(stem, arxiv_id),
            "title": stem.replace("_", " ").strip(),
            "arxiv_id": arxiv_id,
            "filename_base": stem,
            "category": category,
            "pdf_path": str(pdf_file.relative_to(root)),
            "md_path": str(md_file.relative_to(root)) if md_file else None,
            "tags": [],
            "added_at": datetime.fromtimestamp(pdf_file.stat().st_mtime).isoformat(),
            "favorited": False,
            "in_graph": False,
            "graph_paper_id": None
        })

    index = _load_index(path)
    # Preserve favorites and in_graph status from old index
    old_papers = {p["id"]: p for p in index.get("papers", [])}
    for p in papers:
        old = old_papers.get(p["id"])
        if old:
            p["favorited"] = old.get("favorited", False)
            p["in_graph"] = old.get("in_graph", False)
            p["graph_paper_id"] = old.get("graph_paper_id")
            p["tags"] = old.get("tags", [])
            p["title"] = old.get("title", p["title"])

    # Update discovered categories
    discovered_cats = sorted({p["category"] for p in papers})
    existing_cats = index.get("config", {}).get("categories", [])
    all_cats = sorted(set(existing_cats + discovered_cats))
    index["config"]["categories"] = all_cats

    index["papers"] = papers
    _save_index(path, index)

    return {
        "success": True,
        "papers_found": len(papers),
        "stats": index["stats"]
    }


# =============================================================================
# CATEGORY ENDPOINTS
# =============================================================================

@router.get("/categories")
async def get_categories():
    """Get all categories discovered from actual papers in the library."""
    path = _get_library_path()
    if not path:
        return {"categories": DEFAULT_CATEGORIES}
    index = _load_index(path)
    # Derive categories from actual papers, not from stored config
    papers = index.get("papers", [])
    cats = sorted({p["category"] for p in papers})
    if not cats:
        cats = DEFAULT_CATEGORIES.copy()
    return {"categories": cats}


@router.post("/categories")
async def create_category(data: Dict[str, Any]):
    """Create a new category directory."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    cat_name = data.get("name", "").strip().lower().replace(" ", "_")
    if not cat_name:
        raise HTTPException(status_code=400, detail="Category name is required")

    cat_dir = Path(path) / "categories" / cat_name
    cat_dir.mkdir(parents=True, exist_ok=True)

    index = _load_index(path)
    cats = index.get("config", {}).get("categories", [])
    if cat_name not in cats:
        cats.append(cat_name)
        index["config"]["categories"] = cats
        _save_index(path, index)

    return {"success": True, "category": cat_name}


# =============================================================================
# PAPER ENDPOINTS
# =============================================================================

@router.get("/papers")
async def list_papers(
    category: Optional[str] = None,
    favorited: Optional[bool] = None,
    in_graph: Optional[bool] = None,
    search: Optional[str] = None
):
    """List papers with optional filters."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    papers = index.get("papers", [])

    if category:
        papers = [p for p in papers if p.get("category") == category]
    if favorited is not None:
        papers = [p for p in papers if p.get("favorited") == favorited]
    if in_graph is not None:
        papers = [p for p in papers if p.get("in_graph") == in_graph]
    if search:
        q = search.lower()
        papers = [p for p in papers if q in p.get("title", "").lower() or q in " ".join(p.get("tags", [])).lower()]

    return {
        "success": True,
        "count": len(papers),
        "papers": papers
    }


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str):
    """Get a single paper's metadata."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    paper = next((p for p in index.get("papers", []) if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {"success": True, "paper": paper}


@router.get("/papers/{paper_id}/pdf")
async def get_paper_pdf(paper_id: str):
    """Stream the PDF file for a paper."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    paper = next((p for p in index.get("papers", []) if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    pdf_path = Path(path) / paper["pdf_path"]
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(str(pdf_path), media_type="application/pdf", filename=pdf_path.name)


@router.get("/papers/{paper_id}/markdown")
async def get_paper_markdown(paper_id: str):
    """Get the markdown analysis content for a paper."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    paper = next((p for p in index.get("papers", []) if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    md_path = paper.get("md_path")
    if not md_path:
        return {"success": True, "content": "", "exists": False}

    full_md = Path(path) / md_path
    if not full_md.exists():
        return {"success": True, "content": "", "exists": False}

    with open(full_md, "r", encoding="utf-8") as f:
        content = f.read()

    return {"success": True, "content": content, "exists": True}


@router.post("/papers")
async def add_paper(
    pdf_file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("general"),
    arxiv_id: Optional[str] = Form(None),
    tags: Optional[str] = Form(None)
):
    """Add a new paper (PDF + optional markdown) to the library."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    if not pdf_file.filename or not pdf_file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Ensure category exists
    cat_dir = Path(path) / "categories" / category
    cat_dir.mkdir(parents=True, exist_ok=True)

    # Build filename base
    safe_title = _sanitize_filename(title)
    base = f"{safe_title}_{arxiv_id}" if arxiv_id else safe_title
    base = base[:100]  # Limit length

    pdf_path = cat_dir / f"{base}.pdf"
    md_path = cat_dir / f"{base}.md"

    # Save PDF
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(pdf_file.file, f)

    # Create empty markdown if not exists
    if not md_path.exists():
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(f"# {title}\n\n")
            if arxiv_id:
                f.write(f"**arXiv:** {arxiv_id}\n\n")
            f.write("## Analysis\n\n")

    # Add to index
    index = _load_index(path)
    paper = {
        "id": _generate_paper_id(title, arxiv_id),
        "title": title,
        "arxiv_id": arxiv_id,
        "filename_base": base,
        "category": category,
        "pdf_path": str(pdf_path.relative_to(path)),
        "md_path": str(md_path.relative_to(path)),
        "tags": [t.strip() for t in tags.split(",")] if tags else [],
        "added_at": datetime.utcnow().isoformat(),
        "favorited": False,
        "in_graph": False,
        "graph_paper_id": None
    }
    index["papers"].append(paper)
    _save_index(path, index)

    return {"success": True, "paper": paper}


@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str):
    """Delete a paper from the library (files + index). Does NOT affect graph."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    paper = next((p for p in index.get("papers", []) if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Delete files
    pdf_full = Path(path) / paper["pdf_path"]
    if pdf_full.exists():
        pdf_full.unlink()

    md_full = Path(path) / paper["md_path"] if paper.get("md_path") else None
    if md_full and md_full.exists():
        md_full.unlink()

    # Remove from index
    index["papers"] = [p for p in index["papers"] if p["id"] != paper_id]
    if paper_id in index.get("favorites", []):
        index["favorites"].remove(paper_id)
    _save_index(path, index)

    return {"success": True, "deleted_id": paper_id}


@router.post("/papers/{paper_id}/favorite")
async def toggle_favorite(paper_id: str):
    """Toggle favorite status for a paper."""
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    paper = next((p for p in index.get("papers", []) if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper["favorited"] = not paper.get("favorited", False)
    if paper["favorited"]:
        if paper_id not in index.get("favorites", []):
            index.setdefault("favorites", []).append(paper_id)
    else:
        if paper_id in index.get("favorites", []):
            index["favorites"].remove(paper_id)

    _save_index(path, index)
    return {"success": True, "favorited": paper["favorited"]}


@router.post("/papers/{paper_id}/import-to-graph")
async def import_paper_to_graph(paper_id: str):
    """
    Import a paper from the library into the knowledge graph.
    Uses the existing ingestion pipeline to extract problems/methods/claims.
    """
    path = _get_library_path()
    if not path:
        raise HTTPException(status_code=400, detail="Library not configured")

    index = _load_index(path)
    paper = next((p for p in index.get("papers", []) if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    pdf_full = Path(path) / paper["pdf_path"]
    if not pdf_full.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    try:
        graph_db = get_local_graph_db()
        vector_db = get_local_vector_db()
        pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)

        meta = {
            "paper_id": paper.get("arxiv_id") or paper["id"],
            "title": paper["title"],
            "authors": ["Unknown"],
            "year": str(datetime.now().year),
            "venue": "ArXiv"
        }

        # Register paper in graph first
        graph_paper_id = graph_db.create_paper({
            "id": meta["paper_id"],
            "title": meta["title"],
            "authors": meta["authors"],
            "year": meta["year"],
            "venue": meta["venue"],
            "arxiv_id": paper.get("arxiv_id")
        })

        # Run pipeline
        result = await pipeline.process_paper(str(pdf_full), meta)

        # Update index
        paper["in_graph"] = True
        paper["graph_paper_id"] = graph_paper_id
        _save_index(path, index)

        return {
            "success": True,
            "message": f"Successfully imported '{paper['title']}' into graph",
            "graph_paper_id": graph_paper_id,
            "claims_extracted": result.get("claims_extracted", 0),
            "paper": paper
        }
    except Exception as e:
        logger.error(f"Import to graph failed for {paper_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# =============================================================================
# BATCH IMPORT SYSTEM
# =============================================================================

# In-memory job tracking (resets on server restart)
_batch_jobs: Dict[str, Any] = {}

HUMOROUS_MESSAGES = [
    "正在唤醒 AI 研究员...",
    "给 PDF 泡杯咖啡...",
    "正在和论文作者进行心灵感应...",
    "提取核心论点中，请勿打扰...",
    "Kimi 正在疯狂阅读...",
    "发现了一些有趣的方法论...",
    "正在将知识图谱缝缝补补...",
    "和向量数据库进行深度对话...",
    "论文太多，AI 也需要喘口气...",
    "正在给问题节点找归属...",
    "方法节点们正在排队入库...",
    "验证证据链中，这很关键...",
    "发现跨领域创新机会！",
    "最后冲刺，马上就好...",
    "整理思绪，准备汇报...",
]


class BatchImportRequest(BaseModel):
    category: Optional[str] = None
    paper_ids: Optional[List[str]] = None
    scope: str = "all"  # "all", "category", "selected"


def _get_humorous_message(progress: float) -> str:
    """Get a humorous progress message based on completion percentage."""
    idx = min(int(progress / 100 * len(HUMOROUS_MESSAGES)), len(HUMOROUS_MESSAGES) - 1)
    return HUMOROUS_MESSAGES[idx]


async def _run_batch_import_job(job_id: str, scope: str, category: Optional[str], paper_ids: Optional[List[str]]):
    """Background task: run batch import with progress tracking."""
    path = _get_library_path()
    if not path:
        _batch_jobs[job_id]["status"] = "error"
        _batch_jobs[job_id]["error"] = "Library not configured"
        return

    index = _load_index(path)
    papers = index.get("papers", [])

    # Filter papers based on scope
    if scope == "category" and category:
        target_papers = [p for p in papers if p.get("category") == category]
    elif scope == "selected" and paper_ids:
        target_papers = [p for p in papers if p["id"] in paper_ids]
    else:
        target_papers = [p for p in papers if not p.get("in_graph")]

    total = len(target_papers)
    if total == 0:
        _batch_jobs[job_id]["status"] = "completed"
        _batch_jobs[job_id]["progress"] = 100
        _batch_jobs[job_id]["message"] = "没有需要导入的论文"
        return

    _batch_jobs[job_id]["total"] = total
    _batch_jobs[job_id]["targets"] = [p["id"] for p in target_papers]

    graph_db = get_local_graph_db()
    vector_db = get_local_vector_db()
    pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)

    success_count = 0
    failed_count = 0
    results = []

    for i, paper in enumerate(target_papers):
        if _batch_jobs[job_id].get("cancelled"):
            _batch_jobs[job_id]["status"] = "cancelled"
            _batch_jobs[job_id]["message"] = f"已取消 ({success_count}/{total} 完成)"
            break

        progress = int((i / total) * 100)
        _batch_jobs[job_id]["current"] = i + 1
        _batch_jobs[job_id]["progress"] = progress
        _batch_jobs[job_id]["current_paper"] = paper["title"]
        _batch_jobs[job_id]["message"] = _get_humorous_message(progress)

        try:
            pdf_full = Path(path) / paper["pdf_path"]
            if not pdf_full.exists():
                failed_count += 1
                results.append({"id": paper["id"], "title": paper["title"], "status": "skipped", "reason": "PDF not found"})
                continue

            meta = {
                "paper_id": paper.get("arxiv_id") or paper["id"],
                "title": paper["title"],
                "authors": ["Unknown"],
                "year": str(datetime.now().year),
                "venue": "ArXiv"
            }

            graph_paper_id = graph_db.create_paper({
                "id": meta["paper_id"],
                "title": meta["title"],
                "authors": meta["authors"],
                "year": meta["year"],
                "venue": meta["venue"],
                "arxiv_id": paper.get("arxiv_id")
            })

            await pipeline.process_paper(str(pdf_full), meta)

            # Update index
            paper["in_graph"] = True
            paper["graph_paper_id"] = graph_paper_id
            success_count += 1
            results.append({"id": paper["id"], "title": paper["title"], "status": "success", "graph_paper_id": graph_paper_id})

        except Exception as e:
            logger.error(f"Batch import failed for {paper['id']}: {e}")
            failed_count += 1
            results.append({"id": paper["id"], "title": paper["title"], "status": "error", "reason": str(e)})

        # Small delay to prevent overwhelming the system
        await asyncio.sleep(0.5)

    # Save updated index
    _save_index(path, index)

    if _batch_jobs[job_id].get("status") != "cancelled":
        _batch_jobs[job_id]["status"] = "completed"
        _batch_jobs[job_id]["progress"] = 100
        _batch_jobs[job_id]["message"] = f"完成！成功 {success_count} 篇，失败 {failed_count} 篇"

    _batch_jobs[job_id]["results"] = results
    _batch_jobs[job_id]["success_count"] = success_count
    _batch_jobs[job_id]["failed_count"] = failed_count


@router.post("/batch-import")
async def start_batch_import(request: BatchImportRequest, background_tasks: BackgroundTasks):
    """Start a batch import job. Supports importing all, by category, or selected papers."""
    job_id = f"batch_{uuid.uuid4().hex[:12]}"

    _batch_jobs[job_id] = {
        "id": job_id,
        "status": "running",
        "progress": 0,
        "total": 0,
        "current": 0,
        "message": "正在启动批量导入...",
        "current_paper": None,
        "scope": request.scope,
        "category": request.category,
        "cancelled": False,
        "results": [],
        "success_count": 0,
        "failed_count": 0,
        "created_at": datetime.utcnow().isoformat(),
    }

    background_tasks.add_task(
        _run_batch_import_job,
        job_id,
        request.scope,
        request.category,
        request.paper_ids
    )

    return {
        "success": True,
        "job_id": job_id,
        "message": "Batch import started",
        "status": "running"
    }


@router.get("/batch-import/{job_id}/progress")
async def get_batch_import_progress(job_id: str):
    """Get real-time progress of a batch import job."""
    job = _batch_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "success": True,
        "job": {
            "id": job["id"],
            "status": job["status"],
            "progress": job["progress"],
            "total": job.get("total", 0),
            "current": job.get("current", 0),
            "message": job["message"],
            "current_paper": job.get("current_paper"),
            "success_count": job.get("success_count", 0),
            "failed_count": job.get("failed_count", 0),
        }
    }


@router.post("/batch-import/{job_id}/cancel")
async def cancel_batch_import(job_id: str):
    """Cancel a running batch import job."""
    job = _batch_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "running":
        return {"success": False, "message": f"Job is already {job['status']}"}

    job["cancelled"] = True
    return {"success": True, "message": "Cancellation requested"}


@router.get("/batch-import/{job_id}/results")
async def get_batch_import_results(job_id: str):
    """Get detailed results of a completed batch import job."""
    job = _batch_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "success": True,
        "job": {
            "id": job["id"],
            "status": job["status"],
            "progress": job["progress"],
            "success_count": job.get("success_count", 0),
            "failed_count": job.get("failed_count", 0),
            "results": job.get("results", []),
        }
    }
