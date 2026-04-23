"""
MarkItDown PDF Extractor - Primary PDF-to-text extraction using markitdown CLI.
Falls back to StructuredPDFExtractor (pdfplumber) if markitdown is unavailable.
"""
import logging
import subprocess
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from app.services.structured_pdf_extractor import StructuredDocument, ExtractedPage, StructuredPDFExtractor

logger = logging.getLogger(__name__)

class MarkItDownExtractor:
    """
    Extracts structured text from PDFs using Microsoft's markitdown tool.
    Produces high-quality Markdown with preserved tables and structure.
    Falls back to pdfplumber-based extractor if markitdown fails.
    """

    def __init__(self):
        self._available = self._check_availability()
        self._fallback = StructuredPDFExtractor()

    def _check_availability(self) -> bool:
        """Check if markitdown CLI is installed."""
        return shutil.which("markitdown") is not None

    def extract(self, pdf_path: str) -> StructuredDocument:
        """
        Extract text from PDF using markitdown, fallback to pdfplumber.
        Returns a StructuredDocument compatible with the pipeline.
        """
        if not self._available:
            logger.info("markitdown not available, using pdfplumber fallback")
            return self._fallback.extract(pdf_path)

        try:
            return self._extract_with_markitdown(pdf_path)
        except Exception as e:
            logger.warning(f"markitdown extraction failed: {e}, falling back to pdfplumber")
            return self._fallback.extract(pdf_path)

    def _extract_with_markitdown(self, pdf_path: str) -> StructuredDocument:
        """Run markitdown CLI and convert markdown output to StructuredDocument."""
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        # Run markitdown via subprocess
        cmd = ["markitdown", str(pdf_file)]
        logger.info(f"Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 2 minute timeout per paper
        )

        if result.returncode != 0:
            raise RuntimeError(f"markitdown failed: {result.stderr}")

        markdown_text = result.stdout

        if not markdown_text or not markdown_text.strip():
            raise ValueError("markitdown produced empty output")

        logger.info(f"markitdown extracted {len(markdown_text)} chars from {pdf_file.name}")

        # Parse markdown into sections
        sections = self._parse_markdown_sections(markdown_text)

        # Create a single-page representation (markitdown doesn't give page boundaries)
        pages = [ExtractedPage(
            page_num=1,
            text=markdown_text[:8000]  # First chunk for page map
        )]

        # Add additional pages if text is very long
        chunk_size = 8000
        for i in range(1, (len(markdown_text) // chunk_size) + 1):
            start = i * chunk_size
            end = start + chunk_size
            pages.append(ExtractedPage(
                page_num=i + 1,
                text=markdown_text[start:end]
            ))

        return StructuredDocument(
            pages=pages,
            sections=sections,
            full_text=markdown_text
        )

    def _parse_markdown_sections(self, markdown: str):
        """Parse markdown into sections based on heading hierarchy."""
        from app.services.structured_pdf_extractor import SectionBlock as ExtractedSection

        sections = []
        current_title = "Abstract"
        current_lines = []
        current_tables = []

        lines = markdown.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i]

            # Detect heading
            if line.startswith("# "):
                # Save previous section
                if current_lines:
                    sections.append(ExtractedSection(
                        title=current_title,
                        level=1,
                        text="\n".join(current_lines).strip(),
                        page_range=(1, 1),
                        tables=current_tables
                    ))
                current_title = line[2:].strip()
                current_lines = []
                current_tables = []
            elif line.startswith("## "):
                if current_lines:
                    sections.append(ExtractedSection(
                        title=current_title,
                        level=2,
                        text="\n".join(current_lines).strip(),
                        page_range=(1, 1),
                        tables=current_tables
                    ))
                current_title = line[3:].strip()
                current_lines = []
                current_tables = []
            elif line.startswith("### "):
                # Sub-heading, append to current section
                current_lines.append(line)
            elif line.strip().startswith("|") and line.strip().endswith("|"):
                # Table row - collect full table
                table_lines = []
                while i < len(lines) and lines[i].strip().startswith("|"):
                    table_lines.append(lines[i])
                    i += 1
                # Parse markdown table
                table_data = self._parse_markdown_table(table_lines)
                if table_data:
                    current_tables.append(table_data)
                continue
            else:
                current_lines.append(line)

            i += 1

        # Save final section
        if current_lines:
            sections.append(ExtractedSection(
                title=current_title,
                level=1,
                text="\n".join(current_lines).strip(),
                page_range=(1, 1),
                tables=current_tables
            ))

        # If no sections detected, create one big section
        if not sections:
            sections.append(ExtractedSection(
                title="Full Text",
                level=1,
                text=markdown,
                page_range=(1, 1),
                tables=[]
            ))

        return sections

    def _parse_markdown_table(self, lines: list) -> Optional[list]:
        """Parse markdown table format into list of lists."""
        if len(lines) < 2:
            return None

        # Skip separator line (e.g., |---|---|)
        data_lines = [l for l in lines if not set(l.strip().replace("|", "")).issubset({"-", ":", " "})]

        rows = []
        for line in data_lines:
            # Split by | and strip
            cells = [cell.strip() for cell in line.split("|")]
            # Remove empty first/last cells from leading/trailing |
            cells = [c for c in cells if c]
            if cells:
                rows.append(cells)

        return rows if rows else None

    def get_tables_as_text(self, doc: StructuredDocument) -> list:
        """Extract all tables as formatted text strings."""
        texts = []
        for sec in doc.sections:
            for ti, table in enumerate(sec.tables, 1):
                lines = [f"[Table {ti} from {sec.title}]"]
                for row in table:
                    lines.append(" | ".join(str(c) for c in row))
                texts.append("\n".join(lines))
        return texts
