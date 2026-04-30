"""Test fixtures.

The real `sentence-transformers` model would load on first call to embedder.embed
and add ~3s of import + load time per test session. We don't need *real* vectors
to test the API contract — we just need vectors with the right shape — so we
monkey-patch the embedder to return deterministic fakes.
"""
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import embedder as embedder_mod
from app import main as main_mod


@pytest.fixture(autouse=True)
def fake_embedder(monkeypatch):
    def _fake_embed(texts):
        # Deterministic per-text vectors derived from a hash of the text — same
        # input always returns the same vector, so cosine similarity is stable
        # across calls within a test.
        rng = np.random.default_rng(seed=42)
        vectors = []
        for t in texts:
            seed = abs(hash(t)) % (2**32)
            local = np.random.default_rng(seed=seed)
            v = local.standard_normal(embedder_mod.EMBED_DIM).astype(np.float32)
            vectors.append(v)
        # Identical-text query <-> chunk pair will produce identical vectors and
        # therefore cosine = 1.0, which makes search assertions easy.
        _ = rng  # silence linter — kept for future stochastic variants
        return np.stack(vectors), 1.23

    monkeypatch.setattr(embedder_mod, "embed", _fake_embed)
    monkeypatch.setattr(main_mod, "embed", _fake_embed)
    monkeypatch.setattr(embedder_mod, "is_loaded", lambda: True)
    monkeypatch.setattr(main_mod, "is_loaded", lambda: True)


@pytest.fixture
def client():
    with TestClient(main_mod.app) as c:
        yield c
