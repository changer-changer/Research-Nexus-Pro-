#!/usr/bin/env python3
"""
Paper Reader Plus - Enhanced PDF extraction with citation network and image filtering.
Extracts text, images, tables, and citations from academic PDFs into structured markdown.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from collections import Counter

try:
    import pdfplumber
    import fitz  # PyMuPDF
except ImportError as e:
    print(f"Error: Missing dependency - {e}")
    print("Install: pip install pdfplumber pymupdf")
    sys.exit(1)


class PaperReaderPlus:
    """Enhanced reader for academic PDF papers."""

    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.pdf_name = Path(pdf_path).stem
        self.doc = fitz.open(pdf_path)
        try:
            self.plumber_pdf = pdfplumber.open(pdf_path)
        except Exception:
            self.plumber_pdf = None

    def get_metadata(self) -> dict:
        meta = self.doc.metadata or {}
        return {
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "subject": meta.get("subject", ""),
            "keywords": meta.get("keywords", ""),
            "pages": len(self.doc),
            "filename": self.pdf_name
        }

    def extract_text(self) -> str:
        """Extract full text from all pages."""
        return "\n\n".join(p.get_text() for p in self.doc)

    def extract_text_structured(self) -> list:
        """Extract text page by page with page numbers."""
        pages = []
        for i, page in enumerate(self.doc):
            text = page.get_text()
            if text.strip():
                pages.append({"page": i + 1, "text": text})
        return pages

    def extract_sections(self) -> dict:
        """Extract text organized by section headers."""
        full_text = self.extract_text()
        sections = {}
        # Common section headers in academic papers
        section_patterns = [
            r'(?m)^(?:Abstract|ABSTRACT)\s*$',
            r'(?m)^\d+\.?\s*(?:Introduction|INTRODUCTION)\s*$',
            r'(?m)^\d+\.?\s*(?:Related Work|Background|RELATED WORK)\s*$',
            r'(?m)^\d+\.?\s*(?:Method|Methods|Methodology|METHODS|Approach|Our Approach)\s*$',
            r'(?m)^\d+\.?\s*(?:Experiment|Experiments|Evaluation|EXPERIMENTS|Results|RESULTS)\s*$',
            r'(?m)^\d+\.?\s*(?:Conclusion|Conclusions|CONCLUSION|Discussion|Future Work)\s*$',
            r'(?m)^(?:References|REFERENCES|Bibliography)\s*$',
        ]

        lines = full_text.split('\n')
        current_section = "header"
        current_text = []

        for line in lines:
            matched = False
            for pattern in section_patterns:
                if re.match(pattern, line.strip()):
                    if current_text:
                        sections[current_section] = '\n'.join(current_text)
                    current_section = line.strip()
                    current_text = []
                    matched = True
                    break
            if not matched:
                current_text.append(line)

        if current_text:
            sections[current_section] = '\n'.join(current_text)

        return sections

    def extract_images(self, output_dir: str, min_size: int = 300) -> list:
        """Extract meaningful images from PDF, filtering decorative ones.
        
        Filtering rules:
        - Skip images smaller than min_size on either dimension (icons, bullets)
        - Keep images >= 300px (charts, diagrams, photos, tables rendered as images)
        """
        os.makedirs(output_dir, exist_ok=True)
        images = []
        img_idx = 0

        for page_idx, page in enumerate(self.doc):
            image_list = page.get_images(full=True)
            for img_info in image_list:
                xref = img_info[0]
                try:
                    base_image = self.doc.extract_image(xref)
                    if base_image:
                        image_bytes = base_image["image"]
                        width = base_image.get("width", 0)
                        height = base_image.get("height", 0)

                        # Filter decorative images (icons, bullets, small markers)
                        if width < min_size or height < min_size:
                            continue

                        img_idx += 1
                        img_name = f"fig_{img_idx:03d}_p{page_idx+1}.png"
                        img_path = os.path.join(output_dir, img_name)

                        with open(img_path, "wb") as f:
                            f.write(image_bytes)

                        images.append({
                            "index": img_idx,
                            "page": page_idx + 1,
                            "filename": img_name,
                            "width": width,
                            "height": height,
                            "size_bytes": len(image_bytes)
                        })
                except Exception:
                    continue

        return images

    def extract_tables(self, output_dir: str) -> list:
        """Extract tables from PDF as CSV files."""
        os.makedirs(output_dir, exist_ok=True)
        tables = []

        if not self.plumber_pdf:
            return tables

        for page_idx, page in enumerate(self.plumber_pdf.pages):
            try:
                page_tables = page.extract_tables()
                for table_idx, table in enumerate(page_tables):
                    if not table or len(table) < 2:
                        continue

                    table_idx_global = len(tables) + 1
                    csv_name = f"table_{table_idx_global:03d}_p{page_idx+1}.csv"
                    csv_path = os.path.join(output_dir, csv_name)

                    with open(csv_path, "w", encoding="utf-8") as f:
                        for row in table:
                            if row:
                                f.write(",".join('"' + str(cell).replace('"', '""') + '"' if cell else '""' for cell in row) + "\n")

                    tables.append({
                        "index": table_idx_global,
                        "page": page_idx + 1,
                        "filename": csv_name,
                        "rows": len(table),
                        "cols": len(table[0]) if table else 0
                    })
            except Exception:
                continue

        return tables

    def extract_citations(self) -> dict:
        """Extract citation network from references section."""
        full_text = self.extract_text()

        # Find references section
        refs_match = re.search(
            r'(?:References|REFERENCES|Bibliography)\s*\n(.*?)$',
            full_text, re.DOTALL
        )
        refs_text = refs_match.group(1) if refs_match else full_text

        # Extract arxiv IDs in multiple formats
        arxiv_ids = set()
        arxiv_ids.update(re.findall(r'arXiv[:\s]+(\d{4}\.\d{4,5})', refs_text))
        arxiv_ids.update(re.findall(r'arxiv\.org/abs/(\d{4}\.\d{4,5})', refs_text))
        # Bare format in reference brackets
        arxiv_ids.update(re.findall(r'(?<!\d\.)(\d{4}\.\d{4,5})(?!\d)', refs_text))

        # Count references
        ref_count = len(re.findall(r'\[\d+\]', refs_text))

        return {
            "arxiv_ids": sorted(arxiv_ids),
            "total_references": ref_count,
            "total_arxiv_citations": len(arxiv_ids)
        }

    def full_extraction(self, output_dir: str) -> dict:
        """Complete extraction: text + images + tables + citations."""
        os.makedirs(output_dir, exist_ok=True)
        aid_m = re.search(r'(\d{4}\.\d{4,5})', self.pdf_name)
        arxiv_id = aid_m.group(1) if aid_m else self.pdf_name

        result = {"arxiv_id": arxiv_id, "pdf": self.pdf_path}

        # 1. Metadata
        result["metadata"] = self.get_metadata()

        # 2. Text
        text = self.extract_text()
        text_path = os.path.join(output_dir, f"{arxiv_id}_text.txt")
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text)
        result["text_chars"] = len(text)
        result["text_file"] = text_path

        # 3. Sections
        result["sections"] = list(self.extract_sections().keys())

        # 4. Images
        img_dir = os.path.join(output_dir, f"{arxiv_id}_figures")
        result["images"] = self.extract_images(img_dir)

        # 5. Tables
        tbl_dir = os.path.join(output_dir, f"{arxiv_id}_tables")
        result["tables"] = self.extract_tables(tbl_dir)

        # 6. Citations
        result["citations"] = self.extract_citations()

        # 7. Generate markdown analysis
        md_path = os.path.join(output_dir, f"{arxiv_id}_analysis.md")
        self._generate_markdown(result, md_path)
        result["analysis_file"] = md_path

        return result

    def _generate_markdown(self, data: dict, output_path: str):
        """Generate structured markdown analysis."""
        meta = data["metadata"]

        md = f"""# {meta['title']}

## 基本信息
- **ArXiv ID**: {data['arxiv_id']}
- **作者**: {meta['author']}
- **页数**: {meta['pages']}
- **关键词**: {meta.get('subject', 'N/A')}

---

## 1. 研究背景
{self._get_section_text('Introduction', data.get('sections', []))}

## 2. 研究问题与方法
{self._get_section_text('Method', data.get('sections', []))}

## 3. 实验结果
{self._get_section_text('Experiment', data.get('sections', []))}

## 4. 结论
{self._get_section_text('Conclusion', data.get('sections', []))}

---

## 引用网络
- **总引用数**: {data['citations']['total_references']}
- **ArXiv 引用**: {data['citations']['total_arxiv_citations']}
- **关键引用 ID**: {', '.join(data['citations']['arxiv_ids'][:20])}

## 图表
- **提取图片数**: {len(data['images'])}
- **提取表格数**: {len(data['tables'])}

---
*由 Paper Reader Plus 提取*
"""
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md)

    def _get_section_text(self, section_keyword, sections):
        """Get text for a section matching keyword."""
        full = self.extract_text()
        pattern = rf'(?i){section_keyword}.*?\n(.*?)(?=\n\d+\.?\s*[A-Z]|\nReferences|\Z)'
        m = re.search(pattern, full, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()[:2000]  # Limit length
        return "（需要从原文提取）"


def batch_process(input_dir: str, output_dir: str):
    """Process all PDFs in a directory."""
    import glob as globmod
    pdfs = globmod.glob(os.path.join(input_dir, "**/*.pdf"), recursive=True)
    results = []

    os.makedirs(output_dir, exist_ok=True)

    for pdf in sorted(pdfs):
        if ".venv" in pdf:
            continue
        try:
            reader = PaperReaderPlus(pdf)
            arxiv_m = re.search(r'(\d{4}\.\d{4,5})', os.path.basename(pdf))
            arxiv_id = arxiv_m.group(1) if arxiv_m else Path(pdf).stem
            pdf_output = os.path.join(output_dir, arxiv_id)
            result = reader.full_extraction(pdf_output)
            results.append(result)
            print(f"  ✅ {arxiv_id}: {result['text_chars']} chars, {len(result['images'])} imgs, {len(result['tables'])} tables")
        except Exception as e:
            print(f"  ❌ {os.path.basename(pdf)}: {e}")

    # Save citation network
    citation_edges = []
    for r in results:
        for cited in r.get("citations", {}).get("arxiv_ids", []):
            citation_edges.append({"from": r["arxiv_id"], "to": cited})

    citation_data = {
        "papers": {r["arxiv_id"]: {"title": r["metadata"]["title"], "citations": r["citations"]["arxiv_ids"], "total_refs": r["citations"]["total_references"]} for r in results},
        "edges": citation_edges,
        "total_edges": len(citation_edges)
    }

    with open(os.path.join(output_dir, "citation_network.json"), "w") as f:
        json.dump(citation_data, f, indent=2, ensure_ascii=False)

    return results


def main():
    parser = argparse.ArgumentParser(description="Enhanced PDF paper reader with citations and image support")
    parser.add_argument("pdf_file", nargs="?", help="Path to PDF file")
    parser.add_argument("--batch", action="store_true", help="Batch process a directory")
    parser.add_argument("--input", help="Input directory for batch mode")
    parser.add_argument("--output", "-o", default="./output", help="Output directory")
    parser.add_argument("--full", action="store_true", help="Full extraction")
    parser.add_argument("--text", action="store_true", help="Extract text only")
    parser.add_argument("--images", action="store_true", help="Extract images")
    parser.add_argument("--tables", action="store_true", help="Extract tables")
    parser.add_argument("--citations", action="store_true", help="Extract citations only")
    parser.add_argument("--metadata", action="store_true", help="Show metadata only")
    parser.add_argument("--section", help="Extract specific section")
    parser.add_argument("--pages", help="Page range (e.g., 1-5)")
    parser.add_argument("--img-dir", help="Image output directory")
    parser.add_argument("--csv-dir", help="CSV output directory")
    parser.add_argument("--min-img-size", type=int, default=100, help="Min image size in px")

    args = parser.parse_args()

    if args.batch:
        if not args.input:
            print("Error: --input required for batch mode")
            sys.exit(1)
        print(f"Batch processing: {args.input}")
        results = batch_process(args.input, args.output)
        print(f"\nDone! Processed {len(results)} papers")
        return

    if not args.pdf_file:
        print("Error: PDF file required")
        parser.print_help()
        sys.exit(1)

    reader = PaperReaderPlus(args.pdf_file)

    if args.metadata:
        meta = reader.get_metadata()
        print(json.dumps(meta, indent=2))
        return

    if args.text:
        if args.pages:
            start, end = map(int, args.pages.split("-"))
            pages = reader.extract_text_structured()
            for p in pages:
                if start <= p["page"] <= end:
                    print(f"\n=== Page {p['page']} ===")
                    print(p["text"])
        else:
            print(reader.extract_text())
        return

    if args.citations:
        cites = reader.extract_citations()
        print(json.dumps(cites, indent=2))
        return

    if args.images:
        img_dir = args.img_dir or args.output or "./figures"
        imgs = reader.extract_images(img_dir, args.min_img_size)
        print(f"Extracted {len(imgs)} images to {img_dir}")
        for img in imgs:
            print(f"  {img['filename']}: {img['width']}x{img['height']}")
        return

    if args.tables:
        csv_dir = args.csv_dir or args.output or "./tables"
        tables = reader.extract_tables(csv_dir)
        print(f"Extracted {len(tables)} tables to {csv_dir}")
        return

    if args.full or True:
        out = args.output or "./output"
        result = reader.full_extraction(out)
        print(f"✅ Full extraction complete:")
        print(f"   Text: {result['text_chars']} chars")
        print(f"   Images: {len(result['images'])}")
        print(f"   Tables: {len(result['tables'])}")
        print(f"   Citations: {result['citations']['total_arxiv_citations']} arxiv IDs")
        print(f"   Analysis: {result['analysis_file']}")
        return


if __name__ == "__main__":
    main()
