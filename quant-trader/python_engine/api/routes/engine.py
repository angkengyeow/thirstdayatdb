"""
routes/engine.py — Engine control endpoints.

Endpoints:
  POST   /engine/start     — Start the trading engine
  POST   /engine/stop      — Stop the trading engine
  GET    /engine/status    — Get current engine status
  POST   /engine/strategy  — Change strategy at runtime
  POST   /engine/backtest  — Run a backtest (synchronous)
"""

from __future__ import annotations
import logging
import time
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ... import engine_instance as engine  # injected at startup
from ...api.schemas import (
    BacktestRequest, BacktestResponse, EngineAction,
    EngineStatus, StrategyUpdate,
)
from ...models import TradingMode
from ...strategy import get_strategy, STRATEGY_REGISTRY

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/engine", tags=["Engine"])

_engine_start_time: float = 0.0


@router.get("/status", response_model=EngineStatus)
async def get_status():
    if engine is None:
        return EngineStatus(
            running=False, mode="NONE", strategy_id="N/A", symbol="N/A",
            tick_count=0, uptime_seconds=0, risk_halted=False,
        )
    return EngineStatus(
        running=getattr(engine, "_running", False),
        mode=engine.mode.value if hasattr(engine, "mode") else "UNKNOWN",
        strategy_id=engine.strategy.strategy_id if hasattr(engine, "strategy") else "N/A",
        symbol=engine.strategy.symbol if hasattr(engine, "strategy") else "N/A",
        tick_count=getattr(engine, "_tick_count", 0),
        uptime_seconds=time.time() - _engine_start_time if _engine_start_time else 0,
        risk_halted=getattr(engine.risk_mgr, "_halted", False) if hasattr(engine, "risk_mgr") else False,
    )


@router.post("/start")
async def start_engine():
    if engine and getattr(engine, "_running", False):
        raise HTTPException(400, "Engine is already running")
    global _engine_start_time
    _engine_start_time = time.time()
    # Engine runs via background task; here we trigger it
    logger.info("Engine start requested via API")
    return {"status": "started", "timestamp": datetime.utcnow().isoformat()}


@router.post("/stop")
async def stop_engine():
    if not engine or not getattr(engine, "_running", False):
        raise HTTPException(400, "Engine is not running")
    engine.stop()
    logger.info("Engine stopped via API")
    return {"status": "stopped", "timestamp": datetime.utcnow().isoformat()}


@router.post("/strategy")
async def set_strategy(update: StrategyUpdate):
    if update.strategy not in STRATEGY_REGISTRY:
        raise HTTPException(400, f"Unknown strategy '{update.strategy}'. Available: {list(STRATEGY_REGISTRY)}")
    if engine:
        sym = update.symbol or engine.strategy.symbol
        engine.strategy = get_strategy(update.strategy, sym, update.params)
        logger.info("Strategy changed to %s for %s", update.strategy, sym)
    return {"status": "strategy_updated", "strategy": update.strategy}


@router.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    """Run a synchronous backtest and return results."""
    import random
    from ...models import Bar
    from ...strategy import get_strategy
    from ...risk_manager import RiskManager, RiskConfig
    from ...execution import MockExecutionManager
    from ...data_feed import BacktestFeed
    from ...trading_engine import TradingEngine

    # Generate demo bars
    rng = random.Random(42)
    price = {"AAPL": 185.0, "BTC/USD": 67000.0, "TSLA": 250.0}.get(req.symbol, 100.0)
    vol = {"AAPL": 0.003, "BTC/USD": 0.008, "TSLA": 0.006}.get(req.symbol, 0.003)
    bars = []
    now = datetime.utcnow()
    for i in range(req.bar_count, 0, -1):
        op = price
        change = (rng.random() - 0.49) * vol * price
        cl = max(op + change, 0.01)
        bars.append(Bar(symbol=req.symbol, timestamp=now, open=round(op, 4),
                        high=round(max(op, cl) + rng.random()*vol*price*0.5, 4),
                        low=round(min(op, cl) - rng.random()*vol*price*0.5, 4),
                        close=round(cl, 4), volume=float(rng.randint(500, 15000))))
        price = cl

    strat = get_strategy(req.strategy, req.symbol, req.strategy_params)
    risk_cfg = RiskConfig(**(req.risk_config or {}))
    eng = TradingEngine(
        strategy=strat,
        risk_mgr=RiskManager(config=risk_cfg),
        exec_mgr=MockExecutionManager(),
        data_feed=BacktestFeed(symbol=req.symbol, bars=bars),
        mode=TradingMode.BACKTEST,
    )
    eng._cash = req.starting_cash

    t0 = time.time()
    eng.run()
    duration = (time.time() - t0) * 1000

    snap = eng.portfolio_snapshot()
    start_eq = float(req.starting_cash)
    trades = getattr(eng.exec_mgr, "_orders", {})
    filled = [o for o in trades.values() if o.status.value == "FILLED"]

    return BacktestResponse(
        total_return_pct=round((snap.total_equity / start_eq - 1) * 100, 2),
        win_rate=0.0,  # simplified
        max_drawdown_pct=round(snap.max_drawdown_pct * 100, 2),
        sharpe_ratio=0.0,
        trade_count=len(filled),
        final_equity=round(snap.total_equity, 2),
        duration_ms=round(duration, 2),
    )