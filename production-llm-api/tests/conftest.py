import json
import pytest
import fakeredis.aioredis
from fastapi.testclient import TestClient

from app import cache as cache_mod
from app import main as main_mod
from app.providers import get_provider


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr(cache_mod, "redis_client", fake)
    yield fake


@pytest.fixture
def client(monkeypatch):
    class _Provider:
        async def stream_generate(self, prompt, http_client):
            for token in ["hello", " ", "world"]:
                yield token

    main_mod.app.dependency_overrides[get_provider] = lambda: _Provider()
    with TestClient(main_mod.app) as c:
        yield c
    main_mod.app.dependency_overrides.clear()


def parse_ndjson(body: bytes):
    return [json.loads(line) for line in body.decode().splitlines() if line.strip()]
