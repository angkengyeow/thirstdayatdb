"""
models.py — Core data models for the QuantexPro trading engine.

All inter-component communication uses these immutable dataclasses,
guaranteeing type safety and a clean audit trail throughout the system.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


# ─── Enumerations ─────────────────────────────────────────────────────────────

class SignalType(str, Enum):
    BUY  = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class OrderSide(str, Enum):
    BUY  = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT  = "LIMIT"
    STOP   = "STOP"


class OrderStatus(str, Enum):
    PENDING         = "PENDING"
    SUBMITTED       = "SUBMITTED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED          = "FILLED"
    CANCELLED       = "CANCELLED"
    REJECTED        = "REJECTED"


class TradingMode(str, Enum):
    BACKTEST     = "BACKTEST"
    PAPER_TRADE  = "PAPER_TRADE"
    LIVE_TRADE   = "LIVE_TRADE"


# ─── Market Data ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Bar:
    """OHLCV candlestick bar — the atomic unit of market data."""
    symbol:    str
    timestamp: datetime
    open:      float
    high:      float
    low:       float
    close:     float
    volume:    float

    @property
    def mid(self) -> float:
        return (self.high + self.low) / 2.0

    @property
    def range(self) -> float:
        return self.high - self.low


@dataclass(frozen=True)
class Tick:
    """Level-1 quote tick from a real-time WebSocket feed."""
    symbol:    str
    timestamp: datetime
    bid:       float
    ask:       float
    last:      float
    volume:    float

    @property
    def spread(self) -> float:
        return self.ask - self.bid

    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2.0


# ─── Signals ──────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Signal:
    """
    Trading signal emitted by the Strategy Engine.

    confidence  : 0.0–1.0 normalised conviction score.
    metadata    : arbitrary strategy-specific diagnostic payload.
    """
    strategy_id: str
    symbol:      str
    signal_type: SignalType
    price:       float
    timestamp:   datetime
    confidence:  float = 0.0
    reason:      str   = ""
    metadata:    dict  = field(default_factory=dict)


# ─── Risk-Validated Order Request ─────────────────────────────────────────────

@dataclass
class OrderRequest:
    """
    Risk-stamped order intent produced by the Risk Manager.

    stop_loss and take_profit are mandatory; the Risk Manager refuses
    to produce an OrderRequest without them.
    """
    symbol:      str
    side:        OrderSide
    order_type:  OrderType
    quantity:    float
    limit_price: Optional[float]
    stop_loss:   float          # absolute price level — REQUIRED
    take_profit: float          # absolute price level — REQUIRED
    signal_ref:  Signal
    created_at:  datetime = field(default_factory=datetime.utcnow)


# ─── Broker Order ─────────────────────────────────────────────────────────────

@dataclass
class Order:
    """
    Live/simulated broker order with full lifecycle state.
    """
    order_id:       str
    request:        OrderRequest
    status:         OrderStatus       = OrderStatus.PENDING
    filled_qty:     float             = 0.0
    avg_fill_price: Optional[float]   = None
    submitted_at:   Optional[datetime] = None
    filled_at:      Optional[datetime] = None
    broker_msg:     str               = ""

    @property
    def is_terminal(self) -> bool:
        return self.status in (
            OrderStatus.FILLED,
            OrderStatus.CANCELLED,
            OrderStatus.REJECTED,
        )

    @property
    def remaining_qty(self) -> float:
        return self.request.quantity - self.filled_qty


# ─── Portfolio Position ───────────────────────────────────────────────────────

@dataclass
class Position:
    symbol:      str
    quantity:    float
    avg_cost:    float
    opened_at:   datetime
    stop_loss:   float
    take_profit: float

    def unrealised_pnl(self, current_price: float) -> float:
        return (current_price - self.avg_cost) * self.quantity

    def pnl_pct(self, current_price: float) -> float:
        return (current_price - self.avg_cost) / self.avg_cost


# ─── Portfolio Snapshot ───────────────────────────────────────────────────────

@dataclass
class PortfolioSnapshot:
    timestamp:        datetime
    cash:             float
    positions:        dict[str, Position]
    total_equity:     float
    unrealised_pnl:   float
    realised_pnl:     float
    max_drawdown_pct: float
