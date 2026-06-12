"""
test_portfolio_manager.py — Tests for cross-asset portfolio management.
"""

from datetime import datetime, timezone
import pytest

from ..models import Bar, Position
from ..portfolio_manager import AssetConfig, PortfolioManager


class TestAssetConfig:
    def test_defaults(self):
        ac = AssetConfig(symbol="AAPL")
        assert ac.symbol == "AAPL"
        assert ac.strategy == "ma_crossover"
        assert ac.strategy_params == {}
        assert ac.allocation_pct == 0.2

    def test_custom(self):
        ac = AssetConfig(
            symbol="BTC/USD",
            strategy="momentum_breakout",
            strategy_params={"lookback": 10},
            allocation_pct=0.5,
        )
        assert ac.strategy == "momentum_breakout"
        assert ac.strategy_params == {"lookback": 10}
        assert ac.allocation_pct == 0.5


class TestPortfolioManager:
    def test_initialization(self):
        assets = [
            AssetConfig("AAPL", "ma_crossover", allocation_pct=0.5),
            AssetConfig("MSFT", "mean_reversion_bb", allocation_pct=0.5),
        ]
        pm = PortfolioManager(assets, starting_cash=100000)
        assert len(pm._engines) == 2
        assert "AAPL" in pm._engines
        assert "MSFT" in pm._engines

    def test_initial_portfolio_snapshot(self):
        assets = [
            AssetConfig("AAPL", "ma_crossover", allocation_pct=0.6),
            AssetConfig("TSLA", "momentum_breakout", allocation_pct=0.4),
        ]
        pm = PortfolioManager(assets, starting_cash=100000)
        snap = pm.portfolio_snapshot()
        assert snap.total_equity == pytest.approx(100000.0, rel=0.01)
        assert snap.cash > 0

    def test_feed_bar(self):
        assets = [
            AssetConfig("AAPL", "ma_crossover", allocation_pct=1.0),
        ]
        pm = PortfolioManager(assets, starting_cash=100000)
        bar = Bar(
            symbol="AAPL", timestamp=datetime.now(timezone.utc),
            open=150.0, high=151.0, low=149.0, close=150.5, volume=10000,
        )
        pm.feed_bar(bar)
        assert len(pm._bar_buffers["AAPL"]) == 1

    def test_correlation_calculation(self):
        assets = [
            AssetConfig("AAPL", allocation_pct=0.5),
            AssetConfig("MSFT", allocation_pct=0.5),
        ]
        pm = PortfolioManager(assets)
        from ..tests.conftest import generate_test_bars

        # Feed bars for both symbols
        for _ in range(60):
            bar1 = Bar(symbol="AAPL", timestamp=datetime.now(timezone.utc),
                       open=150, high=151, low=149, close=150.5, volume=10000)
            bar2 = Bar(symbol="MSFT", timestamp=datetime.now(timezone.utc),
                       open=200, high=201, low=199, close=200.5, volume=10000)
            pm.feed_bar(bar1)
            pm.feed_bar(bar2)

        corr = pm.calculate_correlations()
        assert "AAPL" in corr
        assert "MSFT" in corr
        assert abs(corr["AAPL"]["AAPL"] - 1.0) < 0.01  # self-correlation = 1

    def test_stop(self):
        assets = [AssetConfig("AAPL", allocation_pct=1.0)]
        pm = PortfolioManager(assets)
        pm.stop()
        # Should not crash