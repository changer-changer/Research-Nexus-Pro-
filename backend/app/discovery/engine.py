"""
Innovation Discovery Engine — implements the six innovation paradigms.

Paradigms:
1. CDT: Cross-Domain Transfer
2. SHF: Structural Hole Filling
3. MC: Method Composition
4. TF: Temporal Frontiers
5. CH: Counterfactual Hypothesis
6. RGI: Research Gap Identification
"""
from enum import Enum
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ParadigmType(str, Enum):
    CDT = "cdt"  # Cross-Domain Transfer
    SHF = "shf"  # Structural Hole Filling
    MC = "mc"    # Method Composition
    TF = "tf"    # Temporal Frontiers
    CH = "ch"    # Counterfactual Hypothesis
    RGI = "rgi"  # Research Gap Identification


class InnovationDiscoveryEngine:
    """
    Discovers innovation opportunities by running six complementary paradigms
    over the knowledge graph and vector database.
    """

    def __init__(self, graph_db, vector_db, llm_client=None):
        self.graph_db = graph_db
        self.vector_db = vector_db
        self.llm_client = llm_client
        self.logger = logging.getLogger("discovery.engine")

    def discover(self, paradigm: Optional[ParadigmType] = None,
                 seed_node_id: Optional[str] = None,
                 limit: int = 20) -> List[Dict[str, Any]]:
        """
        Main entry point. Run one or all paradigms and return opportunities.

        Args:
            paradigm: Specific paradigm to run, or None for all
            seed_node_id: Optional seed node to focus discovery
            limit: Max results per paradigm

        Returns:
            List of InnovationOpportunity dicts
        """
        opportunities = []

        paradigms_to_run = [paradigm] if paradigm else list(ParadigmType)

        for p in paradigms_to_run:
            if p == ParadigmType.CDT:
                opportunities.extend(self._discover_cdt(seed_node_id, limit))
            elif p == ParadigmType.SHF:
                opportunities.extend(self._discover_shf(seed_node_id, limit))
            elif p == ParadigmType.MC:
                opportunities.extend(self._discover_mc(seed_node_id, limit))
            elif p == ParadigmType.TF:
                opportunities.extend(self._discover_tf(limit))
            elif p == ParadigmType.CH:
                opportunities.extend(self._discover_ch(seed_node_id, limit))
            elif p == ParadigmType.RGI:
                opportunities.extend(self._discover_rgi(limit))

        # Score and sort
        scored = []
        for opp in opportunities:
            score = self._score_opportunity(opp)
            opp['composite_score'] = score['total']
            opp['score_breakdown'] = score
            scored.append(opp)

        scored.sort(key=lambda x: x['composite_score'], reverse=True)
        return scored[:limit]

    # ========================================================================
    # Paradigm 1: Cross-Domain Transfer (CDT)
    # ========================================================================

    def _discover_cdt(self, seed_problem_id: Optional[str] = None,
                      limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find methods from other domains that might solve a problem.
        Sweet spot: vector similarity 0.40-0.85 (not too close, not too far).

        Falls back to "unconnected but semantically similar" when all nodes
        share the same domain label (common in imported datasets).
        """
        opportunities = []

        problems = self.graph_db.get_all_problems()
        if seed_problem_id:
            problems = [p for p in problems if p.get('id') == seed_problem_id]

        # Check domain diversity — if the problem's domain covers >80% of nodes,
        # excluding by domain will remove almost all candidates.
        domain_counts = {}
        for p in problems:
            d = p.get('domain', 'unknown')
            domain_counts[d] = domain_counts.get(d, 0) + 1
        total_problems = len(problems)

        for problem in problems[:20]:  # Sample for performance
            prob_id = problem.get('id')
            prob_domain = problem.get('domain', 'unknown')

            # Get problem vector
            prob_vec = self.vector_db.get_problem_vector(prob_id)
            if prob_vec is None:
                continue

            # Use domain filter only if this domain is not dominant (<80%)
            domain_ratio = domain_counts.get(prob_domain, 0) / total_problems if total_problems else 1.0
            use_domain_filter = domain_ratio < 0.8

            if use_domain_filter:
                candidates = self.vector_db.search_similar_methods(
                    query_vector=prob_vec,
                    top_k=limit * 2,
                    exclude_domain=prob_domain
                )
            else:
                # Fallback: search all methods, filter by graph connectivity
                candidates = self.vector_db.search_similar_methods(
                    query_vector=prob_vec,
                    top_k=limit * 3,
                    exclude_domain=None
                )

            for cand in candidates:
                score = cand['score']
                # Sweet spot: not too similar (known) nor too dissimilar (irrelevant)
                if 0.40 <= score <= 0.85:
                    # Check if already connected in graph
                    if self.graph_db.graph.has_edge(cand['id'], prob_id):
                        continue
                    # If fallback mode, also require different mechanism (proxy for cross-domain)
                    if not use_domain_filter:
                        method = self.graph_db.get_method(cand['id'])
                        problem_mechs = set()
                        for s, t, d in self.graph_db.graph.in_edges(prob_id, data=True):
                            if d.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                                m = self.graph_db.get_method(s)
                                if m:
                                    problem_mechs.add(m.get('mechanism', '').lower())
                        cand_mech = method.get('mechanism', '').lower() if method else ''
                        if cand_mech and cand_mech in problem_mechs:
                            continue

                    opportunities.append({
                        'opportunity_id': f"cdt_{prob_id}_{cand['id']}",
                        'target_problem_id': prob_id,
                        'candidate_method_ids': [cand['id']],
                        'rationale': f"Method '{cand['payload'].get('name', cand['id'])}' from "
                                     f"domain '{cand['payload'].get('domain', 'unknown')}' shows "
                                     f"semantic similarity {score:.2f} with problem '{problem.get('name')}' "
                                     f"but has never been applied.",
                        'innovation_type': 'cdt',
                        'feasibility_score': score,
                        'novelty_score': 1.0 - score,
                        'supporting_evidence_ids': []
                    })

        return opportunities[:limit]

    # ========================================================================
    # Paradigm 2: Structural Hole Filling (SHF)
    # ========================================================================

    def _discover_shf(self, seed_problem_id: Optional[str] = None,
                      limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find pairs of methods that solve the same problem with different mechanisms
        but have no IMPROVES_UPON or COMPOSED_OF relationship.
        """
        opportunities = []

        problems = self.graph_db.get_all_problems()
        if seed_problem_id:
            problems = [p for p in problems if p.get('id') == seed_problem_id]

        for problem in problems[:30]:
            prob_id = problem.get('id')

            # Get all methods that solve this problem
            solving_methods = []
            for source, target, edge_data in self.graph_db.graph.in_edges(prob_id, data=True):
                if edge_data.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                    method = self.graph_db.get_method(source)
                    if method:
                        solving_methods.append(method)

            if len(solving_methods) < 2:
                continue

            # Find pairs with no direct relationship
            for i in range(len(solving_methods)):
                for j in range(i + 1, len(solving_methods)):
                    m1, m2 = solving_methods[i], solving_methods[j]
                    m1_id, m2_id = m1.get('id'), m2.get('id')

                    # Check if already connected
                    if self.graph_db.graph.has_edge(m1_id, m2_id) or \
                       self.graph_db.graph.has_edge(m2_id, m1_id):
                        continue

                    # Check different mechanisms
                    mech1 = m1.get('mechanism', '').lower()
                    mech2 = m2.get('mechanism', '').lower()
                    if not mech1 or not mech2 or mech1 == mech2:
                        continue

                    opportunities.append({
                        'opportunity_id': f"shf_{prob_id}_{m1_id}_{m2_id}",
                        'target_problem_id': prob_id,
                        'candidate_method_ids': [m1_id, m2_id],
                        'rationale': f"Methods '{m1.get('name')}' ({mech1[:30]}...) and "
                                     f"'{m2.get('name')}' ({mech2[:30]}...) both address "
                                     f"'{problem.get('name')}' but use different mechanisms and "
                                     f"have never been combined.",
                        'innovation_type': 'shf',
                        'feasibility_score': 0.6,
                        'novelty_score': 0.7,
                        'supporting_evidence_ids': []
                    })

        return opportunities[:limit]

    # ========================================================================
    # Paradigm 3: Method Composition (MC)
    # ========================================================================

    def _discover_mc(self, seed_problem_id: Optional[str] = None,
                     limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find methods that solve sub-problems of a larger problem,
        suggesting they could be composed into an end-to-end pipeline.
        """
        opportunities = []

        problems = self.graph_db.get_all_problems()
        if seed_problem_id:
            problems = [p for p in problems if p.get('id') == seed_problem_id]

        seen_mc = set()

        for problem in problems[:20]:
            prob_id = problem.get('id')

            # Get sub-problems
            sub_problems = []
            for source, target, edge_data in self.graph_db.graph.out_edges(prob_id, data=True):
                if edge_data.get('type') == 'SUB_PROBLEM_OF' and target == prob_id:
                    sub_problems.append(self.graph_db.get_problem(source))

            # Also check incoming SUB_PROBLEM_OF edges
            for source, target, edge_data in self.graph_db.graph.in_edges(prob_id, data=True):
                if edge_data.get('type') == 'SUB_PROBLEM_OF':
                    sub_problems.append(self.graph_db.get_problem(source))

            sub_problems = [sp for sp in sub_problems if sp]
            if len(sub_problems) < 2:
                continue

            # Get best methods for each sub-problem
            methods_per_sub = {}
            for sp in sub_problems:
                sp_methods = []
                for s, t, d in self.graph_db.graph.in_edges(sp.get('id'), data=True):
                    if d.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                        m = self.graph_db.get_method(s)
                        if m:
                            sp_methods.append(m)
                if sp_methods:
                    methods_per_sub[sp.get('id')] = sp_methods[:2]  # Top 2

            # If we have methods for multiple sub-problems
            if len(methods_per_sub) >= 2:
                sub_ids = list(methods_per_sub.keys())
                for i in range(len(sub_ids)):
                    for j in range(i + 1, len(sub_ids)):
                        m1 = methods_per_sub[sub_ids[i]][0]
                        m2 = methods_per_sub[sub_ids[j]][0]

                        mc_key = (prob_id, m1.get('id'), m2.get('id'))
                        if mc_key in seen_mc:
                            continue
                        seen_mc.add(mc_key)

                        opportunities.append({
                            'opportunity_id': f"mc_{prob_id}_{m1.get('id')}_{m2.get('id')}",
                            'target_problem_id': prob_id,
                            'candidate_method_ids': [m1.get('id'), m2.get('id')],
                            'rationale': f"Compose pipeline: '{m1.get('name')}' handles "
                                         f"sub-problem '{sub_ids[i]}', then '{m2.get('name')}' "
                                         f"handles '{sub_ids[j]}' to solve '{problem.get('name')}' end-to-end.",
                            'innovation_type': 'mc',
                            'feasibility_score': 0.55,
                            'novelty_score': 0.65,
                            'supporting_evidence_ids': []
                        })

        return opportunities[:limit]

    # ========================================================================
    # Paradigm 4: Temporal Frontiers (TF)
    # ========================================================================

    def _discover_tf(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find new methods (2024+) that could solve old unsolved problems.
        """
        opportunities = []
        current_year = datetime.now().year

        problems = self.graph_db.get_all_problems()
        methods = self.graph_db.get_all_methods()

        # Old unsolved problems (identified before 2022)
        old_problems = [
            p for p in problems
            if p.get('year') and p.get('year') <= 2022
            and p.get('resolution_status') in ('unsolved', 'partial')
        ]

        # New methods (2024+)
        new_methods = [
            m for m in methods
            if m.get('year') and m.get('year') >= 2024
        ]

        for problem in old_problems[:20]:
            prob_id = problem.get('id')
            prob_vec = self.vector_db.get_problem_vector(prob_id)
            if prob_vec is None:
                continue

            for method in new_methods[:20]:
                meth_id = method.get('id')

                # Check if already connected
                if self.graph_db.graph.has_edge(meth_id, prob_id):
                    continue

                # Vector similarity check
                meth_vec = self.vector_db.get_method_vector(meth_id)
                if meth_vec:
                    import numpy as np
                    q = np.array(prob_vec, dtype=np.float32)
                    v = np.array(meth_vec, dtype=np.float32)
                    qn, vn = np.linalg.norm(q), np.linalg.norm(v)
                    if qn > 0 and vn > 0:
                        sim = float(np.dot(q, v) / (qn * vn))
                        if sim > 0.4:
                            opportunities.append({
                                'opportunity_id': f"tf_{prob_id}_{meth_id}",
                                'target_problem_id': prob_id,
                                'candidate_method_ids': [meth_id],
                                'rationale': f"New method '{method.get('name')}' ({method.get('year')}) "
                                             f"may solve the long-standing problem '{problem.get('name')}' "
                                             f"({problem.get('year')}, {problem.get('resolution_status')}). "
                                             f"Semantic similarity: {sim:.2f}.",
                                'innovation_type': 'tf',
                                'feasibility_score': sim,
                                'novelty_score': 0.8,
                                'supporting_evidence_ids': []
                            })

        return opportunities[:limit]

    # ========================================================================
    # Paradigm 5: Counterfactual Hypothesis (CH)
    # ========================================================================

    def _discover_ch(self, seed_method_id: Optional[str] = None,
                     limit: int = 10) -> List[Dict[str, Any]]:
        """
        Challenge default assumptions of methods to find alternative paths.
        """
        opportunities = []

        methods = self.graph_db.get_all_methods()
        if seed_method_id:
            methods = [m for m in methods if m.get('id') == seed_method_id]

        # Check domain dominance
        domain_counts = {}
        for m in methods:
            d = m.get('domain', 'unknown')
            domain_counts[d] = domain_counts.get(d, 0) + 1
        total_methods = len(methods)

        seen_pairs = set()

        for method in methods[:15]:
            meth_id = method.get('id')
            assumptions_text = method.get('assumptions', '')

            if not assumptions_text or len(assumptions_text) < 10:
                continue

            # Parse assumptions (simplified: split by common delimiters)
            assumptions = [a.strip() for a in assumptions_text.replace(';', '.').split('.') if len(a.strip()) > 10]

            for assumption in assumptions[:2]:  # Check top 2 assumptions
                # Negate assumption and search for alternatives
                negated = f"without assuming {assumption}"

                # Get method vector and perturb
                meth_vec = self.vector_db.get_method_vector(meth_id)
                if meth_vec is None:
                    continue

                # Use domain filter only if this domain is not dominant
                meth_domain = method.get('domain', 'unknown')
                domain_ratio = domain_counts.get(meth_domain, 0) / total_methods if total_methods else 1.0
                use_domain_filter = domain_ratio < 0.8

                # Search for alternative methods (simplified: just search similar)
                alternatives = self.vector_db.search_similar_methods(
                    query_vector=meth_vec,
                    top_k=5,
                    exclude_domain=meth_domain if use_domain_filter else None
                )

                for alt in alternatives:
                    score = alt['score']
                    # Exclude self-match and very high similarity (same sub-approach)
                    if score < 0.95 and score > 0.5:
                        alt_id = alt['id']
                        if alt_id == meth_id:
                            continue

                        # Find shared problems
                        shared_problems = []
                        for s, t, d in self.graph_db.graph.out_edges(meth_id, data=True):
                            if d.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                                if self.graph_db.graph.has_edge(alt_id, t):
                                    shared_problems.append(t)

                        if shared_problems:
                            pair_key = (meth_id, alt_id)
                            if pair_key in seen_pairs:
                                continue
                            seen_pairs.add(pair_key)
                            import hashlib
                            ass_hash = hashlib.md5(assumption.encode()).hexdigest()[:6]
                            opportunities.append({
                                'opportunity_id': f"ch_{meth_id}_{alt_id}_{ass_hash}",
                                'target_problem_id': shared_problems[0],
                                'candidate_method_ids': [alt_id, meth_id],
                                'rationale': f"If we relax assumption '{assumption[:80]}...' of "
                                             f"'{method.get('name')}', alternative method '{alt['payload'].get('name', alt_id)}' "
                                             f"offers a different mechanism for the same problem.",
                                'innovation_type': 'ch',
                                'feasibility_score': score,
                                'novelty_score': 0.75,
                                'supporting_evidence_ids': []
                            })

        return opportunities[:limit]

    # ========================================================================
    # Paradigm 6: Research Gap Identification (RGI)
    # ========================================================================

    def _discover_rgi(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Find problems with high importance but few solutions (high PageRank, low SOLVES in-degree).
        """
        opportunities = []

        problems = self.graph_db.get_all_problems()

        # Compute simple importance metrics
        for problem in problems:
            prob_id = problem.get('id')

            # Count SOLVES edges (in-degree)
            solves_count = 0
            paper_mentions = 0
            for source, target, edge_data in self.graph_db.graph.in_edges(prob_id, data=True):
                if edge_data.get('type') in ('SOLVES', 'ADDRESSES_PROBLEM'):
                    solves_count += 1
                elif edge_data.get('type') == 'CITES':
                    paper_mentions += 1

            # Count claims as proxy for importance
            claims = self.graph_db.get_claims_by_canonical(prob_id)
            claim_count = len(claims)

            # Gap ratio: high mentions/claims but low solutions
            importance = claim_count * 2 + paper_mentions
            if importance > 3 and solves_count < 2:
                gap_ratio = importance / max(solves_count, 0.5)

                opportunities.append({
                    'opportunity_id': f"rgi_{prob_id}",
                    'target_problem_id': prob_id,
                    'candidate_method_ids': [],
                    'rationale': f"Problem '{problem.get('name')}' is mentioned in {claim_count} claims "
                                 f"but has only {solves_count} solution methods. "
                                 f"Gap ratio: {gap_ratio:.1f}.",
                    'innovation_type': 'rgi',
                    'feasibility_score': 0.4,
                    'novelty_score': 0.6,
                    'supporting_evidence_ids': [c.get('claim_id') for c in claims[:5]]
                })

        # Sort by gap ratio and return top
        opportunities.sort(key=lambda x: len(x.get('supporting_evidence_ids', [])), reverse=True)
        return opportunities[:limit]

    # ========================================================================
    # Scoring
    # ========================================================================

    def _score_opportunity(self, opp: Dict[str, Any]) -> Dict[str, float]:
        """
        Score an opportunity across four dimensions.
        composite = 0.30*novelty + 0.25*feasibility + 0.25*impact + 0.20*evidence
        """
        prob_id = opp.get('target_problem_id')
        meth_ids = opp.get('candidate_method_ids', [])

        # Novelty: graph distance (simplified: more hops = more novel)
        novelty = opp.get('novelty_score', 0.5)

        # Feasibility: vector similarity
        feasibility = opp.get('feasibility_score', 0.5)

        # Impact: problem importance + method generality
        impact = 0.5
        if prob_id and self.graph_db.graph.has_node(prob_id):
            # Simple proxy: more claims = more important
            claims = self.graph_db.get_claims_by_canonical(prob_id)
            impact = min(len(claims) / 10.0, 1.0)

        # Evidence strength
        evidence_count = len(opp.get('supporting_evidence_ids', []))
        evidence = min(evidence_count / 5.0, 1.0)

        total = 0.30 * novelty + 0.25 * feasibility + 0.25 * impact + 0.20 * evidence

        return {
            'novelty': round(novelty, 3),
            'feasibility': round(feasibility, 3),
            'impact': round(impact, 3),
            'evidence_strength': round(evidence, 3),
            'total': round(total, 3)
        }
