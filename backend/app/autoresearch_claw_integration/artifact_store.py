"""
Database Artifact Store

Replaces AutoResearchClaw's file-based artifact storage with SQLite.
AutoResearchClaw stages read/write artifacts via file paths like
run_dir/stage-10/experiment/main.py. We intercept these via monkey-patching
or by providing a custom run_dir that reads/writes to the database.

Simpler approach: We let AutoResearchClaw run with a temp directory,
then after each stage, we copy artifacts into the database. Before each
stage, we restore artifacts from the database. This avoids having to
monkey-patch AutoResearchClaw's internal file I/O.
"""

import json
import sqlite3
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "research_graph.db"


class DatabaseArtifactStore:
    """
    Stores and retrieves pipeline stage artifacts from SQLite.

    Each artifact is associated with a task_id, stage number, and filename.
    Supports versioning for PIVOT/REFINE rollback cycles.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or str(DB_PATH)
        self._init_tables()

    def _init_tables(self):
        """Ensure artifact tables exist."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()

            # Main artifact table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS autoresearch_artifacts (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    stage INTEGER NOT NULL,
                    stage_version INTEGER DEFAULT 0,
                    filename TEXT NOT NULL,
                    content TEXT,
                    content_type TEXT DEFAULT 'text',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Checkpoint table for resume
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS autoresearch_checkpoints (
                    task_id TEXT PRIMARY KEY,
                    last_completed_stage INTEGER,
                    checkpoint_data TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Task tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS autoresearch_tasks (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'anonymous',
                    innovation_id TEXT,
                    current_stage INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    config_json TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # HITL decisions
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS autoresearch_hitl_decisions (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    stage INTEGER NOT NULL,
                    decision TEXT,
                    feedback TEXT,
                    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Indices
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_artifacts_task_stage
                ON autoresearch_artifacts(task_id, stage)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_artifacts_task_filename
                ON autoresearch_artifacts(task_id, filename)
            """)

            conn.commit()
            logger.info("Artifact store tables initialized")
        finally:
            conn.close()

    def save_artifact(
        self,
        task_id: str,
        stage: int,
        filename: str,
        content: str,
        stage_version: int = 0,
        content_type: str = "text",
    ) -> None:
        """Save an artifact to the database."""
        artifact_id = f"{task_id}_s{stage}_v{stage_version}_{filename.replace('/', '_')}"

        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO autoresearch_artifacts
                (id, task_id, stage, stage_version, filename, content, content_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                artifact_id, task_id, stage, stage_version,
                filename, content, content_type, datetime.now().isoformat()
            ))
            conn.commit()
        finally:
            conn.close()

    def load_artifact(
        self,
        task_id: str,
        stage: int,
        filename: str,
        stage_version: Optional[int] = None,
    ) -> Optional[str]:
        """Load an artifact from the database."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()

            if stage_version is not None:
                cursor.execute("""
                    SELECT content FROM autoresearch_artifacts
                    WHERE task_id = ? AND stage = ? AND stage_version = ? AND filename = ?
                    ORDER BY created_at DESC LIMIT 1
                """, (task_id, stage, stage_version, filename))
            else:
                # Get latest version
                cursor.execute("""
                    SELECT content FROM autoresearch_artifacts
                    WHERE task_id = ? AND stage = ? AND filename = ?
                    ORDER BY stage_version DESC, created_at DESC LIMIT 1
                """, (task_id, stage, filename))

            row = cursor.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def list_artifacts(
        self,
        task_id: str,
        stage: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List all artifacts for a task (optionally filtered by stage)."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()

            if stage is not None:
                cursor.execute("""
                    SELECT stage, stage_version, filename, content_type, created_at
                    FROM autoresearch_artifacts
                    WHERE task_id = ? AND stage = ?
                    ORDER BY stage_version DESC, created_at DESC
                """, (task_id, stage))
            else:
                cursor.execute("""
                    SELECT stage, stage_version, filename, content_type, created_at
                    FROM autoresearch_artifacts
                    WHERE task_id = ?
                    ORDER BY stage DESC, stage_version DESC, created_at DESC
                """, (task_id,))

            rows = cursor.fetchall()
            return [
                {
                    "stage": r[0],
                    "stage_version": r[1],
                    "filename": r[2],
                    "content_type": r[3],
                    "created_at": r[4],
                }
                for r in rows
            ]
        finally:
            conn.close()

    def save_checkpoint(
        self,
        task_id: str,
        last_completed_stage: int,
        checkpoint_data: Dict[str, Any],
    ) -> None:
        """Save a pipeline checkpoint."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO autoresearch_checkpoints
                (task_id, last_completed_stage, checkpoint_data, updated_at)
                VALUES (?, ?, ?, ?)
            """, (
                task_id, last_completed_stage,
                json.dumps(checkpoint_data), datetime.now().isoformat()
            ))
            conn.commit()
        finally:
            conn.close()

    def load_checkpoint(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Load the latest checkpoint for a task."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT last_completed_stage, checkpoint_data
                FROM autoresearch_checkpoints
                WHERE task_id = ?
            """, (task_id,))
            row = cursor.fetchone()
            if row:
                return {
                    "last_completed_stage": row[0],
                    "checkpoint_data": json.loads(row[1]),
                }
            return None
        finally:
            conn.close()

    def create_task(
        self,
        task_id: str,
        user_id: str = "anonymous",
        innovation_id: Optional[str] = None,
        config_json: Optional[str] = None,
    ) -> None:
        """Create a new task record."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO autoresearch_tasks
                (id, user_id, innovation_id, status, config_json, started_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                task_id, user_id, innovation_id,
                "running", config_json, datetime.now().isoformat()
            ))
            conn.commit()
        finally:
            conn.close()

    def update_task_status(
        self,
        task_id: str,
        status: str,
        current_stage: Optional[int] = None,
    ) -> None:
        """Update task status."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()

            if current_stage is not None:
                cursor.execute("""
                    UPDATE autoresearch_tasks
                    SET status = ?, current_stage = ?
                    WHERE id = ?
                """, (status, current_stage, task_id))
            else:
                cursor.execute("""
                    UPDATE autoresearch_tasks
                    SET status = ?
                    WHERE id = ?
                """, (status, task_id))

            if status in ("completed", "failed"):
                cursor.execute("""
                    UPDATE autoresearch_tasks
                    SET completed_at = ?
                    WHERE id = ?
                """, (datetime.now().isoformat(), task_id))

            conn.commit()
        finally:
            conn.close()

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task details."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, user_id, innovation_id, current_stage, status,
                       config_json, started_at, completed_at
                FROM autoresearch_tasks
                WHERE id = ?
            """, (task_id,))
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "user_id": row[1],
                    "innovation_id": row[2],
                    "current_stage": row[3],
                    "status": row[4],
                    "config_json": row[5],
                    "started_at": row[6],
                    "completed_at": row[7],
                }
            return None
        finally:
            conn.close()

    def save_hitl_decision(
        self,
        task_id: str,
        stage: int,
        decision: str,
        feedback: Optional[str] = None,
    ) -> None:
        """Save a HITL gate decision."""
        import uuid
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO autoresearch_hitl_decisions
                (id, task_id, stage, decision, feedback)
                VALUES (?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), task_id, stage, decision, feedback))
            conn.commit()
        finally:
            conn.close()

    def get_hitl_decision(self, task_id: str, stage: int) -> Optional[Dict[str, Any]]:
        """Get the HITL decision for a stage."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT decision, feedback, decided_at
                FROM autoresearch_hitl_decisions
                WHERE task_id = ? AND stage = ?
                ORDER BY decided_at DESC LIMIT 1
            """, (task_id, stage))
            row = cursor.fetchone()
            if row:
                return {"decision": row[0], "feedback": row[1], "decided_at": row[2]}
            return None
        finally:
            conn.close()
