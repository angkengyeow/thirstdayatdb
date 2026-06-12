"""
models.py — SQLAlchemy ORM models for persistent trading state.

Maps to tables defined in docker/initdb/001_init.sql:
  - trades
  - portfolio_snapshots
  - signal_log
"""

from __future__ import annotations
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Double, ForeignKey, Integer, JSON, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class TradeModel(Base):
    __tablename__ = "trades"

    id: Mapped[int]     = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    side: Mapped[str]   = mapped_column(String(4), nullable=False)

    quantity: Mapped[float]    = mapped_column(Double, nullable=False)
    entry_price: Mapped[float] = mapped_column(Double, nullable=False)
    exit_price: Mapped[float | None] = mapped_column(Double, nullable=True)
    stop_loss: Mapped[float | None]  = mapped_column(Double, nullable=True)
    take_profit: Mapped[float | None] = mapped_column(Double, nullable=True)

    pnl: Mapped[float | None]    = mapped_column(Double, nullable=True)
    pnl_pct: Mapped[float | None] = mapped_column(Double, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")

    strategy_id: Mapped[str | None]       = mapped_column(String(50), nullable=True)
    signal_confidence: Mapped[float | None] = mapped_column(Double, nullable=True)

    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    broker_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata: Mapped[dict]             = mapped_column(JSON, default=dict)

    def __repr__(self) -> str:
        return f"<Trade {self.symbol} {self.side} qty={self.quantity} @ {self.entry_price}>"


class PortfolioSnapshotModel(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    cash: Mapped[float]            = mapped_column(Double, nullable=False)
    equity: Mapped[float]          = mapped_column(Double, nullable=False)
    unrealised_pnl: Mapped[float]  = mapped_column(Double, default=0)
    realised_pnl: Mapped[float]    = mapped_column(Double, default=0)
    max_drawdown_pct: Mapped[float] = mapped_column(Double, default=0)
    open_positions: Mapped[int]    = mapped_column(Integer, default=0)
    snapshot_data: Mapped[dict]    = mapped_column(JSON, default=dict)


class SignalLogModel(Base):
    __tablename__ = "signal_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(10), nullable=False)
    price: Mapped[float] = mapped_column(Double, nullable=False)
    confidence: Mapped[float] = mapped_column(Double, default=0)
    strategy_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reason: Mapped[str | None]      = mapped_column(Text, nullable=True)
    risk_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[dict]       = mapped_column(JSON, default=dict)