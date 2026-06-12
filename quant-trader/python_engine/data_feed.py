"""
data_feed.py — Data Ingestion Engine.

Architecture
────────────
                   ┌─────────────────────────────┐
                   │       DataFeedRouter         │
                   │  (selects feed by TradingMode)│
                   └──────────┬──────────────────┘
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
      BacktestFeed      WebSocketFeed    RESTBackfillFeed
   (CSV / DB replay)   (live WS stream)  (REST history gap-fill)

Design principles:
  • All feeds produce Bar objects via an async generator or callback.
  • The TradingEngine is feed-agnostic — same strategy logic for all modes.
  • WebSocketFeed runs in a background thread; bars land in a thread-safe queue.
  • Backfilling is handled transparently before the live feed starts.
  • Rate-limit handling and reconnection are encapsulated in WebSocketFeed.
"""

from __future__ import annotations
import csv
import logging
import queue
import threading
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Generator, Iterator, Optional

from .models import Bar, TradingMode

logger = logging.getLogger(__name__)

BarCallback = Callable[[Bar], None]


# ─── Abstract Base ─────────────────────────────────────────────────────────────

class BaseDataFeed(ABC):
    """
    All data feeds share this interface.

    In backtest mode, iteration is synchronous (for loop over bars).
    In live mode, bars arrive asynchronously and are pushed into a queue
    that the TradingEngine drains on each heartbeat.
    """

    def __init__(self, symbol: str):
        self.symbol   = symbol
        self._running = False
        self._queue: queue.Queue[Bar] = queue.Queue(maxsize=10_000)

    @abstractmethod
    def start(self) -> None:
        """Begin producing bars (starts background thread for live feeds)."""
        ...

    @abstractmethod
    def stop(self) -> None:
        """Signal the feed to stop cleanly."""
        ...

    def get_bar(self, timeout: float = 0.1) -> Optional[Bar]:
        """Non-blocking pop from the internal bar queue."""
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def drain(self) -> list[Bar]:
        """Return all currently queued bars (non-blocking)."""
        bars = []
        while not self._queue.empty():
            try:
                bars.append(self._queue.get_nowait())
            except queue.Empty:
                break
        return bars

    @property
    def is_running(self) -> bool:
        return self._running


# ─── Backtest Feed (CSV / DB replay) ──────────────────────────────────────────

class BacktestFeed(BaseDataFeed):
    """
    Reads historical OHLCV data from a CSV file or list of Bar objects and
    replays it bar-by-bar at a configurable speed.

    CSV format expected:
        timestamp,open,high,low,close,volume
        2024-01-01T09:30:00Z,150.0,151.5,149.8,151.0,1234567

    Set speed_multiplier=0 for maximum-speed replay (no sleep).
    """

    def __init__(
        self,
        symbol:           str,
        bars:             Optional[list[Bar]]  = None,
        csv_path:         Optional[Path]       = None,
        speed_multiplier: float                = 0.0,   # 0 = instant
    ):
        super().__init__(symbol)
        if bars is not None:
            self._bars = bars
        elif csv_path is not None:
            self._bars = self._load_csv(csv_path)
        else:
            raise ValueError("Provide either bars or csv_path")
        self.speed_multiplier = speed_multiplier
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._replay, daemon=True)
        self._thread.start()
        logger.info("BacktestFeed started: %d bars for %s", len(self._bars), self.symbol)

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def _replay(self) -> None:
        for i, bar in enumerate(self._bars):
            if not self._running:
                break
            self._queue.put(bar)
            if self.speed_multiplier > 0 and i > 0:
                time.sleep(self.speed_multiplier * 0.001)  # ms → s
        # Signal EOF
        self._running = False
        logger.info("BacktestFeed completed replay for %s", self.symbol)

    @staticmethod
    def _load_csv(path: Path) -> list[Bar]:
        bars = []
        with path.open(newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                bars.append(Bar(
                    symbol    = row.get("symbol", "UNKNOWN"),
                    timestamp = datetime.fromisoformat(row["timestamp"].rstrip("Z")).replace(
                        tzinfo=timezone.utc
                    ),
                    open   = float(row["open"]),
                    high   = float(row["high"]),
                    low    = float(row["low"]),
                    close  = float(row["close"]),
                    volume = float(row["volume"]),
                ))
        logger.info("Loaded %d bars from %s", len(bars), path)
        return bars


# ─── WebSocket Feed (Live / Paper) ────────────────────────────────────────────

class AlpacaWebSocketFeed(BaseDataFeed):
    """
    Real-time bar feed using Alpaca's WebSocket Market Data stream.

    Features:
      • Automatic reconnect with exponential back-off (max 60 s).
      • Transparent historical backfill on connect via REST API.
      • Thread-safe queue feeding into the TradingEngine.

    Requirements:
        pip install alpaca-py websocket-client

    Environment:
        ALPACA_API_KEY, ALPACA_SECRET_KEY
    """

    RECONNECT_BASE  = 1.0    # seconds
    RECONNECT_MAX   = 60.0
    BACKFILL_BARS   = 100    # bars to prefetch on startup

    def __init__(
        self,
        symbol:      str,
        api_key:     str,
        secret_key:  str,
        bar_type:    str = "1Min",  # "1Min", "5Min", "1Hour"
        paper:       bool = True,
    ):
        super().__init__(symbol)
        self._api_key    = api_key
        self._secret_key = secret_key
        self._bar_type   = bar_type
        self._paper      = paper
        self._thread:    Optional[threading.Thread] = None
        self._reconnect_delay = self.RECONNECT_BASE

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("AlpacaWebSocketFeed started for %s", self.symbol)

    def stop(self) -> None:
        self._running = False
        logger.info("AlpacaWebSocketFeed stopping for %s", self.symbol)

    # ── Internal ──────────────────────────────────────────────────────────

    def _run_loop(self) -> None:
        """Reconnect loop with exponential back-off."""
        self._backfill()
        while self._running:
            try:
                self._connect_and_subscribe()
                self._reconnect_delay = self.RECONNECT_BASE   # reset on success
            except Exception as exc:
                logger.warning(
                    "WebSocket disconnected (%s). Reconnecting in %.1fs...",
                    exc, self._reconnect_delay,
                )
                time.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2, self.RECONNECT_MAX
                )

    def _connect_and_subscribe(self) -> None:
        """
        Connect to Alpaca's WebSocket and push incoming bars to self._queue.

        This is a synchronous blocking call — it returns only when the
        connection drops.  The outer _run_loop handles reconnection.
        """
        try:
            from alpaca.data.live import StockDataStream, CryptoDataStream
        except ImportError:
            raise RuntimeError("alpaca-py not installed. Run: pip install alpaca-py")

        is_crypto = "/" in self.symbol
        StreamClass = CryptoDataStream if is_crypto else StockDataStream

        stream = StreamClass(self._api_key, self._secret_key)

        async def bar_handler(data):
            bar = Bar(
                symbol    = self.symbol,
                timestamp = data.timestamp,
                open      = float(data.open),
                high      = float(data.high),
                low       = float(data.low),
                close     = float(data.close),
                volume    = float(data.volume),
            )
            self._queue.put(bar)
            logger.debug("TICK %s %.4f", self.symbol, bar.close)

        stream.subscribe_bars(bar_handler, self.symbol.replace("/", ""))
        stream.run()  # blocks until disconnected

    def _backfill(self) -> None:
        """
        Prefetch the last N bars via REST so the strategy has enough history
        to compute indicators before the live stream begins.
        """
        try:
            from alpaca.data.historical import StockHistoricalDataClient, CryptoHistoricalDataClient
            from alpaca.data.requests import StockBarsRequest, CryptoBarsRequest
            from alpaca.data.timeframe import TimeFrame

            is_crypto = "/" in self.symbol
            if is_crypto:
                client = CryptoHistoricalDataClient(self._api_key, self._secret_key)
                req_cls = CryptoBarsRequest
            else:
                client = StockHistoricalDataClient(self._api_key, self._secret_key)
                req_cls = StockBarsRequest

            tf_map   = {"1Min": TimeFrame.Minute, "5Min": TimeFrame.Minute, "1Hour": TimeFrame.Hour}
            timeframe = tf_map.get(self._bar_type, TimeFrame.Minute)
            end       = datetime.now(timezone.utc)
            start     = end - timedelta(hours=self.BACKFILL_BARS * 5)  # generous window

            req     = req_cls(symbol_or_symbols=[self.symbol.replace("/", "")], timeframe=timeframe, start=start, end=end)
            df      = client.get_stock_bars(req).df if not is_crypto else client.get_crypto_bars(req).df

            for _, row in df.iterrows():
                bar = Bar(
                    symbol    = self.symbol,
                    timestamp = row.name[1] if hasattr(row.name, "__len__") else row.name,
                    open      = float(row["open"]),
                    high      = float(row["high"]),
                    low       = float(row["low"]),
                    close     = float(row["close"]),
                    volume    = float(row["volume"]),
                )
                self._queue.put(bar)
            logger.info("Backfilled %d bars for %s", len(df), self.symbol)
        except Exception as exc:
            logger.warning("Backfill failed (non-fatal): %s", exc)


# ─── Feed Factory ─────────────────────────────────────────────────────────────

def create_feed(
    mode:       TradingMode,
    symbol:     str,
    api_key:    str = "",
    secret_key: str = "",
    bars:       Optional[list[Bar]] = None,
    csv_path:   Optional[Path] = None,
    paper:      bool = True,
) -> BaseDataFeed:
    """
    Factory function that returns the correct feed implementation based on mode.

    This is the single configuration point for the backtest ↔ live switch.
    The strategy and engine code never need to know which mode is active.
    """
    if mode == TradingMode.BACKTEST:
        return BacktestFeed(symbol=symbol, bars=bars, csv_path=csv_path)
    elif mode in (TradingMode.PAPER_TRADE, TradingMode.LIVE_TRADE):
        if not api_key or not secret_key:
            raise ValueError("api_key and secret_key are required for live/paper feeds")
        return AlpacaWebSocketFeed(
            symbol=symbol, api_key=api_key, secret_key=secret_key, paper=(mode == TradingMode.PAPER_TRADE)
        )
    else:
        raise ValueError(f"Unknown TradingMode: {mode}")
