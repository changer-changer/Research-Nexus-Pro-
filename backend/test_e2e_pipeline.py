import asyncio
import os
import json
import logging
from fpdf import FPDF

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("E2E_Test")

from app.database.local_graph import LocalGraphDB
from app.database.local_vector import LocalVectorDB
from app.services.ingestion_pipeline import IngestionPipeline

async def run_e2e_test():
    logger.info("=========================================")
    logger.info("STARTING END-TO-END RESEARCH PIPELINE TEST")
    logger.info("=========================================")
    
    # 1. Initialize Databases
    logger.info("Initializing Graph & Vector Databases...")
    graph_db = LocalGraphDB("data/test_research_graph.db")
    vector_db = LocalVectorDB("data/test_research_vector.db")
    
    # Clean DB for fresh test
    graph_db.clear_all()
    # Note: SQLite-vec doesn't have a simple clear_all yet, but we use new UUIDs so it's fine.
    
    pipeline = IngestionPipeline(graph_db=graph_db, vector_db=vector_db)
    
    # 2. Create Dummy PDF
    logger.info("Creating Dummy PDF with known text...")
    pdf_path = "test_e2e_paper.pdf"
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    known_text = """
Title: Advanced Neural Radiance Fields for Soft Tissue Modeling
Abstract: Rendering soft tissue accurately is a major problem in robotic surgery simulation. 
The core problem is that soft tissue deformation is highly non-linear and traditional FEM methods are too slow for real-time.
We propose a novel method called Tissue-NeRF. The core mechanism is to use a dynamic MLP to map spatial coordinates to tissue density and color.
Our assumption is that the tissue deformation is continuous.
However, a major limitation is that it fails under extreme topological changes like cutting.
Experiments show our method achieves 90% accuracy at 60 FPS.
    """
    pdf.multi_cell(0, 10, known_text)
    pdf.output(pdf_path)
    
    # 3. Run Ingestion Pipeline
    logger.info("Running Ingestion Pipeline (Harvester -> LLM Extractor -> Vector Condenser)...")
    meta = {
        "paper_id": "arxiv_test_e2e_001",
        "title": "Advanced Neural Radiance Fields for Soft Tissue Modeling",
        "authors": ["Test Author A", "Test Author B"],
        "year": "2026",
        "venue": "ICRA"
    }
    
    try:
        result = await pipeline.process_paper(pdf_path, meta)
        logger.info(f"Ingestion Result: {result}")
    except Exception as e:
        logger.error(f"Ingestion Failed: {e}")
        import traceback
        traceback.print_exc()
        return

    # 4. Verify Graph DB Nodes
    logger.info("Verifying Graph Database Contents...")
    problems = graph_db.get_all_problems()
    methods = graph_db.get_all_methods()
    
    logger.info(f"Extracted Problems: {len(problems)}")
    for p in problems:
        logger.info(f" - [PROB] {p.get('name')}")
        logger.info(f"   > Constraints: {p.get('constraints')}")
        logger.info(f"   > Metrics: {p.get('evaluation_metrics')}")
        
    logger.info(f"Extracted Methods: {len(methods)}")
    for m in methods:
        logger.info(f" - [METH] {m.get('name')}")
        logger.info(f"   > Assumptions: {m.get('assumptions')}")
        logger.info(f"   > Limitations: {m.get('limitations')}")
        
    # 5. Verify Innovation Discovery
    innovations = graph_db.get_all_innovations()
    logger.info(f"Generated Innovations (Cross-Domain Collisions): {len(innovations)}")
    for opp in innovations:
        logger.info(f" - [INNOVATION] {opp.get('rationale')}")
        
    # 6. Test Node Description Generation (Kimi Node Insight)
    if problems:
        prob_id = problems[0]['id']
        logger.info(f"Testing Node Description Generation for Problem {prob_id}...")
        from app.api.v3_graph_routes import generate_node_description
        try:
            desc_res = await generate_node_description(prob_id, graph_db)
            logger.info("Node Description Generated Successfully.")
        except Exception as e:
            logger.error(f"Node Description Gen Failed: {e}")
            
    # 7. Test Multi-Agent Debate Innovation Generation
    if innovations:
        opp_id = innovations[0]['id']
        logger.info(f"Testing Multi-Agent Debate (Generator vs Devil's Advocate) for Innovation {opp_id}...")
        from app.api.v3_graph_routes import generate_insight
        try:
            insight_res = await generate_insight(opp_id, graph_db)
            logger.info(f"Top-Tier Proposal Generated!")
            logger.info(f"Title: {insight_res.paper_title}")
            logger.info(f"Type: {insight_res.innovation_type}")
        except Exception as e:
            logger.error(f"Multi-Agent Debate Gen Failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
