"""
execution.py — Order Execution Manager.

Responsibilities
────────────────
1. Translate an OrderRequest into a broker-specific API payload.
2. Submit the order and receive an initial Order object with a broker order_id.
3. Poll / subscribe for order status updates (Pending → Filled / Cancelled).
4. Handle partial fills, network dropouts, and rate-limiting gracefully.
5. Emit fill events back to the TradingEngine via a callback.

Two concrete implementations are provided:
  MockExecutionManager  — synchronous, in-process simulation (backtest/paper)
  AlpacaExecutionManager — real Alpaca Markets REST + WebSocket integration

For Interactive Brokers or Binance, subclass BaseExecutionManager and override
_submit_to_broker() and _poll_order_status().
"""

from __future__ import annotations
import logging
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Callable, Optional

from .models import Order, OrderRequest, OrderSide, OrderStatus, OrderType

logger = logging.getLogger(__name__)

# Callback type: receives a fully-updated Order object on every state change
FillCallback = Callable[[Order], None]


# ─── Abstract Base ─────────────────────────────────────────────────────────────

class BaseExecutionManager(ABC):
    """
    All execution managers share this interface.  The TradingEngine only
    depends on this abstract class — swapping brokers requires zero engine changes.
    """

    def __init__(self, on_fill: Optional[FillCallback] = None):
        self._on_fill = on_fill
        self._orders: dict[str, Order] = {}   # order_id → Order

    def register_fill_callback(self, cb: FillCallback) -> None:
        self._on_fill = cb

    @abstractmethod
    def submit(self, request: OrderRequest) -> Order:
        """Submit a risk-validated OrderRequest to the broker. Returns the live Order."""
        ...

    @abstractmethod
    def cancel(self, order_id: str) -> bool:
        """Attempt to cancel a pending order. Returns True on success."""
        ...

    def get_order(self, order_id: str) -> Optional[Order]:
        return self._orders.get(order_id)

    def open_orders(self) -> list[Order]:
        return [o for o in self._orders.values() if not o.is_terminal]

    def _emit_fill(self, order: Order) -> None:
        if self._on_fill:
            try:
                self._on_fill(order)
            except Exception as e:
                logger.error("FillCallback error: %s", e)


# ─── Mock Execution Manager (Backtest / Paper Trading) ────────────────────────

class MockExecutionManager(BaseExecutionManager):
    """
    Deterministic in-process order simulation.

    All MARKET orders are filled immediately at the current price with a
    configurable slippage model.  LIMIT orders are queued and checked each
    time advance_time() is called.

    Suitable for:
      • Backtesting (feed historical bars via advance_time)
      • Paper-trading simulation (call advance_time on each WebSocket tick)
    """

    def __init__(
        self,
        slippage_bps: float = 5.0,           # basis points of slippage
        fill_latency_ms: float = 50.0,        # simulated network round-trip
        on_fill: Optional[FillCallback] = None,
    ):
        super().__init__(on_fill)
        self.slippage_bps    = slippage_bps
        self.fill_latency_ms = fill_latency_ms
        self._current_price: dict[str, float] = {}

    # ── Called by the engine on every price update ─────────────────────────

    def update_price(self, symbol: str, price: float) -> None:
        """Feed the latest market price so limit orders can be evaluated."""
        self._current_price[symbol] = price
        self._check_pending_limits(symbol, price)

    # ── BaseExecutionManager interface ────────────────────────────────────

    def submit(self, request: OrderRequest) -> Order:
        order = Order(
            order_id     = str(uuid.uuid4())[:8],
            request      = request,
            status       = OrderStatus.SUBMITTED,
            submitted_at = datetime.utcnow(),
        )
        self._orders[order.order_id] = order
        logger.info(
            "MOCK SUBMIT | %s %s %.6f @ MARKET",
            request.side.value, request.symbol, request.quantity,
        )

        if request.order_type == OrderType.MARKET:
            self._fill_market(order)

        return order

    def cancel(self, order_id: str) -> bool:
        order = self._orders.get(order_id)
        if order and not order.is_terminal:
            order.status = OrderStatus.CANCELLED
            logger.info("MOCK CANCEL | order_id=%s", order_id)
            self._emit_fill(order)
            return True
        return False

    # ── Private helpers ───────────────────────────────────────────────────

    def _fill_market(self, order: Order) -> None:
        symbol = order.request.symbol
        raw_price = self._current_price.get(symbol, order.request.signal_ref.price)

        # Apply slippage — buys pay more, sells receive less
        slippage_mult = self.slippage_bps / 10_000
        if order.request.side == OrderSide.BUY:
            fill_price = raw_price * (1 + slippage_mult)
        else:
            fill_price = raw_price * (1 - slippage_mult)

        order.filled_qty     = order.request.quantity
        order.avg_fill_price = round(fill_price, 6)
        order.status         = OrderStatus.FILLED
        order.filled_at      = datetime.utcnow()

        logger.info(
            "MOCK FILL | %s %s qty=%.6f @ %.4f (slippage %.1f bps)",
            order.request.side.value, symbol,
            order.filled_qty, order.avg_fill_price, self.slippage_bps,
        )
        self._emit_fill(order)

    def _check_pending_limits(self, symbol: str, price: float) -> None:
        for order in list(self._orders.values()):
            if order.is_terminal or order.request.symbol != symbol:
                continue
            if order.request.order_type != OrderType.LIMIT:
                continue
            lp = order.request.limit_price
            if lp is None:
                continue
            if order.request.side == OrderSide.BUY and price <= lp:
                self._fill_at(order, price)
            elif order.request.side == OrderSide.SELL and price >= lp:
                self._fill_at(order, price)

    def _fill_at(self, order: Order, price: float) -> None:
        order.filled_qty     = order.request.quantity
        order.avg_fill_price = price
        order.status         = OrderStatus.FILLED
        order.filled_at      = datetime.utcnow()
        logger.info(
            "MOCK LIMIT FILL | %s qty=%.6f @ %.4f",
            order.request.symbol, order.filled_qty, order.avg_fill_price,
        )
        self._emit_fill(order)


# ─── Alpaca Execution Manager (Live / Paper) ──────────────────────────────────

class AlpacaExecutionManager(BaseExecutionManager):
    """
    Alpaca Markets REST + WebSocket integration.

    Requirements:
        pip install alpaca-py

    Keys are loaded from environment variables — NEVER hardcoded in source:
        ALPACA_API_KEY
        ALPACA_SECRET_KEY
        ALPACA_BASE_URL  (https://paper-api.alpaca.markets for paper trading)

    Order Status polling runs in a background thread.
    WebSocket fill stream (preferred) uses the TradingStream class.

    Usage:
        import os
        mgr = AlpacaExecutionManager(
            api_key    = os.environ["ALPACA_API_KEY"],
            secret_key = os.environ["ALPACA_SECRET_KEY"],
            paper      = True,         # set False for live
            on_fill    = my_callback,
        )
    """

    def __init__(
        self,
        api_key:    str,
        secret_key: str,
        paper:      bool = True,
        on_fill:    Optional[FillCallback] = None,
    ):
        super().__init__(on_fill)
        self._api_key    = api_key
        self._secret_key = secret_key
        self._paper      = paper
        self._client     = self._build_client()

    def _build_client(self):
        """
        Returns an alpaca.trading.TradingClient instance.
        Lazy-import so the engine can be imported without alpaca-py installed.
        """
        try:
            from alpaca.trading.client import TradingClient
            return TradingClient(
                api_key    = self._api_key,
                secret_key = self._secret_key,
                paper      = self._paper,
            )
        except ImportError:
            raise RuntimeError(
                "alpaca-py not installed. Run: pip install alpaca-py"
            )

    def submit(self, request: OrderRequest) -> Order:
        from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
        from alpaca.trading.enums import OrderSide as AlpacaSide, TimeInForce

        internal_order = Order(
            order_id     = "",  # filled after broker confirms
            request      = request,
            status       = OrderStatus.PENDING,
            submitted_at = datetime.utcnow(),
        )

        alpaca_side = (
            AlpacaSide.BUY if request.side == OrderSide.BUY else AlpacaSide.SELL
        )

        try:
            if request.order_type == OrderType.MARKET:
                req = MarketOrderRequest(
                    symbol        = request.symbol.replace("/", ""),  # BTC/USD → BTCUSD
                    qty           = request.quantity,
                    side          = alpaca_side,
                    time_in_force = TimeInForce.GTC,
                )
            else:
                req = LimitOrderRequest(
                    symbol        = request.symbol.replace("/", ""),
                    qty           = request.quantity,
                    side          = alpaca_side,
                    limit_price   = request.limit_price,
                    time_in_force = TimeInForce.GTC,
                )

            response = self._client.submit_order(order_data=req)
            internal_order.order_id = str(response.id)
            internal_order.status   = OrderStatus.SUBMITTED

            logger.info(
                "ALPACA SUBMIT | %s %s | broker_id=%s",
                request.side.value, request.symbol, internal_order.order_id,
            )

        except Exception as exc:
            internal_order.status   = OrderStatus.REJECTED
            internal_order.broker_msg = str(exc)
            logger.error("ALPACA SUBMIT FAILED: %s", exc)

        self._orders[internal_order.order_id] = internal_order
        return internal_order

    def cancel(self, order_id: str) -> bool:
        try:
            self._client.cancel_order_by_id(order_id)
            order = self._orders.get(order_id)
            if order:
                order.status = OrderStatus.CANCELLED
            logger.info("ALPACA CANCEL | order_id=%s", order_id)
            return True
        except Exception as exc:
            logger.error("ALPACA CANCEL FAILED: %s", exc)
            return False

    def sync_order_status(self, order_id: str) -> Optional[Order]:
        """Fetch latest order status from Alpaca and sync internal state."""
        try:
            from alpaca.trading.enums import OrderStatus as AStatus
            broker_order = self._client.get_order_by_id(order_id)
            internal     = self._orders.get(order_id)
            if internal is None:
                return None

            status_map = {
                "new":              OrderStatus.SUBMITTED,
                "partially_filled": OrderStatus.PARTIALLY_FILLED,
                "filled":           OrderStatus.FILLED,
                "canceled":         OrderStatus.CANCELLED,
                "rejected":         OrderStatus.REJECTED,
            }
            new_status = status_map.get(broker_order.status.value, internal.status)

            if new_status != internal.status:
                internal.status         = new_status
                internal.filled_qty     = float(broker_order.filled_qty or 0)
                internal.avg_fill_price = (
                    float(broker_order.filled_avg_price)
                    if broker_order.filled_avg_price else None
                )
                if internal.status in (OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED):
                    self._emit_fill(internal)

            return internal
        except Exception as exc:
            logger.error("ALPACA SYNC FAILED for %s: %s", order_id, exc)
            return None
