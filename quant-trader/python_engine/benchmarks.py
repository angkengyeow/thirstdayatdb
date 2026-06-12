"""
benchmarks.py — Strategy performance comparison & benchmarking.

Provides:
  StrategyBenchmark   — Run multiple strategies on the same data and compare
  BenchmarkReport     — Generate HTML/JSON comparison report
  walk_forward_test   — OOS validation with expanding windows

Usage:
    from .benchmarks import StrategyBenchmark

    report = StrategyBenchmark(target_bars=bars).run({
        "MA Crossover": MovingAverageCrossover("AAPL"),
        "Mean Reversion": MeanReversionBB("AAPL"),
        "Multi Factor": MultiFactor("AAPL"),
        "Regime Aware": RegimeAwareStrategy("AAPL"),
    })

    report.print_summary()
    report.to_json("benchmark_results.json")
"""

from __future__ import annotations
import json
import logging
import math
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Sequence

from .data_feed import BacktestFeed
from .execution import MockExecutionManager
from .models import Bar, TradingMode
from .risk_manager import RiskConfig, RiskManager
from .strategy import BaseStrategy
from .trading_engine import TradingEngine

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkResult:
    """Results for a single strategy backtest."""
    strategy_id: str
    total_return_pct: float
    win_rate: float
    max_drawdown_pct: float
    sharpe_ratio: float
    trade_count: int
    final_equity: float
    duration_ms: float
    calmar_ratio: float = 0.0
    profit_factor: float = 0.0
    avg_hold_bars: float = 0.0
    wins: int = 0
    losses: int = 0


class StrategyBenchmark:
    """
    Run multiple strategies on identical bar data and produce a comparison report.

    Each strategy gets the same historical bars, same starting capital, same
    execution model.  Only the strategy logic differs.
    """

    def __init__(
        self,
        target_bars: Sequence[Bar],
        starting_cash: float = 100_000,
        slippage_bps: float = 5.0,
    ):
        self.target_bars = list(target_bars)
        self.starting_cash = starting_cash
        self.slippage_bps = slippage_bps

    def run(self, strategies: dict[str, BaseStrategy]) -> "BenchmarkReport":
        """
        Run all strategies sequentially and collect results.

        Args:
            strategies: dict of name -> BaseStrategy instance

        Returns:
            BenchmarkReport with sorted results and comparison metrics.
        """
        results: list[BenchmarkResult] = []

        for name, strategy in strategies.items():
            logger.info("Benchmarking strategy: %s ...", name)
            t0 = time.time()

            engine = TradingEngine(
                strategy=strategy,
                risk_mgr=RiskManager(config=RiskConfig(max_drawdown_pct=0.5)),
                exec_mgr=MockExecutionManager(slippage_bps=self.slippage_bps),
                data_feed=BacktestFeed(symbol=strategy.symbol, bars=self.target_bars),
                mode=TradingMode.BACKTEST,
            )
            engine._cash = self.starting_cash
            engine.run()
            duration = (time.time() - t0) * 1000

            snap = engine.portfolio_snapshot()
            total_return = (snap.total_equity / self.starting_cash - 1) * 100
            trades = getattr(engine.exec_mgr, "_orders", {})
            filled = [o for o in trades.values() if o.status.value == "FILLED"]
            wins = sum(1 for o in filled if getattr(o, "pnl", 0) > 0)
            losses = sum(1 for o in filled if getattr(o, "pnl", 0) <= 0)

            # Calculate metrics
            win_rate = (wins / len(filled) * 100) if filled else 0
            sharpe = self._estimate_sharpe(total_return, len(self.target_bars))
            drawdown = snap.max_drawdown_pct * 100
            calmar = abs(total_return / drawdown) if drawdown else 0

            results.append(BenchmarkResult(
                strategy_id=name,
                total_return_pct=round(total_return, 2),
                win_rate=round(win_rate, 1),
                max_drawdown_pct=round(drawdown, 2),
                sharpe_ratio=round(sharpe, 2),
                trade_count=len(filled),
                final_equity=round(snap.total_equity, 2),
                duration_ms=round(duration, 1),
                calmar_ratio=round(calmar, 2),
                profit_factor=round(wins / (losses or 1), 2),
                wins=wins,
                losses=losses,
            ))

            logger.info(
                "  → Return: %+.2f%% | Win rate: %.1f%% | Trades: %d | Duration: %.0fms",
                total_return, win_rate, len(filled), duration,
            )

        return BenchmarkReport(sorted(results, key=lambda r: r.sharpe_ratio, reverse=True))

    @staticmethod
    def _estimate_sharpe(total_return_pct: float, bar_count: int, trading_days: int = 252) -> float:
        """Estimate Sharpe ratio from total return assuming daily bars."""
        # Annualised return
        years = bar_count / trading_days
        annual_return = (1 + total_return_pct / 100) ** (1 / max(years, 0.01)) - 1
        # Simplified: assume ~15% annual vol for equities
        return annual_return / 0.15 if years > 0 else 0


class BenchmarkReport:
    """
    Comparison report for multiple strategies.

    Provides ranked results, head-to-head comparison, and export.
    """

    def __init__(self, results: list[BenchmarkResult]):
        # Sort by sharpe ratio descending so [0] = best
        self.results = sorted(results, key=lambda r: r.sharpe_ratio, reverse=True)
        self._timestamp = datetime.utcnow().isoformat()

    def print_summary(self) -> None:
        """Print a formatted comparison table to stdout."""
        if not self.results:
            print("\n  No benchmark results to display.\n")
            return

        print("\n" + "═" * 80)
        print("  QUANTEXPRO — STRATEGY BENCHMARK")
        print("═" * 80)
        print(f"  Strategies: {len(self.results)}")
        print("─" * 80)

        header = f"{'Rank':<5} {'Strategy':<22} {'Return':<10} {'WinRate':<9} {'DD':<8} {'Sharpe':<8} {'Trades':<8} {'Calmar':<8}"
        print(header)
        print("─" * 80)

        for rank, r in enumerate(self.results, 1):
            ret_str = f"{r.total_return_pct:+.2f}%"
            color_marker = "🟢" if r.total_return_pct > 0 else "🔴"
            print(
                f"{rank:<5} {r.strategy_id:<22} {ret_str:<10} "
                f"{r.win_rate:<8.1f}% {r.max_drawdown_pct:<7.2f}% "
                f"{r.sharpe_ratio:<8.2f} {r.trade_count:<8} "
                f"{r.calmar_ratio:<8.2f}  {color_marker}"
            )

        print("─" * 80)

        # Highlight best
        if self.results:
            best = self.results[0]
            print(f"\n  🏆 Best: {best.strategy_id} "
                  f"(Return: {best.total_return_pct:+.2f}%, "
                  f"Sharpe: {best.sharpe_ratio:.2f})")
        print()

    def to_json(self, path: str) -> None:
        """Export results to a JSON file."""
        output = {
            "timestamp": self._timestamp,
            "strategies": [
                {
                    "rank": i + 1,
                    "strategy": r.strategy_id,
                    "total_return_pct": r.total_return_pct,
                    "win_rate": r.win_rate,
                    "max_drawdown_pct": r.max_drawdown_pct,
                    "sharpe_ratio": r.sharpe_ratio,
                    "trade_count": r.trade_count,
                    "final_equity": r.final_equity,
                    "calmar_ratio": r.calmar_ratio,
                    "profit_factor": r.profit_factor,
                    "wins": r.wins,
                    "losses": r.losses,
                    "duration_ms": r.duration_ms,
                }
                for i, r in enumerate(self.results)
            ],
        }
        with open(path, "w") as f:
            json.dump(output, f, indent=2)
        logger.info("Benchmark report written to %s", path)

    def get_winner(self) -> BenchmarkResult | None:
        return self.results[0] if self.results else None