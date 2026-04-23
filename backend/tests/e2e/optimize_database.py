#!/usr/bin/env python3
"""
数据库优化脚本 (Database Optimization Script)

执行数据库性能优化:
1. 添加索引
2. 查询优化建议
3. 分析查询性能

运行: python optimize_database.py [--db-path PATH]
"""

import sqlite3
import argparse
import os
from datetime import datetime


# 推荐的索引配置
RECOMMENDED_INDEXES = [
    {
        "name": "idx_paper_tasks_user_id",
        "table": "paper_generation_tasks",
        "column": "user_id",
        "reason": "加速按用户查询任务"
    },
    {
        "name": "idx_paper_tasks_status",
        "table": "paper_generation_tasks",
        "column": "status",
        "reason": "加速按状态查询任务"
    },
    {
        "name": "idx_paper_tasks_innovation_id",
        "table": "paper_generation_tasks",
        "column": "innovation_id",
        "reason": "加速按创新点查询任务"
    },
    {
        "name": "idx_favorites_user_id",
        "table": "innovation_favorites",
        "column": "user_id",
        "reason": "加速查询用户收藏列表"
    },
    {
        "name": "idx_favorites_innovation_id",
        "table": "innovation_favorites",
        "column": "innovation_id",
        "reason": "加速检查收藏状态"
    },
    {
        "name": "idx_experiment_slots_task_id",
        "table": "experiment_slots",
        "column": "task_id",
        "reason": "加速查询任务的实验槽"
    },
    {
        "name": "idx_paper_versions_task_id",
        "table": "paper_versions",
        "column": "task_id",
        "reason": "加速查询论文版本"
    },
    {
        "name": "idx_paper_tasks_created_at",
        "table": "paper_generation_tasks",
        "column": "created_at",
        "reason": "加速按时间排序任务"
    },
    {
        "name": "idx_paper_tasks_user_status",
        "table": "paper_generation_tasks",
        "columns": ["user_id", "status"],
        "reason": "加速查询用户的特定状态任务"
    }
]


def get_db_path():
    """获取数据库路径"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, "..", "..", "data", "research_graph.db")


def check_index_exists(cursor, index_name):
    """检查索引是否已存在"""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
        (index_name,)
    )
    return cursor.fetchone() is not None


def add_index(conn, index_config):
    """添加单个索引"""
    cursor = conn.cursor()
    index_name = index_config["name"]
    table = index_config["table"]
    
    # 检查是否已存在
    if check_index_exists(cursor, index_name):
        print(f"  索引 {index_name} 已存在，跳过")
        return False
    
    # 构建索引列
    if "columns" in index_config:
        columns = ", ".join(index_config["columns"])
    else:
        columns = index_config["column"]
    
    # 创建索引
    sql = f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}({columns})"
    
    try:
        cursor.execute(sql)
        conn.commit()
        print(f"  ✓ 创建索引 {index_name} on {table}({columns})")
        print(f"    用途: {index_config['reason']}")
        return True
    except Exception as e:
        print(f"  ✗ 创建索引 {index_name} 失败: {e}")
        return False


def analyze_table(conn, table_name):
    """分析表统计信息"""
    cursor = conn.cursor()
    
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        
        cursor.execute(f"ANALYZE {table_name}")
        conn.commit()
        
        return count
    except Exception as e:
        print(f"  分析表 {table_name} 失败: {e}")
        return -1


def get_query_performance_recommendations(cursor):
    """获取查询性能建议"""
    recommendations = []
    
    # 检查慢查询模式
    slow_patterns = [
        {
            "pattern": "SELECT * FROM paper_generation_tasks WHERE user_id = ?",
            "issue": "全表扫描",
            "solution": "使用 idx_paper_tasks_user_id 索引加速"
        },
        {
            "pattern": "SELECT * FROM innovation_favorites WHERE user_id = ? ORDER BY created_at DESC",
            "issue": "排序开销大",
            "solution": "使用 idx_favorites_user_id 和覆盖索引"
        },
        {
            "pattern": "SELECT * FROM experiment_slots WHERE task_id = ?",
            "issue": "全表扫描",
            "solution": "使用 idx_experiment_slots_task_id 索引"
        }
    ]
    
    return slow_patterns


def optimize_database(db_path):
    """优化数据库"""
    print(f"\n数据库优化工具")
    print(f"数据库: {db_path}")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    if not os.path.exists(db_path):
        print(f"\n错误: 数据库不存在: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    
    try:
        # 1. 添加推荐的索引
        print("\n[1/3] 添加推荐索引...")
        created_count = 0
        skipped_count = 0
        
        for index_config in RECOMMENDED_INDEXES:
            if add_index(conn, index_config):
                created_count += 1
            else:
                skipped_count += 1
        
        print(f"\n索引统计: 新建 {created_count} 个, 跳过 {skipped_count} 个")
        
        # 2. 分析表
        print("\n[2/3] 分析表统计信息...")
        tables = [
            "paper_generation_tasks",
            "innovation_favorites",
            "experiment_slots",
            "paper_versions"
        ]
        
        for table in tables:
            count = analyze_table(conn, table)
            if count >= 0:
                print(f"  ✓ {table}: {count} 行")
        
        # 3. 优化配置
        print("\n[3/3] 应用优化配置...")
        cursor = conn.cursor()
        
        # 启用WAL模式（提高并发性能）
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            result = cursor.fetchone()
            print(f"  ✓ 日志模式: {result[0]}")
        except Exception as e:
            print(f"  ⚠ WAL模式设置失败: {e}")
        
        # 设置缓存大小
        cursor.execute("PRAGMA cache_size=10000")
        print(f"  ✓ 缓存大小: 10000 页")
        
        # 设置同步模式（性能和持久性平衡）
        cursor.execute("PRAGMA synchronous=NORMAL")
        print(f"  ✓ 同步模式: NORMAL")
        
        # 运行VACUUM优化存储
        print("\n[4/4] 运行VACUUM优化存储...")
        try:
            cursor.execute("VACUUM")
            print("  ✓ VACUUM完成")
        except Exception as e:
            print(f"  ⚠ VACUUM失败: {e}")
        
        conn.commit()
        
        # 性能建议
        print("\n" + "="*60)
        print("查询优化建议:")
        print("="*60)
        recommendations = get_query_performance_recommendations(cursor)
        
        for rec in recommendations:
            print(f"\n查询模式:")
            print(f"  {rec['pattern']}")
            print(f"问题: {rec['issue']}")
            print(f"解决方案: {rec['solution']}")
        
        print("\n" + "="*60)
        print("数据库优化完成!")
        print("="*60 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        conn.close()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="Research Nexus Pro - 数据库优化工具")
    parser.add_argument(
        "--db-path",
        default=get_db_path(),
        help=f"数据库路径 (默认: {get_db_path()})"
    )
    args = parser.parse_args()
    
    success = optimize_database(args.db_path)
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
