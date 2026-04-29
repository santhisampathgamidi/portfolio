from tests.conftest import parse_ndjson


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "provider" in body
    assert "redis" in body


def test_empty_prompt_returns_422(client):
    r = client.post("/generate", json={"prompt": ""})
    assert r.status_code == 422


def test_oversized_prompt_returns_422(client):
    r = client.post("/generate", json={"prompt": "x" * 2001})
    assert r.status_code == 422


def test_streams_tokens_and_caches(client):
    r1 = client.post("/generate", json={"prompt": "hi"})
    assert r1.status_code == 200
    chunks1 = parse_ndjson(r1.content)
    text1 = "".join(c.get("chunk", "") for c in chunks1)
    assert text1 == "hello world"
    assert all(c.get("cached") is False for c in chunks1)

    r2 = client.post("/generate", json={"prompt": "hi"})
    assert r2.status_code == 200
    chunks2 = parse_ndjson(r2.content)
    text2 = "".join(c.get("chunk", "") for c in chunks2)
    assert text2 == "hello world"
    assert any(c.get("cached") is True for c in chunks2)


def test_rate_limit_blocks_after_threshold(client, monkeypatch):
    from app import cache as cache_mod
    monkeypatch.setattr(cache_mod, "RATE_LIMIT", 3)

    for _ in range(3):
        r = client.post("/generate", json={"prompt": "rl-probe"})
        assert r.status_code == 200

    r = client.post("/generate", json={"prompt": "rl-probe-2"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_rate_limit_does_not_grow_window_when_rejected(client, monkeypatch):
    """Regression: rejected requests must NOT be added to the sorted set,
    otherwise the IP stays blocked far longer than RATE_LIMIT/window."""
    from app import cache as cache_mod
    monkeypatch.setattr(cache_mod, "RATE_LIMIT", 2)

    assert client.post("/generate", json={"prompt": "a"}).status_code == 200
    assert client.post("/generate", json={"prompt": "b"}).status_code == 200
    assert client.post("/generate", json={"prompt": "c"}).status_code == 429
    assert client.post("/generate", json={"prompt": "d"}).status_code == 429

    import asyncio
    async def count():
        return await cache_mod.redis_client.zcard("rate_limit:testclient")
    n = asyncio.get_event_loop().run_until_complete(count())
    assert n == 2
