"""
Three-Level Claim Verification (GroundingEngine)

Level 1: Fuzzy N-gram Match — snippet exists in source text
Level 2: Embedding Semantic Match — embed(snippet) vs embed(source_section)
Level 3: LLM-as-Judge — independent evaluation for low-confidence claims
"""
import logging
import re
import difflib
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass

from app.agents.base import BaseAgent, AgentContext, AgentOutput
from app.services.local_embedder import LocalEmbedder

logger = logging.getLogger(__name__)


@dataclass
class VerificationResult:
    claim_id: str
    level1_pass: bool
    level2_pass: bool
    level3_pass: bool
    level1_score: float
    level2_score: float
    level3_reasoning: str = ""
    final_status: str = "verified"  # verified / flagged / rejected
    final_confidence: float = 1.0


class GroundingEngine:
    """
    Three-level verification tower for claim evidence grounding.
    """

    def __init__(self, embedder: LocalEmbedder = None, llm_client=None):
        self.embedder = embedder or LocalEmbedder()
        self.llm_client = llm_client
        self.level2_threshold = 0.85
        self.level1_threshold = 0.65

    def verify_claim(self, claim_text: str, evidence_snippets: List[str],
                     source_text: str, claim_id: str = "") -> VerificationResult:
        """
        Run full three-level verification on a claim.
        """
        # Level 1: Fuzzy N-gram Match
        level1_score, level1_pass = self._level1_fuzzy_match(evidence_snippets, source_text)

        # Level 2: Embedding Semantic Match
        level2_score, level2_pass = self._level2_embedding_match(evidence_snippets, source_text)

        # Level 3: LLM-as-Judge (only if L1 or L2 failed and we have LLM)
        level3_pass = True
        level3_reasoning = "Not triggered (L1+L2 passed)"

        if (not level1_pass or not level2_pass) and self.llm_client:
            level3_pass, level3_reasoning = self._level3_llm_judge(claim_text, evidence_snippets, source_text)

        # Determine final status
        if level1_pass and level2_pass:
            final_status = "verified"
            final_confidence = min(1.0, (level1_score + level2_score) / 2)
        elif level1_pass or level2_pass:
            final_status = "flagged"
            final_confidence = 0.6
        elif level3_pass:
            final_status = "flagged"
            final_confidence = 0.5
        else:
            final_status = "rejected"
            final_confidence = 0.2

        return VerificationResult(
            claim_id=claim_id,
            level1_pass=level1_pass,
            level2_pass=level2_pass,
            level3_pass=level3_pass,
            level1_score=level1_score,
            level2_score=level2_score,
            level3_reasoning=level3_reasoning,
            final_status=final_status,
            final_confidence=final_confidence
        )

    def _level1_fuzzy_match(self, snippets: List[str], source_text: str) -> Tuple[float, bool]:
        """
        Level 1: Fuzzy N-gram matching using difflib.SequenceMatcher.
        Returns (best_score, passed).
        """
        if not snippets:
            return 0.0, False

        best_score = 0.0
        clean_source = re.sub(r'\s+', ' ', source_text).lower()

        for snippet in snippets:
            clean_snippet = re.sub(r'\s+', ' ', snippet).lower()
            if not clean_snippet:
                continue

            # Try exact substring first
            if clean_snippet in clean_source:
                best_score = max(best_score, 1.0)
                continue

            # SequenceMatcher for fuzzy match
            matcher = difflib.SequenceMatcher(None, clean_snippet, clean_source)
            # Find best matching block
            match = matcher.find_longest_match(0, len(clean_snippet), 0, len(clean_source))
            if match.size > 0:
                # Score = matched_length / snippet_length
                score = match.size / len(clean_snippet)
                best_score = max(best_score, score)

        passed = best_score >= self.level1_threshold
        return best_score, passed

    def _level2_embedding_match(self, snippets: List[str], source_text: str) -> Tuple[float, bool]:
        """
        Level 2: Embedding semantic similarity.
        Embed each snippet and compare against embedding of source text sections.
        """
        if not snippets or not self.embedder:
            return 0.0, False

        try:
            # Split source into overlapping windows for section-level matching
            source_windows = self._chunk_text(source_text, window_size=500, overlap=200)
            if not source_windows:
                return 0.0, False

            # Embed all source windows
            source_embeddings = [self.embedder.embed_text(w) for w in source_windows]

            best_score = 0.0
            for snippet in snippets:
                if not snippet.strip():
                    continue
                snippet_vec = self.embedder.embed_text(snippet)

                # Find best matching source window
                for src_vec in source_embeddings:
                    sim = self._cosine_similarity(snippet_vec, src_vec)
                    best_score = max(best_score, sim)

            passed = best_score >= self.level2_threshold
            return best_score, passed

        except Exception as e:
            logger.warning(f"Level 2 embedding match failed: {e}")
            return 0.0, False

    def _level3_llm_judge(self, claim_text: str, snippets: List[str],
                          source_text: str) -> Tuple[bool, str]:
        """
        Level 3: LLM-as-Judge.
        Only called for claims that failed L1 or L2.
        """
        if not self.llm_client:
            return False, "No LLM client available"

        snippet_text = "\n\n".join(f"- {s}" for s in snippets[:3])
        # Truncate source text to stay within token limits
        truncated_source = source_text[:4000] + "..." if len(source_text) > 4000 else source_text

        prompt = f"""You are a rigorous fact-checking system. Your job is to verify if a claim is supported by evidence snippets from a source text.

CLAIM: "{claim_text}"

EVIDENCE SNIPPETS:
{snippet_text}

SOURCE TEXT (truncated):
{truncated_source}

Evaluate: Is the claim SUPPORTED by the evidence snippets and source text, CONTRADICTED by them, or NOT_MENTIONED in them?

Rules:
- SUPPORTED: The claim's core assertion is directly confirmed by the text.
- CONTRADICTED: The text directly contradicts the claim.
- NOT_MENTIONED: The text doesn't address the claim's specific assertion.

Reply with ONLY one word: SUPPORTED, CONTRADICTED, or NOT_MENTIONED. Then on the next line, give a one-sentence reason."""

        try:
            import asyncio
            response = asyncio.run(self._call_llm_async(prompt))
            text = response.strip().upper()

            if "SUPPORTED" in text:
                return True, f"LLM judged SUPPORTED: {response.strip()}"
            elif "CONTRADICTED" in text:
                return False, f"LLM judged CONTRADICTED: {response.strip()}"
            else:
                return False, f"LLM judged NOT_MENTIONED: {response.strip()}"

        except Exception as e:
            logger.warning(f"Level 3 LLM judge failed: {e}")
            return False, f"LLM judge error: {e}"

    async def _call_llm_async(self, prompt: str) -> str:
        """Call LLM asynchronously."""
        response = await self.llm_client.messages.create(
            model=getattr(self.llm_client, 'model', 'kimi-for-coding'),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=256
        )
        return response.content[0].text

    @staticmethod
    def _chunk_text(text: str, window_size: int = 500, overlap: int = 200) -> List[str]:
        """Split text into overlapping windows for embedding comparison."""
        words = text.split()
        if len(words) <= window_size:
            return [text]
        windows = []
        step = window_size - overlap
        for i in range(0, len(words), step):
            window = " ".join(words[i:i + window_size])
            windows.append(window)
            if i + window_size >= len(words):
                break
        return windows

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        import math
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def batch_verify(self, claims: List[Dict[str, Any]], source_text: str) -> List[VerificationResult]:
        """Verify a batch of claims against a single source text."""
        results = []
        for claim in claims:
            snippets = [ev.get("snippet", "") for ev in claim.get("evidence", [])]
            result = self.verify_claim(
                claim_text=claim.get("text", ""),
                evidence_snippets=snippets,
                source_text=source_text,
                claim_id=claim.get("claim_id", "")
            )
            results.append(result)
        return results
