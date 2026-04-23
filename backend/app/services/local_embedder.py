import logging
import os
from fastembed import TextEmbedding

logger = logging.getLogger(__name__)


class LocalEmbedder:
    """
    Singleton wrapper for local embedding models (fastembed).
    Zero-Docker, PyTorch-free, heavily optimized for CPU via ONNX Runtime.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            inst = super(LocalEmbedder, cls).__new__(cls)

            # httpx doesn't support socks:// proxies.
            # Temporarily remove socks env vars during model download.
            # This does NOT affect the system proxy or tun device —
            # only this Python process, and we restore them afterward.
            _socks_keys = ['ALL_PROXY', 'all_proxy']
            _socks_backup = {k: os.environ.pop(k, None) for k in _socks_keys}

            try:
                logger.info("Loading fastembed model (BAAI/bge-base-en-v1.5)...")
                inst.model = TextEmbedding("BAAI/bge-base-en-v1.5")
                logger.info("Model loaded successfully.")
                cls._instance = inst
            except Exception as e:
                logger.error(f"Failed to load fastembed model: {e}")
                cls._instance = None
                raise
            finally:
                for k, v in _socks_backup.items():
                    if v is not None:
                        os.environ[k] = v

        return cls._instance

    def embed_text(self, text: str) -> list[float]:
        """
        Returns a 768-dimensional vector for the input text.
        fastembed returns a generator yielding numpy arrays.
        """
        generator = self.model.embed([text])
        vector = next(generator)
        return vector.tolist()

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Embeds multiple texts efficiently.
        """
        generator = self.model.embed(texts)
        return [v.tolist() for v in generator]
