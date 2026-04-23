#!/usr/bin/env python3
"""
智能体论文数据转换与导入脚本
将38篇智能体论文导入Research-Nexus Pro系统
"""
import json
import sqlite3
from pathlib import Path
from datetime import datetime
import uuid

# 路径配置
WORKSPACE = Path("/home/cuizhixing/.openclaw/workspace")
PROJECT_DIR = WORKSPACE / "Projects/lobster-contest-2026/research-nexus-pro"
DATA_DIR = PROJECT_DIR / "backend/data"
JSON_FILE = WORKSPACE / "科研内容/论文收集/智能体论文搜索结果.json"
EXTRACTED_DATA_FILE = PROJECT_DIR / "EXTRACTED_DATA.json"
DB_FILE = DATA_DIR / "research_graph.db"

def load_agent_papers():
    """加载智能体论文数据"""
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('papers', [])

def create_agent_branches_and_problems():
    """创建智能体相关的分支和问题定义"""
    branches = {
        "b_agent": {
            "name": "AI Agent Systems",
            "description": "人工智能智能体系统研究",
            "color": "#8b5cf6"  # 紫色
        },
        "b_multi_agent": {
            "name": "Multi-Agent Collaboration",
            "description": "多智能体协作机制研究",
            "color": "#ec4899"  # 粉色
        },
        "b_agent_memory": {
            "name": "Agent Long-term Memory",
            "description": "智能体长期记忆系统研究",
            "color": "#22c55e"  # 绿色
        },
        "b_agent_tools": {
            "name": "Agent Tool Use",
            "description": "智能体工具调用能力研究",
            "color": "#f59e0b"  # 橙色
        }
    }
    
    problems_by_branch = {
        "b_agent": [
            {
                "id": "p_agent_root",
                "name": "AI Agent Architecture",
                "year": 2026,
                "status": "active",
                "level": 0,
                "parent": None
            }
        ],
        "b_multi_agent": [
            {
                "id": "p_multi_agent",
                "name": "Multi-Agent Collaboration",
                "year": 2026,
                "status": "active",
                "level": 1,
                "parent": "p_agent_root"
            },
            {
                "id": "p_ma_1",
                "name": "Agent Communication Protocols",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_multi_agent"
            },
            {
                "id": "p_ma_2",
                "name": "Distributed Task Allocation",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_multi_agent"
            },
            {
                "id": "p_ma_3",
                "name": "Collective Intelligence",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_multi_agent"
            }
        ],
        "b_agent_memory": [
            {
                "id": "p_agent_memory",
                "name": "Agent Long-term Memory",
                "year": 2026,
                "status": "active",
                "level": 1,
                "parent": "p_agent_root"
            },
            {
                "id": "p_mem_1",
                "name": "Memory Architecture Design",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_agent_memory"
            },
            {
                "id": "p_mem_2",
                "name": "Context Management",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_agent_memory"
            },
            {
                "id": "p_mem_3",
                "name": "Knowledge Graph Integration",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_agent_memory"
            }
        ],
        "b_agent_tools": [
            {
                "id": "p_agent_tools",
                "name": "Agent Tool Integration",
                "year": 2026,
                "status": "active",
                "level": 1,
                "parent": "p_agent_root"
            },
            {
                "id": "p_tool_1",
                "name": "Function Calling",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_agent_tools"
            },
            {
                "id": "p_tool_2",
                "name": "API Integration",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_agent_tools"
            },
            {
                "id": "p_tool_3",
                "name": "Tool Learning",
                "year": 2026,
                "status": "active",
                "level": 2,
                "parent": "p_agent_tools"
            }
        ]
    }
    
    return branches, problems_by_branch

def create_agent_methods():
    """创建智能体相关的方法定义"""
    return [
        {
            "id": "m_autogen",
            "name": "AutoGen Multi-Agent Framework",
            "description": "微软开源的多智能体对话框架",
            "category": "multi_agent",
            "color": "#8b5cf6",
            "related_problems": ["p_multi_agent", "p_ma_1", "p_ma_2"],
            "year": 2023
        },
        {
            "id": "m_metagent",
            "name": "MetaGPT",
            "description": "基于SOP的多智能体元编程框架",
            "category": "multi_agent",
            "color": "#ec4899",
            "related_problems": ["p_multi_agent", "p_ma_2", "p_ma_3"],
            "year": 2023
        },
        {
            "id": "m_memgpt",
            "name": "MemGPT",
            "description": "操作系统启发的虚拟上下文管理",
            "category": "memory",
            "color": "#22c55e",
            "related_problems": ["p_agent_memory", "p_mem_1", "p_mem_2"],
            "year": 2023
        },
        {
            "id": "m_reflexion",
            "name": "Reflexion",
            "description": "语言强化学习的自我反思机制",
            "category": "memory",
            "color": "#22c55e",
            "related_problems": ["p_agent_memory", "p_mem_2", "p_mem_3"],
            "year": 2023
        },
        {
            "id": "m_toolllm",
            "name": "ToolLLM",
            "description": "大规模API学习框架",
            "category": "tool_use",
            "color": "#f59e0b",
            "related_problems": ["p_agent_tools", "p_tool_1", "p_tool_2"],
            "year": 2023
        },
        {
            "id": "m_gorilla",
            "name": "Gorilla",
            "description": "API调用专用微调模型",
            "category": "tool_use",
            "color": "#f59e0b",
            "related_problems": ["p_agent_tools", "p_tool_1", "p_tool_3"],
            "year": 2023
        },
        {
            "id": "m_voyager",
            "name": "Voyager",
            "description": "终身学习智能体架构",
            "category": "memory",
            "color": "#22c55e",
            "related_problems": ["p_agent_memory", "p_mem_1", "p_mem_3"],
            "year": 2023
        },
        {
            "id": "m_generative_agents",
            "name": "Generative Agents",
            "description": "人类行为模拟智能体",
            "category": "memory",
            "color": "#22c55e",
            "related_problems": ["p_agent_memory", "p_mem_2", "p_mem_3"],
            "year": 2023
        }
    ]

def paper_to_extracted_format(paper):
    """将论文转换为EXTRACTED_DATA格式"""
    category = paper.get('category', '')
    arxiv_id = paper.get('arxiv_id', '')
    
    # 映射分类到问题ID
    problem_mapping = {
        'multi_agent_collaboration': ['p_multi_agent', 'p_ma_1', 'p_ma_2', 'p_ma_3'],
        'long_term_memory': ['p_agent_memory', 'p_mem_1', 'p_mem_2', 'p_mem_3'],
        'tool_use': ['p_agent_tools', 'p_tool_1', 'p_tool_2', 'p_tool_3']
    }
    
    # 映射分类到方法ID
    method_mapping = {
        'multi_agent_collaboration': ['m_autogen', 'm_metagent'],
        'long_term_memory': ['m_memgpt', 'm_reflexion', 'm_voyager', 'm_generative_agents'],
        'tool_use': ['m_toolllm', 'm_gorilla']
    }
    
    problems = problem_mapping.get(category, [])
    methods = method_mapping.get(category, [])
    
    return {
        "arxivId": arxiv_id,
        "title": paper.get('title', ''),
        "authors": paper.get('authors', []),
        "year": paper.get('year', 2024),
        "venue": paper.get('venue', 'arXiv'),
        "abstract": paper.get('abstract', ''),
        "category": category,
        "problems": problems,
        "methods": methods,
        "key_contributions": paper.get('key_contributions', []),
        "url": paper.get('pdf_url', ''),
        "local_path": paper.get('local_path', ''),
        "imported_at": datetime.now().isoformat()
    }

def update_extracted_data(papers):
    """更新EXTRACTED_DATA.json文件"""
    print(f"加载现有EXTRACTED_DATA...")
    
    with open(EXTRACTED_DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 添加新的分支
    new_branches, new_problems = create_agent_branches_and_problems()
    data['branches'].update(new_branches)
    data['problems_by_branch'].update(new_problems)
    
    # 添加新的方法
    new_methods = create_agent_methods()
    if 'methods' not in data:
        data['methods'] = []
    data['methods'].extend(new_methods)
    
    # 添加新的论文
    existing_ids = {p.get('arxivId') for p in data.get('papers', [])}
    new_papers = []
    
    for paper in papers:
        arxiv_id = paper.get('arxiv_id')
        if arxiv_id and arxiv_id not in existing_ids:
            formatted = paper_to_extracted_format(paper)
            new_papers.append(formatted)
            existing_ids.add(arxiv_id)
    
    if 'papers' not in data:
        data['papers'] = []
    data['papers'].extend(new_papers)
    
    # 更新元数据
    data['metadata']['total_papers'] = len(data['papers'])
    data['metadata']['total_problems'] = sum(len(v) for v in data['problems_by_branch'].values())
    data['metadata']['total_methods'] = len(data['methods'])
    data['metadata']['total_branches'] = len(data['branches'])
    
    # 保存更新后的数据
    backup_file = EXTRACTED_DATA_FILE.parent / f"EXTRACTED_DATA_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    with open(EXTRACTED_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ 备份文件: {backup_file}")
    print(f"✓ 新增论文: {len(new_papers)}")
    print(f"✓ 总论文数: {data['metadata']['total_papers']}")
    print(f"✓ 总分支数: {data['metadata']['total_branches']}")
    print(f"✓ 总问题数: {data['metadata']['total_problems']}")
    print(f"✓ 总方法数: {data['metadata']['total_methods']}")
    
    return new_papers

def import_to_sqlite(papers):
    """导入论文到SQLite数据库"""
    print(f"\n连接到数据库: {DB_FILE}")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 检查表结构
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"现有表: {[t[0] for t in tables]}")
    
    # 插入论文数据
    papers_table_exists = any(t[0] == 'papers' for t in tables)
    
    if not papers_table_exists:
        print("创建papers表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                arxiv_id TEXT UNIQUE,
                title TEXT,
                authors TEXT,
                year INTEGER,
                venue TEXT,
                abstract TEXT,
                category TEXT,
                problems TEXT,
                methods TEXT,
                key_contributions TEXT,
                url TEXT,
                local_path TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
    
    inserted_count = 0
    skipped_count = 0
    
    for paper in papers:
        paper_id = str(uuid.uuid4())
        arxiv_id = paper.get('arxiv_id', '')
        
        # 检查是否已存在
        cursor.execute("SELECT id FROM papers WHERE arxiv_id = ?", (arxiv_id,))
        if cursor.fetchone():
            skipped_count += 1
            continue
        
        cursor.execute('''
            INSERT INTO papers (
                id, arxiv_id, title, authors, year, venue, abstract,
                category, problems, methods, key_contributions, url, local_path,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            paper_id,
            arxiv_id,
            paper.get('title', ''),
            json.dumps(paper.get('authors', []), ensure_ascii=False),
            paper.get('year', 2024),
            paper.get('venue', 'arXiv'),
            paper.get('abstract', ''),
            paper.get('category', ''),
            json.dumps(paper.get('problems', []), ensure_ascii=False),
            json.dumps(paper.get('methods', []), ensure_ascii=False),
            json.dumps(paper.get('key_contributions', []), ensure_ascii=False),
            paper.get('pdf_url', ''),
            paper.get('local_path', ''),
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))
        inserted_count += 1
    
    conn.commit()
    conn.close()
    
    print(f"✓ 插入论文: {inserted_count}")
    print(f"✓ 跳过重复: {skipped_count}")
    
    return inserted_count

def main():
    print("=" * 60)
    print("智能体论文导入脚本")
    print("=" * 60)
    
    # 1. 加载论文数据
    print("\n【步骤1】加载论文数据...")
    papers = load_agent_papers()
    print(f"✓ 找到 {len(papers)} 篇智能体论文")
    
    # 分类统计
    categories = {}
    for p in papers:
        cat = p.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1
    print(f"分类统计: {categories}")
    
    # 2. 更新EXTRACTED_DATA.json
    print("\n【步骤2】更新EXTRACTED_DATA.json...")
    new_papers = update_extracted_data(papers)
    
    # 3. 导入到SQLite
    print("\n【步骤3】导入到SQLite数据库...")
    inserted = import_to_sqlite(papers)
    
    # 4. 生成报告
    print("\n【步骤4】生成导入报告...")
    report = {
        "imported_at": datetime.now().isoformat(),
        "total_papers": len(papers),
        "new_papers": len(new_papers),
        "inserted_to_db": inserted,
        "category_distribution": categories,
        "year_distribution": {}
    }
    
    for p in papers:
        year = p.get('year', 0)
        report['year_distribution'][year] = report['year_distribution'].get(year, 0) + 1
    
    report_file = PROJECT_DIR / "agent_papers_import_report.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"✓ 报告已保存: {report_file}")
    
    print("\n" + "=" * 60)
    print("导入完成!")
    print(f"总论文数: {len(papers)}")
    print(f"新增论文: {len(new_papers)}")
    print(f"数据库插入: {inserted}")
    print("=" * 60)

if __name__ == "__main__":
    main()
