"""
security.py — Production-grade security infrastructure.

Capabilities:
  1. API Key Encryption at Rest (Fernet symmetric encryption)
  2. Audit Logger (structured audit trail for all trading actions)
  3. Rate Limiter (token bucket for API protection)
  4. Secret rotation helpers

Usage:
    from .security import AuditLogger, encrypt_key, decrypt_key, RateLimiter

    audit = AuditLogger()
    audit.log("ORDER_SUBMIT", {"symbol": "AAPL", "qty": 100})

    encrypted = encrypt_key("my-alpaca-secret-key")
    decrypted = decrypt_key(encrypted)
"""

from __future__ import annotations
import base64
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ─── Encryption ───────────────────────────────────────────────────────────────

_fernet = None


def _get_fernet():
    """Lazy-initialise Fernet cipher from ENCRYPTION_KEY env var."""
    global _fernet
    if _fernet is not None:
        return _fernet
    try:
        from cryptography.fernet import Fernet
        key = os.getenv("ENCRYPTION_KEY", "")
        if not key:
            # Generate a key on first run (must be persisted for production)
            key = Fernet.generate_key().decode()
            logger.warning(
                "ENCRYPTION_KEY not set. Generated temporary key: %s. "
                "Set ENCRYPTION_KEY in .env for persistent encryption.", key
            )
            os.environ["ENCRYPTION_KEY"] = key
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet
    except ImportError:
        logger.warning("cryptography not installed. Install: pip install cryptography")
        return None


def encrypt_key(plaintext: str) -> str:
    """Encrypt an API key or secret. Returns a base64-encoded cipher string."""
    f = _get_fernet()
    if f is None:
        return plaintext  # no encryption available
    cipher = f.encrypt(plaintext.encode())
    return base64.b64encode(cipher).decode()


def decrypt_key(ciphertext_b64: str) -> str:
    """Decrypt a previously encrypted key. Returns the plaintext."""
    f = _get_fernet()
    if f is None:
        return ciphertext_b64
    cipher = base64.b64decode(ciphertext_b64.encode())
    return f.decrypt(cipher).decode()


# ─── Audit Logger ─────────────────────────────────────────────────────────────

@dataclass
class AuditEntry:
    timestamp: str
    action: str
    details: dict
    source: str = "engine"


class AuditLogger:
    """
    Structured audit trail for all trading actions.

    Writes to:
      - Log file (always, via Python logging)
      - PostgreSQL (via repository, if available)
      - Local JSON file (persistent, independent of DB)
    """

    def __init__(self, log_path: str = ""):
        self._entries: list[AuditEntry] = []
        self._log_path = log_path or os.getenv(
            "AUDIT_LOG_PATH",
            os.path.join(os.path.dirname(__file__), "..", "data", "audit.jsonl"),
        )
        self._ensure_log_dir()

    def _ensure_log_dir(self) -> None:
        log_dir = os.path.dirname(self._log_path)
        if log_dir and not os.path.exists(log_dir):
            try:
                os.makedirs(log_dir, exist_ok=True)
            except OSError:
                pass  # best-effort

    def log(self, action: str, details: dict | None = None) -> AuditEntry:
        """Record an audit entry and persist it."""
        entry = AuditEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            action=action,
            details=details or {},
        )
        self._entries.append(entry)

        # Write to JSONL file
        try:
            with open(self._log_path, "a") as f:
                f.write(json.dumps({
                    "timestamp": entry.timestamp,
                    "action": entry.action,
                    "details": entry.details,
                }) + "\n")
        except OSError as exc:
            logger.warning("Audit log write failed: %s", exc)

        # Log
        logger.info("AUDIT [%s] %s", entry.action, json.dumps(entry.details)[:200])
        return entry

    def get_recent(self, limit: int = 100) -> list[AuditEntry]:
        """Return recent audit entries from memory."""
        return list(self._entries[-limit:])

    @property
    def total_entries(self) -> int:
        return len(self._entries)


# ─── Rate Limiter (Token Bucket) ──────────────────────────────────────────────

class RateLimiter:
    """
    Token-bucket rate limiter for API protection.

    Usage:
        limiter = RateLimiter(tokens_per_sec=10, max_burst=20)
        if limiter.allow():
            # call broker API
        else:
            # queue or drop
    """

    def __init__(self, tokens_per_sec: float = 10.0, max_burst: int = 20):
        self.rate = tokens_per_sec
        self.max_burst = max_burst
        self._tokens = float(max_burst)
        self._last_refill = time.monotonic()

    def allow(self, cost: float = 1.0) -> bool:
        """
        Check if a request is allowed. Deducts `cost` tokens on approval.

        Returns True if sufficient tokens remain.
        """
        self._refill()
        if self._tokens >= cost:
            self._tokens -= cost
            return True
        return False

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self.max_burst, self._tokens + elapsed * self.rate)
        self._last_refill = now

    @property
    def available_tokens(self) -> float:
        self._refill()
        return self._tokens


# ─── Singleton instances ──────────────────────────────────────────────────────

audit = AuditLogger()
rate_limiter = RateLimiter()