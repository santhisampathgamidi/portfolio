"""FastAPI app exposing the four primitives that make up RAG retrieval.

Endpoints are intentionally separate (rather than one mega-`/run`) so the
visualiser can call them independently and *show* each step.
"""
from __future__ import annotations

import logging
import os
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .chunker import chunk_text
from .corpus import DEMO_QUERIES, DEMO_TEXT
from .embedder import EMBED_DIM, MODEL_NAME, cosine_similarity, embed, is_loaded

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Hard limits — the educational demo doesn't need to handle long documents,
# and these caps keep memory + latency predictable on Render's free tier.
MAX_TEXT_CHARS = 20_000
MAX_CHUNKS = 200
MAX_QUERY_CHARS = 500
MAX_TOP_K = 20
MAX_PREVIEW_DIMS = 32

app = FastAPI(
    title="RAG From Scratch",
    description="Manual chunking, embeddings, and cosine retrieval — no frameworks.",
    version="1.0.0",
)

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [
    o.strip() for o in allowed_origins_str.split(",")
    if o.strip() and o.strip() != "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ChunkRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_CHARS)
    chunk_size: int = Field(500, ge=10, le=2000)
    overlap: int = Field(100, ge=0, le=1000)


class ChunkOut(BaseModel):
    id: int
    text: str
    start: int
    end: int
    chars: int


class ChunkResponse(BaseModel):
    chunks: List[ChunkOut]
    chunk_count: int
    total_chars: int


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=MAX_CHUNKS)


class EmbedOut(BaseModel):
    id: int
    dim: int
    norm: float
    preview: List[float]  # first MAX_PREVIEW_DIMS values for the sparkline UI


class EmbedResponse(BaseModel):
    embeddings: List[EmbedOut]
    dim: int
    elapsed_ms: float
    model: str


class SearchChunk(BaseModel):
    id: int
    text: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=MAX_QUERY_CHARS)
    chunks: List[SearchChunk] = Field(..., min_length=1, max_length=MAX_CHUNKS)
    top_k: int = Field(5, ge=1, le=MAX_TOP_K)


class SearchHit(BaseModel):
    chunk_id: int
    score: float
    text: str
    rank: int


class SearchResponse(BaseModel):
    query: str
    hits: List[SearchHit]
    embed_ms: float
    search_ms: float
    model: str


class HealthResponse(BaseModel):
    status: str
    model: str
    dim: int
    model_loaded: bool


class DemoResponse(BaseModel):
    text: str
    queries: List[str]


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model=MODEL_NAME,
        dim=EMBED_DIM,
        model_loaded=is_loaded(),
    )


@app.get("/demo", response_model=DemoResponse)
def demo() -> DemoResponse:
    return DemoResponse(text=DEMO_TEXT, queries=DEMO_QUERIES)


@app.post("/chunk", response_model=ChunkResponse)
def chunk(req: ChunkRequest) -> ChunkResponse:
    if req.overlap >= req.chunk_size:
        raise HTTPException(status_code=422, detail="overlap must be < chunk_size")

    chunks = chunk_text(req.text, req.chunk_size, req.overlap)
    if len(chunks) > MAX_CHUNKS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Configuration would produce {len(chunks)} chunks "
                f"(limit {MAX_CHUNKS}). Increase chunk_size or shorten the text."
            ),
        )
    return ChunkResponse(
        chunks=[ChunkOut(**c.to_dict()) for c in chunks],
        chunk_count=len(chunks),
        total_chars=len(req.text),
    )


@app.post("/embed", response_model=EmbedResponse)
def embed_route(req: EmbedRequest) -> EmbedResponse:
    matrix, elapsed_ms = embed(req.texts)
    embeddings = [
        EmbedOut(
            id=i,
            dim=int(matrix.shape[1]),
            norm=float(np.linalg.norm(row)),
            preview=row[:MAX_PREVIEW_DIMS].tolist(),
        )
        for i, row in enumerate(matrix)
    ]
    return EmbedResponse(
        embeddings=embeddings,
        dim=EMBED_DIM,
        elapsed_ms=round(elapsed_ms, 2),
        model=MODEL_NAME,
    )


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest) -> SearchResponse:
    chunk_texts = [c.text for c in req.chunks]
    chunk_ids = [c.id for c in req.chunks]

    # Embed query + chunks together so we report a single "embed_ms" the user
    # can compare against later /embed-only calls.
    matrix, embed_ms = embed([req.query] + chunk_texts)
    query_vec, chunk_matrix = matrix[0], matrix[1:]

    import time
    t0 = time.perf_counter()
    sims = cosine_similarity(query_vec, chunk_matrix)
    search_ms = (time.perf_counter() - t0) * 1000.0

    top_k = min(req.top_k, len(sims))
    # argsort ascending; take last top_k and reverse for descending order.
    top_idx = np.argsort(sims)[-top_k:][::-1]
    hits = [
        SearchHit(
            chunk_id=chunk_ids[int(i)],
            score=float(sims[int(i)]),
            text=chunk_texts[int(i)],
            rank=rank,
        )
        for rank, i in enumerate(top_idx)
    ]
    return SearchResponse(
        query=req.query,
        hits=hits,
        embed_ms=round(embed_ms, 2),
        search_ms=round(search_ms, 2),
        model=MODEL_NAME,
    )
