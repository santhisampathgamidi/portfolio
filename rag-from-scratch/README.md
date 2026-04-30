# RAG From Scratch

Manual chunking, embeddings, and cosine retrieval — **no LangChain, no LlamaIndex, no vector DB**. The educational counterpart to the polished `app/rag-chat/` demo.

Powers the `/rag-scratch` page on the portfolio.

## Endpoints

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `GET`  | `/health` | — | model name, dim, whether weights are loaded |
| `GET`  | `/demo`   | — | preloaded solar-system passage + suggested queries |
| `POST` | `/chunk`  | `{text, chunk_size, overlap}` | character-window chunks with absolute offsets |
| `POST` | `/embed`  | `{texts: [...]}` | per-text vector norm + first 32 dims for the sparkline UI |
| `POST` | `/search` | `{query, chunks, top_k}` | embeds query + chunks, ranks by cosine similarity |

All endpoints are CORS-restricted to `ALLOWED_ORIGINS` (comma-separated, defaults to `http://localhost:3000`).

## Stack

- **FastAPI** + **Pydantic v2**
- **sentence-transformers** `all-MiniLM-L6-v2` (384-dim, ~90MB) — baked into the Docker image so cold starts on Render don't pay a HuggingFace round-trip
- **numpy** for cosine similarity (no FAISS — the math is the lesson)

## Local dev

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

First call to `/embed` or `/search` will load the model (~3s, ~90MB resident).

## Tests

```bash
pip install pytest pytest-asyncio
pytest -q
```

The test suite monkey-patches `embedder.embed` with deterministic fake vectors, so it doesn't need to download the real model. To verify the *real* embedder runs end-to-end, build the Docker image (which bakes in the weights) and curl the live container.

## Deploy (Render)

1. New Web Service → connect this repo → root directory `rag-from-scratch/`
2. Runtime: Docker (the `Dockerfile` in this folder)
3. Set `ALLOWED_ORIGINS` env var to your Vercel URL(s), comma-separated
4. Build will pre-download the model (~30s extra one-time cost), so first request after deploy is fast

Render injects `$PORT` — the Dockerfile uses shell form (`uvicorn ... --port ${PORT:-8000}`) so it expands at runtime. Don't switch to exec form or Render's port detection will fail.
