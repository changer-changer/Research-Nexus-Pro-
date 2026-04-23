"""
SmartChunker — paragraph-aware text chunking without tiktoken.
Splits by paragraph boundaries, merges small chunks, splits oversized ones.
"""
import re
from typing import List, Dict, Any


class TextChunk:
    """A single chunk with metadata."""

    def __init__(self, text: str, index: int, page_hint: int = -1, section_hint: str = ""):
        self.text = text.strip()
        self.index = index
        self.page_hint = page_hint
        self.section_hint = section_hint
        self.char_count = len(text)
        self.embedding: List[float] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "index": self.index,
            "page_hint": self.page_hint,
            "section_hint": self.section_hint,
            "char_count": self.char_count,
        }


class SmartChunker:
    """
    Zero-tiktoken chunker.

    Strategy:
      1. Split by double-newlines (paragraph boundaries).
      2. Merge consecutive tiny paragraphs (< min_size).
      3. Split oversized paragraphs at sentence boundaries.
    """

    def __init__(
        self,
        target_size: int = 800,
        min_size: int = 200,
        max_size: int = 1500,
        overlap: int = 100,
    ):
        self.target_size = target_size
        self.min_size = min_size
        self.max_size = max_size
        self.overlap = overlap

    def chunk(self, text: str) -> List[TextChunk]:
        """Chunk raw text into semantic paragraphs."""
        # Normalize whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        chunks: List[TextChunk] = []
        buffer = ""
        buf_start_idx = 0

        for i, para in enumerate(paragraphs):
            # Detect section headers (heuristic: short, all caps, or ends with colon)
            section_hint = ""
            if len(para) < 80 and (para.isupper() or para.endswith(":") or para.startswith("Abstract") or para.startswith("Introduction") or para.startswith("Conclusion") or para.startswith("Method") or para.startswith("Results")):
                section_hint = para.split("\n")[0][:60]

            if len(buffer) + len(para) + 2 <= self.target_size:
                buffer += ("\n\n" + para if buffer else para)
            else:
                # Flush buffer
                if buffer:
                    chunks.append(TextChunk(buffer, len(chunks), section_hint=section_hint))
                    buffer = ""

                # If single para is still too big, split it
                if len(para) > self.max_size:
                    sub_chunks = self._split_large_paragraph(para)
                    for sc in sub_chunks:
                        chunks.append(TextChunk(sc, len(chunks), section_hint=section_hint))
                else:
                    buffer = para

        if buffer:
            chunks.append(TextChunk(buffer, len(chunks)))

        # Second pass: merge tiny trailing chunks into previous
        merged: List[TextChunk] = []
        for c in chunks:
            if merged and c.char_count < self.min_size and merged[-1].char_count + c.char_count + 2 <= self.max_size:
                merged[-1].text += "\n\n" + c.text
                merged[-1].char_count = len(merged[-1].text)
            else:
                merged.append(c)

        # Re-index
        for i, c in enumerate(merged):
            c.index = i

        return merged

    def _split_large_paragraph(self, para: str) -> List[str]:
        """Split a large paragraph at sentence boundaries."""
        # Simple sentence split: period + space + uppercase
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", para)
        results: List[str] = []
        buffer = ""

        for sent in sentences:
            if len(buffer) + len(sent) + 1 <= self.target_size:
                buffer += (" " + sent if buffer else sent)
            else:
                if buffer:
                    results.append(buffer)
                buffer = sent

        if buffer:
            results.append(buffer)

        # If still too big, brute force split
        final: List[str] = []
        for r in results:
            if len(r) > self.max_size:
                for i in range(0, len(r), self.target_size - self.overlap):
                    final.append(r[i:i + self.target_size])
            else:
                final.append(r)

        return final
