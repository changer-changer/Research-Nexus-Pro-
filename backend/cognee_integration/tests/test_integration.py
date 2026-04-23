"""
Test suite for Cognee Integration

Tests:
1. Configuration setup
2. Paper processing
3. Knowledge extraction
4. Data format conversion
5. API endpoints
"""

import asyncio
import os
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cognee

# Test configuration
TEST_CONFIG = {
    "llm_api_key": os.getenv("COGNEE_LLM_API_KEY", "sk-kimi-5MvMfLJNEY6DlOyoJg9yOxPk1WTGWXd2LKfAxjJ4Lgv99IYrrxizVaigBsDKOglc"),
    "llm_endpoint": "https://api.kimi.com/coding",
    "llm_model": "anthropic/k2p5",
    "embedding_provider": "fastembed",
    "embedding_model": "BAAI/bge-base-en-v1.5",
    "embedding_dimensions": 768,
    "system_root_directory": "./test_cognee_data"
}


async def test_configuration():
    """Test 1: Configuration setup"""
    print("\n" + "="*60)
    print("TEST 1: Configuration Setup")
    print("="*60)
    
    try:
        from cognee_integration import CogneeConfig
        
        config = CogneeConfig(**TEST_CONFIG)
        config.apply()
        
        print("✅ Configuration applied successfully")
        print(f"   LLM Model: {config.llm_model}")
        print(f"   Embedding: {config.embedding_model}")
        print(f"   Vector DB: {config.vector_db_provider}")
        
        # Verify config is set
        from cognee.infrastructure.llm.config import get_llm_config
        from cognee.infrastructure.databases.vector.embeddings.config import get_embedding_config
        
        llm_config = get_llm_config()
        embed_config = get_embedding_config()
        
        assert llm_config.llm_model == TEST_CONFIG["llm_model"], "LLM model not set correctly"
        assert embed_config.embedding_provider == TEST_CONFIG["embedding_provider"], "Embedding provider not set"
        
        print("✅ Configuration verified")
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_paper_processing():
    """Test 2: Paper processing with simple text"""
    print("\n" + "="*60)
    print("TEST 2: Paper Processing")
    print("="*60)
    
    try:
        from cognee_integration import ResearchPaperProcessor, CogneeConfig
        
        # Setup
        config = CogneeConfig(**TEST_CONFIG)
        processor = ResearchPaperProcessor(config)
        await processor.initialize()
        
        print("✅ Processor initialized")
        
        # Test paper
        paper_text = """
        Title: Deep Tactile Perception for Robotic Grasping
        
        Abstract: This paper presents a novel deep learning approach for tactile 
        perception in robotic manipulation. We propose a Convolutional Neural Network 
        (CNN) architecture that processes high-resolution tactile images to estimate 
        contact forces and detect slip. Our method addresses the problem of robust 
        grasping under uncertainty by combining tactile feedback with visual information.
        
        Introduction: Robotic grasping remains a challenging problem in robotics.
        Tactile sensing provides crucial information about contact state...
        
        Method: We use a ResNet-18 backbone with custom heads for force estimation 
        and slip detection. The network is trained on a dataset of 10,000 grasp attempts.
        
        Results: Our method achieves 95% accuracy in slip detection and reduces 
        grasp failures by 40% compared to vision-only baselines.
        """
        
        paper_meta = {
            "title": "Deep Tactile Perception for Robotic Grasping",
            "authors": ["John Doe", "Jane Smith"],
            "year": 2024,
            "venue": "ICRA"
        }
        
        print("Processing paper...")
        result = await processor.process_paper(paper_text, paper_meta)
        
        print(f"✅ Paper processed")
        print(f"   Success: {result.success}")
        print(f"   Paper ID: {result.paper_id}")
        print(f"   Problems extracted: {result.extracted_problems}")
        print(f"   Methods extracted: {result.extracted_methods}")
        print(f"   Relationships: {result.extracted_relationships}")
        
        return result.success
        
    except Exception as e:
        print(f"❌ Paper processing test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_search():
    """Test 3: Search functionality"""
    print("\n" + "="*60)
    print("TEST 3: Search")
    print("="*60)
    
    try:
        from cognee_integration import ResearchPaperProcessor, CogneeConfig
        
        config = CogneeConfig(**TEST_CONFIG)
        processor = ResearchPaperProcessor(config)
        await processor.initialize()
        
        queries = [
            "tactile perception",
            "CNN architecture",
            "grasping methods"
        ]
        
        for query in queries:
            print(f"\nSearching: '{query}'")
            result = await processor.search(query, limit=5)
            
            print(f"   Success: {result.success}")
            print(f"   Results found: {result.total_found}")
            
            if result.results:
                print(f"   First result: {str(result.results[0])[:100]}...")
        
        print("\n✅ Search test completed")
        return True
        
    except Exception as e:
        print(f"❌ Search test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_adapter():
    """Test 4: Data format conversion"""
    print("\n" + "="*60)
    print("TEST 4: Data Format Adapter")
    print("="*60)
    
    try:
        from cognee_integration import (
            Paper, ResearchProblem, ResearchMethod,
            ExtractedKnowledge, to_reactflow
        )
        
        # Create sample knowledge
        paper = Paper(
            id="test_paper_1",
            title="Test Paper",
            authors=["Author A", "Author B"],
            year=2024
        )
        
        problems = [
            ResearchProblem(
                id="p_test_1",
                name="Test Problem",
                description="A test research problem",
                level=1,
                parent_id="p_root"
            )
        ]
        
        methods = [
            ResearchMethod(
                id="m_test_1",
                name="Test Method",
                description="A test method",
                category="test"
            )
        ]
        
        knowledge = ExtractedKnowledge(
            paper=paper,
            problems=problems,
            methods=methods
        )
        
        # Convert to ReactFlow
        reactflow_data = to_reactflow(knowledge)
        
        print(f"✅ Converted to ReactFlow format")
        print(f"   Nodes: {len(reactflow_data['nodes'])}")
        print(f"   Edges: {len(reactflow_data['edges'])}")
        
        # Verify structure
        assert "nodes" in reactflow_data
        assert "edges" in reactflow_data
        
        if reactflow_data["nodes"]:
            node = reactflow_data["nodes"][0]
            assert "id" in node
            assert "position" in node
            assert "data" in node
        
        print("✅ ReactFlow structure verified")
        return True
        
    except Exception as e:
        print(f"❌ Adapter test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_extracted_data_import():
    """Test 5: Import from EXTRACTED_DATA.json"""
    print("\n" + "="*60)
    print("TEST 5: EXTRACTED_DATA.json Import")
    print("="*60)
    
    try:
        from cognee_integration.adapter import ResearchNexusToCogneeAdapter
        
        # Sample extracted data format
        sample_data = {
            "papers": [
                {
                    "id": "paper_1",
                    "title": "Sample Paper on Tactile Sensing",
                    "authors": ["Alice Researcher", "Bob Scientist"],
                    "year": 2024,
                    "venue": "ICRA",
                    "abstract": "This paper explores tactile sensing methods...",
                    "problem_ids": ["p_tactile", "p_perception"],
                    "method_ids": ["m_cnn", "m_transformer"]
                }
            ]
        }
        
        adapter = ResearchNexusToCogneeAdapter()
        papers = adapter.adapt_full_extracted_data(sample_data)
        
        print(f"✅ Converted {len(papers)} papers")
        
        if papers:
            paper = papers[0]
            print(f"   Text length: {len(paper['text'])} chars")
            print(f"   Meta keys: {list(paper['meta'].keys())}")
        
        return True
        
    except Exception as e:
        print(f"❌ Import test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_end_to_end():
    """Test 6: End-to-end workflow"""
    print("\n" + "="*60)
    print("TEST 6: End-to-End Workflow")
    print("="*60)
    
    try:
        from cognee_integration import CogneePipeline, CogneeConfig
        
        # Initialize pipeline
        config = CogneeConfig(**TEST_CONFIG)
        pipeline = CogneePipeline()
        await pipeline.initialize(config)
        
        print("✅ Pipeline initialized")
        
        # Add a paper
        paper_text = """
        We propose a novel approach to slip detection in robotic grasping using 
        deep learning. Our method combines tactile sensor data with proprioceptive 
        feedback to predict slip events before they occur. The key contribution is 
        a transformer-based architecture that processes temporal sequences of 
        tactile readings. We evaluate on a dataset of 5,000 grasps and achieve 
        92% precision in slip prediction.
        """
        
        paper_meta = {
            "title": "Transformer-based Slip Detection",
            "authors": ["Researcher X"],
            "year": 2024
        }
        
        result = await pipeline.add_paper(paper_text, paper_meta)
        print(f"✅ Paper added: {result.get('success')}")
        
        # Search
        search_result = await pipeline.search("slip detection transformer", limit=5)
        print(f"✅ Search completed: {search_result.get('success')}")
        
        return True
        
    except Exception as e:
        print(f"❌ End-to-end test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("COGNEE INTEGRATION TEST SUITE")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Configuration", await test_configuration()))
    results.append(("Paper Processing", await test_paper_processing()))
    results.append(("Search", await test_search()))
    results.append(("Adapter", await test_adapter()))
    results.append(("Extracted Data Import", await test_extracted_data_import()))
    results.append(("End-to-End", await test_end_to_end()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return passed == total


if __name__ == "__main__":
    # Set environment variables for testing
    os.environ["ENABLE_BACKEND_ACCESS_CONTROL"] = "false"
    os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"
    
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
