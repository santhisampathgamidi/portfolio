FROM python:3.11-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render injects $PORT; defaults to 8000 for local dev)
EXPOSE 8000

# Use shell form so ${PORT:-8000} expands at runtime
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
