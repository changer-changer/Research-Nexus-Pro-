import asyncio
import os
import httpx

async def run_integration_test():
    print("=== Sending PDF to V3 Ingest API ===")
    
    test_pdf_path = "test_paper_api.pdf"
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(test_pdf_path)
    c.drawString(100, 750, "Title: Soft Tactile Sensors with High-Frequency Response")
    c.drawString(100, 730, "Abstract: Capturing high-frequency vibrations >500Hz remains a major challenge.")
    c.drawString(100, 710, "We propose a novel Quantum-Resonance elastomer method that resolves this.")
    c.save()

    async with httpx.AsyncClient() as client:
        with open(test_pdf_path, "rb") as f:
            files = {"file": ("test_paper_api.pdf", f, "application/pdf")}
            data = {"paper_id": "api_test_001"}
            response = await client.post("http://localhost:8000/api/v3/ingest", data=data, files=files, timeout=60.0)
            print(f"Ingest Status Code: {response.status_code}")
            print(f"Ingest Response: {response.text}")
            
        print("\n=== Fetching Innovation Board ===")
        board_resp = await client.get("http://localhost:8000/api/v3/innovation-board", timeout=10.0)
        print(f"Board Status: {board_resp.status_code}")
        board_data = board_resp.json()
        print(f"Opportunities Found: {len(board_data.get('opportunities', []))}")
        
        if board_data.get('opportunities'):
            opp = board_data['opportunities'][0]
            print(f"First Opp ID: {opp['opportunity_id']}")
            
        print("\n=== Fetching Evidence (Assuming claim_id exists if fallback used) ===")
        # We need a valid claim ID. The ingest endpoint response doesn't return the exact claim IDs directly yet, 
        # but let's query Domain Map to see what we have, or simply skip direct evidence fetch in this script and verify manually in UI.
        map_resp = await client.get("http://localhost:8000/api/v3/domain-map", timeout=10.0)
        map_data = map_resp.json()
        print(f"Domain Map Problems: {len(map_data.get('problems', []))}, Methods: {len(map_data.get('methods', []))}")
            
    if os.path.exists(test_pdf_path):
        os.remove(test_pdf_path)

if __name__ == "__main__":
    asyncio.run(run_integration_test())