"""
metrics.py — Prometheus metrics for the QuantexPro trading engine.

Provides both:
  1. A Prometheus Counter/Gauge/Histogram registry (for /metrics endpoint).
  2. A simple dict-based fallback when prometheus_client isn't installed.

Usage:
    from .metrics import METRICS, generate_metrics
    METRICS["orders_submitted"].inc()
    METRICS["equity"].set(123456.78)
"""

from __future__ import annotations
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


# ─── Metrics Dictionary (fallback + primary tracking) ─────────────────────────

class _Metric:
    def __init__(self, value: float = 0.0):
        self._value = value

    def inc(self, amount: float = 1.0) -> None:
        self._value += amount

    def dec(self, amount: float = 1.0) -> None:
        self._value -= amount

    def set(self, value: float) -> None:
        self._value = value

    def observe(self, value: float) -> None:
        """For histograms/summaries."""
        self._value = value

    @property
    def value(self) -> float:
        return self._value


METRICS: dict[str, _Metric | Any] = {
    # ── Engine ───────────────────────────────────────────────────────────────
    "uptime_seconds": time.time(),
    "tick_count": _Metric(),
    "bars_processed": _Metric(),
    "signals_generated": _Metric(),
    "signals_rejected": _Metric(),
    "orders_submitted": _Metric(),
    "orders_filled": _Metric(),
    "orders_rejected": _Metric(),
    # ── Portfolio ────────────────────────────────────────────────────────────
    "equity": _Metric(),
    "cash": _Metric(),
    "realised_pnl": _Metric(),
    "unrealised_pnl": _Metric(),
    "max_drawdown_pct": _Metric(),
    "open_positions": _Metric(),
    # ── Latency ──────────────────────────────────────────────────────────────
    "signal_latency_ms": _Metric(),
    "order_to_fill_ms": _Metric(),
    # ── Connections ──────────────────────────────────────────────────────────
    "ws_connections": _Metric(),
    # ── Last values (for dashboard labels) ───────────────────────────────────
    "last_signal_type": "",
    "last_signal_price": 0.0,
    "last_strategy": "",
    "last_symbol": "",
}

# Track histogram buckets manually
_histogram_buckets = {
    "signal_latency_bucket": {},
    "order_latency_bucket": {},
}

BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000]


def _inc_bucket(hist_name: str, value_ms: float) -> None:
    for b in BUCKETS:
        if value_ms <= b:
            key = b
            _histogram_buckets.setdefault(hist_name, {})
            _histogram_buckets[hist_name][key] = _histogram_buckets[hist_name].get(key, 0) + 1


def observe_signal_latency(ms: float) -> None:
    METRICS["signal_latency_ms"].observe(ms)
    _inc_bucket("signal_latency_bucket", ms)


def observe_order_latency(ms: float) -> None:
    METRICS["order_to_fill_ms"].observe(ms)
    _inc_bucket("order_latency_bucket", ms)


# ─── Generate Prometheus Text Format ─────────────────────────────────────────

def generate_metrics() -> str:
    """Generate a Prometheus-compatible /metrics response.

    Tries prometheus_client first; falls back to text format from METRICS dict.
    """
    try:
        from prometheus_client import generate_latest, REGISTRY
        return generate_latest(REGISTRY).decode()
    except ImportError:
        pass

    lines = ["# HELP quantex_engine QuantexPro trading engine metrics", "# TYPE quantex_engine gauge"]
    uptime = time.time() - METRICS.get("uptime_seconds", time.time())

    for name, metric in METRICS.items():
        if name == "uptime_seconds":
            continue
        if name in ("last_signal_type", "last_signal_price", "last_strategy", "last_symbol"):
            continue
        if hasattr(metric, "value"):
            lines.append(f"quantex_{name} {metric.value}")

    lines.append(f"quantex_uptime_seconds {uptime}")
    lines.append(f'quantex_last_signal_type{ {METRICS.get("last_signal_type", "")} }')
    lines.append(f'quantex_last_symbol{ {METRICS.get("last_symbol", "")} }')
    return "\n".join(lines) + "\n"


# ─── Update helpers (called from trading_engine) ──────────────────────────────

def update_engine_metrics(engine) -> None:
    """Periodically sync engine state to metrics."""
    snap = engine.portfolio_snapshot()
    METRICS["equity"].set(snap.total_equity)
    METRICS["cash"].set(snap.cash)
    METRICS["realised_pnl"].set(snap.realised_pnl)
    METRICS["unrealised_pnl"].set(snap.unrealised_pnl)
    METRICS["max_drawdown_pct"].set(snap.max_drawdown_pct * 100)
    METRICS["open_positions"].set(len(snap.positions))
    METRICS["tick_count"].inc()
    METRICS["bars_processed"].inc()
    METRICS["last_strategy"] = engine.strategy.strategy_id
    METRICS["last_symbol"] = engine.strategy.symbol