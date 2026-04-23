#!/usr/bin/env python3
"""
Cognee Configuration Test - Fixed Version
Tests FastEmbed + Kimi Coding LLM configuration
"""
import os
import asyncio

os.environ["ENABLE_BACKEND_ACCESS_CONTROL"] = "false"
os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"

import cognee
from cognee.infrastructure.llm.config import get_llm_config
from cognee.infrastructure.databases.vector.embeddings.config import get_embedding_config
from cognee.infrastructure.databases.vector.config import get_vectordb_config
from cognee.base_config import get_base_config


async def test_cognee_config():
    print("=== Cognee Configuration Test ===\n")
    
    # 1. Configure system paths
    system_root = "./test_cognee_data"
    cognee.config.system_root_directory(system_root)
    cognee.config.data_root_directory(f"{system_root}/raw_data")
    print(f"✅ System root: {system_root}")
    
    # 2. Configure LLM (Kimi Coding)
    llm_config = get_llm_config()
    llm_config.llm_api_key = "sk-kimi-5MvMfLJNEY6DlOyoJg9yOxPk1WTGWXd2LKfAxjJ4Lgv99IYrrxizVaigBsDKOglc"
    llm_config.llm_endpoint = "https://api.kimi.com/coding"
    llm_config.llm_model = "anthropic/k2p5"
    llm_config.llm_provider = "openai"  # litellm uses 'openai' for custom endpoints
    llm_config.llm_temperature = 0.0
    print("✅ LLM configured: Kimi Coding (anthropic/k2p5)")
    
    # 3. Configure Embedding (FastEmbed) - CORRECT WAY
    embed_config = get_embedding_config()
    embed_config.embedding_provider = "fastembed"
    embed_config.embedding_model = "BAAI/bge-base-en-v1.5"
    embed_config.embedding_dimensions = 768
    embed_config.embedding_max_completion_tokens = 512
    print("✅ Embedding configured: FastEmbed (BAAI/bge-base-en-v1.5)")
    
    # 4. Configure Vector DB
    vector_config = get_vectordb_config()
    vector_config.vector_db_provider = "lancedb"
    print("✅ Vector DB configured: LanceDB")
    
    # 5. Verify configuration
    print("\n--- Configuration Verification ---")
    print(f"LLM Model: {llm_config.llm_model}")
    print(f"LLM Endpoint: {llm_config.llm_endpoint}")
    print(f"Embedding Provider: {embed_config.embedding_provider}")
    print(f"Embedding Model: {embed_config.embedding_model}")
    print(f"Embedding Dimensions: {embed_config.embedding_dimensions}")
    print(f"Vector DB Provider: {vector_config.vector_db_provider}")
    
    # 6. Test embedding engine creation
    print("\n--- Testing Embedding Engine ---")
    try:
        from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import get_embedding_engine
        engine = get_embedding_engine()
        print(f"✅ Embedding engine created: {type(engine).__name__}")
        print(f"   Vector size: {engine.get_vector_size()}")
        print(f"   Batch size: {engine.get_batch_size()}")
    except Exception as e:
        print(f"❌ Embedding engine error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


async def test_cognee_basic():
    """Test basic Cognee operations"""
    print("\n=== Basic Cognee Operations ===\n")
    
    try:
        # Clean up
        print("[1/4] Cleaning up...")
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)
        print("   ✅ Cleanup complete")
        
        # Add data
        print("[2/4] Adding test data...")
        test_text = """
        OpenClaw is an AI agent platform supporting multiple agents.
        Engineer Musk handles code and architecture.
        Scientist handles research and analysis.
        Creator handles design and content.
        """
        await cognee.add(test_text, dataset_name="test")
        print("   ✅ Data added")
        
        # Build graph
        print("[3/4] Building knowledge graph...")
        await cognee.cognify()
        print("   ✅ Knowledge graph built")
        
        # Search
        print("[4/4] Testing search...")
        results = await cognee.search("What agents does OpenClaw have?")
        print(f"   ✅ Search completed, found {len(results)} results")
        
        for i, r in enumerate(results[:3]):
            print(f"   Result {i+1}: {str(r)[:100]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    print("Starting Cognee Integration Test\n")
    
    # Test configuration
    config_ok = await test_cognee_config()
    
    if not config_ok:
        print("\n❌ Configuration test failed")
        return False
    
    # Test basic operations
    basic_ok = await test_cognee_basic()
    
    if basic_ok:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Basic operations test failed")
    
    return config_ok and basic_ok


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
