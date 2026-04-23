import logging
import re
import uuid
from typing import List, Dict, Any, Optional

from app.models.domain_schema import Paper, PaperClaim, EvidenceSpan, Problem, Method
from app.services.kimi_client import KimiExtractor
from app.services.local_embedder import LocalEmbedder
from app.services.structured_pdf_extractor import StructuredPDFExtractor
from app.services.markitdown_extractor import MarkItDownExtractor
from app.agents.grounding_engine import GroundingEngine

logger = logging.getLogger(__name__)

class IngestionPipeline:
    """
    Research Graph Ingestion Pipeline
    Implements strict 4-stage extraction: Parse -> Paper-Local Extraction -> Canonical Alignment -> Graph/Vector Write
    """
    def __init__(self, graph_db=None, vector_db=None, llm_client=None):
        self.graph_db = graph_db
        self.vector_db = vector_db
        self.llm_extractor = KimiExtractor()
        self.embedder = LocalEmbedder()
        # Primary: MarkItDown (better tables, faster). Fallback: pdfplumber
        self.pdf_extractor = MarkItDownExtractor()
        self.grounding_engine = GroundingEngine(embedder=self.embedder, llm_client=llm_client)

    async def process_paper(self, pdf_path: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orchestrates the complete ingestion workflow.
        """
        logger.info(f"Starting ingestion for {pdf_path}")

        # Stage 1: Parse Document (structured extraction with pdfplumber)
        structured_doc = await self._parse_document(pdf_path)

        # Build rich text with section hints and table content
        text = self._build_extraction_text(structured_doc)

        # Stage 2: Paper-Local Extraction (Generate Evidence)
        local_claims = await self._extract_local_claims(text, meta, structured_doc)

        # Stage 3: Canonical Alignment (Graph Layer Mapping)
        aligned_nodes = await self._align_to_canonical(local_claims)

        # Stage 4: Write to Storage (Graph & Vector DB)
        await self._write_to_stores(aligned_nodes, local_claims, meta.get("paper_id", "unknown"))

        # Async trigger for innovation discovery
        await self._trigger_innovation_discovery(aligned_nodes)

        return {"status": "success", "claims_extracted": len(local_claims), "paper_id": meta.get("paper_id")}

    async def _parse_document(self, pdf_path: str):
        """Parse PDF using pdfplumber for structured extraction."""
        try:
            return self.pdf_extractor.extract(pdf_path)
        except Exception as e:
            logger.error(f"PDF Parse Error: {e}")
            # Return minimal fallback
            from app.services.structured_pdf_extractor import StructuredDocument, ExtractedPage
            return StructuredDocument(
                pages=[ExtractedPage(page_num=1, text="Failed to parse PDF.")],
                sections=[],
                full_text="Failed to parse PDF."
            )

    def _build_extraction_text(self, doc) -> str:
        """Build rich extraction text with section markers and table content."""
        parts = []

        # Add section-structured text if sections detected
        if doc.sections:
            for section in doc.sections:
                parts.append(f"\n=== {section.title} ===")
                parts.append(section.text)
                if section.tables:
                    for ti, table in enumerate(section.tables, 1):
                        parts.append(f"\n[TABLE {ti} in {section.title}]")
                        for row in table:
                            parts.append(" | ".join(str(c) for c in row))
                        parts.append("[END TABLE]")
        else:
            # Fallback to flat text
            parts.append(doc.full_text)

        # Append all tables at the end (some papers have key results in tables)
        table_texts = self.pdf_extractor.get_tables_as_text(doc)
        if table_texts:
            parts.append("\n\n=== ALL TABLES ===")
            for ti, tt in enumerate(table_texts, 1):
                parts.append(f"\n[TABLE {ti}]")
                parts.append(tt)

        return "\n".join(parts)

    async def _extract_local_claims(self, text: str, meta: Dict[str, Any],
                                     structured_doc=None) -> List[PaperClaim]:
        paper_id = meta.get("paper_id", f"paper_{uuid.uuid4().hex[:8]}")

        raw_claims = await self.llm_extractor.extract_claims_from_text(text)

        # Build snippet-to-page mapping from structured doc for better grounding
        page_map = {}
        if structured_doc and structured_doc.pages:
            for page in structured_doc.pages:
                page_map[page.page_num] = page.text

        def _find_page_for_snippet(snippet: str) -> Optional[int]:
            """Find which page a snippet likely came from."""
            if not page_map:
                return None
            clean_snippet = re.sub(r'[^\w\s]', '', snippet).lower()
            words = clean_snippet.split()[:5]
            if not words:
                return None
            for page_num, page_text in page_map.items():
                clean_page = re.sub(r'[^\w\s]', '', page_text).lower()
                if all(word in clean_page for word in words):
                    return page_num
            return None

        parsed_claims = []
        for rc in raw_claims:
            claim_id = f"claim_{uuid.uuid4().hex[:8]}"
            snippets = [ev.get("snippet", "") for ev in rc.get("evidence", [])]

            # === Three-Level Verification (GroundingEngine) ===
            verification = self.grounding_engine.verify_claim(
                claim_text=rc.get("text", ""),
                evidence_snippets=snippets,
                source_text=text,
                claim_id=claim_id
            )

            logger.info(
                f"[{paper_id}] Claim {claim_id}: L1={verification.level1_pass:.0f}({verification.level1_score:.2f}) "
                f"L2={verification.level2_pass:.0f}({verification.level2_score:.2f}) "
                f"L3={verification.level3_pass:.0f} -> {verification.final_status}"
            )

            evidence_spans = []
            for ev in rc.get("evidence", []):
                snippet = ev.get("snippet", "")
                page_num = _find_page_for_snippet(snippet)
                section_hint = ev.get("section", "Unknown")

                # Use section from structured doc if not provided by LLM
                if section_hint == "Unknown" and structured_doc:
                    clean_snippet_words = re.sub(r'[^\w\s]', '', snippet).lower().split()[:5]
                    for sec in structured_doc.sections:
                        clean_sec = re.sub(r'[^\w\s]', '', sec.text).lower()
                        if clean_snippet_words and all(w in clean_sec for w in clean_snippet_words):
                            section_hint = sec.title
                            break

                # Adjust confidence based on verification result
                base_confidence = ev.get("confidence", 1.0)
                adjusted_confidence = base_confidence * verification.final_confidence

                evidence_spans.append(EvidenceSpan(
                    paper_id=paper_id,
                    section=section_hint,
                    snippet=snippet,
                    confidence=round(adjusted_confidence, 3),
                    page_num=page_num
                ))

            # Attach verification metadata to the claim
            claim_metadata = rc.get("metadata", {})
            claim_metadata["verification"] = {
                "level1_score": verification.level1_score,
                "level2_score": verification.level2_score,
                "level3_reasoning": verification.level3_reasoning,
                "final_status": verification.final_status,
                "final_confidence": verification.final_confidence
            }

            if evidence_spans:
                parsed_claims.append(PaperClaim(
                    claim_id=claim_id,
                    claim_type=rc.get("claim_type", "unknown"),
                    text=rc.get("text", ""),
                    evidence=evidence_spans,
                    metadata=claim_metadata
                ))

        return parsed_claims

    async def _llm_arbiter(self, new_claim_text: str, candidate_node: Dict[str, Any], node_type: str) -> str:
        """
        [LLM Arbiter Gateway]
        Uses LLM to decide if a new claim should MERGE with an existing node or MINT a new one (as a sub-type).
        """
        prompt = f"""
        You are a top-tier AI scientific ontology manager.
        We have a new extracted {node_type} claim from a paper: "{new_claim_text}"
        
        The vector database suggests it might be similar to an existing {node_type} in our graph:
        Existing Name: "{candidate_node.get('name')}"
        Existing Description: "{candidate_node.get('description', candidate_node.get('definition', candidate_node.get('mechanism', '')))}"
        
        Please critically evaluate if the new claim is fundamentally describing the EXACT SAME {node_type} (just worded differently), or if it is a DISTINCT variant, sub-type, or entirely new concept.
        
        If it's the exact same core concept, reply with only the word: MERGE
        If it's a distinct concept or a specific sub-variant, reply with only the word: MINT
        """
        try:
            response = await self.llm_extractor.client.messages.create(
                model=self.llm_extractor.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0.0
            )
            decision = response.content[0].text.strip().upper()
            if "MERGE" in decision:
                return "MERGE"
            return "MINT"
        except Exception as e:
            logger.error(f"LLM Arbiter failed: {e}. Defaulting to MINT.")
            return "MINT"

    async def _align_to_canonical(self, claims: List[PaperClaim]) -> Dict[str, Any]:
        """
        Uses LocalEmbedder, VectorDB, and LLM Arbiter to align new claims.
        """
        problems = []
        methods = []
        
        for c in claims:
            vector = self.embedder.embed_text(c.text)
            
            if c.claim_type == "problem_statement":
                canonical_id = None
                parent_id = None
                if self.vector_db:
                    similar_probs = self.vector_db.search_similar_problems(vector, top_k=1)
                    if similar_probs:
                        score = similar_probs[0]['score']
                        cand_id = similar_probs[0]['id']
                        if score > 0.90:
                            canonical_id = cand_id
                            logger.info(f"AUTO-MERGE: Problem '{c.text[:30]}' aligns with {cand_id} (Score: {score:.2f})")
                        elif 0.60 < score <= 0.90:
                            cand_node = self.graph_db.get_problem(cand_id) if self.graph_db else None
                            if cand_node is None:
                                cand_node = {} # Fallback to avoid NoneType error
                            decision = await self._llm_arbiter(c.text, cand_node, "Problem")
                            if decision == "MERGE":
                                canonical_id = cand_id
                                logger.info(f"LLM-MERGE: Problem '{c.text[:30]}' -> {cand_id}")
                            else:
                                parent_id = cand_id # MINT, but link as sub-problem
                                logger.info(f"LLM-MINT: Problem '{c.text[:30]}' -> New (Sub-problem of {cand_id})")
                
                if not canonical_id:
                    canonical_id = f"prob_{uuid.uuid4().hex[:8]}"
                    prob_domain = c.metadata.get("domain", "General")
                    if self.vector_db:
                        self.vector_db.upsert_problem_vector(
                            canonical_id, vector, {"name": c.text[:40] + "...", "domain": prob_domain}
                        )

                prob_obj = Problem(
                    canonical_id=canonical_id,
                    name=c.text[:40] + "...",
                    domain=c.metadata.get("domain", "General"),
                    definition=c.text,
                    resolution_status="unsolved",
                    year_identified=c.metadata.get("year_identified"),
                    constraints=c.metadata.get("constraints", "Hardware/Physics/Math constraints not explicitly defined."),
                    evaluation_metrics=c.metadata.get("evaluation_metrics", "No specific metrics identified."),
                    keywords=c.metadata.get("keywords", []),
                    performance_metrics=c.metadata.get("performance_metrics"),
                    benchmark_datasets=c.metadata.get("benchmark_datasets", []),
                )
                # Attach temporary parent mapping
                setattr(prob_obj, "_parent_id", parent_id)
                problems.append(prob_obj)
                
            elif c.claim_type == "method_mechanism":
                canonical_id = None
                parent_id = None
                if self.vector_db:
                    similar_meths = self.vector_db.search_similar_methods(vector, top_k=1)
                    if similar_meths:
                        score = similar_meths[0]['score']
                        cand_id = similar_meths[0]['id']
                        if score > 0.90:
                            canonical_id = cand_id
                            logger.info(f"AUTO-MERGE: Method '{c.text[:30]}' aligns with {cand_id} (Score: {score:.2f})")
                        elif 0.60 < score <= 0.90:
                            cand_node = self.graph_db.get_method(cand_id) if self.graph_db else None
                            if cand_node is None:
                                cand_node = {} # Fallback
                            decision = await self._llm_arbiter(c.text, cand_node, "Method")
                            if decision == "MERGE":
                                canonical_id = cand_id
                                logger.info(f"LLM-MERGE: Method '{c.text[:30]}' -> {cand_id}")
                            else:
                                parent_id = cand_id # MINT, but link as sub-type
                                logger.info(f"LLM-MINT: Method '{c.text[:30]}' -> New (Sub-type of {cand_id})")
                
                if not canonical_id:
                    canonical_id = f"meth_{uuid.uuid4().hex[:8]}"
                    meth_domain = c.metadata.get("domain", "General")
                    if self.vector_db:
                        self.vector_db.upsert_method_vector(
                            canonical_id, vector, {"name": c.text[:40] + "...", "domain": meth_domain}
                        )

                meth_obj = Method(
                    canonical_id=canonical_id,
                    name=c.text[:40] + "...",
                    domain=c.metadata.get("domain", "General"),
                    mechanism=c.text,
                    complexity="Unknown",
                    assumptions=c.metadata.get("assumptions", "Pre-conditions and assumptions not explicitly defined."),
                    limitations=c.metadata.get("limitations", "Known blind spots not explicitly defined."),
                    keywords=c.metadata.get("keywords", []),
                    input_output_spec=c.metadata.get("input_output_spec"),
                    hyperparameters=c.metadata.get("hyperparameters"),
                    application_domains=c.metadata.get("application_domains", []),
                    performance_metrics=c.metadata.get("performance_metrics"),
                )
                setattr(meth_obj, "_parent_id", parent_id)
                methods.append(meth_obj)
            
            c.canonical_id = canonical_id
        
        unique_problems = {p.canonical_id: p for p in problems}.values()
        unique_methods = {m.canonical_id: m for m in methods}.values()
        
        return {"problems": list(unique_problems), "methods": list(unique_methods)}

    async def _write_to_stores(self, canonical_nodes: Dict[str, Any], claims: List[PaperClaim], paper_id: str):
        logger.info(f"Writing {len(canonical_nodes['problems'])} Problems, {len(canonical_nodes['methods'])} Methods to Graph DB.")
        logger.info(f"Writing {len(claims)} PaperClaims to DB.")
        
        if not self.graph_db:
            logger.warning("Graph DB not initialized, skipping Graph Write.")
            return

        # Write Canonical Problems
        for prob in canonical_nodes.get("problems", []):
            self.graph_db.create_problem({
                "id": prob.canonical_id,
                "name": prob.name,
                "definition": prob.definition,
                "domain": prob.domain,
                "resolution_status": prob.resolution_status,
                "year": getattr(prob, 'year_identified', None),
                "constraints": prob.constraints,
                "evaluation_metrics": prob.evaluation_metrics,
                "description": f"An automatically extracted problem from the literature: {prob.name}. It generally involves {prob.definition}.",
                "development_progress": f"Currently identified as {prob.resolution_status}. Further research is needed to determine the full evolutionary timeline.",
                "keywords": getattr(prob, 'keywords', []),
                "performance_metrics": getattr(prob, 'performance_metrics', None),
                "benchmark_datasets": getattr(prob, 'benchmark_datasets', []),
                "related_problems": getattr(prob, 'related_problems', []),
            })
            if hasattr(prob, "_parent_id") and prob._parent_id:
                self.graph_db.create_sub_problem_relationship(prob.canonical_id, prob._parent_id)

        # Write Canonical Methods
        for meth in canonical_nodes.get("methods", []):
            self.graph_db.create_method({
                "id": meth.canonical_id,
                "name": meth.name,
                "mechanism": meth.mechanism,
                "domain": meth.domain,
                "complexity": meth.complexity,
                "year": getattr(meth, 'year', None),
                "assumptions": meth.assumptions,
                "limitations": meth.limitations,
                "description": f"An automatically extracted method: {meth.name}. Its primary mechanism is {meth.mechanism}. Its implementation complexity is {meth.complexity}.",
                "keywords": getattr(meth, 'keywords', []),
                "input_output_spec": getattr(meth, 'input_output_spec', None),
                "hyperparameters": getattr(meth, 'hyperparameters', None),
                "application_domains": getattr(meth, 'application_domains', []),
                "performance_metrics": getattr(meth, 'performance_metrics', None),
            })
            if hasattr(meth, "_parent_id") and meth._parent_id:
                self.graph_db.create_sub_type_of_relationship(meth.canonical_id, meth._parent_id)

        # Link Methods to Problems (Simulating ADDRESSES_PROBLEM relations)
        # Assuming for this paper, all extracted methods address all extracted problems
        for prob in canonical_nodes.get("problems", []):
            for meth in canonical_nodes.get("methods", []):
                self.graph_db.create_relation(
                    source_id=meth.canonical_id,
                    target_id=prob.canonical_id,
                    relation_type="ADDRESSES_PROBLEM",
                    properties={"paper_id": paper_id}
                )

        # Write Claims
        for claim in claims:
            self.graph_db.create_claim({
                "id": claim.claim_id,
                "paper_id": paper_id,
                "canonical_id": claim.canonical_id,
                "type": claim.claim_type,
                "text": claim.text,
                "evidence": [ev.model_dump() for ev in claim.evidence]
            })

    async def _trigger_innovation_discovery(self, aligned_nodes: Dict[str, Any]):
        """
        [Innovation Engine]
        Computes Structural Gaps and Cross-Domain Transfer opportunities based on vector similarity.
        """
        logger.info("Triggering Innovation Discovery Engine...")
        
        problems = aligned_nodes.get("problems", [])
        if not problems or not self.vector_db or not self.graph_db:
            return
            
        for prob in problems:
            # 1. Get problem vector
            prob_vector = self.vector_db.get_problem_vector(prob.canonical_id)
            if not prob_vector:
                continue
                
            # 2. Search for methods that are semantically similar to this problem's requirements
            # We look for methods that might not be formally linked yet in the graph
            candidate_meths = self.vector_db.search_similar_methods(prob_vector, top_k=5)
            
            for candidate in candidate_meths:
                meth_id = candidate['id']
                score = candidate['score']
                
                # Check if they are already linked in the graph
                if self.graph_db.graph.has_edge(meth_id, prob.canonical_id):
                    continue # Already a known solution path
                    
                # The sweet spot for cross-domain innovation is semantic relevance but not exact match
                if 0.45 < score < 0.95:
                    meth_data = self.graph_db.get_method(meth_id)
                    if not meth_data:
                        continue
                        
                    opportunity_id = f"opp_{uuid.uuid4().hex[:8]}"
                    rationale = (
                        f"Cross-Domain Transfer Opportunity: '{meth_data.get('name')}' shows {score*100:.1f}% "
                        f"underlying mechanism similarity to the requirements of unsolved problem '{prob.name}'. "
                        f"This connection has not been formally explored in current literature."
                    )
                    
                    logger.info(f"💡 [INNOVATION] {opportunity_id}: Apply [{meth_data.get('name')}] to [{prob.name}]")
                    
                    self.graph_db.create_innovation({
                        "id": opportunity_id,
                        "target_problem_id": prob.canonical_id,
                        "candidate_method_ids": [meth_id],
                        "rationale": rationale,
                        "supporting_evidence_ids": [], 
                        "risks": ["Requires domain adaptation", "May face unmodeled constraints"],
                        "feasibility_score": score,
                        "novelty_score": 1.0 - score  # Inverse relation: lower direct similarity = higher novelty
                    })
                    break # Just create the top 1 opportunity per problem for now
