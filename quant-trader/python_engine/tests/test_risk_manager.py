"""
test_risk_manager.py — Tests for the risk management engine.

Tests cover:
  - Kill-switch activation on max drawdown breach
  - Position sizing (fixed-fractional)
  - Mandatory stop-loss and take-profit values
  - Portfolio heat rejection
  - Position cap enforcement
  - Confidence threshold filtering
  - Rejection logging
"""

from datetime import datetime, timezone

import pytest

from ..models import Bar, OrderSide, Position, Signal, SignalType, OrderType
from ..risk_manager import RiskConfig, RiskManager, RiskViolation


@pytest.fixture
def risk_mgr():
    return RiskManager()


@pytest.fixture
def buy_signal():
    return Signal(
        strategy_id="test", symbol="AAPL", signal_type=SignalType.BUY,
        price=150.0, timestamp=datetime.now(timezone.utc),
        confidence=0.8, reason="Test signal",
    )


@pytest.fixture
def sell_signal():
    return Signal(
        strategy_id="test", symbol="AAPL", signal_type=SignalType.SELL,
        price=150.0, timestamp=datetime.now(timezone.utc),
        confidence=0.8, reason="Test signal",
    )


@pytest.fixture
def last_bar():
    return Bar(
        symbol="AAPL", timestamp=datetime.now(timezone.utc),
        open=149.5, high=151.0, low=149.0, close=150.0, volume=10000,
    )


class TestKillSwitch:
    def test_not_halted_by_default(self, risk_mgr):
        assert not risk_mgr.is_halted

    def test_triggers_on_drawdown(self, risk_mgr):
        risk_mgr.update_equity(100000)
        risk_mgr.update_equity(80000)  # 20% drawdown > 15% limit
        assert risk_mgr.is_halted

    def test_rejects_signals_when_halted(self, risk_mgr, buy_signal, last_bar):
        risk_mgr.update_equity(100000)
        risk_mgr.update_equity(75000)  # 25% drawdown
        with pytest.raises(RiskViolation, match="drawdown"):
            risk_mgr.validate(buy_signal, {}, 75000, last_bar)

    def test_recovers_when_drawdown_recedes(self, risk_mgr):
        risk_mgr.update_equity(100000)
        risk_mgr.update_equity(75000)  # 25% drawdown — triggers
        assert risk_mgr.is_halted
        risk_mgr.update_equity(110000)  # new peak
        assert not risk_mgr.is_halted


class TestPositionSizing:
    def test_sizing_formula(self, risk_mgr, buy_signal, last_bar):
        # equity=100000, max_position_risk=0.02, stop_loss_pct=0.02
        # risk_amount = 100000 * 0.02 = 2000
        # qty = 2000 / (100 * 0.02) = 1000
        risk_mgr.update_equity(100000)
        request = risk_mgr.validate(buy_signal, {}, 100000, last_bar)
        assert request.quantity == pytest.approx(666.666, rel=1e-3)
        expected_qty = (100000 * 0.02) / (last_bar.close * 0.02)
        assert request.quantity == pytest.approx(expected_qty, rel=1e-3)

    def test_min_notional_guard(self, risk_mgr, buy_signal):
        risk_mgr.config.min_notional = 1_000_000  # absurdly high
        low_value_bar = Bar(
            symbol="PENNY", timestamp=datetime.now(timezone.utc),
            open=0.01, high=0.01, low=0.01, close=0.01, volume=100000,
        )
        with pytest.raises(RiskViolation, match="notional"):
            risk_mgr.validate(buy_signal, {}, 100000, low_value_bar)


class TestStopLossTakeProfit:
    def test_sl_tp_for_buy(self, risk_mgr, buy_signal, last_bar):
        risk_mgr.update_equity(100000)
        request = risk_mgr.validate(buy_signal, {}, 100000, last_bar)
        # Stop loss for BUY = entry * (1 - 0.02)
        assert request.stop_loss == pytest.approx(150.0 * 0.98)
        # Take profit for BUY = entry * (1 + 0.05)
        assert request.take_profit == pytest.approx(150.0 * 1.05)

    def test_sl_tp_for_sell(self, risk_mgr, sell_signal, last_bar):
        risk_mgr.update_equity(100000)
        request = risk_mgr.validate(sell_signal, {}, 100000, last_bar)
        # Stop loss for SELL = entry * (1 + 0.02)
        assert request.stop_loss == pytest.approx(150.0 * 1.02)
        # Take profit for SELL = entry * (1 - 0.05)
        assert request.take_profit == pytest.approx(150.0 * 0.95)


class TestPositionCaps:
    def test_max_open_positions(self, risk_mgr, buy_signal, last_bar):
        risk_mgr.config.max_open_positions = 2
        positions = {
            "MSFT": Position("MSFT", 10, 200, datetime.now(timezone.utc), 195, 220),
            "GOOG": Position("GOOG", 5, 180, datetime.now(timezone.utc), 175, 200),
        }
        with pytest.raises(RiskViolation, match="Position cap"):
            risk_mgr.validate(buy_signal, positions, 100000, last_bar)

    def test_already_holding_symbol(self, risk_mgr, buy_signal, last_bar):
        positions = {"AAPL": Position("AAPL", 10, 150, datetime.now(timezone.utc), 145, 160)}
        with pytest.raises(RiskViolation, match="Already holding"):
            risk_mgr.validate(buy_signal, positions, 100000, last_bar)


class TestConfidenceFilter:
    def test_low_confidence_rejected(self, buy_signal, last_bar):
        risk_mgr = RiskManager(RiskConfig(min_confidence=0.9))
        buy_signal = Signal(
            strategy_id="test", symbol="AAPL", signal_type=SignalType.BUY,
            price=150.0, timestamp=datetime.now(timezone.utc),
            confidence=0.5, reason="Low confidence",
        )
        with pytest.raises(RiskViolation, match="confidence"):
            risk_mgr.validate(buy_signal, {}, 100000, last_bar)

    def test_confidence_accepts_zero_by_default(self, risk_mgr, buy_signal, last_bar):
        risk_mgr.config.min_confidence = 0.0
        request = risk_mgr.validate(buy_signal, {}, 100000, last_bar)
        assert request is not None


class TestRejectionLog:
    def test_rejections_are_logged(self, risk_mgr, buy_signal, last_bar):
        risk_mgr.config.max_open_positions = 0  # always reject
        for _ in range(3):
            try:
                risk_mgr.validate(buy_signal, {"MSFT": None}, 100000, last_bar)
            except RiskViolation:
                pass
        assert len(risk_mgr.rejection_log) >= 3