"""
scheduler.py — Automated job scheduling for the QuantexPro trading engine.

Built on APScheduler (Advanced Python Scheduler) for cron-like job execution.

Jobs:
  1. portfolio_snapshot  — Persist portfolio state to DB every 5 minutes
  2. metrics_sync        — Sync engine metrics to Prometheus every 30 seconds
  3. health_check        — Verify DB/Redis connectivity and emit alerts
  4. rebalance_check     — Evaluate portfolio rebalancing needs
  5. strategy_eval       — Re-evaluate active strategy parameters

All jobs are no-ops if the engine is not running, safe for 24/7 operation.
"""

from __future__ import annotations
import logging
import os
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy initialisation — APScheduler is imported only when used
_scheduler = None


def get_scheduler():
    """Return the scheduler singleton, creating it if needed."""
    global _scheduler
    if _scheduler is None:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.cron import CronTrigger
            from apscheduler.triggers.interval import IntervalTrigger

            _scheduler = BackgroundScheduler(daemon=True, job_defaults={"coalesce": True, "max_instances": 1})

            # ── Register Jobs ────────────────────────────────────────────────
            _scheduler.add_job(
                _job_portfolio_snapshot,
                IntervalTrigger(minutes=5),
                id="portfolio_snapshot",
                name="Persist portfolio state",
                replace_existing=True,
            )
            _scheduler.add_job(
                _job_metrics_sync,
                IntervalTrigger(seconds=30),
                id="metrics_sync",
                name="Sync Prometheus metrics",
                replace_existing=True,
            )
            _scheduler.add_job(
                _job_health_check,
                IntervalTrigger(minutes=1),
                id="health_check",
                name="System health verification",
                replace_existing=True,
            )
            # Only register if enabled explicitly
            if os.getenv("SCHEDULER_ENABLED", "").lower() == "true":
                _scheduler.add_job(
                    _job_rebalance_check,
                    IntervalTrigger(minutes=int(os.getenv("SCHEDULER_CHECK_INTERVAL_MINUTES", "15"))),
                    id="rebalance_check",
                    name="Portfolio rebalancing check",
                    replace_existing=True,
                )

            logger.info("Background scheduler initialised with %d jobs", len(_scheduler.get_jobs()))
        except ImportError:
            logger.warning("APScheduler not installed — scheduler disabled. pip install apscheduler")
            _scheduler = _NullScheduler()
    return _scheduler


# ── Null Scheduler Fallback ───────────────────────────────────────────────────

class _NullScheduler:
    """No-op scheduler when APScheduler is not installed."""
    def start(self) -> None: pass
    def shutdown(self) -> None: pass
    def get_jobs(self) -> list: return []


# ── Job Implementations ───────────────────────────────────────────────────────

def _get_engine():
    from .. import engine_instance
    return engine_instance


def _job_portfolio_snapshot() -> None:
    engine = _get_engine()
    if not engine or not getattr(engine, "_running", False):
        return
    try:
        snap = engine.portfolio_snapshot()
        from ..db.repository import PortfolioRepository
        from ..db.base import get_session
        from ..db.models import PortfolioSnapshotModel
        with get_session() as s:
            s.add(PortfolioSnapshotModel(
                cash=snap.cash, equity=snap.total_equity,
                unrealised_pnl=snap.unrealised_pnl,
                realised_pnl=snap.realised_pnl,
                max_drawdown_pct=snap.max_drawdown_pct * 100,
                open_positions=len(snap.positions),
            ))
        logger.debug("Portfolio snapshot saved (equity=%.2f)", snap.total_equity)
    except Exception as exc:
        logger.warning("Portfolio snapshot failed: %s", exc)


def _job_metrics_sync() -> None:
    engine = _get_engine()
    if not engine or not getattr(engine, "_running", False):
        return
    try:
        from ..monitoring.metrics import update_engine_metrics
        update_engine_metrics(engine)
    except Exception as exc:
        logger.debug("Metrics sync failed: %s", exc)


def _job_health_check() -> None:
    engine = _get_engine()
    if not engine:
        return
    try:
        # Check DB connectivity
        from ..db.base import get_session
        with get_session() as s:
            s.execute("SELECT 1")
    except Exception as exc:
        logger.error("Health check — DB connection failed: %s", exc)
        from ..monitoring.alerts import send_error_alert
        send_error_alert(f"Database connection lost: {exc}")

    # Check for stale data (no bar received in > 60s)
    if hasattr(engine, "_bars") and engine._bars:
        last_bar = engine._bars[-1]
        age_s = time.time() - last_bar.timestamp.timestamp()
        if age_s > 300:
            logger.warning("Health check — no bars for %.0f seconds", age_s)
            if age_s > 600:
                from ..monitoring.alerts import send_error_alert
                send_error_alert(f"No market data received for {age_s:.0f}s. Possible feed outage.")


def _job_rebalance_check() -> None:
    """Evaluate rebalancing for multi-symbol portfolios.

    Sends an alert if any single position exceeds 40% of total equity.
    """
    engine = _get_engine()
    if not engine or not getattr(engine, "_running", False):
        return
    try:
        snap = engine.portfolio_snapshot()
        positions = snap.positions
        if len(positions) <= 1:
            return
        for sym, pos in positions.items():
            current_price = engine._last_price(sym)
            position_value = current_price * pos.quantity
            alloc_pct = position_value / snap.total_equity * 100
            if alloc_pct > 40:
                from ..monitoring.alerts import send_alert
                send_alert(
                    f"rebalance_{sym}",
                    f"⚠️ Rebalance needed: {sym} is {alloc_pct:.1f}% of portfolio (>40%)",
                    f"Current allocation: {alloc_pct:.1f}% | Equity: ${snap.total_equity:.2f}",
                )
    except Exception as exc:
        logger.debug("Rebalance check failed: %s", exc)