#!/usr/bin/env python3
"""
main.py — QuantexPro engine entry point.

Usage
─────
# Run a backtest with simulated data
python -m python_engine.main

# Run a backtest from a CSV file
SYMBOL=AAPL TRADING_MODE=BACKTEST python -m python_engine.main --csv data/AAPL_5min.csv

# Run paper trading (Alpaca)
TRADING_MODE=PAPER_TRADE ALPACA_API_KEY=xxx ALPACA_SECRET_KEY=yyy python -m python_engine.main

# Run live trading (Alpaca, real money — use with extreme caution)
TRADING_MODE=LIVE_TRADE ALPACA_PAPER=false ALPACA_API_KEY=xxx ALPACA_SECRET_KEY=yyy python -m python_engine.main

Docker/Production:
  Set environment variables via Docker secrets or AWS Secrets Manager.
  Never pass secrets as CLI arguments (they appear in `ps` output).
"""

from __future__ import annotations
import argparse
import logging
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ── Internal imports ──────────────────────────────────────────────────────────
from .config import cfg
from .models import Bar, TradingMode
from .strategy import get_strategy
from .risk_manager import RiskManager
from .execution import MockExecutionManager, AlpacaExecutionManager
from .data_feed import BacktestFeed, create_feed
from .trading_engine import TradingEngine

logger = logging.getLogger(__name__)


# ─── Synthetic data generator for zero-dependency demo ───────────────────────

def _generate_demo_bars(symbol: str, n: int = 300, seed: int = 42) -> list[Bar]:
    """
    Generates n bars of synthetic OHLCV data for demo/testing purposes.
    Uses a seeded random walk so results are reproducible.
    """
    rng   = random.Random(seed)
    price = {"AAPL": 185.0, "BTC/USD": 67000.0, "TSLA": 250.0}.get(symbol, 100.0)
    vol   = {"AAPL": 0.003, "BTC/USD": 0.008,   "TSLA": 0.006}.get(symbol, 0.003)

    bars  = []
    now   = datetime.now(timezone.utc)
    for i in range(n, 0, -1):
        open_p  = price
        change  = (rng.random() - 0.49) * vol * price
        close_p = max(price + change, 0.01)
        high_p  = max(open_p, close_p) + rng.random() * vol * price * 0.5
        low_p   = min(open_p, close_p) - rng.random() * vol * price * 0.5
        volume  = rng.randint(500, 15_000)
        bars.append(Bar(
            symbol    = symbol,
            timestamp = now - timedelta(minutes=5 * i),
            open      = round(open_p, 4),
            high      = round(high_p, 4),
            low       = round(max(low_p, 0.01), 4),
            close     = round(close_p, 4),
            volume    = float(volume),
        ))
        price = close_p
    return bars


# ─── Main ─────────────────────────────────────────────────────────────────────

def main(csv_path: str | None = None) -> None:
    logger.info("QuantexPro Engine starting | mode=%s | symbol=%s | strategy=%s",
                cfg.mode.value, cfg.symbol, cfg.strategy)

    # ── Strategy ──────────────────────────────────────────────────────────────
    strategy = get_strategy(cfg.strategy, cfg.symbol)
    logger.info("Strategy: %s (min_bars=%d)", strategy.strategy_id, strategy.min_bars)

    # ── Risk Manager ──────────────────────────────────────────────────────────
    risk_mgr = RiskManager(config=cfg.risk)

    # ── Execution Manager ─────────────────────────────────────────────────────
    if cfg.mode == TradingMode.LIVE_TRADE:
        exec_mgr = AlpacaExecutionManager(
            api_key    = cfg.alpaca_api_key,
            secret_key = cfg.alpaca_secret_key,
            paper      = False,
        )
    else:
        # Paper trade AND backtest both use mock execution (no real orders)
        exec_mgr = MockExecutionManager(slippage_bps=5.0)

    # ── Data Feed ─────────────────────────────────────────────────────────────
    if cfg.mode == TradingMode.BACKTEST:
        if csv_path:
            feed = BacktestFeed(symbol=cfg.symbol, csv_path=Path(csv_path))
        else:
            logger.info("No CSV provided — using synthetic demo data")
            demo_bars = _generate_demo_bars(cfg.symbol, n=300)
            feed = BacktestFeed(symbol=cfg.symbol, bars=demo_bars)
    else:
        feed = create_feed(
            mode       = cfg.mode,
            symbol     = cfg.symbol,
            api_key    = cfg.alpaca_api_key,
            secret_key = cfg.alpaca_secret_key,
        )

    # ── Engine ────────────────────────────────────────────────────────────────
    engine = TradingEngine(
        strategy    = strategy,
        risk_mgr    = risk_mgr,
        exec_mgr    = exec_mgr,
        data_feed   = feed,
        mode        = cfg.mode,
        bar_window  = cfg.bar_window,
        heartbeat_s = cfg.heartbeat_s,
    )
    engine._cash = cfg.starting_cash

    # ── Run ───────────────────────────────────────────────────────────────────
    engine.run()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QuantexPro Trading Engine")
    parser.add_argument("--csv", help="Path to OHLCV CSV for backtest mode", default=None)
    args = parser.parse_args()
    main(csv_path=args.csv)
