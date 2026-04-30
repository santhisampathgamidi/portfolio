"""Lazy-loaded SentenceTransformer singleton.

Loading the model takes a few seconds and ~90MB of memory. We load on first
use rather than at import so:
  - tests can import the module without paying that cost,
  - the FastAPI process starts immediately on Render (lifespan completes fast),
  - the first inbound `/embed` or `/search` triggers the load.

In Docker we pre-pull the weights at build time (see Dockerfile), so first-use
just deserialises from local disk — no network call at runtime.
"""
from __future__ import annotations

import threading
import time
from typing import List, Tuple

import numpy as np

MODEL_NAME = "all-MiniLM-L6-v2"
EMBED_DIM = 384  # documented dim for all-MiniLM-L6-v2

_model = None
_model_lock = threading.Lock()


def get_model():
    """Return the singleton SentenceTransformer, loading it on first call."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                # Imported lazily so module import stays cheap.
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer(MODEL_NAME)
    return _model


def is_loaded() -> bool:
    return _model is not None


def embed(texts: List[str]) -> Tuple[np.ndarray, float]:
    """Embed a batch of texts.

    Returns (matrix of shape (len(texts), EMBED_DIM), elapsed_ms).
    """
    if not texts:
        return np.zeros((0, EMBED_DIM), dtype=np.float32), 0.0

    model = get_model()
    t0 = time.perf_counter()
    vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=False)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return vectors.astype(np.float32), elapsed_ms


def cosine_similarity(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Cosine similarity between a single query vector and each row of `matrix`.

    Implemented manually (no FAISS / no sklearn) because the educational point
    is to show the math.
    """
    if matrix.shape[0] == 0:
        return np.zeros((0,), dtype=np.float32)

    q_norm = np.linalg.norm(query_vec)
    m_norms = np.linalg.norm(matrix, axis=1)
    denom = q_norm * m_norms
    # Guard against zero-norm rows (shouldn't happen with this model, but cheap).
    denom = np.where(denom == 0, 1e-12, denom)
    sims = matrix @ query_vec / denom
    return sims.astype(np.float32)
