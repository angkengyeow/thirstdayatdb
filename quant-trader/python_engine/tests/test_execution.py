"""
test_execution.py — Tests for order execution managers.

Tests cover:
  - MockExecutionManager: MARKET order immediate fill
  - MockExecutionManager: slippage model
  - MockExecutionManager: LIMIT order queue & fill
  - Order lifecycle: PENDING → SUBMITTED → FILLED
  - Cancel pending order
  - Fill callback invocation
"""

from datetime import datetime, timezone

import pytest

from ..execution import MockExecutionManager
from ..models import (
    OrderRequest, OrderSide, OrderStatus, OrderType, Signal, SignalType,
)


@pytest.fixture
def buy_signal():
    return Signal(
        strategy_id="test", symbol="AAPL", signal_type=SignalType.BUY,
        price=150.0, timestamp=datetime.now(timezone.utc),
        confidence=0.8, reason="Test",
    )


@pytest.fixture
def buy_request(buy_signal):
    return OrderRequest(
        symbol="AAPL", side=OrderSide.BUY, order_type=OrderType.MARKET,
        quantity=100, limit_price=None, stop_loss=145.0, take_profit=160.0,
        signal_ref=buy_signal,
    )


class TestMarketOrder:
    def test_immediate_fill(self, buy_request):
        mgr = MockExecutionManager()
        mgr.update_price("AAPL", 150.0)
        order = mgr.submit(buy_request)
        assert order.status == OrderStatus.FILLED
        assert order.filled_qty == 100
        assert order.avg_fill_price is not None
        assert order.order_id is not None

    def test_slippage_applied(self, buy_request):
        mgr = MockExecutionManager(slippage_bps=50.0)  # 50 bps = 0.5%
        mgr.update_price("AAPL", 100.0)
        order = mgr.submit(buy_request)
        # Buy slippage: price should be higher than 100
        assert order.avg_fill_price > 100.0
        # 100 * (1 + 0.005) = 100.5
        assert order.avg_fill_price == pytest.approx(100.5)

    def test_order_lifecycle(self, buy_request):
        mgr = MockExecutionManager()
        mgr.update_price("AAPL", 150.0)
        order = mgr.submit(buy_request)
        assert order.status == OrderStatus.FILLED
        assert order.filled_at is not None
        assert order.submitted_at is not None


class TestLimitOrder:
    def test_limit_not_filled_below_limit(self, buy_signal):
        request = OrderRequest(
            symbol="AAPL", side=OrderSide.BUY, order_type=OrderType.LIMIT,
            quantity=100, limit_price=140.0, stop_loss=135.0, take_profit=155.0,
            signal_ref=buy_signal,
        )
        mgr = MockExecutionManager()
        mgr.update_price("AAPL", 150.0)  # price above limit
        order = mgr.submit(request)
        assert order.status == OrderStatus.SUBMITTED  # not yet filled

    def test_limit_fills_when_price_hits(self, buy_signal):
        request = OrderRequest(
            symbol="AAPL", side=OrderSide.BUY, order_type=OrderType.LIMIT,
            quantity=100, limit_price=150.0, stop_loss=145.0, take_profit=160.0,
            signal_ref=buy_signal,
        )
        mgr = MockExecutionManager()
        mgr.update_price("AAPL", 155.0)  # above limit
        order = mgr.submit(request)
        assert order.status == OrderStatus.SUBMITTED
        mgr.update_price("AAPL", 150.0)  # hits limit
        assert order.status == OrderStatus.FILLED


class TestCancellation:
    def test_cancel_pending(self, buy_signal):
        request = OrderRequest(
            symbol="AAPL", side=OrderSide.BUY, order_type=OrderType.LIMIT,
            quantity=100, limit_price=140.0, stop_loss=135.0, take_profit=155.0,
            signal_ref=buy_signal,
        )
        mgr = MockExecutionManager()
        mgr.update_price("AAPL", 150.0)
        order = mgr.submit(request)
        assert mgr.cancel(order.order_id)
        assert order.status == OrderStatus.CANCELLED

    def test_cancel_filled_noop(self, buy_request):
        mgr = MockExecutionManager()
        mgr.update_price("AAPL", 150.0)
        order = mgr.submit(buy_request)
        assert not mgr.cancel(order.order_id)  # can't cancel a filled order


class TestFillCallback:
    def test_callback_invoked(self, buy_request):
        calls = []
        mgr = MockExecutionManager(on_fill=lambda o: calls.append(o))
        mgr.update_price("AAPL", 150.0)
        mgr.submit(buy_request)
        assert len(calls) == 1
        assert calls[0].status == OrderStatus.FILLED

    def test_callback_registration(self, buy_request):
        calls = []
        mgr = MockExecutionManager()
        mgr.register_fill_callback(lambda o: calls.append(o))
        mgr.update_price("AAPL", 150.0)
        mgr.submit(buy_request)
        assert len(calls) == 1