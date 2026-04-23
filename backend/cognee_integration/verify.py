#!/usr/bin/env python3
"""
Quick verification script for Cognee Integration
Shows basic usage and validates setup
"""
import os
import asyncio

os.environ["ENABLE_BACKEND_ACCESS_CONTROL"] = "false"
os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"

async def main():
    print("=" * 60)
    print("Cognee Integration Quick Verification")
    print("=" * 60)
    
    # 1. Import test
    print("\n1. Testing imports...")
    try:
        from cognee_integration import (
            CogneeConfig, 
            ResearchPaperProcessor,
            Paper, ResearchProblem, ResearchMethod
        )
        from cognee_integration.adapter import to_reactflow
        print("   ✅ All imports successful")
    except Exception as e:
        print(f"   ❌ Import failed: {e}")
        return False
    
    # 2. Configuration test
    print("\n2. Testing configuration...")
    try:
        config = CogneeConfig(
            llm_api_key=os.getenv("COGNEE_LLM_API_KEY", "test-key"),
            llm_endpoint="https://api.kimi.com/coding",
            llm_model="anthropic/k2p5",
            embedding_provider="fastembed",
            embedding_model="BAAI/bge-base-en-v1.5",
            system_root_directory="./cognee_test_data"
        )
        config.apply()
        print("   ✅ Configuration applied")
        print(f"   LLM: {config.llm_model}")
        print(f"   Embedding: {config.embedding_model}")
    except Exception as e:
        print(f"   ❌ Configuration failed: {e}")
        return False
    
    # 3. Schema test
    print("\n3. Testing data schemas...")
    try:
        paper = Paper(
            id="test_001",
            title="Test Paper",
            authors=["Author A"],
            year=2024
        )
        problem = ResearchProblem(
            id="p_test",
            name="Test Problem",
            level=1
        )
        method = ResearchMethod(
            id="m_test",
            name="Test Method",
            category="test"
        )
        print("   ✅ Schemas working")
    except Exception as e:
        print(f"   ❌ Schema test failed: {e}")
        return False
    
    # 4. Adapter test
    print("\n4. Testing adapter...")
    try:
        from cognee_integration.schemas import ExtractedKnowledge
        
        knowledge = ExtractedKnowledge(
            paper=paper,
            problems=[problem],
            methods=[method]
        )
        
        reactflow_data = to_reactflow(knowledge)
        print(f"   ✅ Adapter working")
        print(f"   Nodes: {len(reactflow_data['nodes'])}")
        print(f"   Edges: {len(reactflow_data['edges'])}")
    except Exception as e:
        print(f"   ❌ Adapter test failed: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("✅ All verification tests passed!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Set COGNEE_LLM_API_KEY environment variable")
    print("2. Run: python -m cognee_integration.tests.test_integration")
    print("3. Start API with: python app/api/main_local.py")
    print("4. Test endpoints at: http://localhost:8000/api/cognee/health")
    
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
