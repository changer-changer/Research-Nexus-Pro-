"""
Cognee Configuration Manager for Research-Nexus Pro

Handles correct configuration of:
- LLM (Kimi Coding API)
- Embedding (FastEmbed local)
- Vector DB (LanceDB)
- Graph DB (NetworkX)
"""

import os
from typing import Optional
from dataclasses import dataclass

import cognee
from cognee.infrastructure.llm.config import get_llm_config
from cognee.infrastructure.databases.vector.embeddings.config import get_embedding_config
from cognee.infrastructure.databases.vector.config import get_vectordb_config
from cognee.infrastructure.databases.graph.config import get_graph_config
from cognee.base_config import get_base_config


@dataclass
class CogneeConfig:
    """Configuration for Cognee integration."""
    
    # LLM Configuration
    llm_api_key: str
    llm_endpoint: str = "https://api.kimi.com/coding"
    llm_model: str = "anthropic/k2p5"
    llm_provider: str = "openai"  # litellm uses 'openai' for custom endpoints
    llm_temperature: float = 0.0
    llm_max_tokens: int = 16384
    
    # Embedding Configuration
    embedding_provider: str = "fastembed"
    embedding_model: str = "BAAI/bge-base-en-v1.5"
    embedding_dimensions: int = 768
    embedding_max_tokens: int = 512
    
    # Vector DB Configuration
    vector_db_provider: str = "lancedb"
    vector_db_url: Optional[str] = None
    
    # Graph DB Configuration
    graph_db_provider: str = "kuzu"
    
    # System Paths
    system_root_directory: str = "./cognee_data"
    data_root_directory: str = "./cognee_data/raw_data"
    
    def apply(self):
        """Apply configuration to Cognee."""
        import os
        
        # Convert to absolute paths (Cognee requires absolute paths)
        abs_system_root = os.path.abspath(self.system_root_directory)
        abs_data_root = os.path.abspath(self.data_root_directory)
        
        # Ensure directories exist
        os.makedirs(abs_system_root, exist_ok=True)
        os.makedirs(abs_data_root, exist_ok=True)
        
        # Set system directories
        cognee.config.system_root_directory(abs_system_root)
        cognee.config.data_root_directory(abs_data_root)
        
        # Configure LLM
        llm_config = get_llm_config()
        llm_config.llm_api_key = self.llm_api_key
        llm_config.llm_endpoint = self.llm_endpoint
        llm_config.llm_model = self.llm_model
        llm_config.llm_provider = self.llm_provider
        llm_config.llm_temperature = self.llm_temperature
        llm_config.llm_max_completion_tokens = self.llm_max_tokens
        
        # Configure Embedding (direct attribute access)
        embedding_config = get_embedding_config()
        embedding_config.embedding_provider = self.embedding_provider
        embedding_config.embedding_model = self.embedding_model
        embedding_config.embedding_dimensions = self.embedding_dimensions
        embedding_config.embedding_max_completion_tokens = self.embedding_max_tokens
        
        # Configure Vector DB
        vector_config = get_vectordb_config()
        vector_config.vector_db_provider = self.vector_db_provider
        if self.vector_db_url:
            vector_config.vector_db_url = self.vector_db_url
        
        # Configure Graph DB
        graph_config = get_graph_config()
        graph_config.graph_database_provider = self.graph_db_provider
        
        return self
    
    @classmethod
    def from_env(cls):
        """Create configuration from environment variables."""
        api_key = os.getenv("COGNEE_LLM_API_KEY", "")
        if not api_key:
            raise ValueError("COGNEE_LLM_API_KEY environment variable must be set")
        return cls(
            llm_api_key=api_key,
            llm_endpoint=os.getenv("COGNEE_LLM_ENDPOINT", "https://api.kimi.com/coding"),
            llm_model=os.getenv("COGNEE_LLM_MODEL", "anthropic/k2p5"),
            llm_provider=os.getenv("COGNEE_LLM_PROVIDER", "openai"),
            embedding_provider=os.getenv("COGNEE_EMBEDDING_PROVIDER", "fastembed"),
            embedding_model=os.getenv("COGNEE_EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5"),
            embedding_dimensions=int(os.getenv("COGNEE_EMBEDDING_DIMENSIONS", "768")),
            system_root_directory=os.getenv("COGNEE_SYSTEM_ROOT", "./cognee_data"),
        )
    
    def to_dict(self):
        """Export configuration as dictionary."""
        return {
            "llm": {
                "provider": self.llm_provider,
                "model": self.llm_model,
                "endpoint": self.llm_endpoint,
                "temperature": self.llm_temperature,
                "max_tokens": self.llm_max_tokens,
            },
            "embedding": {
                "provider": self.embedding_provider,
                "model": self.embedding_model,
                "dimensions": self.embedding_dimensions,
            },
            "vector_db": {
                "provider": self.vector_db_provider,
                "url": self.vector_db_url,
            },
            "graph_db": {
                "provider": self.graph_db_provider,
            },
            "system": {
                "root_directory": self.system_root_directory,
                "data_directory": self.data_root_directory,
            }
        }


def ensure_directories(config: CogneeConfig):
    """Ensure all required directories exist."""
    directories = [
        config.system_root_directory,
        config.data_root_directory,
        os.path.join(config.system_root_directory, "databases"),
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
