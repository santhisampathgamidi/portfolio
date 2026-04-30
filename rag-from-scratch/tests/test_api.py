import pytest


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model"] == "all-MiniLM-L6-v2"
    assert body["dim"] == 384


def test_demo_returns_text_and_queries(client):
    r = client.get("/demo")
    assert r.status_code == 200
    body = r.json()
    assert len(body["text"]) > 100
    assert len(body["queries"]) >= 3


def test_chunk_basic(client):
    text = "a" * 25  # 25 chars / window=10 / step=10 -> 3 chunks
    r = client.post(
        "/chunk",
        json={"text": text, "chunk_size": 10, "overlap": 0},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["chunk_count"] == 3
    assert body["total_chars"] == 25
    assert [c["chars"] for c in body["chunks"]] == [10, 10, 5]


def test_chunk_rejects_overlap_ge_chunk_size(client):
    r = client.post(
        "/chunk",
        json={"text": "hello world this is long enough", "chunk_size": 10, "overlap": 10},
    )
    assert r.status_code == 422


def test_embed_returns_preview_and_norm(client):
    r = client.post("/embed", json={"texts": ["alpha", "beta"]})
    assert r.status_code == 200
    body = r.json()
    assert body["dim"] == 384
    assert len(body["embeddings"]) == 2
    first = body["embeddings"][0]
    assert first["dim"] == 384
    assert len(first["preview"]) == 32
    assert first["norm"] > 0


def test_search_top_k_and_ranking(client):
    r = client.post(
        "/search",
        json={
            "query": "alpha",
            "chunks": [
                {"id": 0, "text": "alpha"},        # identical to query -> cosine=1
                {"id": 1, "text": "completely different content here"},
                {"id": 2, "text": "another unrelated chunk"},
            ],
            "top_k": 2,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["hits"]) == 2
    assert body["hits"][0]["chunk_id"] == 0
    assert body["hits"][0]["score"] == pytest.approx(1.0, abs=1e-3)
    assert body["hits"][0]["rank"] == 0


def test_search_returns_at_most_chunk_count(client):
    r = client.post(
        "/search",
        json={
            "query": "anything",
            "chunks": [{"id": 0, "text": "only one"}],
            "top_k": 10,
        },
    )
    assert r.status_code == 200
    assert len(r.json()["hits"]) == 1
