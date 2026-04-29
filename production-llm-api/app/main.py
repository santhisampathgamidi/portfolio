import os
import json
import logging
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

from .cache import get_cached_response, rate_limit, redis_client, set_cached_response
from .providers import LLMProvider, get_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient()
    yield
    await app.state.http_client.aclose()
    try:
        await redis_client.aclose()
    except Exception:
        pass


app = FastAPI(
    title="Production LLM API",
    description="Streaming LLM API with Redis caching, sliding-window rate limiting, "
    "and a pluggable provider abstraction (Ollama for local, Groq for production).",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip() and o.strip() != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The prompt to send to the LLM.",
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(_request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else {}
    msg = first_error.get("msg", "Invalid request.")
    return JSONResponse(status_code=422, content={"detail": msg})


@app.get("/health")
async def health_check():
    backend = os.getenv("LLM_BACKEND", "ollama").lower()
    redis_ok = False
    try:
        redis_ok = await redis_client.ping()
    except Exception:
        redis_ok = False
    return {"status": "ok", "provider": backend, "redis": bool(redis_ok)}


def _ndjson(payload: dict) -> str:
    return json.dumps(payload) + "\n"


async def _stream_cached(text: str) -> AsyncGenerator[str, None]:
    yield _ndjson({"cached": True, "chunk": ""})
    chunk_size = 24
    for i in range(0, len(text), chunk_size):
        yield _ndjson({"cached": True, "chunk": text[i : i + chunk_size]})
        await asyncio.sleep(0.01)


@app.post("/generate", dependencies=[Depends(rate_limit)])
async def generate(
    request: GenerateRequest,
    provider: LLMProvider = Depends(get_provider),
):
    prompt = request.prompt

    cached = await get_cached_response(prompt)
    if cached:
        return StreamingResponse(_stream_cached(cached), media_type="application/x-ndjson")

    async def stream_and_cache() -> AsyncGenerator[str, None]:
        full_response = ""
        try:
            async for chunk in provider.stream_generate(prompt, app.state.http_client):
                full_response += chunk
                yield _ndjson({"cached": False, "chunk": chunk})
            if full_response:
                await set_cached_response(prompt, full_response)
        except HTTPException as e:
            yield _ndjson({"error": e.detail, "status": e.status_code})
        except Exception as e:
            logger.exception("Unexpected error during streaming")
            yield _ndjson({"error": "Internal error during generation."})

    return StreamingResponse(stream_and_cache(), media_type="application/x-ndjson")
