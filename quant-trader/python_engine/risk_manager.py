"""
risk_manager.py — Non-negotiable Risk Management Engine.

Design Contract
───────────────
• The RiskManager is the ONLY gateway between a Signal and an OrderRequest.
• It CANNOT be bypassed.  The TradingEngine enforces this architecturally.
• It enriches every signal with position-sizing, stop-loss, and take-profit
  levels before an OrderRequest is created.
• If ANY hard limit is breached the signal is rejected — no exceptions.

Hard Limits (configurable at construction, immutable at runtime)
────────────────────────────────────────────────────────────────
  MAX_DRAWDOWN_PCT      — kill switch: halts ALL new positions when breached
  MAX_PORTFOLIO_RISK    — maximum fraction of equity risked across all open positions
  MAX_POSITION_RISK     — maximum fraction of equity risked on a SINGLE position
  MAX_OPEN_POSITIONS    — hard cap on concurrent positions
  MIN_CONFIDENCE        — minimum signal confidence required for any order

Position Sizing Method: Fixed Fractional (Kelly-inspired)
──────────────────────────────────────────────────────────
  risk_amount  = equity × position_risk_pct
  distance_pct = stop_loss_pct (from entry to stop)
  quantity     = risk_amount / (entry_price × distance_pct)
"""

from __future__ import annotations
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from .models import (
    Bar, Order, OrderRequest, OrderSide, OrderStatus, OrderType,
    Position, PortfolioSnapshot, Signal, SignalType,
)

logger = logging.getLogger(__name__)


@dataclass
class RiskConfig:
    # Hard limits
    max_drawdown_pct:     float = 0.15    # 15 % peak-to-trough → kill switch
    max_portfolio_risk:   float = 0.30    # 30 % of equity at risk across all positions
    max_position_risk:    float = 0.02    # 2 % of equity risked per trade
    max_open_positions:   int   = 5       # concurrent position cap
    min_confidence:       float = 0.0     # 0 = accept all, raise to filter noise

    # Stop / Target geometry (as fraction of entry price)
    stop_loss_pct:   float = 0.02   # 2 % hard stop below entry
    take_profit_pct: float = 0.05   # 5 % take-profit above entry

    # Minimum trade size guard
    min_notional: float = 10.0  # $10 minimum order value


class RiskViolation(Exception):
    """Raised when the Risk Manager rejects a signal."""
    pass


class RiskManager:
    """
    Stateful risk gateway.  Must be provided with a live view of the portfolio
    and the current equity before each validate() call.
    """

    def __init__(self, config: Optional[RiskConfig] = None):
        self.config    = config or RiskConfig()
        self._halted   = False   # set to True when max_drawdown is breached
        self._peak_equity: Optional[float] = None
        self._rejection_log: list[dict] = []

    # ── Public Interface ─────────────────────────────────────────────────────

    def update_equity(self, equity: float) -> None:
        """
        Called by the TradingEngine on every price tick.
        Updates peak equity and checks the drawdown kill-switch.
        """
        if self._peak_equity is None or equity > self._peak_equity:
            self._peak_equity = equity

        drawdown = (self._peak_equity - equity) / self._peak_equity
        if drawdown >= self.config.max_drawdown_pct:
            if not self._halted:
                logger.critical(
                    "RISK KILL-SWITCH TRIGGERED: drawdown %.2f%% >= limit %.2f%%",
                    drawdown * 100, self.config.max_drawdown_pct * 100,
                )
            self._halted = True
        else:
            self._halted = False

    def validate(
        self,
        signal:    Signal,
        positions: dict[str, Position],
        equity:    float,
        last_bar:  Bar,
    ) -> OrderRequest:
        """
        Validate a Signal and, if accepted, produce an OrderRequest.

        Raises RiskViolation with a human-readable reason on rejection.
        """
        self._check_kill_switch()
        self._check_confidence(signal)
        self._check_position_cap(positions, signal)
        self._check_portfolio_heat(positions, equity, last_bar)

        entry_price = last_bar.close
        qty         = self._size_position(equity, entry_price)
        stop_loss   = self._calc_stop(signal, entry_price)
        take_profit = self._calc_take_profit(signal, entry_price)

        self._check_min_notional(qty, entry_price)

        logger.info(
            "RISK APPROVED | %s %s | qty=%.6f | SL=%.4f | TP=%.4f | conf=%.2f",
            signal.signal_type.value, signal.symbol,
            qty, stop_loss, take_profit, signal.confidence,
        )

        return OrderRequest(
            symbol      = signal.symbol,
            side        = OrderSide.BUY if signal.signal_type == SignalType.BUY else OrderSide.SELL,
            order_type  = OrderType.MARKET,
            quantity    = qty,
            limit_price = None,
            stop_loss   = stop_loss,
            take_profit = take_profit,
            signal_ref  = signal,
        )

    @property
    def is_halted(self) -> bool:
        return self._halted

    @property
    def rejection_log(self) -> list[dict]:
        return list(self._rejection_log)

    # ── Private Checks ───────────────────────────────────────────────────────

    def _check_kill_switch(self) -> None:
        if self._halted:
            self._reject("Kill-switch active — max drawdown breached")

    def _check_confidence(self, signal: Signal) -> None:
        if signal.confidence < self.config.min_confidence:
            self._reject(
                f"Signal confidence {signal.confidence:.2f} < minimum "
                f"{self.config.min_confidence:.2f}"
            )

    def _check_position_cap(
        self, positions: dict[str, Position], signal: Signal
    ) -> None:
        # Allow SELL signals even at cap (used to close positions)
        if signal.signal_type == SignalType.SELL:
            return
        open_count = len(positions)
        if open_count >= self.config.max_open_positions:
            self._reject(
                f"Position cap reached ({open_count}/{self.config.max_open_positions})"
            )
        # Prevent doubling into existing position
        if signal.symbol in positions:
            self._reject(f"Already holding position in {signal.symbol}")

    def _check_portfolio_heat(
        self,
        positions: dict[str, Position],
        equity:    float,
        last_bar:  Bar,
    ) -> None:
        """
        Portfolio heat = sum of (entry_to_stop distances) for all open positions
        as a fraction of equity.  Rejects new positions when heat is too high.
        """
        heat = sum(
            pos.quantity * (pos.avg_cost - pos.stop_loss)
            for pos in positions.values()
        ) / (equity or 1.0)

        if heat >= self.config.max_portfolio_risk:
            self._reject(
                f"Portfolio heat {heat*100:.1f}% >= max {self.config.max_portfolio_risk*100:.0f}%"
            )

    def _size_position(self, equity: float, entry_price: float) -> float:
        """
        Fixed-fractional position sizing.

        risk_amount  = equity × max_position_risk
        quantity     = risk_amount / (entry_price × stop_loss_pct)
        """
        risk_amount = equity * self.config.max_position_risk
        quantity    = risk_amount / (entry_price * self.config.stop_loss_pct)
        return round(quantity, 6)

    def _calc_stop(self, signal: Signal, entry_price: float) -> float:
        if signal.signal_type == SignalType.BUY:
            return round(entry_price * (1 - self.config.stop_loss_pct), 6)
        return round(entry_price * (1 + self.config.stop_loss_pct), 6)

    def _calc_take_profit(self, signal: Signal, entry_price: float) -> float:
        if signal.signal_type == SignalType.BUY:
            return round(entry_price * (1 + self.config.take_profit_pct), 6)
        return round(entry_price * (1 - self.config.take_profit_pct), 6)

    def _check_min_notional(self, qty: float, price: float) -> None:
        notional = qty * price
        if notional < self.config.min_notional:
            self._reject(
                f"Order notional ${notional:.2f} below minimum ${self.config.min_notional}"
            )

    def _reject(self, reason: str) -> None:
        entry = {"timestamp": datetime.utcnow().isoformat(), "reason": reason}
        self._rejection_log.append(entry)
        logger.warning("RISK REJECTED: %s", reason)
        raise RiskViolation(reason)
