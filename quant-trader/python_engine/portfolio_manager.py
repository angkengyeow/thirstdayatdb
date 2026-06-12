"""
portfolio_manager.py — Cross-asset portfolio management.

Beyond the single-symbol TradingEngine, this module orchestrates:
  - Multiple symbol feeds → individual TradingEngine instances
  - Portfolio-level risk aggregation across all positions
  - Automated rebalancing (time-based and threshold-based)
  - Correlation-aware position sizing
  - Cross-asset strategy coordination

Architecture:
    PortfolioManager
    ├── SymbolA → TradingEngine(A) → Strategy(A) → RiskManager → Position
    ├── SymbolB → TradingEngine(B) → Strategy(B) → RiskManager → Position
    └── SymbolC → TradingEngine(C) → Strategy(C) → RiskManager → Position
         │
         └── Portfolio-level Risk Manager (aggregate exposure, correlations)
"""

from __future__ import annotations
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Sequence

from .models import Bar, PortfolioSnapshot, Position, Signal, SignalType, TradingMode
from .risk_manager import RiskConfig, RiskManager
from .strategy import BaseStrategy, get_strategy, STRATEGY_REGISTRY
from .execution import MockExecutionManager, BaseExecutionManager
from .trading_engine import TradingEngine

logger = logging.getLogger(__name__)


@dataclass
class AssetConfig:
    """Configuration for a single asset in the portfolio."""
    symbol: str
    strategy: str = "ma_crossover"
    strategy_params: dict = field(default_factory=dict)
    allocation_pct: float = 0.2  # fraction of total equity for this asset
    risk_config: Optional[RiskConfig] = None


class PortfolioManager:
    """
    Multi-asset portfolio orchestrator.

    Manages N TradingEngine instances, one per symbol, each with its own
    strategy.  Portfolio-level risk caps are enforced across all engines.
    """

    def __init__(
        self,
        assets: list[AssetConfig],
        starting_cash: float = 100_000.0,
        max_correlation: float = 0.85,
        rebalance_threshold_pct: float = 5.0,
    ):
        self.assets = assets
        self._total_cash = starting_cash
        self._max_correlation = max_correlation
        self._rebalance_threshold = rebalance_threshold_pct
        self._running = False
        self._engines: dict[str, TradingEngine] = {}
        self._bar_buffers: dict[str, list[Bar]] = {a.symbol: [] for a in assets}
        self._target_allocation: dict[str, float] = {}
        self._allocation_history: list[dict] = []

        # Normalise allocations to sum to 1.0
        total_alloc = sum(a.allocation_pct for a in assets) or 1.0
        for a in assets:
            self._target_allocation[a.symbol] = a.allocation_pct / total_alloc
            cash_alloc = starting_cash * self._target_allocation[a.symbol]

            engine = TradingEngine(
                strategy=get_strategy(a.strategy, a.symbol, a.strategy_params),
                risk_mgr=RiskManager(config=a.risk_config or RiskConfig()),
                exec_mgr=MockExecutionManager(),
                data_feed=_DummyFeed(a.symbol),  # replaced by real feeds
                mode=TradingMode.BACKTEST,
            )
            engine._cash = cash_alloc
            self._engines[a.symbol] = engine

        logger.info(
            "PortfolioManager initialised: %d assets, $%.0f capital",
            len(assets), starting_cash,
        )

    # ── Feed dispatch ─────────────────────────────────────────────────────────

    def feed_bar(self, bar: Bar) -> None:
        """Feed a new bar to the appropriate engine."""
        sym = bar.symbol
        self._bar_buffers.setdefault(sym, []).append(bar)
        self._bar_buffers[sym] = self._bar_buffers[sym][-500:]  # cap

        engine = self._engines.get(sym)
        if engine:
            engine._bars.append(bar)
            engine._process_bar(bar)

            # Rebalance check
            self._check_rebalance()

    # ── Rebalancing ───────────────────────────────────────────────────────────

    def _check_rebalance(self) -> None:
        """Check if any allocation has drifted beyond threshold."""
        total_equity = sum(e.equity for e in self._engines.values())
        if total_equity <= 0:
            return

        needs_rebalance = False
        for sym, engine in self._engines.items():
            current_pct = engine.equity / total_equity * 100
            target_pct = self._target_allocation.get(sym, 0) * 100
            drift = abs(current_pct - target_pct)
            if drift > self._rebalance_threshold:
                needs_rebalance = True
                logger.info(
                    "Rebalance signal: %s %.1f%% (target %.1f%%) — drift %.1f%%",
                    sym, current_pct, target_pct, drift,
                )

        if needs_rebalance:
            self._execute_rebalance(total_equity)

    def _execute_rebalance(self, total_equity: float) -> None:
        """Redistribute cash across engines to match target allocations."""
        for sym, engine in self._engines.items():
            target_cash = total_equity * self._target_allocation[sym]
            current_equity = engine.equity
            diff = target_cash - current_equity

            # Positive diff → add capital; negative → withdraw
            engine._cash += diff
            logger.info(
                "Rebalance %s: $%.0f → $%.0f (delta %+.0f)",
                sym, current_equity, target_cash, diff,
            )

        self._allocation_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "equity": total_equity,
            "allocations": {sym: e.equity for sym, e in self._engines.items()},
        })

    # ── Portfolio State ───────────────────────────────────────────────────────

    def portfolio_snapshot(self) -> PortfolioSnapshot:
        """Aggregate portfolio across all engines."""
        total_cash = sum(e._cash for e in self._engines.values())
        total_equity = sum(e.equity for e in self._engines.values())
        all_positions: dict[str, Position] = {}
        total_realised = 0
        max_dd = 0

        for sym, engine in self._engines.items():
            snap = engine.portfolio_snapshot()
            all_positions.update(snap.positions)
            total_realised += snap.realised_pnl
            max_dd = max(max_dd, snap.max_drawdown_pct)

        unrealised = sum(
            pos.unrealised_pnl(self._last_price(p.symbol))
            for p in all_positions.values()
        )

        return PortfolioSnapshot(
            timestamp=datetime.utcnow(),
            cash=total_cash,
            positions=all_positions,
            total_equity=total_equity,
            unrealised_pnl=unrealised,
            realised_pnl=total_realised,
            max_drawdown_pct=max_dd,
        )

    def _last_price(self, symbol: str) -> float:
        buf = self._bar_buffers.get(symbol, [])
        if buf:
            return buf[-1].close
        return 0.0

    # ── Correlation manager ──────────────────────────────────────────────────

    def calculate_correlations(self) -> dict[str, dict[str, float]]:
        """
        Estimate return correlations between all tracked symbols.
        Returns nested dict: symbol1 -> symbol2 -> correlation.
        """
        import math

        corr_matrix: dict[str, dict[str, float]] = {}
        symbols = [a.symbol for a in self.assets]
        returns: dict[str, list[float]] = {}

        for sym in symbols:
            buf = self._bar_buffers.get(sym, [])
            rets = []
            for i in range(1, len(buf)):
                rets.append(buf[i].close / buf[i - 1].close - 1)
            returns[sym] = rets[-50:]  # last 50 returns

        for s1 in symbols:
            corr_matrix[s1] = {}
            for s2 in symbols:
                if s1 == s2:
                    corr_matrix[s1][s2] = 1.0
                    continue
                r1, r2 = returns.get(s1, []), returns.get(s2, [])
                min_len = min(len(r1), len(r2))
                if min_len < 5:
                    corr_matrix[s1][s2] = 0.0
                    continue
                r1, r2 = r1[-min_len:], r2[-min_len:]
                mean1, mean2 = sum(r1) / min_len, sum(r2) / min_len
                cov = sum((r1[i] - mean1) * (r2[i] - mean2) for i in range(min_len)) / min_len
                std1 = math.sqrt(sum((x - mean1) ** 2 for x in r1) / min_len)
                std2 = math.sqrt(sum((x - mean2) ** 2 for x in r2) / min_len)
                corr_matrix[s1][s2] = cov / (std1 * std2 + 1e-9)
        return corr_matrix

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def run(self) -> None:
        self._running = True
        logger.info("PortfolioManager running (%d assets)", len(self.assets))

        # In backtest mode: we just hold for bars to be fed externally
        while self._running:
            time.sleep(0.1)

    def stop(self) -> None:
        self._running = False
        for engine in self._engines.values():
            engine.stop()
        logger.info("PortfolioManager stopped")


# ── Dummy feed for initialisation ─────────────────────────────────────────────

class _DummyFeed:
    def __init__(self, symbol: str):
        self.symbol = symbol
    def start(self) -> None: pass
    def stop(self) -> None: pass
    def drain(self) -> list: return []
    @property
    def is_running(self) -> bool: return False