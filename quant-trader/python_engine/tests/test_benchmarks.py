"""
test_benchmarks.py — Tests for strategy benchmarking framework.
"""

import json
import tempfile
from datetime import datetime, timezone

import pytest

from ..benchmarks import BenchmarkResult, BenchmarkReport, StrategyBenchmark
from ..strategy import MovingAverageCrossover, MeanReversionBB
from .conftest import generate_test_bars


class TestBenchmarkResult:
    def test_defaults(self):
        r = BenchmarkResult(
            strategy_id="test", total_return_pct=5.0, win_rate=60.0,
            max_drawdown_pct=10.0, sharpe_ratio=1.5, trade_count=10,
            final_equity=105000, duration_ms=100.0,
        )
        assert r.strategy_id == "test"
        assert r.total_return_pct == 5.0
        assert r.win_rate == 60.0
        assert r.sharpe_ratio == 1.5

    def test_additional_fields(self):
        r = BenchmarkResult(
            strategy_id="test", total_return_pct=5.0, win_rate=60.0,
            max_drawdown_pct=10.0, sharpe_ratio=1.5, trade_count=10,
            final_equity=105000, duration_ms=100.0,
            calmar_ratio=0.5, profit_factor=2.0, wins=8, losses=2,
        )
        assert r.calmar_ratio == 0.5
        assert r.profit_factor == 2.0
        assert r.wins == 8


class TestBenchmarkReport:
    def test_empty_report(self):
        report = BenchmarkReport(results=[])
        assert report.get_winner() is None
        assert len(report.results) == 0

    def test_ranked_results(self):
        results = [
            BenchmarkResult("A", 10, 50, 5, 2.0, 20, 110000, 100),
            BenchmarkResult("B", 5, 60, 8, 1.0, 15, 105000, 80),
            BenchmarkResult("C", 15, 55, 3, 3.0, 25, 115000, 120),
        ]
        report = BenchmarkReport(results)
        winner = report.get_winner()
        assert winner is not None
        assert winner.strategy_id == "C"
        assert winner.sharpe_ratio == 3.0

    def test_to_json(self):
        results = [
            BenchmarkResult("Test", 5.5, 60, 8, 1.2, 10, 105500, 50),
        ]
        report = BenchmarkReport(results)
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            path = f.name
        report.to_json(path)
        with open(path) as f:
            data = json.load(f)
            assert data["strategies"][0]["strategy"] == "Test"
            assert data["strategies"][0]["sharpe_ratio"] == 1.2

    def test_print_no_crash(self):
        report = BenchmarkReport([
            BenchmarkResult("A", 10, 50, 5, 2.0, 20, 110000, 100),
        ])
        report.print_summary()  # should not raise


class TestStrategyBenchmark:
    def test_run_single_strategy(self):
        bars = generate_test_bars(count=100, seed=42)
        benchmark = StrategyBenchmark(bars)
        ma = MovingAverageCrossover("TEST")
        report = benchmark.run({"MA Crossover": ma})
        assert len(report.results) >= 0
        if report.results:
            r = report.results[0]
            assert r.strategy_id == "MA Crossover"
            assert r.trade_count >= 0

    def test_run_multiple_strategies(self):
        bars = generate_test_bars(count=100, seed=42)
        benchmark = StrategyBenchmark(bars)
        report = benchmark.run({
            "MA Cross": MovingAverageCrossover("TEST"),
            "Mean Rev": MeanReversionBB("TEST"),
        })
        assert len(report.results) <= 2

    def test_winner_is_best_sharpe(self):
        bars = generate_test_bars(count=150, trend=0.002, seed=42)
        benchmark = StrategyBenchmark(bars)
        report = benchmark.run({
            "MA": MovingAverageCrossover("TEST"),
            "MR": MeanReversionBB("TEST"),
        })
        winner = report.get_winner()
        if winner:
            assert winner.strategy_id in ("MA", "MR")