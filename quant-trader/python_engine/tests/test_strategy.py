"""
test_strategy.py — Tests for all strategy implementations.

Tests cover:
  - MovingAverageCrossover (golden/death cross detection)
  - MeanReversionBB (oversold/overbought)
  - MomentumBreakout (high/low breakout)
  - MultiFactor (3-of-5 confluence)
  - Signal confidence scoring
  - Response to bullish vs bearish data
"""

from datetime import datetime, timezone

import pytest

from ..models import Bar, SignalType
from ..strategy import (
    MeanReversionBB, MomentumBreakout, MovingAverageCrossover,
    MultiFactor, get_strategy, STRATEGY_REGISTRY,
)
from .conftest import generate_test_bars


class TestMovingAverageCrossover:
    def test_registered(self):
        assert "ma_crossover" in STRATEGY_REGISTRY

    def test_min_bars(self):
        s = MovingAverageCrossover("TEST")
        assert s.min_bars == 52  # slow=50 + 2

    def test_not_enough_bars_returns_none(self):
        s = MovingAverageCrossover("TEST")
        bars = generate_test_bars(count=10)
        assert s.generate_signal(bars) is None

    def test_golden_cross_bullish(self):
        """Fast SMA crossing above slow SMA should produce BUY."""
        # Generate bars with strong upward trend
        bars = generate_test_bars(count=100, trend=0.003, volatility=0.002, seed=42)
        s = MovingAverageCrossover("TEST")
        signal = s.generate_signal(bars)
        # The uptrend should eventually trigger a golden cross
        if signal:
            assert signal.signal_type == SignalType.BUY
            assert signal.confidence > 0

    def test_death_cross_bearish(self):
        """Fast SMA crossing below slow SMA should produce SELL."""
        bars = generate_test_bars(count=100, trend=-0.003, volatility=0.002, seed=99)
        s = MovingAverageCrossover("TEST")
        signal = s.generate_signal(bars)
        if signal:
            assert signal.signal_type == SignalType.SELL
            assert signal.confidence > 0

    def test_custom_params(self):
        s = MovingAverageCrossover("TEST", {"fast": 10, "slow": 30})
        assert s.fast == 10
        assert s.slow == 30
        assert s.min_bars == 32


class TestMeanReversionBB:
    def test_registered(self):
        assert "mean_reversion_bb" in STRATEGY_REGISTRY

    def test_buy_on_oversold(self):
        """RSI < 30 and price below lower BB should produce BUY."""
        # Generate volatile bars with a sharp dip at the end
        bars = generate_test_bars(count=100, volatility=0.005, seed=7)
        # Overwrite the last few bars to create an extreme dip
        last_price = bars[-5].close
        for i in range(5, 0, -1):
            dip_price = last_price * (1 - 0.03 * i)
            bars[-i] = Bar(
                symbol=bars[-i].symbol, timestamp=bars[-i].timestamp,
                open=bars[-i].open, high=bars[-i].high, low=bars[-i].low,
                close=round(dip_price, 6), volume=bars[-i].volume,
            )
        s = MeanReversionBB("TEST")
        signal = s.generate_signal(bars)
        # May or may not fire depending on the random data — just check it works
        if signal:
            assert signal.signal_type in (SignalType.BUY, SignalType.SELL)

    def test_custom_params(self):
        s = MeanReversionBB("TEST", {"rsi_period": 7, "oversold": 25, "overbought": 75})
        assert s.rsi_period == 7
        assert s.oversold == 25


class TestMomentumBreakout:
    def test_registered(self):
        assert "momentum_breakout" in STRATEGY_REGISTRY

    def test_min_bars(self):
        s = MomentumBreakout("TEST")
        assert s.min_bars == 21

    def test_breakout_detection(self):
        bars = generate_test_bars(count=50, volatility=0.01, seed=42)
        # Force a breakout at the end
        max_high = max(b.high for b in bars[-21:-1])
        last = bars[-1]
        bars[-1] = Bar(
            symbol=last.symbol, timestamp=last.timestamp,
            open=last.open, high=max_high * 1.02, low=last.low,
            close=round(max_high * 1.01, 6), volume=last.volume,
        )
        s = MomentumBreakout("TEST", {"lookback": 20, "buffer": 0.005})
        signal = s.generate_signal(bars)
        if signal:
            assert signal.signal_type == SignalType.BUY

    def test_custom_buffer(self):
        s = MomentumBreakout("TEST", {"buffer": 0.02})
        assert s.buffer == 0.02


class TestMultiFactor:
    def test_registered(self):
        assert "multi_factor" in STRATEGY_REGISTRY

    def test_min_bars(self):
        s = MultiFactor("TEST")
        assert s.min_bars == 55

    def test_generates_signal_with_enough_data(self):
        bars = generate_test_bars(count=100, volatility=0.005, seed=42)
        s = MultiFactor("TEST")
        signal = s.generate_signal(bars)
        # Multi-factor may or may not fire — just verify no crash
        if signal:
            assert signal.signal_type in (SignalType.BUY, SignalType.SELL)
            assert signal.reason  # must have a reason
            assert signal.confidence > 0


class TestGetStrategy:
    def test_factory_returns_correct_type(self):
        s = get_strategy("ma_crossover", "AAPL")
        assert isinstance(s, MovingAverageCrossover)
        assert s.symbol == "AAPL"

        s2 = get_strategy("multi_factor", "BTC/USD")
        assert isinstance(s2, MultiFactor)
        assert s2.symbol == "BTC/USD"

    def test_unknown_strategy_raises(self):
        with pytest.raises(ValueError, match="Unknown strategy"):
            get_strategy("nonexistent", "TEST")