import os
import json
import httpx
import logging
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import AsyncGenerator
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    @abstractmethod
    async def stream_generate(
        self, prompt: str, client: httpx.AsyncClient
    ) -> AsyncGenerator[str, None]:
        ...


class GroqProvider(LLMProvider):
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("GROQ_API_KEY not set; GroqProvider will fail on requests.")
        self.url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    async def stream_generate(self, prompt, client):
        if not self.api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }

        try:
            async with client.stream(
                "POST", self.url, headers=headers, json=payload, timeout=30.0
            ) as response:
                if response.status_code == 429:
                    raise HTTPException(
                        status_code=503,
                        detail="Upstream Groq rate limit hit. Try again shortly.",
                    )
                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(f"Groq error {response.status_code}: {body!r}")
                    raise HTTPException(
                        status_code=502, detail="Upstream LLM provider error."
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        chunk = data["choices"][0]["delta"].get("content", "")
                        if chunk:
                            yield chunk
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
        except httpx.RequestError as e:
            logger.error(f"Groq connection error: {e}")
            raise HTTPException(status_code=503, detail="Failed to connect to Groq.")


class OllamaProvider(LLMProvider):
    def __init__(self):
        self.host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

    async def stream_generate(self, prompt, client):
        url = f"{self.host}/api/generate"
        payload = {"model": self.model, "prompt": prompt, "stream": True}

        try:
            async with client.stream("POST", url, json=payload, timeout=120.0) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(f"Ollama error {response.status_code}: {body!r}")
                    raise HTTPException(status_code=502, detail="Ollama provider error.")

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        chunk = data.get("response", "")
                        if chunk:
                            yield chunk
                    except json.JSONDecodeError:
                        continue
        except httpx.RequestError as e:
            logger.error(f"Ollama connection error: {e}")
            raise HTTPException(
                status_code=503,
                detail="Failed to connect to Ollama. Is the container running?",
            )


@lru_cache(maxsize=1)
def get_provider() -> LLMProvider:
    backend = os.getenv("LLM_BACKEND", "ollama").lower()
    if backend == "groq":
        return GroqProvider()
    return OllamaProvider()
