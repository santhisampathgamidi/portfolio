import os
import time
import uuid
import hashlib
import logging
from redis.asyncio import Redis
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

redis_url = os.getenv("REDIS_URL")
redis_client = Redis.from_url(redis_url) if redis_url else Redis(host="localhost", port=6379, db=0)

RATE_LIMIT = int(os.getenv("RATE_LIMIT", "10"))
RATE_WINDOW = 60
CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))


def _cache_key(prompt: str) -> str:
    return f"llm_cache:{hashlib.md5(prompt.encode()).hexdigest()}"


async def get_cached_response(prompt: str) -> str | None:
    try:
        cached = await redis_client.get(_cache_key(prompt))
        return cached.decode("utf-8") if cached else None
    except Exception as e:
        logger.warning(f"Redis cache read failed: {e}")
        return None


async def set_cached_response(prompt: str, response: str):
    try:
        await redis_client.setex(_cache_key(prompt), CACHE_TTL, response)
    except Exception as e:
        logger.warning(f"Redis cache write failed: {e}")


async def rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    key = f"rate_limit:{client_ip}"
    now = time.time()
    cutoff = now - RATE_WINDOW

    try:
        async with redis_client.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(key, 0, cutoff)
            pipe.zcard(key)
            results = await pipe.execute()

        current_count = results[1]
        if current_count >= RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded ({RATE_LIMIT}/min). Try again shortly.",
                headers={"Retry-After": str(RATE_WINDOW)},
            )

        member = f"{now}:{uuid.uuid4().hex}"
        async with redis_client.pipeline(transaction=True) as pipe:
            pipe.zadd(key, {member: now})
            pipe.expire(key, RATE_WINDOW)
            await pipe.execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Rate limit check failed (failing open): {e}")
