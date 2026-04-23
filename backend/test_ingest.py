import requests
from fpdf import FPDF
import time

print("Creating dummy PDF...")
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.multi_cell(0, 10, "Title: Photonic Micro-Vibration Sensor for Soft Tactile Skins\n\nAbstract: Despite recent advances, capturing high-frequency vibrations >500Hz remains a major challenge for soft tactile skins. We propose a novel Photonic-Membrane mechanism leveraging light diffraction to overcome this bandwidth limitation. Experiments show our method captures up to 2000Hz vibrations accurately.")
pdf.output("test_paper.pdf")

print("Sending to /api/v3/ingest...")
url = "http://localhost:8000/api/v3/ingest"
files = {'file': ('test_paper.pdf', open('test_paper.pdf', 'rb'), 'application/pdf')}
data = {
    'paper_id': 'arxiv_test_123',
    'title': 'Photonic Micro-Vibration Sensor',
    'authors': 'John Doe, Jane Smith',
    'year': '2026',
    'venue': 'Nature Robotics'
}

response = requests.post(url, files=files, data=data)
print("Status Code:", response.status_code)
print("Response JSON:", response.json())
