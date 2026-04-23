"""
SQLite Database Connection Module
提供统一的数据库连接接口
"""

import sqlite3
import os
from pathlib import Path

# 数据库路径 — 使用主数据库 research_graph.db (包含所有论文数据)
DB_PATH = Path(__file__).parent.parent.parent / "data" / "research_graph.db"

def get_db_connection() -> sqlite3.Connection:
    """获取数据库连接"""
    # 确保数据目录存在
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # 创建连接
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    return conn

def init_database():
    """初始化数据库表结构"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 创新点表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS innovations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            paradigm TEXT NOT NULL,
            target_problem TEXT,
            candidate_method TEXT,
            core_insight TEXT,
            source_papers TEXT,
            novelty_score REAL,
            feasibility_score REAL,
            impact_score REAL,
            urgency_score REAL,
            composite_score REAL,
            mvp_experiment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 回测结果表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS backtest_results (
            id TEXT PRIMARY KEY,
            train_years TEXT NOT NULL,
            test_year INTEGER NOT NULL,
            domain TEXT,
            predicted_count INTEGER,
            hit_count INTEGER,
            precision REAL,
            recall REAL,
            f1_score REAL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 创建索引
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_innovations_paradigm ON innovations(paradigm)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_backtest_year ON backtest_results(test_year)")
    
    conn.commit()
    conn.close()
    
    print("✅ Database initialized successfully")

# 初始化数据库
if __name__ == "__main__":
    init_database()
