"""
trading_engine.py — Central TradingEngine event loop.

Architecture
────────────

  ┌──────────────────────────────────────────────────────────┐
  │                     TradingEngine                        │
  │                                                          │
  │  DataFeed ──► bar_buffer ──► Strategy ──► Signal         │
  │                                              │           │
  │                                         RiskManager      │
  │                                              │           │
  │                                        OrderRequest      │
  │                                              │           │
  │                                      ExecutionManager    │
  │                                              │           │
  │                                    Order (filled) ──► Portfolio │
  └──────────────────────────────────────────────────────────┘

Thread model
────────────
  • Main thread      : TradingEngine.run() blocking event loop
  • DataFeed thread  : pushes Bar objects into a queue (daemon)
  • No separate order-monitor thread — Alpaca uses WebSocket fills OR
    the engine polls sync_order_status() inside its heartbeat loop.

Mode switching
──────────────
  BACKTEST     → BacktestFeed (CSV/DB)    + MockExecutionManager
  PAPER_TRADE  → AlpacaWebSocketFeed      + MockExecutionManager
  LIVE_TRADE   → AlpacaWebSocketFeed      + AlpacaExecutionManager
"""

from __future__ import annotations
import logging
import time
from collections import deque
from datetime import datetime
from typing import Optional

from .models import (
    Bar, Order, OrderSide, OrderStatus, Position, PortfolioSnapshot, Signal,
    SignalType, TradingMode,
)
from .strategy import BaseStrategy
from .risk_manager import RiskManager, RiskViolation
from .execution import BaseExecutionManager, MockExecutionManager
from .data_feed import BaseDataFeed

logger = logging.getLogger(__name__)


class TradingEngine:
    """
    Orchestrates all subsystems.

    Parameters
    ----------
    strategy    : A concrete BaseStrategy instance.
    risk_mgr    : A RiskManager instance (shared across all strategies).
    exec_mgr    : A BaseExecutionManager implementation.
    data_feed   : A BaseDataFeed implementation.
    mode        : TradingMode enum — controls execution and logging behaviour.
    bar_window  : Number of bars kept in the rolling window for indicators.
    heartbeat_s : Main loop tick rate in seconds.
    """

    def __init__(
        self,
        strategy:    BaseStrategy,
        risk_mgr:    RiskManager,
        exec_mgr:    BaseExecutionManager,
        data_feed:   BaseDataFeed,
        mode:        TradingMode = TradingMode.BACKTEST,
        bar_window:  int         = 200,
        heartbeat_s: float       = 0.05,
    ):
        self.strategy    = strategy
        self.risk_mgr    = risk_mgr
        self.exec_mgr    = exec_mgr
        self.data_feed   = data_feed
        self.mode        = mode
        self.heartbeat_s = heartbeat_s

        self._bar_window   = bar_window
        self._bars: deque[Bar]              = deque(maxlen=bar_window)
        self._positions: dict[str, Position] = {}
        self._cash: float                    = 100_000.0   # starting capital
        self._realised_pnl: float            = 0.0
        self._peak_equity: float             = self._cash
        self._max_drawdown_pct: float        = 0.0
        self._running: bool                  = False
        self._tick_count: int                = 0

        # Wire fill callback
        self.exec_mgr.register_fill_callback(self._on_fill)

        logger.info(
            "TradingEngine initialised | mode=%s | strategy=%s | symbol=%s",
            mode.value, strategy.strategy_id, strategy.symbol,
        )

    # ── Public API ───────────────────────────────────────────────────────────

    def run(self) -> None:
        """
        Start the main event loop.  Blocks until the data feed is exhausted
        (BACKTEST) or stop() is called (LIVE/PAPER).
        """
        self._running = True
        self.data_feed.start()
        logger.info("TradingEngine running in %s mode", self.mode.value)

        try:
            while self._running:
                bars = self.data_feed.drain()
                for bar in bars:
                    self._process_bar(bar)

                if not bars:
                    # Feed is empty; in BACKTEST mode this means we're done
                    if not self.data_feed.is_running and self.mode == TradingMode.BACKTEST:
                        # Drain any last bars
                        for bar in self.data_feed.drain():
                            self._process_bar(bar)
                        break
                    time.sleep(self.heartbeat_s)

        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt — shutting down gracefully...")
        finally:
            self.stop()

    def stop(self) -> None:
        self._running = False
        self.data_feed.stop()
        logger.info("TradingEngine stopped.")
        self._log_session_summary()

    @property
    def equity(self) -> float:
        unrealised = sum(
            pos.unrealised_pnl(self._last_price(sym))
            for sym, pos in self._positions.items()
        )
        return self._cash + unrealised

    def portfolio_snapshot(self) -> PortfolioSnapshot:
        eq = self.equity
        unrealised = sum(
            pos.unrealised_pnl(self._last_price(sym))
            for sym, pos in self._positions.items()
        )
        return PortfolioSnapshot(
            timestamp        = datetime.utcnow(),
            cash             = self._cash,
            positions        = dict(self._positions),
            total_equity     = eq,
            unrealised_pnl   = unrealised,
            realised_pnl     = self._realised_pnl,
            max_drawdown_pct = self._max_drawdown_pct,
        )

    # ── Core Tick ────────────────────────────────────────────────────────────

    def _process_bar(self, bar: Bar) -> None:
        self._tick_count += 1
        self._bars.append(bar)

        # Update mock execution prices
        if isinstance(self.exec_mgr, MockExecutionManager):
            self.exec_mgr.update_price(bar.symbol, bar.close)

        # Check existing positions for SL/TP
        self._check_exit_conditions(bar)

        # Update risk manager with current equity
        eq = self.equity
        self._update_drawdown(eq)
        self.risk_mgr.update_equity(eq)

        # Skip signal generation if risk kill-switch is active
        if self.risk_mgr.is_halted:
            return

        # Only generate signals when we have enough history
        bars_list = list(self._bars)
        if len(bars_list) < self.strategy.min_bars:
            return

        signal = self.strategy.generate_signal(bars_list)
        if signal is None:
            return

        # Skip BUY signals if we already hold this symbol
        if signal.signal_type == SignalType.BUY and bar.symbol in self._positions:
            return
        # Skip SELL signals if we have no position to close
        if signal.signal_type == SignalType.SELL and bar.symbol not in self._positions:
            return

        self._handle_signal(signal, bar)

    def _handle_signal(self, signal: Signal, bar: Bar) -> None:
        try:
            request = self.risk_mgr.validate(
                signal    = signal,
                positions = self._positions,
                equity    = self.equity,
                last_bar  = bar,
            )
        except RiskViolation as e:
            logger.debug("Signal rejected: %s", e)
            return

        order = self.exec_mgr.submit(request)
        logger.info(
            "ORDER SUBMITTED | %s %s | id=%s",
            signal.signal_type.value, signal.symbol, order.order_id,
        )

    # ── Fill Callback ─────────────────────────────────────────────────────────

    def _on_fill(self, order: Order) -> None:
        """
        Called by the ExecutionManager whenever an order status changes.
        Updates the internal portfolio state.
        """
        if order.status != OrderStatus.FILLED:
            return

        req   = order.request
        sym   = req.symbol
        qty   = order.filled_qty
        price = order.avg_fill_price or req.signal_ref.price

        if req.side == OrderSide.BUY:
            cost = qty * price
            if cost > self._cash:
                logger.warning("Insufficient cash %.2f for order %.2f — skipping", self._cash, cost)
                return
            self._cash -= cost
            self._positions[sym] = Position(
                symbol      = sym,
                quantity    = qty,
                avg_cost    = price,
                opened_at   = datetime.utcnow(),
                stop_loss   = req.stop_loss,
                take_profit = req.take_profit,
            )
            logger.info("POSITION OPEN  | %s qty=%.6f @ %.4f | SL=%.4f TP=%.4f",
                        sym, qty, price, req.stop_loss, req.take_profit)

        elif req.side == OrderSide.SELL and sym in self._positions:
            pos    = self._positions.pop(sym)
            proceeds = pos.quantity * price
            pnl      = proceeds - pos.quantity * pos.avg_cost
            self._cash        += proceeds
            self._realised_pnl += pnl
            logger.info("POSITION CLOSE | %s qty=%.6f @ %.4f | PnL=%+.2f",
                        sym, pos.quantity, price, pnl)

    # ── Stop-Loss / Take-Profit monitoring ────────────────────────────────────

    def _check_exit_conditions(self, bar: Bar) -> None:
        sym = bar.symbol
        pos = self._positions.get(sym)
        if pos is None:
            return

        price = bar.close
        if price <= pos.stop_loss:
            logger.info("STOP-LOSS HIT | %s @ %.4f (SL=%.4f)", sym, price, pos.stop_loss)
            self._force_close(sym, price, "STOP_LOSS")
        elif price >= pos.take_profit:
            logger.info("TAKE-PROFIT HIT | %s @ %.4f (TP=%.4f)", sym, price, pos.take_profit)
            self._force_close(sym, price, "TAKE_PROFIT")

    def _force_close(self, sym: str, price: float, reason: str) -> None:
        pos = self._positions.pop(sym, None)
        if pos is None:
            return
        proceeds = pos.quantity * price
        pnl = proceeds - pos.quantity * pos.avg_cost
        self._cash += proceeds
        self._realised_pnl += pnl
        logger.info("FORCED CLOSE | %s @ %.4f | reason=%s | PnL=%+.2f",
                    sym, price, reason, pnl)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _last_price(self, symbol: str) -> float:
        for bar in reversed(list(self._bars)):
            if bar.symbol == symbol:
                return bar.close
        return 0.0

    def _update_drawdown(self, equity: float) -> None:
        if equity > self._peak_equity:
            self._peak_equity = equity
        dd = (self._peak_equity - equity) / self._peak_equity
        if dd > self._max_drawdown_pct:
            self._max_drawdown_pct = dd

    def _log_session_summary(self) -> None:
        snap = self.portfolio_snapshot()
        logger.info(
            "\n" + "─" * 60 +
            "\n  SESSION SUMMARY" +
            "\n  Strategy     : %s" +
            "\n  Mode         : %s" +
            "\n  Bars processed: %d" +
            "\n  Starting cash : $100,000.00" +
            "\n  Final equity  : $%.2f" +
            "\n  Realised PnL  : %+.2f" +
            "\n  Unrealised PnL: %+.2f" +
            "\n  Max Drawdown  : %.2f%%" +
            "\n  Open positions: %d" +
            "\n" + "─" * 60,
            self.strategy.strategy_id,
            self.mode.value,
            self._tick_count,
            snap.total_equity,
            snap.realised_pnl,
            snap.unrealised_pnl,
            snap.max_drawdown_pct * 100,
            len(snap.positions),
        )
