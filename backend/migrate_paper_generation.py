"""
Database migration script for paper generation system.
Adds required tables to research_graph.db
"""

import sqlite3
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "research_graph.db")

def migrate_database():
    """Create paper generation related tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if tables already exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='innovation_favorites'")
    if cursor.fetchone():
        print("⚠️ Tables already exist, skipping migration")
        conn.close()
        return
    
    # 1. User innovation favorites
    cursor.execute("""
    CREATE TABLE innovation_favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        innovation_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("CREATE INDEX idx_favorites_user ON innovation_favorites(user_id)")
    cursor.execute("CREATE INDEX idx_favorites_innovation ON innovation_favorites(innovation_id)")
    print("✅ Created innovation_favorites table")
    
    # 2. Paper generation tasks
    cursor.execute("""
    CREATE TABLE paper_generation_tasks (
        id TEXT PRIMARY KEY,
        innovation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        output_path TEXT,
        paper_title TEXT,
        paper_abstract TEXT,
        target_venue TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("CREATE INDEX idx_tasks_user ON paper_generation_tasks(user_id)")
    cursor.execute("CREATE INDEX idx_tasks_status ON paper_generation_tasks(status)")
    cursor.execute("CREATE INDEX idx_tasks_innovation ON paper_generation_tasks(innovation_id)")
    print("✅ Created paper_generation_tasks table")
    
    # 3. Experiment slots
    cursor.execute("""
    CREATE TABLE experiment_slots (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        slot_index INTEGER NOT NULL,
        slot_type TEXT,
        description TEXT,
        expected_outcome TEXT,
        actual_data TEXT,
        status TEXT DEFAULT 'pending',
        confidence_score REAL,
        FOREIGN KEY (task_id) REFERENCES paper_generation_tasks(id)
    )
    """)
    cursor.execute("CREATE INDEX idx_experiments_task ON experiment_slots(task_id)")
    print("✅ Created experiment_slots table")
    
    # 4. Paper versions
    cursor.execute("""
    CREATE TABLE paper_versions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        content_path TEXT,
        change_summary TEXT,
        is_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES paper_generation_tasks(id)
    )
    """)
    cursor.execute("CREATE INDEX idx_versions_task ON paper_versions(task_id)")
    cursor.execute("CREATE INDEX idx_versions_number ON paper_versions(version_number)")
    print("✅ Created paper_versions table")

    # 5. Paper iteration records (for iterative refinement)
    cursor.execute("""
    CREATE TABLE paper_iterations (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        iteration_id TEXT NOT NULL,
        section_name TEXT NOT NULL,
        feedback TEXT,
        before_text TEXT,
        after_text TEXT,
        coherence_warnings TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES paper_generation_tasks(id)
    )
    """)
    cursor.execute("CREATE INDEX idx_iterations_task ON paper_iterations(task_id)")
    cursor.execute("CREATE INDEX idx_iterations_section ON paper_iterations(section_name)")
    print("✅ Created paper_iterations table")

    conn.commit()
    conn.close()
    print("\n🎉 Database migration completed successfully!")
    print(f"📁 Database: {DB_PATH}")

if __name__ == "__main__":
    migrate_database()
