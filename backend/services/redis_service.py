"""Redis helpers for TraceTrust.

Single connection pool shared across the process lifetime.
All public functions are safe to call from any thread.
"""
import json
from typing import Optional

from redis import ConnectionPool, Redis
from redis.exceptions import RedisError

from config import settings

_IMPACT_TTL = 300  # seconds (5 minutes)

_pool: ConnectionPool = ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
)


def _client() -> Redis:
    """Return a Redis client that borrows a connection from the shared pool."""
    return Redis(connection_pool=_pool)


# ── Impact-score cache ─────────────────────────────────────────────────────────

def get_cached_impact(ngo_id: str) -> Optional[dict]:
    """Return the cached impact dict for *ngo_id*, or None if not cached."""
    raw = _client().get(f"impact:{ngo_id}")
    if raw is None:
        return None
    return json.loads(raw)


def set_cached_impact(ngo_id: str, data: dict) -> None:
    """Serialise *data* to JSON and cache it for 5 minutes."""
    _client().set(f"impact:{ngo_id}", json.dumps(data), ex=_IMPACT_TTL)


def invalidate_impact(ngo_id: str) -> None:
    """Delete the cached impact score for *ngo_id* so the next read recomputes it."""
    _client().delete(f"impact:{ngo_id}")


def get_redis_health() -> bool:
    """Return True if Redis is reachable, False otherwise."""
    try:
        return _client().ping()
    except RedisError:
        return False
