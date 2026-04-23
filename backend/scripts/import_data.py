#!/usr/bin/env python3
"""
Data Import Script for Research-Nexus
Imports EXTRACTED_DATA.json into Local Database (SQLite + NumPy)
"""

import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database.local_graph import LocalGraphDB
from app.database.local_vector import LocalVectorDB
import numpy as np


def load_extracted_data():
    """Load EXTRACTED_DATA.json."""
    data_path = Path(__file__).parent.parent.parent / "EXTRACTED_DATA.json"
    with open(data_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def import_problems(graph_db: LocalGraphDB, data: dict):
    """Import problems from EXTRACTED_DATA.json."""
    print("📥 Importing Problems...")
    
    problems_by_branch = data.get("problems_by_branch", {})
    count = 0
    
    for branch_id, problems in problems_by_branch.items():
        for problem in problems:
            problem_data = {
                "id": problem["id"],
                "name": problem["name"],
                "definition": problem.get("description", ""),
                "domain": "robotics",
                "status": problem.get("status", "active"),
                "year": problem.get("year", 2024),
                "level": problem.get("level", 0),
                "parent_id": problem.get("parent"),
                "branch": branch_id,
            }
            
            # Add to graph
            graph_db.create_problem(problem_data)
            count += 1
    
    print(f"✅ Imported {count} problems")
    return count


def import_methods(graph_db: LocalGraphDB, data: dict):
    """Import methods from EXTRACTED_DATA.json."""
    print("📥 Importing Methods...")
    
    methods_by_approach = data.get("methods_by_approach", {})
    count = 0
    
    for approach, methods in methods_by_approach.items():
        for method in methods:
            method_data = {
                "id": method["id"],
                "name": method["name"],
                "mechanism": method.get("mechanism", ""),
                "approach": approach,
                "complexity": method.get("complexity", "medium"),
                "level": method.get("level", 0),
                "parent_id": method.get("parent"),
            }
            graph_db.create_method(method_data)
            count += 1
    
    print(f"✅ Imported {count} methods")
    return count


def import_papers(graph_db: LocalGraphDB, data: dict):
    """Import papers from EXTRACTED_DATA.json."""
    print("📥 Importing Papers...")
    
    papers_by_year = data.get("papers_by_year", {})
    count = 0
    
    for year, papers in papers_by_year.items():
        for paper in papers:
            paper_data = {
                "id": paper["id"],
                "title": paper.get("title", ""),
                "authors": paper.get("authors", []),
                "year": paper.get("year", int(year) if year.isdigit() else 2024),
                "venue": paper.get("venue", "unknown"),
                "abstract": paper.get("abstract", ""),
                "category": paper.get("category", "general"),
                "authority_score": paper.get("authorityScore", 5),
            }
            
            # Add to graph
            graph_db.create_paper(paper_data)
            
            # Create relationships
            problems = paper.get("problems", [])
            methods = paper.get("methods", [])
            
            # Handle both string IDs and object formats
            problem_ids = [p if isinstance(p, str) else p.get("id") for p in problems]
            method_ids = [m if isinstance(m, str) else m.get("id") for m in methods]
            
            graph_db.create_paper_relationships(
                paper_id=paper["id"],
                problem_ids=problem_ids,
                method_ids=method_ids
            )
            
            count += 1
    
    print(f"✅ Imported {count} papers")
    return count


def import_vectors(vector_db: LocalVectorDB, data: dict):
    """Generate and import vector embeddings."""
    print("📥 Generating Vectors (simplified)...")
    
    # Get all methods
    methods_by_approach = data.get("methods_by_approach", {})
    methods_dict = {}
    for approach, methods in methods_by_approach.items():
        for method in methods:
            methods_dict[method["id"]] = method
    
    # Get all problems
    problems_by_branch = data.get("problems_by_branch", {})
    problems_dict = {}
    for branch_id, problems in problems_by_branch.items():
        for problem in problems:
            problems_dict[problem["id"]] = problem
    
    # Generate random vectors for now (in production, use OpenAI embeddings)
    vector_dim = 1536
    
    for problem_id, problem in problems_dict.items():
        # Create a deterministic vector based on problem id
        np.random.seed(hash(problem_id) % 2**32)
        vector = np.random.randn(vector_dim).tolist()
        
        vector_db.upsert_problem_vector(
            problem_id=problem_id,
            vector=vector,
            payload={
                "id": problem_id,
                "name": problem.get("name", ""),
                "type": "problem"
            }
        )
    
    for method_id, method in methods_dict.items():
        np.random.seed(hash(method_id) % 2**32)
        vector = np.random.randn(vector_dim).tolist()
        
        vector_db.upsert_method_vector(
            method_id=method_id,
            vector=vector,
            payload={
                "id": method_id,
                "name": method.get("name", ""),
                "type": "method"
            }
        )
    
    print(f"✅ Generated {len(problems_dict)} problem vectors, {len(methods_dict)} method vectors")


def main():
    """Main import function."""
    print("=" * 50)
    print("🔧 Research-Nexus Data Import Tool")
    print("=" * 50)
    
    # Initialize databases
    graph_db = LocalGraphDB()
    vector_db = LocalVectorDB()
    
    # Load data
    print("📂 Loading EXTRACTED_DATA.json...")
    data = load_extracted_data()
    
    metadata = data.get("metadata", {})
    print(f"  Papers: {metadata.get('total_papers', 'N/A')}")
    print(f"  Problems: {metadata.get('total_problems', 'N/A')}")
    print(f"  Methods: {metadata.get('total_methods', 'N/A')}")
    print()
    
    # Import data
    problems_count = import_problems(graph_db, data)
    methods_count = import_methods(graph_db, data)
    papers_count = import_papers(graph_db, data)
    import_vectors(vector_db, data)
    
    # Summary
    print()
    print("=" * 50)
    print("📊 Import Summary")
    print("=" * 50)
    print(f"✅ Problems: {problems_count}")
    print(f"✅ Methods: {methods_count}")
    print(f"✅ Papers: {papers_count}")
    print()
    print("🎉 Import complete!")
    print("   Database: backend/data/research_graph.db")
    print("   Vectors:  backend/data/vectors/")


if __name__ == "__main__":
    main()
