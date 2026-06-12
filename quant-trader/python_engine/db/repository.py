"""
repository.py — CRUD operations for persistent trading state.

Provides a clean data-access abstraction over SQLAlchemy ORM models.
All engine components use this layer rather than querying the DB directly.
"""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy import desc, func

from .base import get_session
from .models import PortfolioSnapshotModel, SignalLogModel, TradeModel

logger = logging.getLogger(__name__)


class TradeRepository:
    """Data access for trades."""

    def save_trade(
        self,
        symbol: str,
        side: str,
        quantity: float,
        entry_price: float,
        strategy_id: str = "",
        stop_loss: float = 0,
        take_profit: float = 0,
        signal_confidence: float = 0,
    ) -> Optional[TradeModel]:
        try:
            with get_session() as s:
                trade = TradeModel(
                    symbol=symbol, side=side, quantity=quantity,
                    entry_price=entry_price, stop_loss=stop_loss,
                    take_profit=take_profit, strategy_id=strategy_id,
                    signal_confidence=signal_confidence, status="OPEN",
                )
                s.add(trade)
                s.flush()
                logger.info("Trade saved: %s %s qty=%.4f @ %.4f", symbol, side, quantity, entry_price)
                return trade
        except Exception as exc:
            logger.error("Failed to save trade: %s", exc)
            return None

    def close_trade(self, trade_id: int, exit_price: float, pnl: float, pnl_pct: float) -> bool:
        try:
            with get_session() as s:
                trade = s.query(TradeModel).filter_by(id=trade_id).first()
                if trade:
                    trade.exit_price = exit_price
                    trade.pnl = pnl
                    trade.pnl_pct = pnl_pct
                    trade.status = "CLOSED"
                    trade.closed_at = datetime.utcnow()
                    return True
            return False
        except Exception as exc:
            logger.error("Failed to close trade %d: %s", trade_id, exc)
            return False

    def get_trades(
        self, page: int = 1, page_size: int = 50,
        symbol: str = "", status: str = "",
    ) -> Sequence[TradeModel]:
        with get_session() as s:
            q = s.query(TradeModel)
            if symbol:
                q = q.filter_by(symbol=symbol)
            if status:
                q = q.filter_by(status=status)
            q = q.order_by(desc(TradeModel.opened_at))
            q = q.offset((page - 1) * page_size).limit(page_size)
            return q.all()

    def count_trades(self, symbol: str = "", status: str = "") -> int:
        with get_session() as s:
            q = s.query(func.count(TradeModel.id))
            if symbol:
                q = q.filter_by(symbol=symbol)
            if status:
                q = q.filter_by(status=status)
            return q.scalar() or 0


class SignalLogRepository:
    """Data access for signal log."""

    def save_signal(self, **kwargs) -> None:
        try:
            with get_session() as s:
                sig = SignalLogModel(**kwargs)
                s.add(sig)
        except Exception as exc:
            logger.error("Failed to save signal log: %s", exc)

    def get_recent(self, limit: int = 100) -> Sequence[SignalLogModel]:
        with get_session() as s:
            return (s.query(SignalLogModel)
                    .order_by(desc(SignalLogModel.timestamp))
                    .limit(limit)
                    .all())


class PortfolioRepository:
    """Data access for portfolio snapshots."""

    def save_snapshot(self, **kwargs) -> None:
        try:
            with get_session() as s:
                snap = PortfolioSnapshotModel(**kwargs)
                s.add(snap)
        except Exception as exc:
            logger.error("Failed to save portfolio snapshot: %s", exc)

    def get_latest(self) -> Optional[PortfolioSnapshotModel]:
        with get_session() as s:
            return (s.query(PortfolioSnapshotModel)
                    .order_by(desc(PortfolioSnapshotModel.timestamp))
                    .first())