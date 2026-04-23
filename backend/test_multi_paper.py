import asyncio
import os
import httpx

async def generate_pdf(path: str, lines: list):
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(path)
    y = 750
    for line in lines:
        c.drawString(100, y, line)
        y -= 20
    c.save()

async def run_multi_paper_test():
    print("=== Multi-Paper Graph Convergence Test ===")
    
    # 1. Generate Paper A
    paper_a_path = "paper_a.pdf"
    await generate_pdf(paper_a_path, [
        "Title: Soft Tactile Sensors with High-Frequency Response",
        "Abstract: Capturing high-frequency vibrations >500Hz remains a major challenge.",
        "We propose a novel Quantum-Resonance elastomer method that resolves this."
    ])
    
    # 2. Generate Paper B (Similar Problem, Different Method)
    paper_b_path = "paper_b.pdf"
    await generate_pdf(paper_b_path, [
        "Title: Photonic Sensing for Rapid Micro-Vibrations",
        "Abstract: Soft sensors suffer from severe bandwidth limitations for rapid micro-vibrations (>500Hz).",
        "To address this, we introduce a Photonic-Membrane mechanism leveraging light diffraction."
    ])
    
    # 3. Generate Paper C (Different Problem entirely, but Method has some physical resonance property)
    paper_c_path = "paper_c.pdf"
    await generate_pdf(paper_c_path, [
        "Title: Acoustic Damping in Submarine Structures",
        "Abstract: Stopping low-frequency waves is hard.",
        "We propose an Acoustic-Metamaterial damper that absorbs high-frequency vibrations well."
    ])
    
    async with httpx.AsyncClient() as client:
        # Ingest Paper A
        print("\n--- Ingesting Paper A ---")
        with open(paper_a_path, "rb") as f:
            resp_a = await client.post("http://localhost:8000/api/v3/ingest", 
                                       data={"paper_id": "paper_a"}, 
                                       files={"file": ("paper_a.pdf", f, "application/pdf")}, timeout=60.0)
            
        # Ingest Paper B
        print("\n--- Ingesting Paper B ---")
        with open(paper_b_path, "rb") as f:
            resp_b = await client.post("http://localhost:8000/api/v3/ingest", 
                                       data={"paper_id": "paper_b"}, 
                                       files={"file": ("paper_b.pdf", f, "application/pdf")}, timeout=60.0)

        # Ingest Paper C
        print("\n--- Ingesting Paper C (The Cross-Domain Seed) ---")
        with open(paper_c_path, "rb") as f:
            resp_c = await client.post("http://localhost:8000/api/v3/ingest", 
                                       data={"paper_id": "paper_c"}, 
                                       files={"file": ("paper_c.pdf", f, "application/pdf")}, timeout=60.0)

        # Fetch Graph State
        print("\n=== Fetching Converged Graph State ===")
        map_resp = await client.get("http://localhost:8000/api/v3/domain-map", timeout=10.0)
        map_data = map_resp.json()
        print(f"Total Canonical Problems: {len(map_data.get('problems', []))} (Expected 2)")
        print(f"Total Canonical Methods: {len(map_data.get('methods', []))} (Expected 3)")
        
        print("\n=== Fetching Innovation Board ===")
        board_resp = await client.get("http://localhost:8000/api/v3/innovation-board", timeout=10.0)
        board_data = board_resp.json()
        print(f"Innovations Discovered: {len(board_data.get('opportunities', []))}")
        for opp in board_data.get('opportunities', []):
            print(f"- {opp['rationale']}")
            
    # Cleanup
    for p in [paper_a_path, paper_b_path, paper_c_path]:
        if os.path.exists(p):
            os.remove(p)

if __name__ == "__main__":
    asyncio.run(run_multi_paper_test())