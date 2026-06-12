"""
routes/portfolio.py — Portfolio & trade history endpoints.

Endpoints:
  GET   /portfolio  — Current portfolio state
  GET   /trades     — Trade history (paginated)
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, Query

from ... import engine_instance as engine
from ...api.schemas import (
    PortfolioResponse, PositionResponse, TradeListResponse, TradeResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Portfolio"])


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio():
    if engine is None:
        return _empty_portfolio()
    snap = engine.portfolio_snapshot()
    positions = []
    for sym, pos in snap.positions.items():
        current_price = engine._last_price(sym)
        positions.append(PositionResponse(
            symbol=sym,
            quantity=pos.quantity,
            avg_cost=pos.avg_cost,
            current_price=current_price,
            unrealised_pnl=round(pos.unrealised_pnl(current_price), 2),
            pnl_pct=round(pos.pnl_pct(current_price) * 100, 2),
            stop_loss=pos.stop_loss,
            take_profit=pos.take_profit,
            opened_at=pos.opened_at.isoformat(),
        ))
    return PortfolioResponse(
        timestamp=snap.timestamp.isoformat(),
        cash=round(snap.cash, 2),
        equity=round(snap.total_equity, 2),
        unrealised_pnl=round(snap.unrealised_pnl, 2),
        realised_pnl=round(snap.realised_pnl, 2),
        max_drawdown_pct=round(snap.max_drawdown_pct * 100, 2),
        open_positions=len(snap.positions),
        positions=positions,
    )


@router.get("/trades", response_model=TradeListResponse)
async def get_trades(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    symbol: str = Query("", description="Filter by symbol"),
    status: str = Query("", description="Filter by status OPEN/CLOSED"),
):
    if engine is None:
        return TradeListResponse(trades=[], total=0, page=page, page_size=page_size)

    # Collect closed trades from engine portfolio
    closed = getattr(engine, "_closed_trades", [])
    trades_out = []
    from ...db.repository import TradeRepository
    try:
        repo = TradeRepository()
        db_trades = repo.get_trades(page=page, page_size=page_size, symbol=symbol, status=status)
        trades_out = [TradeResponse(
            id=t.id, symbol=t.symbol, side=t.side, quantity=t.quantity,
            entry_price=t.entry_price, exit_price=t.exit_price,
            pnl=t.pnl, pnl_pct=t.pnl_pct, status=t.status,
            strategy_id=t.strategy_id,
            opened_at=t.opened_at.isoformat(),
            closed_at=t.closed_at.isoformat() if t.closed_at else None,
        ) for t in db_trades]
        total = repo.count_trades(symbol=symbol, status=status)
    except Exception:
        # DB not available — return in-memory trades
        total = 0

    return TradeListResponse(trades=trades_out, total=total, page=page, page_size=page_size)


def _empty_portfolio() -> PortfolioResponse:
    return PortfolioResponse(
        timestamp="", cash=0, equity=0, unrealised_pnl=0, realised_pnl=0,
        max_drawdown_pct=0, open_positions=0, positions=[],
    )