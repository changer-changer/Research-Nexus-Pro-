#!/usr/bin/env python3
"""
数据库集成测试 (Database Integration Tests)

测试创新点收藏、论文生成任务、实验占位符、版本管理等数据库表的操作
"""

import pytest
import sqlite3
import json
import os
import tempfile
from datetime import datetime
from typing import Dict, Any


def test_simple_connection():
    """简单测试 - 验证测试框架工作"""
    assert True


class TestDatabaseIntegration:
    """数据库集成测试类"""
    
    @pytest.fixture(scope="function")
    def db_path(self):
        """创建临时数据库"""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            path = f.name
        yield path
        os.unlink(path)
    
    @pytest.fixture(scope="function")
    def conn(self, db_path):
        """创建数据库连接"""
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        yield conn
        conn.close()
    
    @pytest.fixture(scope="function")
    def setup_tables(self, conn):
        """设置数据库表"""
        cursor = conn.cursor()
        
        # innovation_favorites 表 - 创新点收藏
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS innovation_favorites (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                innovation_id TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, innovation_id)
            )
        """)
        
        # paper_generation_tasks 表 - 论文生成任务
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_generation_tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                innovation_id TEXT NOT NULL,
                target_venue TEXT NOT NULL DEFAULT 'NeurIPS',
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                current_stage TEXT,
                output_path TEXT,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)
        
        # experiment_slots 表 - 实验占位符
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS experiment_slots (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                slot_id TEXT NOT NULL,
                slot_type TEXT NOT NULL,
                description TEXT,
                expected_outcome TEXT,
                placeholder TEXT,
                estimated_weeks INTEGER,
                actual_data TEXT,  -- JSON格式存储
                observations TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES paper_generation_tasks(id) ON DELETE CASCADE
            )
        """)
        
        # paper_versions 表 - 论文版本管理
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_versions (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                format TEXT DEFAULT 'markdown',  -- markdown, latex, pdf
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                FOREIGN KEY (task_id) REFERENCES paper_generation_tasks(id) ON DELETE CASCADE,
                UNIQUE(task_id, version_number)
            )
        """)
        
        # 创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tasks_user_id 
            ON paper_generation_tasks(user_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_favorites_user_id 
            ON innovation_favorites(user_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_slots_task_id 
            ON experiment_slots(task_id)
        """)
        
        conn.commit()
        yield cursor
    
    # ==================== innovation_favorites 测试 ====================
    
    def test_favorites_crud_create(self, conn, setup_tables):
        """测试收藏创建"""
        cursor = conn.cursor()
        
        # 创建收藏
        cursor.execute("""
            INSERT INTO innovation_favorites (id, user_id, innovation_id, notes)
            VALUES (?, ?, ?, ?)
        """, ("fav_001", "user_001", "innov_001", "很有价值的创新点"))
        conn.commit()
        
        # 验证创建
        cursor.execute("SELECT * FROM innovation_favorites WHERE id = ?", ("fav_001",))
        row = cursor.fetchone()
        
        assert row is not None
        assert row["user_id"] == "user_001"
        assert row["innovation_id"] == "innov_001"
        assert row["notes"] == "很有价值的创新点"
    
    def test_favorites_crud_read(self, conn, setup_tables):
        """测试收藏查询"""
        cursor = conn.cursor()
        
        # 创建多个收藏
        for i in range(3):
            cursor.execute("""
                INSERT INTO innovation_favorites (id, user_id, innovation_id, notes)
                VALUES (?, ?, ?, ?)
            """, (f"fav_{i:03d}", "user_001", f"innov_{i:03d}", f"Note {i}"))
        conn.commit()
        
        # 查询用户收藏列表
        cursor.execute("""
            SELECT * FROM innovation_favorites
            WHERE user_id = ?
            ORDER BY id DESC
        """, ("user_001",))
        rows = cursor.fetchall()

        assert len(rows) == 3
        innovation_ids = [r["innovation_id"] for r in rows]
        assert "innov_002" in innovation_ids
    
    def test_favorites_crud_update(self, conn, setup_tables):
        """测试收藏更新"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO innovation_favorites (id, user_id, innovation_id, notes)
            VALUES (?, ?, ?, ?)
        """, ("fav_001", "user_001", "innov_001", "初始备注"))
        conn.commit()
        
        # 更新备注
        cursor.execute("""
            UPDATE innovation_favorites 
            SET notes = ?, updated_at = ?
            WHERE id = ?
        """, ("更新后的备注", datetime.now().isoformat(), "fav_001"))
        conn.commit()
        
        cursor.execute("SELECT notes FROM innovation_favorites WHERE id = ?", ("fav_001",))
        row = cursor.fetchone()
        assert row["notes"] == "更新后的备注"
    
    def test_favorites_crud_delete(self, conn, setup_tables):
        """测试收藏删除"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO innovation_favorites (id, user_id, innovation_id, notes)
            VALUES (?, ?, ?, ?)
        """, ("fav_001", "user_001", "innov_001", "测试备注"))
        conn.commit()
        
        # 删除
        cursor.execute("DELETE FROM innovation_favorites WHERE id = ?", ("fav_001",))
        conn.commit()
        
        cursor.execute("SELECT * FROM innovation_favorites WHERE id = ?", ("fav_001",))
        row = cursor.fetchone()
        assert row is None
    
    def test_favorites_unique_constraint(self, conn, setup_tables):
        """测试用户-创新点唯一约束"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO innovation_favorites (id, user_id, innovation_id)
            VALUES (?, ?, ?)
        """, ("fav_001", "user_001", "innov_001"))
        conn.commit()
        
        # 尝试重复收藏同一个创新点
        with pytest.raises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO innovation_favorites (id, user_id, innovation_id)
                VALUES (?, ?, ?)
            """, ("fav_002", "user_001", "innov_001"))
            conn.commit()
    
    # ==================== paper_generation_tasks 测试 ====================
    
    def test_tasks_crud_create(self, conn, setup_tables):
        """测试任务创建"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO paper_generation_tasks 
            (id, user_id, innovation_id, target_venue, status, progress)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("task_001", "user_001", "innov_001", "NeurIPS", "pending", 0))
        conn.commit()
        
        cursor.execute("SELECT * FROM paper_generation_tasks WHERE id = ?", ("task_001",))
        row = cursor.fetchone()
        
        assert row["status"] == "pending"
        assert row["progress"] == 0
        assert row["target_venue"] == "NeurIPS"
    
    def test_tasks_status_update(self, conn, setup_tables):
        """测试任务状态更新"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO paper_generation_tasks 
            (id, user_id, innovation_id, status, progress)
            VALUES (?, ?, ?, ?, ?)
        """, ("task_001", "user_001", "innov_001", "pending", 0))
        conn.commit()
        
        # 模拟生成过程
        stages = [
            ("generating", 20, "title"),
            ("generating", 40, "abstract"),
            ("generating", 60, "methodology"),
            ("paused", 70, "experiment_design"),
            ("generating", 85, "analysis"),
            ("completed", 100, "complete")
        ]
        
        for status, progress, stage in stages:
            cursor.execute("""
                UPDATE paper_generation_tasks 
                SET status = ?, progress = ?, current_stage = ?, updated_at = ?
                WHERE id = ?
            """, (status, progress, stage, datetime.now().isoformat(), "task_001"))
            conn.commit()
        
        cursor.execute("SELECT * FROM paper_generation_tasks WHERE id = ?", ("task_001",))
        row = cursor.fetchone()
        assert row["status"] == "completed"
        assert row["progress"] == 100
    
    # ==================== experiment_slots 测试 ====================
    
    def test_slots_placeholder_creation(self, conn, setup_tables):
        """测试实验占位符创建"""
        cursor = conn.cursor()
        
        # 先创建任务
        cursor.execute("""
            INSERT INTO paper_generation_tasks (id, user_id, innovation_id)
            VALUES (?, ?, ?)
        """, ("task_001", "user_001", "innov_001"))
        
        # 创建实验占位符
        slots = [
            ("slot_001", "exp_1", "main_performance", "主性能评估", "[PENDING:实验1-主性能评估]"),
            ("slot_002", "exp_2", "ablation_study", "消融研究", "[PENDING:实验2-消融研究]"),
            ("slot_003", "exp_3", "robustness_analysis", "鲁棒性分析", "[PENDING:实验3-鲁棒性分析]")
        ]
        
        for slot_id, slot_ref, slot_type, desc, placeholder in slots:
            cursor.execute("""
                INSERT INTO experiment_slots 
                (id, task_id, slot_id, slot_type, description, placeholder, estimated_weeks)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (slot_id, "task_001", slot_ref, slot_type, desc, placeholder, 2))
        
        conn.commit()
        
        cursor.execute("SELECT COUNT(*) as count FROM experiment_slots WHERE task_id = ?", ("task_001",))
        assert cursor.fetchone()["count"] == 3
    
    def test_slots_data_update(self, conn, setup_tables):
        """测试实验数据更新"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO paper_generation_tasks (id, user_id, innovation_id)
            VALUES (?, ?, ?)
        """, ("task_001", "user_001", "innov_001"))
        
        cursor.execute("""
            INSERT INTO experiment_slots (id, task_id, slot_id, slot_type, status)
            VALUES (?, ?, ?, ?, ?)
        """, ("slot_001", "task_001", "exp_1", "main_performance", "pending"))
        conn.commit()
        
        # 填写实验数据
        actual_data = {
            "accuracy": 0.95,
            "f1_score": 0.94,
            "precision": 0.93,
            "recall": 0.96
        }
        
        cursor.execute("""
            UPDATE experiment_slots 
            SET actual_data = ?, observations = ?, status = ?, updated_at = ?
            WHERE id = ?
        """, (json.dumps(actual_data), "实验结果超出预期", "completed", datetime.now().isoformat(), "slot_001"))
        conn.commit()
        
        cursor.execute("SELECT * FROM experiment_slots WHERE id = ?", ("slot_001",))
        row = cursor.fetchone()
        
        assert row["status"] == "completed"
        data = json.loads(row["actual_data"])
        assert data["accuracy"] == 0.95
    
    # ==================== paper_versions 测试 ====================
    
    def test_versions_management(self, conn, setup_tables):
        """测试论文版本管理"""
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO paper_generation_tasks (id, user_id, innovation_id)
            VALUES (?, ?, ?)
        """, ("task_001", "user_001", "innov_001"))
        conn.commit()
        
        # 创建多个版本
        versions = [
            ("ver_001", 1, "# v1: Initial draft", "markdown"),
            ("ver_002", 2, "# v2: Added experiments", "markdown"),
            ("ver_003", 3, "\\documentclass{article}...", "latex")
        ]
        
        for ver_id, ver_num, content, fmt in versions:
            cursor.execute("""
                INSERT INTO paper_versions (id, task_id, version_number, content, format)
                VALUES (?, ?, ?, ?, ?)
            """, (ver_id, "task_001", ver_num, content, fmt))
        
        conn.commit()
        
        # 查询最新版本
        cursor.execute("""
            SELECT * FROM paper_versions 
            WHERE task_id = ? 
            ORDER BY version_number DESC LIMIT 1
        """, ("task_001",))
        row = cursor.fetchone()
        
        assert row["version_number"] == 3
        assert row["format"] == "latex"
    
    # ==================== 外键约束和级联删除测试 ====================
    
    def test_foreign_key_constraint(self, conn, setup_tables):
        """测试外键约束"""
        cursor = conn.cursor()
        
        # 尝试创建无主任务的实验占位符
        with pytest.raises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO experiment_slots (id, task_id, slot_id, slot_type)
                VALUES (?, ?, ?, ?)
            """, ("slot_001", "non_existent_task", "exp_1", "main_performance"))
            conn.commit()
    
    def test_cascade_delete(self, conn, setup_tables):
        """测试级联删除"""
        cursor = conn.cursor()
        
        # 创建任务和相关数据
        cursor.execute("""
            INSERT INTO paper_generation_tasks (id, user_id, innovation_id)
            VALUES (?, ?, ?)
        """, ("task_001", "user_001", "innov_001"))
        
        cursor.execute("""
            INSERT INTO experiment_slots (id, task_id, slot_id, slot_type)
            VALUES (?, ?, ?, ?)
        """, ("slot_001", "task_001", "exp_1", "main_performance"))
        
        cursor.execute("""
            INSERT INTO paper_versions (id, task_id, version_number, content)
            VALUES (?, ?, ?, ?)
        """, ("ver_001", "task_001", 1, "content"))
        conn.commit()
        
        # 删除任务
        cursor.execute("DELETE FROM paper_generation_tasks WHERE id = ?", ("task_001",))
        conn.commit()
        
        # 验证相关数据也被删除
        cursor.execute("SELECT COUNT(*) FROM experiment_slots WHERE task_id = ?", ("task_001",))
        assert cursor.fetchone()[0] == 0
        
        cursor.execute("SELECT COUNT(*) FROM paper_versions WHERE task_id = ?", ("task_001",))
        assert cursor.fetchone()[0] == 0
    
    # ==================== 索引性能测试 ====================
    
    def test_index_performance(self, conn, setup_tables):
        """测试索引是否正确创建"""
        cursor = conn.cursor()
        
        # 查询索引
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type = 'index' AND name LIKE 'idx_%'
        """)
        indexes = [row[0] for row in cursor.fetchall()]
        
        assert "idx_tasks_user_id" in indexes
        assert "idx_favorites_user_id" in indexes
        assert "idx_slots_task_id" in indexes


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
