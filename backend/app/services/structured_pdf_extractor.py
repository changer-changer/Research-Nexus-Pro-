"""
Structured PDF Extractor using pdfplumber.
Replaces PyPDF2 with better table detection, layout awareness, and section hints.
"""
import logging
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class ExtractedPage:
    page_num: int
    text: str
    tables: List[List[List[str]]] = field(default_factory=list)
    has_table: bool = False


@dataclass
class SectionBlock:
    title: str
    level: int  # 1 = major (Introduction), 2 = subsection
    text: str
    page_range: Tuple[int, int]
    tables: List[List[List[str]]] = field(default_factory=list)


@dataclass
class StructuredDocument:
    pages: List[ExtractedPage]
    sections: List[SectionBlock]
    full_text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class StructuredPDFExtractor:
    """
    Phase 1: pdfplumber-based structured extraction.
    Extracts text with layout awareness, tables, and section structure.
    """

    # Common section headers in academic papers
    SECTION_PATTERNS = [
        r"^(?:\d+\.\s*)?(Abstract|Introduction|Related\s+Work|Background|Method|Methods|Methodology|"
        r"Experiments?|Results?|Evaluation|Discussion|Conclusion|Conclusions|"
        r"Future\s+Work|Acknowledgments?|References|Appendix)[\s:]*$",
        r"^(?:I{1,3}|IV|V|VI|VII|VIII|IX|X)[.\s]+\w+",  # Roman numeral sections
        r"^\d+\.\d*\s+\w+",  # Numbered sections like 1. Introduction
    ]

    def __init__(self):
        if not PDFPLUMBER_AVAILABLE:
            logger.error("pdfplumber not installed. Run: pip install pdfplumber")
            raise ImportError("pdfplumber is required. Run: pip install pdfplumber")

    def extract(self, pdf_path: str) -> StructuredDocument:
        """Extract structured content from a PDF."""
        logger.info(f"Extracting structured content from {pdf_path}")

        pages = []
        all_text_parts = []

        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                page_data = self._extract_page(page, i)
                pages.append(page_data)
                if page_data.text.strip():
                    all_text_parts.append(f"--- Page {i} ---\n{page_data.text}")

        full_text = "\n\n".join(all_text_parts)
        sections = self._detect_sections(pages)

        doc = StructuredDocument(
            pages=pages,
            sections=sections,
            full_text=full_text,
            metadata={"total_pages": len(pages)}
        )

        logger.info(f"Extracted {len(pages)} pages, {len(sections)} sections, "
                    f"{sum(1 for p in pages if p.has_table)} pages with tables")
        return doc

    def extract_text_only(self, pdf_path: str) -> str:
        """Simple text extraction (PyPDF2-compatible interface)."""
        doc = self.extract(pdf_path)
        return doc.full_text

    def _extract_page(self, page: Any, page_num: int) -> ExtractedPage:
        """Extract text and tables from a single page."""
        # Extract text with layout preservation
        text = page.extract_text(layout=True) or ""

        # Clean up common PDF artifacts
        text = self._clean_text(text)

        # Extract tables
        tables = page.extract_tables() or []
        has_table = len(tables) > 0

        # Convert table cells to strings (handling None values)
        cleaned_tables = []
        for table in tables:
            cleaned_table = []
            for row in table:
                cleaned_row = [str(cell) if cell is not None else "" for cell in row]
                cleaned_table.append(cleaned_row)
            if cleaned_table:
                cleaned_tables.append(cleaned_table)

        return ExtractedPage(
            page_num=page_num,
            text=text,
            tables=cleaned_tables,
            has_table=has_table
        )

    def _clean_text(self, text: str) -> str:
        """Clean common PDF extraction artifacts."""
        # Remove headers/footers (lines with just page numbers)
        lines = text.split("\n")
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            # Skip lines that are just page numbers
            if re.match(r"^\d+$", stripped):
                continue
            # Skip lines that look like running headers (short, repeated)
            if len(stripped) < 40 and re.match(r"^[A-Z][a-zA-Z\s:-]+$", stripped):
                continue
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines)

    def _detect_sections(self, pages: List[ExtractedPage]) -> List[SectionBlock]:
        """Detect section boundaries from page text."""
        sections = []
        current_title = "Untitled"
        current_level = 0
        current_text_parts = []
        current_tables = []
        start_page = 1

        section_pattern = re.compile(
            r"|".join(self.SECTION_PATTERNS),
            re.IGNORECASE | re.MULTILINE
        )

        for page in pages:
            lines = page.text.split("\n")
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                match = section_pattern.match(line)
                if match:
                    # Save previous section
                    if current_text_parts:
                        sections.append(SectionBlock(
                            title=current_title,
                            level=current_level,
                            text="\n".join(current_text_parts).strip(),
                            page_range=(start_page, page.page_num),
                            tables=current_tables
                        ))
                    current_title = line
                    current_level = 1
                    current_text_parts = []
                    current_tables = []
                    start_page = page.page_num
                else:
                    current_text_parts.append(lines[i])
                    if page.tables:
                        current_tables.extend(page.tables)
                i += 1

        # Save final section
        if current_text_parts or sections:
            sections.append(SectionBlock(
                title=current_title,
                level=current_level,
                text="\n".join(current_text_parts).strip(),
                page_range=(start_page, pages[-1].page_num if pages else start_page),
                tables=current_tables
            ))

        return sections

    def get_section_text(self, doc: StructuredDocument, section_name: str) -> Optional[str]:
        """Get text for a specific section by name (fuzzy match)."""
        section_name_lower = section_name.lower()
        for section in doc.sections:
            if section_name_lower in section.title.lower():
                return section.text
        return None

    def get_tables_as_text(self, doc: StructuredDocument) -> List[str]:
        """Convert all tables to readable text format."""
        table_texts = []
        for page in doc.pages:
            for table in page.tables:
                lines = [" | ".join(row) for row in table]
                table_texts.append("\n".join(lines))
        return table_texts


# Backward-compatible function for direct replacement
def extract_pdf_text(pdf_path: str) -> str:
    """Drop-in replacement for PyPDF2.extract_text."""
    extractor = StructuredPDFExtractor()
    return extractor.extract_text_only(pdf_path)
