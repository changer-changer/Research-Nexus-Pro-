"""
Agent Orchestrator - manages the AI Scientist Society workflow.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

from app.agents.base import AgentContext, AgentOutput
from app.agents.extractor import ExtractorAgent
from app.agents.token_saving_extractor import TokenSavingExtractor
from app.agents.hypothesizer import HypothesizerAgent
from app.agents.critic import CriticAgent
from app.agents.experimentalist import ExperimentalistAgent
from app.agents.reviewer import ReviewerAgent


class AgentOrchestrator:
    """
    Orchestrates multi-agent workflows for the AI Scientist Society.

    Workflows:
    A. Extraction: Extractor -> (loop if Ontologist rejects)
    B. Innovation: Hypothesizer -> Critic (loop) -> Experimentalist -> Reviewer
    """

    def __init__(self, llm_client=None, graph_db=None):
        self.llm_client = llm_client
        self.graph_db = graph_db
        self.agents = {
            'extractor': ExtractorAgent(llm_client),
            'hypothesizer': HypothesizerAgent(llm_client),
            'critic': CriticAgent(llm_client),
            'experimentalist': ExperimentalistAgent(llm_client),
            'reviewer': ReviewerAgent(llm_client),
        }
        self.logger = logging.getLogger("agent.orchestrator")

    async def run_extraction_pipeline(self, paper_id: str,
                                      structured_sections: Dict[str, str]) -> Dict[str, Any]:
        """
        Workflow A: Extract claims from a parsed paper.
        Returns extracted claims grouped by section.
        """
        session_id = f"ext_{uuid.uuid4().hex[:8]}"
        context = AgentContext(
            session_id=session_id,
            paper_id=paper_id,
            extra={"structured_sections": structured_sections}
        )

        self.logger.info(f"[Session {session_id}] Starting extraction pipeline for {paper_id}")

        extractor = self.agents['extractor']
        output = await extractor.run(context)

        claims = output.structured_data.get('claims', [])
        self.logger.info(f"[Session {session_id}] Extracted {len(claims)} claims")

        # Store session record
        if self.graph_db:
            self.graph_db.create_agent_session({
                'id': session_id,
                'session_type': 'extraction',
                'trigger_node_id': paper_id,
                'participants': ['Extractor'],
                'conclusion': f"Extracted {len(claims)} claims",
                'reasoning_chain': [{'agent': 'Extractor', 'output': output.content}]
            })

        return {
            'session_id': session_id,
            'claims': claims,
            'claim_count': len(claims)
        }

    async def run_token_saving_extraction_pipeline(self, paper_id: str,
                                                    full_text: str,
                                                    query: str = "extract scientific claims",
                                                    top_k_chunks: int = 5) -> Dict[str, Any]:
        """
        Workflow A-v2: Extract claims using local embedding pre-filtering.
        Saves ~85-90% LLM tokens vs sending full paper text.

        Pipeline:
          1. SmartChunker splits text into semantic paragraphs
          2. fastembed embeds all chunks locally
          3. Vector similarity ranks chunks by relevance to query
          4. Only top-K chunks are sent to LLM for extraction
        """
        session_id = f"ext_ts_{uuid.uuid4().hex[:8]}"
        context = AgentContext(
            session_id=session_id,
            paper_id=paper_id,
            extra={
                'paper_id': paper_id,
                'text': full_text,
                'query': query,
            }
        )

        self.logger.info(f"[{session_id}] Token-saving extraction for {paper_id} (top_k={top_k_chunks})")

        extractor = TokenSavingExtractor(
            llm_client=self.llm_client,
            top_k_chunks=top_k_chunks
        )
        output = await extractor.run(context)

        claims = output.structured_data.get('claims', [])
        savings = output.structured_data.get('token_savings', {})
        self.logger.info(
            f"[{session_id}] Extracted {len(claims)} claims | "
            f"Token savings: {savings.get('savings_percent', 0)}% "
            f"({savings.get('original_chars', 0)} -> {savings.get('selected_chars', 0)} chars)"
        )

        if self.graph_db:
            self.graph_db.create_agent_session({
                'id': session_id,
                'session_type': 'extraction',
                'trigger_node_id': paper_id,
                'participants': ['TokenSavingExtractor'],
                'conclusion': f"Extracted {len(claims)} claims with {savings.get('savings_percent', 0)}% token savings",
                'reasoning_chain': [{
                    'agent': 'TokenSavingExtractor',
                    'output': output.content,
                    'token_savings': savings
                }]
            })

        return {
            'session_id': session_id,
            'claims': claims,
            'claim_count': len(claims),
            'token_savings': savings
        }

    async def run_innovation_pipeline(self, opportunity: Dict[str, Any],
                                      max_critique_rounds: int = 2) -> Dict[str, Any]:
        """
        Workflow B: Multi-agent debate to generate an Innovation Insight.

        Flow:
        1. Hypothesizer generates initial hypothesis
        2. Critic evaluates and provides feedback
        3. Hypothesizer revises based on critique (loop up to max_critique_rounds)
        4. Experimentalist designs validation experiment
        5. Reviewer synthesizes final insight

        Returns the final insight with full debate log.
        """
        session_id = f"inn_{uuid.uuid4().hex[:8]}"
        context = AgentContext(
            session_id=session_id,
            extra={"opportunity": opportunity}
        )

        self.logger.info(f"[Session {session_id}] Starting innovation pipeline")

        debate_log = []

        # Phase 1: Hypothesizer
        hypothesizer = self.agents['hypothesizer']
        hyp_output = await hypothesizer.run(context)
        hypothesis = hyp_output.structured_data
        debate_log.append({
            'round': 1,
            'agent': 'Hypothesizer',
            'stage': 'hypothesis',
            'content': hyp_output.content,
            'structured': hypothesis
        })

        await asyncio.sleep(1)

        # Phase 2: Critic loop
        critic = self.agents['critic']
        for round_num in range(max_critique_rounds):
            context.extra['current_hypothesis'] = hypothesis
            crit_output = await critic.run(context)
            critique = crit_output.structured_data

            debate_log.append({
                'round': round_num + 1,
                'agent': 'Critic',
                'stage': 'critique',
                'content': crit_output.content,
                'structured': critique,
                'severity': critique.get('severity', 'low')
            })

            # If critique severity is low, break early
            if critique.get('severity', 'high') == 'low':
                self.logger.info(f"[Session {session_id}] Critic satisfied at round {round_num + 1}")
                break

            await asyncio.sleep(1)

            # Hypothesizer revises
            context.extra['critique'] = critique
            rev_output = await hypothesizer.revise(context)
            hypothesis = rev_output.structured_data
            debate_log.append({
                'round': round_num + 1,
                'agent': 'Hypothesizer',
                'stage': 'revision',
                'content': rev_output.content,
                'structured': hypothesis
            })

        await asyncio.sleep(1)

        # Phase 3: Experimentalist designs validation experiment
        context.extra['final_hypothesis'] = hypothesis
        experimentalist = self.agents['experimentalist']
        exp_output = await experimentalist.run(context)
        experiment_design = exp_output.structured_data

        debate_log.append({
            'round': len(debate_log) + 1,
            'agent': 'Experimentalist',
            'stage': 'experiment_design',
            'content': exp_output.content,
            'structured': experiment_design
        })

        await asyncio.sleep(1)

        # Phase 4: Reviewer synthesizes
        context.extra['experiment_design'] = experiment_design
        context.extra['debate_log'] = debate_log
        reviewer = self.agents['reviewer']
        rev_output = await reviewer.run(context)
        final_insight = rev_output.structured_data

        debate_log.append({
            'round': len(debate_log) + 1,
            'agent': 'Reviewer',
            'stage': 'synthesis',
            'content': rev_output.content,
            'structured': final_insight
        })

        self.logger.info(f"[Session {session_id}] Innovation pipeline complete. Score: {final_insight.get('composite_score', 0)}")

        # Store insight and session
        if self.graph_db:
            insight_id = self.graph_db.create_insight({
                'id': f"insight_{session_id}",
                'type': opportunity.get('innovation_type', 'cdt'),
                'title': final_insight.get('paper_title', 'Untitled Insight'),
                'rationale': final_insight.get('rationale', ''),
                'hypothesis': final_insight.get('hypothesis', ''),
                'experiment_design': json.dumps(final_insight.get('experiment_design', {})),
                'confidence': final_insight.get('confidence', 0.5),
                'composite_score': final_insight.get('composite_score', 0.0),
                'status': 'hypothesis',
                'source_node_ids': [opportunity.get('target_problem_id')] + opportunity.get('candidate_method_ids', []),
                'evidence_claim_ids': opportunity.get('supporting_evidence_ids', []),
                'agent_debate_log': debate_log
            })

            self.graph_db.create_agent_session({
                'id': session_id,
                'session_type': 'innovation',
                'trigger_node_id': opportunity.get('target_problem_id', ''),
                'participants': ['Hypothesizer', 'Critic', 'Experimentalist', 'Reviewer'],
                'conclusion': final_insight.get('abstract', ''),
                'reasoning_chain': debate_log
            })

        return {
            'session_id': session_id,
            'insight': final_insight,
            'debate_log': debate_log
        }
