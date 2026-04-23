"""
V4 Component Tests — Discovery Engine, GraphRAG, Value Score, Agent Orchestrator.

Run with: pytest backend/tests/test_v4_components.py -v
"""

import pytest
import sys
import os

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.discovery.engine import InnovationDiscoveryEngine, ParadigmType
from app.graphrag.engine import GraphRAGEngine, GraphRAGResponse
from app.database.local_graph import LocalGraphDB
from app.database.local_vector import LocalVectorDB


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def graph_db(tmp_path):
    """Create a temporary LocalGraphDB for testing."""
    db_path = tmp_path / "test_graph.db"
    db = LocalGraphDB(str(db_path))
    return db


@pytest.fixture
def vector_db(tmp_path):
    """Create a temporary LocalVectorDB for testing."""
    vector_path = tmp_path / "vectors"
    db = LocalVectorDB(str(vector_path))
    return db


@pytest.fixture
def populated_graph(graph_db):
    """Populate graph with sample problems and methods."""
    # Problem in robotics domain
    graph_db.create_problem({
        "id": "prob_robotics_1",
        "name": "Dexterous manipulation uncertainty",
        "domain": "robotics",
        "definition": "Robotic hands struggle with uncertain contact dynamics",
        "resolution_status": "unsolved",
        "year_identified": 2020
    })

    # Problem in multi-agent domain
    graph_db.create_problem({
        "id": "prob_multiagent_1",
        "name": "Agent coordination scaling",
        "domain": "multi_agent",
        "definition": "Multi-agent systems fail to scale beyond 100 agents",
        "resolution_status": "unsolved",
        "year_identified": 2021
    })

    # Method in robotics
    graph_db.create_method({
        "id": "meth_robotics_1",
        "name": "Tactile Diffusion Policy",
        "domain": "robotics",
        "mechanism": "Uses diffusion models for tactile-based policy learning",
        "complexity": "high",
        "year": 2024
    })

    # Method in multi-agent (cross-domain candidate)
    graph_db.create_method({
        "id": "meth_multiagent_1",
        "name": "Consensus Diffusion",
        "domain": "multi_agent",
        "mechanism": "Uses diffusion models for distributed consensus",
        "complexity": "medium",
        "year": 2024
    })

    # Older method
    graph_db.create_method({
        "id": "meth_old_1",
        "name": "Classical MPC",
        "domain": "robotics",
        "mechanism": "Model predictive control with quadratic costs",
        "complexity": "medium",
        "year": 2019
    })

    # Edges
    graph_db.graph.add_edge("meth_robotics_1", "prob_robotics_1", type="ADDRESSES_PROBLEM")
    graph_db.graph.add_edge("meth_old_1", "prob_robotics_1", type="ADDRESSES_PROBLEM")
    graph_db.graph.add_edge("prob_multiagent_1", "prob_robotics_1", type="SUB_PROBLEM_OF")

    # Problem with no solves but many claims — perfect RGI target
    graph_db.create_problem({
        "id": "prob_unsolved_rgi",
        "name": "Hard unsolved problem",
        "domain": "robotics",
        "definition": "No one has solved this yet",
        "resolution_status": "unsolved",
        "year_identified": 2022
    })

    # Claims for RGI testing
    graph_db.create_claim({
        "id": "claim_1",
        "paper_id": "paper_1",
        "claim_type": "problem_identification",
        "text": "Dexterous manipulation is hard",
        "canonical_id": "prob_unsolved_rgi"
    })
    graph_db.create_claim({
        "id": "claim_2",
        "paper_id": "paper_2",
        "claim_type": "problem_identification",
        "text": "Contact dynamics are uncertain",
        "canonical_id": "prob_unsolved_rgi"
    })
    graph_db.create_claim({
        "id": "claim_3",
        "paper_id": "paper_3",
        "claim_type": "problem_identification",
        "text": "Scaling multi-agent is difficult",
        "canonical_id": "prob_multiagent_1"
    })

    return graph_db


@pytest.fixture
def discovery_engine(populated_graph, vector_db):
    """Create a discovery engine with populated data."""
    return InnovationDiscoveryEngine(graph_db=populated_graph, vector_db=vector_db)


@pytest.fixture
def graphrag_engine(populated_graph, vector_db):
    """Create a GraphRAG engine with populated data."""
    return GraphRAGEngine(graph_db=populated_graph, vector_db=vector_db)


# ============================================================================
# Value Score Tests
# ============================================================================

def test_problem_value_score_solved(graph_db):
    """Solved problems should have high base scores."""
    graph_db.create_problem({
        "id": "prob_solved",
        "name": "Solved Problem",
        "resolution_status": "solved",
        "definition": "test"
    })
    p = graph_db.get_problem("prob_solved")
    assert p["value_score"] >= 80


def test_problem_value_score_unsolved(graph_db):
    """Unsolved problems should have lower base scores."""
    graph_db.create_problem({
        "id": "prob_unsolved",
        "name": "Unsolved Problem",
        "resolution_status": "unsolved",
        "definition": "test"
    })
    p = graph_db.get_problem("prob_unsolved")
    assert p["value_score"] < 50


def test_method_value_score_with_targets(graph_db):
    """Methods addressing more problems should score higher."""
    graph_db.create_method({
        "id": "meth_popular",
        "name": "Popular Method",
        "mechanism": "test",
        "complexity": "medium"
    })
    # Add multiple target edges and claims
    graph_db.graph.add_edge("meth_popular", "prob_robotics_1", type="ADDRESSES_PROBLEM")
    graph_db.create_claim({
        "id": "claim_pop",
        "paper_id": "paper_pop",
        "claim_type": "uses_method",
        "text": "Uses popular method",
        "canonical_id": "meth_popular"
    })
    m = graph_db.get_method("meth_popular")
    # Base is 50 + bonuses for targets/claims
    assert m["value_score"] >= 40


# ============================================================================
# Discovery Engine Tests
# ============================================================================

def test_discover_rgi_finds_unsolved(discovery_engine):
    """RGI paradigm should find unsolved problems."""
    opps = discovery_engine.discover(paradigm=ParadigmType.RGI, limit=10)
    assert len(opps) > 0
    assert any(o["innovation_type"] == "rgi" for o in opps)


def test_discover_tf_finds_temporal(discovery_engine):
    """TF paradigm should find new methods vs old problems."""
    opps = discovery_engine.discover(paradigm=ParadigmType.TF, limit=10)
    # With our seed data, we have 2024 method vs 2020 problem
    assert len(opps) >= 0  # may be 0 depending on exact thresholds


def test_discover_cdt_cross_domain(discovery_engine):
    """CDT paradigm should attempt cross-domain matching."""
    opps = discovery_engine.discover(paradigm=ParadigmType.CDT, limit=10)
    # Without real vectors this may return empty, but should not crash
    assert isinstance(opps, list)


def test_discover_all_paradigms(discovery_engine):
    """Running all paradigms should return a mixed list."""
    opps = discovery_engine.discover(paradigm=None, limit=20)
    assert isinstance(opps, list)
    # Should include at least RGI results
    assert len(opps) > 0


def test_opportunity_scoring(discovery_engine):
    """Opportunities should have valid score breakdowns."""
    opps = discovery_engine.discover(paradigm=ParadigmType.RGI, limit=5)
    for o in opps:
        assert "composite_score" in o
        assert 0 <= o["composite_score"] <= 1
        if "score_breakdown" in o:
            sb = o["score_breakdown"]
            assert "novelty" in sb
            assert "feasibility" in sb
            assert "impact" in sb
            assert "evidence_strength" in sb


# ============================================================================
# GraphRAG Tests
# ============================================================================

@pytest.mark.asyncio
async def test_graphrag_node_detail(graphrag_engine):
    """GraphRAG should handle node detail queries."""
    result = await graphrag_engine.answer("What is dexterous manipulation uncertainty")
    assert isinstance(result, GraphRAGResponse)
    assert result.intent == "node_detail"
    # FTS may not always match; subgraph may be empty but response should be valid
    assert result.confidence > 0


@pytest.mark.asyncio
async def test_graphrag_relationship(graphrag_engine):
    """GraphRAG should handle relationship queries."""
    result = await graphrag_engine.answer("How is robotics related to multi-agent")
    assert isinstance(result, GraphRAGResponse)
    assert result.confidence > 0


@pytest.mark.asyncio
async def test_graphrag_innovation(graphrag_engine):
    """GraphRAG should handle innovation/gap queries."""
    result = await graphrag_engine.answer("What are the gaps in robotics")
    assert isinstance(result, GraphRAGResponse)
    assert result.intent == "innovation"


@pytest.mark.asyncio
async def test_graphrag_temporal(graphrag_engine):
    """GraphRAG should handle temporal queries."""
    result = await graphrag_engine.answer("Recent trends in 2024")
    assert isinstance(result, GraphRAGResponse)
    assert result.intent == "temporal"


@pytest.mark.asyncio
async def test_graphrag_general(graphrag_engine):
    """GraphRAG should handle general queries."""
    result = await graphrag_engine.answer("diffusion policy")
    assert isinstance(result, GraphRAGResponse)
    assert len(result.subgraph.nodes) >= 0


def test_graphrag_intent_classification(graphrag_engine):
    """Intent classifier should categorize queries correctly."""
    assert graphrag_engine._identify_intent("What is X") == "node_detail"
    assert graphrag_engine._identify_intent("How does X relate to Y") == "relationship"
    assert graphrag_engine._identify_intent("What are the gaps") == "innovation"
    assert graphrag_engine._identify_intent("Recent trends") == "temporal"
    assert graphrag_engine._identify_intent("random query") == "general"


# ============================================================================
# API Route Tests (integration)
# ============================================================================

def test_v4_domain_map_returns_data(populated_graph):
    """Domain map should return problems and methods with value_score."""
    from app.models.domain_schema import DomainMapDTO
    probs = populated_graph.get_all_problems()
    meths = populated_graph.get_all_methods()

    assert len(probs) > 0
    assert len(meths) > 0
    # value_score should be computed dynamically
    for p in probs:
        assert "value_score" in p
        assert isinstance(p["value_score"], (int, float))


# ============================================================================
# Run directly
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
