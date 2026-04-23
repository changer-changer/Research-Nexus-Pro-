import asyncio
import os
import logging
from app.services.ingestion_pipeline import IngestionPipeline

# Configure logging
logging.basicConfig(level=logging.INFO)

async def run_test():
    print("=== Starting Ingestion Pipeline Test ===")
    
    # 1. Create a dummy PDF file for testing
    test_pdf_path = "test_paper.pdf"
    try:
        from reportlab.pdfgen import canvas
        c = canvas.Canvas(test_pdf_path)
        c.drawString(100, 750, "Title: Soft Tactile Sensors with High-Frequency Response")
        c.drawString(100, 730, "Abstract: Capturing high-frequency vibrations >500Hz remains a major challenge.")
        c.drawString(100, 710, "We propose a novel Quantum-Resonance elastomer method that resolves this.")
        c.drawString(100, 690, "Experiments show our sensor detects up to 800Hz with 95% accuracy.")
        c.drawString(100, 670, "However, the method is computationally expensive and struggles with low temps.")
        c.save()
        print(f"Created test PDF at {test_pdf_path}")
    except ImportError:
        print("Please install reportlab to generate the test PDF: pip install reportlab")
        return

    # 2. Initialize the pipeline
    pipeline = IngestionPipeline()
    
    # 3. Process the paper
    print("\n--- Running Pipeline ---")
    result = await pipeline.process_paper(
        pdf_path=test_pdf_path, 
        meta={"paper_id": "test_paper_001", "title": "Test Paper"}
    )
    
    print("\n=== Ingestion Result ===")
    print(result)

    # Cleanup
    if os.path.exists(test_pdf_path):
        os.remove(test_pdf_path)

if __name__ == "__main__":
    asyncio.run(run_test())