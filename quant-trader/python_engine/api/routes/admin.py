"""
routes/admin.py — Admin & monitoring endpoints.

Endpoints:
  GET   /health    — Health check
  GET   /metrics   — Prometheus metrics endpoint
  GET   /signals   — Recent signal log
  GET   /rejections — Risk manager rejection log
  GET   /config    — Current engine configuration
"""

from __future__ import annotations
import logging
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from ... import engine_instance as engine
from ...api.schemas import HealthResponse, SignalResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Admin"])

_uptime_start = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    redis_ok = False
    pg_ok = False
    try:
        import redis
        from ...config import cfg
        r = redis.Redis(host=cfg.get("REDIS_HOST", "redis"), port=int(cfg.get("REDIS_PORT", 6379)), socket_connect_timeout=2)
        r.ping()
        redis_ok = True
    except Exception:
        pass
    try:
        from ...db.base import get_session
        with get_session() as s:
            s.execute("SELECT 1")
            pg_ok = True
    except Exception:
        pass

    last_bar_ts = None
    if engine:
        bars = getattr(engine, "_bars", None)
        if bars and len(bars) > 0:
            last_bar_ts = bars[-1].timestamp.isoformat()

    return HealthResponse(
        engine_running=getattr(engine, "_running", False) if engine else False,
        redis_connected=redis_ok,
        postgres_connected=pg_ok,
        uptime_seconds=round(time.time() - _uptime_start, 1),
        last_bar_timestamp=last_bar_ts,
    )


@router.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Prometheus-formatted metrics text."""
    from ...monitoring.metrics import generate_metrics
    return generate_metrics()


@router.get("/signals", response_model=list[SignalResponse])
async def get_signals(limit: int = 50):
    """Return the most recent signal log entries."""
    signals = []
    if engine and hasattr(engine, "_signal_log"):
        sigs = list(engine._signal_log)[-limit:]
        for sig_info in sigs:
            signals.append(SignalResponse(
                timestamp=sig_info.get("timestamp", ""),
                symbol=sig_info.get("symbol", ""),
                signal_type=sig_info.get("signal_type", ""),
                price=sig_info.get("price", 0),
                confidence=sig_info.get("confidence", 0),
                strategy_id=sig_info.get("strategy_id", ""),
                reason=sig_info.get("reason", ""),
                risk_accepted=sig_info.get("risk_accepted", False),
                rejection_reason=sig_info.get("rejection_reason"),
            ))
    return signals[-limit:]


@router.get("/rejections")
async def get_rejections():
    """Risk manager rejection log."""
    if engine and hasattr(engine, "risk_mgr"):
        return engine.risk_mgr.rejection_log
    return []


@router.get("/config")
async def get_config():
    """Current runtime configuration (redacted secrets)."""
    from ...config import cfg
    return {
        "mode": cfg.mode.value,
        "symbol": cfg.symbol,
        "strategy": cfg.strategy,
        "starting_cash": cfg.starting_cash,
        "bar_window": cfg.bar_window,
        "heartbeat_s": cfg.heartbeat_s,
        "risk": {
            "max_drawdown_pct": cfg.risk.max_drawdown_pct,
            "max_position_risk": cfg.risk.max_position_risk,
            "max_portfolio_risk": cfg.risk.max_portfolio_risk,
            "max_open_positions": cfg.risk.max_open_positions,
            "stop_loss_pct": cfg.risk.stop_loss_pct,
            "take_profit_pct": cfg.risk.take_profit_pct,
        },
        "is_live": cfg.is_live,
        "is_paper": cfg.is_paper,
        "is_backtest": cfg.is_backtest,
    }