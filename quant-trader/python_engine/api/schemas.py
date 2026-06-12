"""
schemas.py — Pydantic request/response schemas for the QuantexPro REST API.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─── Engine Control ───────────────────────────────────────────────────────────

class EngineStatus(BaseModel):
    running: bool
    mode: str
    strategy_id: str
    symbol: str
    tick_count: int
    uptime_seconds: float
    risk_halted: bool

class EngineAction(BaseModel):
    action: str = Field(..., pattern=r"^(start|stop|restart|reset)$")

class StrategyUpdate(BaseModel):
    strategy: str
    symbol: Optional[str] = None
    params: dict[str, Any] = Field(default_factory=dict)


# ─── Portfolio ────────────────────────────────────────────────────────────────

class PositionResponse(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    current_price: float
    unrealised_pnl: float
    pnl_pct: float
    stop_loss: float
    take_profit: float
    opened_at: str

class PortfolioResponse(BaseModel):
    timestamp: str
    cash: float
    equity: float
    unrealised_pnl: float
    realised_pnl: float
    max_drawdown_pct: float
    open_positions: int
    positions: list[PositionResponse]


# ─── Trade History ────────────────────────────────────────────────────────────

class TradeResponse(BaseModel):
    id: int
    symbol: str
    side: str
    quantity: float
    entry_price: float
    exit_price: Optional[float]
    pnl: Optional[float]
    pnl_pct: Optional[float]
    status: str
    strategy_id: Optional[str]
    opened_at: str
    closed_at: Optional[str]

class TradeListResponse(BaseModel):
    trades: list[TradeResponse]
    total: int
    page: int
    page_size: int


# ─── Backtest ─────────────────────────────────────────────────────────────────

class BacktestRequest(BaseModel):
    symbol: str
    strategy: str = "ma_crossover"
    strategy_params: dict[str, Any] = Field(default_factory=dict)
    starting_cash: float = 100_000
    bar_count: int = 300
    risk_config: Optional[dict[str, Any]] = None

class BacktestResponse(BaseModel):
    total_return_pct: float
    win_rate: float
    max_drawdown_pct: float
    sharpe_ratio: float
    trade_count: int
    final_equity: float
    duration_ms: float


# ─── Signals ──────────────────────────────────────────────────────────────────

class SignalResponse(BaseModel):
    timestamp: str
    symbol: str
    signal_type: str
    price: float
    confidence: float
    strategy_id: str
    reason: str
    risk_accepted: bool
    rejection_reason: Optional[str] = None


# ─── Metrics ──────────────────────────────────────────────────────────────────

class MetricsResponse(BaseModel):
    equity: float
    cash: float
    realised_pnl: float
    unrealised_pnl: float
    max_drawdown_pct: float
    open_positions: int
    total_trades: int
    win_rate: float
    uptime_hours: float
    signals_generated: int
    orders_submitted: int
    orders_filled: int
    orders_rejected: int


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "2.5.0"
    engine_running: bool
    redis_connected: bool
    postgres_connected: bool
    uptime_seconds: float
    last_bar_timestamp: Optional[str] = None