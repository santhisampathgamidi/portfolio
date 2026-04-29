# Production LLM API

A production-grade FastAPI service wrapping an LLM with **async streaming**, **Redis sliding-window rate limiting**, **MD5 prompt caching**, and a **pluggable provider abstraction**.

The same FastAPI code runs against a **local Ollama** model (full Docker stack) or a **cloud Groq** endpoint (deployable to Render's free tier) — controlled by a single env var.

## Architecture

```
┌──────────────┐    ┌──────────────────────┐    ┌─────────────┐
│ Next.js UI   │───▶│  FastAPI (httpx)     │───▶│  Provider   │
│  /llm-api    │    │  • CORS              │    │  • Ollama   │
└──────────────┘    │  • Pydantic          │    │  • Groq     │
                    │  • Rate limit (Redis)│    └─────────────┘
                    │  • Cache (Redis)     │           │
                    └──────────────────────┘           │
                              ▲                        │
                              │  NDJSON stream         │
                              └────────────────────────┘
```

## Endpoints

| Method | Path        | Description                                          |
|--------|-------------|------------------------------------------------------|
| GET    | `/health`   | Liveness + provider + Redis status                   |
| POST   | `/generate` | Stream LLM response (NDJSON: `{cached, chunk, ...}`) |
| GET    | `/docs`     | Interactive Swagger UI                               |

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Var                  | Required           | Default                       |
|----------------------|--------------------|-------------------------------|
| `LLM_BACKEND`        | yes                | `ollama`                      |
| `GROQ_API_KEY`       | if backend=groq    | —                             |
| `GROQ_MODEL`         | no                 | `llama-3.3-70b-versatile`     |
| `OLLAMA_MODEL`       | no                 | `llama3.2:1b`                 |
| `REDIS_URL`          | yes (prod)         | local fallback in compose     |
| `RATE_LIMIT`         | no                 | `10` (req / IP / min)         |
| `CACHE_TTL`          | no                 | `3600` (seconds)              |
| `ALLOWED_ORIGINS`    | yes                | `http://localhost:3000`       |

> CORS is strict — wildcards are stripped because they're invalid with `allow_credentials=True`.

## Local development (Docker Compose)

The compose stack runs the API, Redis, Ollama, and a one-shot init container that pulls the model **before** the API starts (no race conditions, no failed first requests):

```bash
cp .env.example .env
docker compose up --build
```

Then open `http://localhost:8000/docs`.

## Production deployment (Render + Upstash + Groq, $0/mo)

1. Create a serverless Redis on **Upstash** → copy the `REDIS_URL`.
2. Get a **Groq** API key.
3. Push this repo to GitHub, then on **Render** → New Web Service → point at `production-llm-api/`.
4. Set environment variables on Render:
   ```
   LLM_BACKEND=groq
   GROQ_API_KEY=...
   REDIS_URL=...
   ALLOWED_ORIGINS=https://your-portfolio.vercel.app
   ```
5. Render polls `/health` for liveness.

## Provider-swap demo

The whole point of the abstraction:

```bash
# Local: Ollama via docker
LLM_BACKEND=ollama docker compose up

# Local: cloud Groq (no Ollama needed)
LLM_BACKEND=groq GROQ_API_KEY=... uvicorn app.main:app --reload
```

Same `/generate` endpoint, same NDJSON stream contract, swappable in 1 env var.

## Tests

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest
```

Tests cover: streaming, NDJSON contract, cache behavior, Pydantic validation (422), rate limiting (429 + `Retry-After` header), and a regression test ensuring rejected requests **don't** grow the sliding window.
