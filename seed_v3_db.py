import asyncio
import json
import sys
import os
import uuid
from pathlib import Path

backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database.local_graph import LocalGraphDB
from app.database.local_vector import LocalVectorDB
from app.services.ingestion_pipeline import IngestionPipeline
from app.models.domain_schema import PaperClaim, EvidenceSpan

async def seed_db():
    graph_db = LocalGraphDB()
    vector_db = LocalVectorDB()
    
    # Clear existing DBs
    if os.path.exists("data/research_graph.db"):
        os.remove("data/research_graph.db")
    # Actually graph_db creates the db if it doesn't exist
    graph_db = LocalGraphDB()
    graph_db._init_db()

    pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)
    
    with open("src/data/real_papers_enriched.json", "r") as f:
        data = json.load(f)
        
    papers = data.get("papers", [])[:10] # just 10 papers
    print(f"Seeding {len(papers)} papers into V3 Database...")
    
    for paper in papers:
        paper_id = paper.get("id") or str(uuid.uuid4())
        
        claims = []
        for prob in paper.get("problems", []):
            claims.append(PaperClaim(
                claim_id=f"claim_{uuid.uuid4().hex[:8]}",
                claim_type="problem_statement",
                text=prob,
                evidence=[EvidenceSpan(paper_id=paper_id, section="Abstract", snippet=prob, confidence=0.9)]
            ))
            
        for meth in paper.get("methods", []):
            claims.append(PaperClaim(
                claim_id=f"claim_{uuid.uuid4().hex[:8]}",
                claim_type="method_mechanism",
                text=meth,
                evidence=[EvidenceSpan(paper_id=paper_id, section="Methodology", snippet=meth, confidence=0.9)]
            ))
            
        # Bypass Stage 1 & 2, directly go to Stage 3 & 4
        print(f"Aligning claims for paper {paper_id}...")
        aligned_nodes = await pipeline._align_to_canonical(claims)
        
        print(f"Writing to Graph/Vector DB for paper {paper_id}...")
        await pipeline._write_to_stores(aligned_nodes, claims, paper_id)
        
        print(f"Triggering innovation discovery...")
        await pipeline._trigger_innovation_discovery(aligned_nodes)
        
    print("Database seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_db())
