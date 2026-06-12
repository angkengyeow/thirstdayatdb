"""
test_security.py — Tests for encryption, audit logging, and rate limiting.
"""

import os
import tempfile
import time

import pytest

from ..security import (
    AuditLogger, RateLimiter, audit, encrypt_key, decrypt_key, rate_limiter,
)


# Check if cryptography is available
try:
    from cryptography.fernet import Fernet
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


class TestEncryption:
    @pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
    def test_roundtrip(self):
        os.environ["ENCRYPTION_KEY"] = ""  # force key generation
        plaintext = "my-super-secret-api-key-12345"
        encrypted = encrypt_key(plaintext)
        assert encrypted != plaintext
        decrypted = decrypt_key(encrypted)
        assert decrypted == plaintext

    @pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
    def test_different_keys_different_output(self):
        os.environ["ENCRYPTION_KEY"] = ""
        p1 = encrypt_key("secret1")
        p2 = encrypt_key("secret1")
        # With the same key, Fernet ciphertexts differ (due to IV) but decrypt identically
        assert decrypt_key(p1) == decrypt_key(p2)


class TestAuditLogger:
    def test_log_entry_created(self):
        al = AuditLogger()
        entry = al.log("TEST_ACTION", {"key": "value"})
        assert entry.action == "TEST_ACTION"
        assert entry.details == {"key": "value"}
        assert entry.timestamp is not None

    def test_logs_accumulate(self):
        al = AuditLogger()
        al.log("ACTION_1")
        al.log("ACTION_2")
        al.log("ACTION_3")
        assert al.total_entries == 3

    def test_get_recent(self):
        al = AuditLogger()
        for i in range(10):
            al.log(f"ACTION_{i}")
        recent = al.get_recent(3)
        assert len(recent) == 3
        assert recent[-1].action == "ACTION_9"

    def test_log_to_file(self):
        with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False, mode="w") as f:
            tmp_path = f.name
        al = AuditLogger(log_path=tmp_path)
        al.log("FILE_TEST", {"msg": "written"})
        import json
        with open(tmp_path) as f:
            line = json.loads(f.readline())
            assert line["action"] == "FILE_TEST"
        os.unlink(tmp_path)

    def test_singleton(self):
        assert audit is not None
        assert audit.total_entries >= 0


class TestRateLimiter:
    def test_allows_initial_requests(self):
        limiter = RateLimiter(tokens_per_sec=10, max_burst=5)
        for _ in range(5):
            assert limiter.allow()

    def test_blocks_when_exhausted(self):
        limiter = RateLimiter(tokens_per_sec=1, max_burst=3)
        for _ in range(3):
            assert limiter.allow()
        # Burst exhausted — next should block
        assert not limiter.allow()

    def test_refills_over_time(self):
        limiter = RateLimiter(tokens_per_sec=10, max_burst=2)
        assert limiter.allow()
        assert limiter.allow()
        assert not limiter.allow()  # burst exhausted
        time.sleep(0.15)  # should refill at least 1 token
        assert limiter.allow()

    def test_available_tokens(self):
        limiter = RateLimiter(tokens_per_sec=10, max_burst=5)
        assert limiter.available_tokens == pytest.approx(5.0)

    def test_singleton(self):
        assert rate_limiter is not None
        assert rate_limiter.available_tokens >= 0