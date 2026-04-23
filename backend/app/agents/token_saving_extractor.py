"""
TokenSavingExtractor — extracts claims by embedding ALL chunks locally,
then sending only the top-K most relevant chunks to the LLM.

Token savings: ~80-90% vs sending full paper text.
"""
import json
import logging
import asyncio
from typing import List, Dict, Any
from app.agents.base import BaseAgent, AgentContext, AgentOutput
from app.services.smart_chunker import SmartChunker
from app.services.local_embedder import LocalEmbedder
from app.database.local_vector import get_local_vector_db

logger = logging.getLogger(__name__)


class TokenSavingExtractor(BaseAgent):
    """
    Two-phase extraction:
      Phase 1 (LOCAL): Chunk text → embed all chunks → store in vector DB.
      Phase 2 (LLM):   Embed query → similarity search → top-K chunks → LLM extraction.
    """

    name = "TokenSavingExtractor"
    system_prompt = """You are an expert research knowledge extraction system specialized in robotics, tactile sensing, embodied AI, and multimodal machine learning.
Your task is to analyze the provided paper excerpts and extract core scientific claims.

You are given ONLY the most relevant excerpts from the paper (pre-filtered by semantic similarity).
Extract claims based ONLY on the provided text. Do not hallucinate.

Extract ONLY these claim types:
- problem_statement: The core problem the paper addresses. Pay special attention to problems in robot manipulation, tactile perception, visual-language-action (VLA) models, diffusion policy, multimodal fusion, agent coordination, and sim-to-real transfer.
- method_mechanism: The proposed method and its core mechanism. Focus on the mathematical/algorithmic foundation, not the application domain.
- experiment_result: Key experimental results with concrete metrics and numbers.
- limitation: Acknowledged limitations or failure modes.
- future_work: Suggested future research directions.

IMPORTANT BALANCE: Aim to extract at least 1-2 problem_statement claims and 1-2 method_mechanism claims per paper, in addition to experiment results. Do not only extract experiment_result claims.

For every claim, provide the exact source evidence snippet from the text.

CRITICAL: If claim_type is "problem_statement", also extract:
  - constraints (physical/mathematical/hardware constraints)
  - evaluation_metrics (how success is measured)

If claim_type is "method_mechanism", also extract:
  - assumptions (pre-conditions required)
  - limitations (known blind spots)

Output ONLY raw JSON with a "claims" array. No markdown, no explanations outside JSON."""

    def __init__(self, llm_client=None, chunker: SmartChunker = None,
                 embedder: LocalEmbedder = None, top_k_chunks: int = 5,
                 vector_collection: str = "paper_chunks"):
        super().__init__(llm_client=llm_client)
        self.chunker = chunker or SmartChunker(target_size=800, min_size=200, max_size=1500)
        self.embedder = embedder or LocalEmbedder()
        self.top_k = top_k_chunks
        self.vector_collection = vector_collection
        self.vector_db = get_local_vector_db()

    async def run(self, context: AgentContext) -> AgentOutput:
        """
        context.extra must contain:
          - 'paper_id': str
          - 'text': str (full paper text)
          - 'query': str (optional, defaults to claim extraction query)
        """
        paper_id = context.extra.get('paper_id', 'unknown')
        text = context.extra.get('text', '')
        query = context.extra.get('query', 'extract scientific claims problem statement method mechanism experiment results limitations future work')

        if not text or len(text) < 100:
            return AgentOutput(agent_name=self.name, stage="extraction",
                               content="Text too short", structured_data={"claims": []}, confidence=0.0)

        # Phase 1: Local chunk + embed + store
        logger.info(f"[{paper_id}] Phase 1: chunking + embedding locally...")
        chunks = self.chunker.chunk(text)
        logger.info(f"[{paper_id}] -> {len(chunks)} chunks")

        # Embed all chunks and store
        chunk_texts = [c.text for c in chunks]
        embeddings = self.embedder.embed_texts(chunk_texts)

        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"{paper_id}_chunk_{i}"
            self.vector_db.upsert(
                collection=self.vector_collection,
                item_id=chunk_id,
                vector=emb,
                payload={
                    "paper_id": paper_id,
                    "index": i,
                    "text": chunk.text,
                    "char_count": chunk.char_count,
                    "section_hint": chunk.section_hint,
                }
            )
            chunk.embedding = emb

        # Phase 2: Vector pre-filter → top-K chunks
        logger.info(f"[{paper_id}] Phase 2: vector search for top-{self.top_k} chunks...")
        query_vec = self.embedder.embed_text(query)
        results = self.vector_db.search(
            collection=self.vector_collection,
            query_vector=query_vec,
            top_k=self.top_k,
            filter_fn=lambda p: p.get('paper_id') == paper_id
        )

        top_chunks_text = "\n\n---\n\n".join([
            f"[Excerpt {r['payload'].get('index', '?')}]\n{r['payload'].get('text', '')}"
            for r in results
        ])

        input_chars = len(text)
        selected_chars = len(top_chunks_text)
        savings_pct = (1 - selected_chars / input_chars) * 100 if input_chars > 0 else 0
        logger.info(f"[{paper_id}] Token savings: {input_chars} → {selected_chars} chars ({savings_pct:.1f}% reduction)")

        # Phase 3: LLM extraction on filtered content
        logger.info(f"[{paper_id}] Phase 3: LLM extraction on {len(results)} chunks...")
        claims = await self._extract_from_chunks(top_chunks_text, paper_id)

        return AgentOutput(
            agent_name=self.name,
            stage="extraction",
            content=f"Extracted {len(claims)} claims from {len(results)} top chunks ({savings_pct:.1f}% token savings)",
            structured_data={
                "claims": claims,
                "token_savings": {
                    "original_chars": input_chars,
                    "selected_chars": selected_chars,
                    "savings_percent": round(savings_pct, 1),
                    "chunks_total": len(chunks),
                    "chunks_sent_to_llm": len(results),
                }
            },
            confidence=0.85 if claims else 0.3
        )

    async def _extract_from_chunks(self, chunks_text: str, paper_id: str) -> List[Dict[str, Any]]:
        """Call LLM with only the top-K chunks. Retry on JSON parse failure."""
        prompt = f"""Analyze the following paper excerpts and extract all scientific claims.

EXCERPTS:
{chunks_text}

You MUST return valid JSON. No markdown code blocks. No text before or after the JSON.

Return exactly this JSON structure:
{{
  "claims": [
    {{
      "claim_type": "problem_statement|method_mechanism|experiment_result|limitation|future_work",
      "text": "concise claim statement",
      "metadata": {{"constraints": "...", "evaluation_metrics": "..." OR "assumptions": "...", "limitations": "..."}},
      "evidence": [{{"section": "...", "snippet": "exact quote", "confidence": 0.95}}]
    }}
  ]
}}"""

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                temperature = 0.1 if attempt == 0 else 0.0
                response = await self._call_llm(prompt, temperature=temperature, max_tokens=4096)
                parsed = self._extract_json(response)
                claims = parsed.get('claims', [])

                for c in claims:
                    c['paper_id'] = paper_id

                return claims
            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Extraction attempt {attempt + 1} failed for {paper_id}: {e}. Retrying...")
                    await asyncio.sleep(1)
                else:
                    logger.error(f"LLM extraction failed after {max_retries + 1} attempts for {paper_id}: {e}")
                    return []
