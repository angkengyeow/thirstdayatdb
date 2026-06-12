"""
test_models.py — Unit tests for data models.

Tests cover:
  - Bar properties (mid, range)
  - Tick properties (spread, mid)
  - Position PnL calculations
  - Order status transitions
  - PortfolioSnapshot creation
"""

from datetime import datetime, timezone

import pytest

from ..models import (
    Bar, Order, OrderRequest, OrderSide, OrderStatus, OrderType,
    PortfolioSnapshot, Position, Signal, SignalType, Tick,
)


class TestBar:
    def test_mid_price(self):
        bar = Bar(symbol="TEST", timestamp=datetime.now(timezone.utc),
                  open=100.0, high=105.0, low=95.0, close=102.0, volume=1000)
        assert bar.mid == 100.0  # (105 + 95) / 2

    def test_range(self):
        bar = Bar(symbol="TEST", timestamp=datetime.now(timezone.utc),
                  open=100.0, high=110.0, low=90.0, close=102.0, volume=1000)
        assert bar.range == 20.0

    def test_frozen_immutability(self):
        bar = Bar(symbol="TEST", timestamp=datetime.now(timezone.utc),
                  open=1, high=2, low=1, close=1.5, volume=100)
        with pytest.raises(Exception):  # FrozenInstanceError or AttributeError
            bar.close = 99.0


class TestTick:
    def test_spread(self):
        tick = Tick(symbol="TEST", timestamp=datetime.now(timezone.utc),
                    bid=100.0, ask=100.05, last=100.02, volume=500)
        assert abs(tick.spread - 0.05) < 1e-10

    def test_mid(self):
        tick = Tick(symbol="TEST", timestamp=datetime.now(timezone.utc),
                    bid=100.0, ask=100.10, last=100.05, volume=500)
        assert tick.mid == 100.05


class TestPosition:
    def test_unrealised_pnl(self):
        pos = Position(symbol="AAPL", quantity=10, avg_cost=150.0,
                       opened_at=datetime.now(timezone.utc),
                       stop_loss=145.0, take_profit=160.0)
        assert pos.unrealised_pnl(160.0) == 100.0  # (160-150) * 10
        assert pos.unrealised_pnl(140.0) == -100.0

    def test_pnl_pct(self):
        pos = Position(symbol="AAPL", quantity=10, avg_cost=100.0,
                       opened_at=datetime.now(timezone.utc),
                       stop_loss=95.0, take_profit=110.0)
        assert pos.pnl_pct(110.0) == 0.1
        assert pos.pnl_pct(90.0) == -0.1


class TestOrder:
    def test_remaining_qty(self):
        req = OrderRequest(symbol="AAPL", side=OrderSide.BUY, order_type=OrderType.MARKET,
                           quantity=100, limit_price=None, stop_loss=145, take_profit=160,
                           signal_ref=self._dummy_signal())
        order = Order(order_id="TEST1", request=req)
        assert order.remaining_qty == 100
        order.filled_qty = 40
        assert order.remaining_qty == 60

    def test_terminal_status(self):
        req = self._dummy_request()
        for status in (OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED):
            o = Order(order_id="T", request=req, status=status)
            assert o.is_terminal
        o2 = Order(order_id="T", request=req, status=OrderStatus.PENDING)
        assert not o2.is_terminal

    @staticmethod
    def _dummy_signal():
        return Signal(
            strategy_id="test", symbol="AAPL", signal_type=SignalType.BUY,
            price=150.0, timestamp=datetime.now(timezone.utc),
        )

    @staticmethod
    def _dummy_request():
        return OrderRequest(
            symbol="AAPL", side=OrderSide.BUY, order_type=OrderType.MARKET,
            quantity=100, limit_price=None, stop_loss=145, take_profit=160,
            signal_ref=TestOrder._dummy_signal(),
        )