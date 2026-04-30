FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so they cache across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformers model into the image so cold starts
# on Render don't pay a network round-trip. The model lives in the default
# HuggingFace cache at /root/.cache/huggingface, ~90MB on disk.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

EXPOSE 8000

# Shell form so ${PORT} (Render injects this) expands at runtime.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
