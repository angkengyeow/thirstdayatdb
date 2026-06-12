"""
broker.py — Unified broker connector for live trading.

Provides:
  1. BrokerConnector — authentication, connection lifecycle, account info
  2. LiveTradingEngine — wraps TradingEngine with live Alpaca feed + execution
  3. Account sync — pulls open positions, orders, and portfolio from broker

Architecture:
    BrokerConnector
    ├── authenticate()        → Validates keys, returns Account
    ├── get_account()         → Account balance, buying power, equity
    ├── get_positions()       → Current open positions from broker
    ├── get_orders()          → Recent order history from broker
    ├── cancel_all_orders()   → Emergency kill switch
    ├── sync_portfolio()      → Align engine positions with broker
    └── create_bracket_order() → Entry + SL + TP in one atomic order

Usage (paper trading — no real money risked):
    from python_engine.broker import BrokerConnector
    connector = BrokerConnector(api_key=..., secret_key=..., paper=True)
    account = connector.authenticate()
    print(f"Equity: ${account.equity}, Buying Power: ${account.buying_power}")

Usage (live trading — real money):
    connector = BrokerConnector(api_key=..., secret_key=..., paper=False)
    connector.authenticate()
    # WARNING: The engine will place REAL orders
"""

from __future__ import annotations
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from .execution import AlpacaExecutionManager, BaseExecutionManager, FillCallback
from .models import Bar, Order, OrderRequest, OrderSide, OrderStatus, OrderType, TradingMode
from .security import audit, encrypt_key

logger = logging.getLogger(__name__)


# ─── Account Dataclass ────────────────────────────────────────────────────────

@dataclass
class Account:
    """Broker account information."""
    account_id:      str
    equity:          float
    cash:            float
    buying_power:    float
    currency:        str
    status:          str           # ACTIVE, DISABLED, etc.
    pattern_day_trader: bool = False
    trading_blocked:   bool = False
    transfers_blocked: bool = False
    last_equity:       float = 0.0

    @property
    def day_trade_count(self) -> int:
        return 0  # populated if broker provides it


@dataclass
class BrokerPosition:
    """A position as reported by the broker."""
    symbol:      str
    qty:         float
    market_value: float
    cost_basis:  float
    unrealized_pl: float
    unrealized_pl_pct: float
    current_price: float
    avg_entry_price: float
    side:        str = "long"


# ─── Connection Error ─────────────────────────────────────────────────────────

class BrokerConnectionError(Exception):
    """Raised when broker authentication or API call fails."""
    pass


# ─── Broker Connector ─────────────────────────────────────────────────────────

class BrokerConnector:
    """
    Manages the live broker connection lifecycle.

    Handles authentication, account queries, position syncing,
    and order management with proper error handling and logging.
    """

    def __init__(
        self,
        api_key:    str = "",
        secret_key: str = "",
        paper:      bool = True,
        base_url:   Optional[str] = None,
    ):
        self._api_key = api_key or os.getenv("ALPACA_API_KEY", "")
        self._secret_key = secret_key or os.getenv("ALPACA_SECRET_KEY", "")
        self._paper = paper
        self._base_url = base_url or os.getenv("ALPACA_BASE_URL", "")
        self._client: Optional[Any] = None
        self._account: Optional[Account] = None
        self._connected = False
        self._last_sync: Optional[datetime] = None
        self._positions_cache: list[BrokerPosition] = []

    # ── Authentication ───────────────────────────────────────────────────────

    def authenticate(self) -> Account:
        """
        Validate broker credentials and fetch account info.

        Returns:
            Account dataclass with balance, equity, status.

        Raises:
            BrokerConnectionError if keys are missing or authentication fails.
        """
        if not self._api_key or not self._secret_key:
            raise BrokerConnectionError(
                "ALPACA_API_KEY and ALPACA_SECRET_KEY must be set. "
                "Set them as environment variables or pass to constructor."
            )

        try:
            from alpaca.trading.client import TradingClient
            from alpaca.trading.enums import AccountStatus

            self._client = TradingClient(
                api_key=self._api_key,
                secret_key=self._secret_key,
                paper=self._paper,
            )

            alpaca_account = self._client.get_account()
            self._account = Account(
                account_id=str(alpaca_account.id),
                equity=float(alpaca_account.equity),
                cash=float(alpaca_account.cash),
                buying_power=float(alpaca_account.buying_power),
                currency=alpaca_account.currency,
                status=alpaca_account.status.value.upper() if hasattr(alpaca_account.status, 'value') else str(alpaca_account.status),
                pattern_day_trader=getattr(alpaca_account, 'pattern_day_trader', False),
                trading_blocked=getattr(alpaca_account, 'trading_blocked', False),
                transfers_blocked=getattr(alpaca_account, 'transfers_blocked', False),
                last_equity=float(alpaca_account.last_equity or 0),
            )
            self._connected = True

            audit.log("BROKER_AUTHENTICATE", {
                "paper": self._paper,
                "account_id": self._account.account_id[:8] + "...",
                "status": self._account.status,
                "equity": self._account.equity,
            })

            logger.info(
                "Broker connected (paper=%s) | Account: %s | Equity: $%.2f | "
                "Buying Power: $%.2f",
                self._paper, self._account.account_id[:8],
                self._account.equity, self._account.buying_power,
            )
            return self._account

        except ImportError:
            raise BrokerConnectionError(
                "alpaca-py not installed. Run: pip install alpaca-py"
            )
        except Exception as exc:
            self._connected = False
            raise BrokerConnectionError(f"Authentication failed: {exc}")

    # ── Account Info ─────────────────────────────────────────────────────────

    def get_account(self) -> Account:
        """Return cached account info, or re-fetch if not cached."""
        if self._account is None:
            return self.authenticate()
        return self._account

    def refresh_account(self) -> Account:
        """Re-fetch account info from broker."""
        return self.authenticate()

    # ── Positions ────────────────────────────────────────────────────────────

    def get_positions(self) -> list[BrokerPosition]:
        """
        Fetch all open positions from the broker.

        Returns:
            List of BrokerPosition dataclasses.
        """
        if not self._connected or not self._client:
            raise BrokerConnectionError("Not connected to broker. Call authenticate() first.")

        try:
            from alpaca.trading.enums import PositionSide
            alpaca_positions = self._client.get_all_positions()
            positions = []
            for p in alpaca_positions:
                qty = float(p.qty)
                if qty == 0:
                    continue
                positions.append(BrokerPosition(
                    symbol=str(p.symbol),
                    qty=qty,
                    market_value=float(p.market_value),
                    cost_basis=float(p.cost_basis),
                    unrealized_pl=float(p.unrealized_pl),
                    unrealized_pl_pct=float(p.unrealized_plpc) * 100,
                    current_price=float(p.current_price),
                    avg_entry_price=float(p.avg_entry_price),
                    side="long" if qty > 0 else "short",
                ))
            self._positions_cache = positions
            self._last_sync = datetime.utcnow()
            logger.debug("Synced %d positions from broker", len(positions))
            return positions
        except Exception as exc:
            logger.error("Failed to fetch positions: %s", exc)
            return list(self._positions_cache)  # return cached on failure

    # ── Orders ───────────────────────────────────────────────────────────────

    def get_orders(self, limit: int = 25, status: str = "all") -> list[dict]:
        """
        Fetch recent orders from the broker.

        Args:
            limit: Max orders to return
            status: "open", "closed", or "all"

        Returns:
            List of order dicts with broker data.
        """
        if not self._connected or not self._client:
            raise BrokerConnectionError("Not connected to broker.")

        try:
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus

            status_map = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL,
            }
            req = GetOrdersRequest(
                status=status_map.get(status, QueryOrderStatus.ALL),
                limit=limit,
                nested=True,
            )
            broker_orders = self._client.get_orders(filter=req)
            return [
                {
                    "id": str(o.id),
                    "symbol": str(o.symbol),
                    "side": o.side.value if hasattr(o.side, 'value') else str(o.side),
                    "type": o.type.value if hasattr(o.type, 'value') else str(o.type),
                    "qty": float(o.qty or 0),
                    "filled_qty": float(o.filled_qty or 0),
                    "limit_price": float(o.limit_price) if o.limit_price else None,
                    "stop_price": float(o.stop_price) if o.stop_price else None,
                    "status": o.status.value if hasattr(o.status, 'value') else str(o.status),
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "filled_at": o.filled_at.isoformat() if o.filled_at else None,
                    "filled_avg_price": float(o.filled_avg_price) if o.filled_avg_price else None,
                }
                for o in broker_orders
            ]
        except Exception as exc:
            logger.error("Failed to fetch orders: %s", exc)
            return []

    def cancel_all_orders(self) -> int:
        """
        Cancel ALL open orders at the broker (emergency kill switch).

        Returns:
            Number of orders cancelled.
        """
        if not self._connected or not self._client:
            raise BrokerConnectionError("Not connected to broker.")

        try:
            cancelled = self._client.cancel_orders()
            count = len(cancelled) if cancelled else 0

            audit.log("BROKER_CANCEL_ALL", {"count": count})
            logger.warning("Cancelled %d orders at broker (emergency kill)", count)
            return count
        except Exception as exc:
            logger.error("Failed to cancel orders: %s", exc)
            return 0

    def close_all_positions(self) -> int:
        """
        Close ALL open positions at the broker (emergency exit).

        Returns:
            Number of positions closed.
        """
        if not self._connected or not self._client:
            raise BrokerConnectionError("Not connected to broker.")

        try:
            statuses = self._client.close_all_positions(cancel_orders=True)
            count = len(statuses) if statuses else 0

            audit.log("BROKER_CLOSE_ALL", {"count": count})
            logger.warning("Closed %d positions at broker (emergency exit)", count)
            return count
        except Exception as exc:
            logger.error("Failed to close positions: %s", exc)
            return 0

    # ── Bracket Orders ───────────────────────────────────────────────────────

    def create_bracket_order(
        self,
        symbol:      str,
        side:        OrderSide,
        quantity:    float,
        entry_price: Optional[float] = None,
        stop_loss:   Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> dict:
        """
        Create an OTOCO (One-Triggers-OCO) bracket order.

        The bracket consists of:
          - Entry order (MARKET or LIMIT)
          - Stop-loss order
          - Take-profit order (both OCO with each other)

        Returns:
            Dict with entry, stop_loss, and take_profit order IDs.
        """
        if not self._connected or not self._client:
            raise BrokerConnectionError("Not connected to broker.")

        try:
            from alpaca.trading.requests import (
                LimitOrderRequest, MarketOrderRequest, StopLossRequest,
                TakeProfitRequest, TrailingStopOrderRequest,
            )
            from alpaca.trading.enums import OrderSide as AlpacaSide, TimeInForce

            alpaca_side = AlpacaSide.BUY if side == OrderSide.BUY else AlpacaSide.SELL

            # Build the take-profit / stop-loss legs
            tp_request = None
            if take_profit:
                tp_request = TakeProfitRequest(limit_price=round(take_profit, 2))

            sl_request = None
            if stop_loss:
                sl_request = StopLossRequest(stop_price=round(stop_loss, 2))

            # Build the entry order with bracket legs attached
            if entry_price:
                order_data = LimitOrderRequest(
                    symbol=symbol.replace("/", ""),
                    qty=quantity,
                    side=alpaca_side,
                    limit_price=round(entry_price, 2),
                    time_in_force=TimeInForce.GTC,
                    take_profit=tp_request,
                    stop_loss=sl_request,
                )
            else:
                order_data = MarketOrderRequest(
                    symbol=symbol.replace("/", ""),
                    qty=quantity,
                    side=alpaca_side,
                    time_in_force=TimeInForce.GTC,
                    take_profit=tp_request,
                    stop_loss=sl_request,
                )

            response = self._client.submit_order(order_data=order_data)

            # Parse returned order IDs
            entry_id = str(response.id)
            tp_id = str(response.take_profit_order_id) if hasattr(response, 'take_profit_order_id') and response.take_profit_order_id else ""
            sl_id = str(response.stop_loss_order_id) if hasattr(response, 'stop_loss_order_id') and response.stop_loss_order_id else ""

            audit.log("BROKER_BRACKET_ORDER", {
                "symbol": symbol, "side": side.value, "qty": quantity,
                "entry_id": entry_id, "tp_id": tp_id, "sl_id": sl_id,
            })

            logger.info(
                "Bracket order placed | %s %s %.4f | Entry=%s TP=%s SL=%s",
                side.value, symbol, quantity, entry_id, tp_id, sl_id,
            )

            return {
                "entry_id": entry_id,
                "take_profit_id": tp_id,
                "stop_loss_id": sl_id,
                "status": str(response.status),
            }

        except Exception as exc:
            logger.error("Bracket order failed: %s", exc)
            return {"error": str(exc)}

    # ── Execution Manager Factory ────────────────────────────────────────────

    def create_execution_manager(self, on_fill: Optional[FillCallback] = None) -> AlpacaExecutionManager:
        """Create an AlpacaExecutionManager wired with our credentials."""
        if not self._connected:
            self.authenticate()
        return AlpacaExecutionManager(
            api_key=self._api_key,
            secret_key=self._secret_key,
            paper=self._paper,
            on_fill=on_fill,
        )

    # ── Connection State ─────────────────────────────────────────────────────

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def is_paper(self) -> bool:
        return self._paper

    def disconnect(self) -> None:
        """Clean disconnection."""
        self._client = None
        self._account = None
        self._connected = False
        self._positions_cache = []
        logger.info("Broker disconnected")
        audit.log("BROKER_DISCONNECT", {})


# ─── Emergency Kill Switch ────────────────────────────────────────────────────

def emergency_kill(api_key: str = "", secret_key: str = "", paper: bool = True) -> dict:
    """
    Emergency function — cancels all orders and closes all positions.

    Call this directly from an alert, webhook, or panic button.
    Returns a summary dict of actions taken.

    Usage:
        from python_engine.broker import emergency_kill
        result = emergency_kill(api_key="...", secret_key="...", paper=True)
        print(f"Cancelled {result['orders_cancelled']} orders, "
              f"closed {result['positions_closed']} positions")
    """
    connector = BrokerConnector(api_key=api_key, secret_key=secret_key, paper=paper)
    try:
        connector.authenticate()
    except BrokerConnectionError as e:
        return {"error": str(e), "orders_cancelled": 0, "positions_closed": 0}

    orders = connector.cancel_all_orders()
    positions = connector.close_all_positions()
    connector.disconnect()

    result = {"orders_cancelled": orders, "positions_closed": positions, "status": "emergency_kill_executed"}
    audit.log("EMERGENCY_KILL", result)
    logger.critical("EMERGENCY KILL executed: %d orders, %d positions", orders, positions)
    return result