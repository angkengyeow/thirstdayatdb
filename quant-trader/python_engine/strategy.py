"""
strategy.py — Abstract Strategy base class and concrete implementations.

Design Principles
─────────────────
• Every strategy is STATELESS between calls — it receives a full window of
  Bar objects and returns a Signal (or None).  State lives in the engine.
• Strategies never touch the broker, the risk manager, or order state.
• Adding a new strategy = subclassing BaseStrategy and registering it in
  STRATEGY_REGISTRY.  Nothing else changes.

Strategies available out-of-the-box
─────────────────────────────────────
  MovingAverageCrossover   – SMA golden/death cross
  MeanReversionBB          – RSI + Bollinger Band extremes
  MomentumBreakout         – N-bar high/low breakout
  MultiFactor              – 3-of-5 confluence scoring
"""

from __future__ import annotations
import logging
from abc import ABC, abstractmethod
from collections import deque
from datetime import datetime
from typing import Optional, Sequence

from .models import Bar, Signal, SignalType

logger = logging.getLogger(__name__)


# ─── Abstract Base ─────────────────────────────────────────────────────────────

class BaseStrategy(ABC):
    """
    Every concrete strategy must inherit from this class.

    Parameters
    ----------
    symbol : str
        The instrument this strategy instance is bound to.
    params : dict
        Strategy-specific hyper-parameters.  Defaults are set in __init__.
    """

    strategy_id: str = "base"

    def __init__(self, symbol: str, params: Optional[dict] = None):
        self.symbol = symbol
        self.params = params or {}
        self._configure(self.params)

    def _configure(self, params: dict) -> None:
        """Override to unpack params into typed attributes."""
        pass

    @abstractmethod
    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        """
        Core signal generation method.

        Parameters
        ----------
        bars : Sequence[Bar]
            Ordered list of OHLCV bars (oldest first).  The caller guarantees
            len(bars) >= self.min_bars.

        Returns
        -------
        Signal | None
            A Signal if the strategy has a view; None to hold.
        """
        ...

    @property
    @abstractmethod
    def min_bars(self) -> int:
        """Minimum number of bars required before this strategy can fire."""
        ...

    # ── Indicator Helpers (shared by all strategies) ─────────────────────────

    @staticmethod
    def _sma(bars: Sequence[Bar], period: int) -> list[Optional[float]]:
        closes = [b.close for b in bars]
        result: list[Optional[float]] = [None] * len(closes)
        for i in range(period - 1, len(closes)):
            result[i] = sum(closes[i - period + 1 : i + 1]) / period
        return result

    @staticmethod
    def _ema(bars: Sequence[Bar], period: int) -> list[float]:
        closes = [b.close for b in bars]
        k = 2.0 / (period + 1)
        ema = closes[0]
        result = [ema]
        for c in closes[1:]:
            ema = c * k + ema * (1 - k)
            result.append(round(ema, 6))
        return result

    @staticmethod
    def _rsi(bars: Sequence[Bar], period: int = 14) -> list[Optional[float]]:
        closes = [b.close for b in bars]
        result: list[Optional[float]] = [None] * period
        for i in range(period, len(closes)):
            window = closes[i - period : i]
            gains  = sum(max(window[j+1]-window[j], 0) for j in range(len(window)-1))
            losses = sum(max(window[j]-window[j+1], 0) for j in range(len(window)-1))
            rs = gains / (losses or 1e-9)
            result.append(round(100 - 100 / (1 + rs), 4))
        return result

    @staticmethod
    def _bollinger(
        bars: Sequence[Bar], period: int = 20, std_dev: float = 2.0
    ) -> list[Optional[dict]]:
        closes = [b.close for b in bars]
        result: list[Optional[dict]] = []
        for i in range(len(closes)):
            if i < period - 1:
                result.append(None)
                continue
            window = closes[i - period + 1 : i + 1]
            mean   = sum(window) / period
            std    = (sum((x - mean) ** 2 for x in window) / period) ** 0.5
            result.append({
                "upper":  round(mean + std_dev * std, 6),
                "middle": round(mean, 6),
                "lower":  round(mean - std_dev * std, 6),
            })
        return result

    def _make_signal(
        self,
        signal_type: SignalType,
        bars: Sequence[Bar],
        confidence: float = 0.0,
        reason: str = "",
        metadata: Optional[dict] = None,
    ) -> Signal:
        last = bars[-1]
        return Signal(
            strategy_id = self.strategy_id,
            symbol      = self.symbol,
            signal_type = signal_type,
            price       = last.close,
            timestamp   = last.timestamp,
            confidence  = confidence,
            reason      = reason,
            metadata    = metadata or {},
        )


# ─── Strategy 1: Moving Average Crossover ──────────────────────────────────────

class MovingAverageCrossover(BaseStrategy):
    """
    Classic SMA Golden / Death Cross.

    BUY  — fast SMA crosses above slow SMA (golden cross)
    SELL — fast SMA crosses below slow SMA (death cross)

    Default params: fast=20, slow=50
    """

    strategy_id = "ma_crossover"

    def _configure(self, params: dict) -> None:
        self.fast = params.get("fast", 20)
        self.slow = params.get("slow", 50)

    @property
    def min_bars(self) -> int:
        return self.slow + 2

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        if len(bars) < self.min_bars:
            return None

        sma_fast = self._sma(bars, self.fast)
        sma_slow = self._sma(bars, self.slow)

        i  = len(bars) - 1
        i1 = i - 1

        f_cur,  f_prev  = sma_fast[i], sma_fast[i1]
        s_cur,  s_prev  = sma_slow[i], sma_slow[i1]

        if None in (f_cur, f_prev, s_cur, s_prev):
            return None

        # Golden cross
        if f_cur > s_cur and f_prev <= s_prev:
            return self._make_signal(
                SignalType.BUY, bars,
                confidence=0.65,
                reason=f"SMA{self.fast} crossed above SMA{self.slow}",
                metadata={"sma_fast": f_cur, "sma_slow": s_cur},
            )

        # Death cross
        if f_cur < s_cur and f_prev >= s_prev:
            return self._make_signal(
                SignalType.SELL, bars,
                confidence=0.65,
                reason=f"SMA{self.fast} crossed below SMA{self.slow}",
                metadata={"sma_fast": f_cur, "sma_slow": s_cur},
            )

        return None


# ─── Strategy 2: Mean Reversion (RSI + Bollinger Bands) ───────────────────────

class MeanReversionBB(BaseStrategy):
    """
    RSI extreme + Bollinger Band extreme confluence.

    BUY  — RSI < oversold_level AND price < lower BB
    SELL — RSI > overbought_level AND price > upper BB

    Default params: rsi_period=14, bb_period=20, oversold=30, overbought=70
    """

    strategy_id = "mean_reversion_bb"

    def _configure(self, params: dict) -> None:
        self.rsi_period  = params.get("rsi_period", 14)
        self.bb_period   = params.get("bb_period", 20)
        self.oversold    = params.get("oversold", 30)
        self.overbought  = params.get("overbought", 70)

    @property
    def min_bars(self) -> int:
        return max(self.rsi_period, self.bb_period) + 2

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        if len(bars) < self.min_bars:
            return None

        rsi = self._rsi(bars, self.rsi_period)
        bb  = self._bollinger(bars, self.bb_period)
        i   = len(bars) - 1
        cur = bars[i]

        if rsi[i] is None or bb[i] is None:
            return None

        # Oversold reversal
        if rsi[i] < self.oversold and cur.close < bb[i]["lower"]:
            return self._make_signal(
                SignalType.BUY, bars,
                confidence=min((self.oversold - rsi[i]) / self.oversold, 1.0),
                reason=f"RSI {rsi[i]:.1f} oversold + below lower BB {bb[i]['lower']:.2f}",
                metadata={"rsi": rsi[i], "bb_lower": bb[i]["lower"]},
            )

        # Overbought reversal
        if rsi[i] > self.overbought and cur.close > bb[i]["upper"]:
            return self._make_signal(
                SignalType.SELL, bars,
                confidence=min((rsi[i] - self.overbought) / (100 - self.overbought), 1.0),
                reason=f"RSI {rsi[i]:.1f} overbought + above upper BB {bb[i]['upper']:.2f}",
                metadata={"rsi": rsi[i], "bb_upper": bb[i]["upper"]},
            )

        return None


# ─── Strategy 3: Momentum Breakout ────────────────────────────────────────────

class MomentumBreakout(BaseStrategy):
    """
    N-bar high/low breakout with a buffer to reduce false signals.

    BUY  — close > N-bar high * (1 + buffer)
    SELL — close < N-bar low  * (1 - buffer)

    Default params: lookback=20, buffer=0.005
    """

    strategy_id = "momentum_breakout"

    def _configure(self, params: dict) -> None:
        self.lookback = params.get("lookback", 20)
        self.buffer   = params.get("buffer", 0.005)

    @property
    def min_bars(self) -> int:
        return self.lookback + 1

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        if len(bars) < self.min_bars:
            return None

        window = bars[-(self.lookback + 1) : -1]  # exclude current bar
        cur    = bars[-1]

        max_high = max(b.high for b in window)
        min_low  = min(b.low  for b in window)

        if cur.close > max_high * (1 + self.buffer):
            return self._make_signal(
                SignalType.BUY, bars,
                confidence=min((cur.close / max_high - 1) / 0.02, 1.0),
                reason=f"{self.lookback}-bar breakout above {max_high:.2f}",
                metadata={"breakout_level": max_high},
            )

        if cur.close < min_low * (1 - self.buffer):
            return self._make_signal(
                SignalType.SELL, bars,
                confidence=min((min_low / cur.close - 1) / 0.02, 1.0),
                reason=f"{self.lookback}-bar breakdown below {min_low:.2f}",
                metadata={"breakdown_level": min_low},
            )

        return None


# ─── Strategy 4: Multi-Factor Confluence ──────────────────────────────────────

class MultiFactor(BaseStrategy):
    """
    3-of-5 confluence scoring across MACD, RSI, trend, volume, and histogram.

    Only fires when ≥3 independent factors agree — reduces noise significantly.
    Emits confidence proportional to the number of agreeing factors.

    Default params: threshold=3, rsi_min=40, rsi_max=62
    """

    strategy_id = "multi_factor"

    def _configure(self, params: dict) -> None:
        self.threshold = params.get("threshold", 3)
        self.rsi_min   = params.get("rsi_min", 40)
        self.rsi_max   = params.get("rsi_max", 62)

    @property
    def min_bars(self) -> int:
        return 55  # needs 26-bar EMA + signal smoothing + lookback

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        if len(bars) < self.min_bars:
            return None

        # ── Indicators ─────────────────────────────────────────────────────
        sma20     = self._sma(bars, 20)
        ema_fast  = self._ema(bars, 12)
        ema_slow  = self._ema(bars, 26)
        rsi       = self._rsi(bars, 14)

        i  = len(bars) - 1
        i1 = i - 1
        cur = bars[i]

        if rsi[i] is None or sma20[i] is None:
            return None

        # MACD line
        macd_cur  = ema_fast[i]  - ema_slow[i]
        macd_prev = ema_fast[i1] - ema_slow[i1]

        # Volume SMA(20)
        vol_sma = sum(b.volume for b in bars[i-19:i+1]) / 20

        # ── Bull Factors ───────────────────────────────────────────────────
        f1_bull = macd_cur > 0 and macd_cur > macd_prev          # MACD momentum
        f2_bull = self.rsi_min < rsi[i] < self.rsi_max           # RSI sweet spot
        f3_bull = cur.close > sma20[i]                           # price above trend
        f4_bull = cur.volume > vol_sma * 1.2                     # above-avg volume
        f5_bull = macd_cur > macd_prev                           # histogram accelerating

        bull_score = sum([f1_bull, f2_bull, f3_bull, f4_bull, f5_bull])

        # ── Bear Factors ───────────────────────────────────────────────────
        f1_bear = macd_cur < 0 and macd_cur < macd_prev
        f2_bear = rsi[i] > 55
        f3_bear = cur.close < sma20[i]
        f4_bear = cur.volume > vol_sma * 1.2
        f5_bear = macd_cur < macd_prev

        bear_score = sum([f1_bear, f2_bear, f3_bear, f4_bear, f5_bear])

        # ── Emit Signal ────────────────────────────────────────────────────
        if bull_score >= self.threshold:
            factors = []
            if f1_bull: factors.append("MACD momentum")
            if f2_bull: factors.append(f"RSI {rsi[i]:.1f}")
            if f3_bull: factors.append("above SMA20")
            if f4_bull: factors.append("vol spike")
            if f5_bull: factors.append("hist accel")
            return self._make_signal(
                SignalType.BUY, bars,
                confidence=bull_score / 5.0,
                reason=" · ".join(factors),
                metadata={"bull_score": bull_score, "macd": macd_cur, "rsi": rsi[i]},
            )

        if bear_score >= self.threshold:
            factors = []
            if f1_bear: factors.append("MACD bearish")
            if f2_bear: factors.append(f"RSI {rsi[i]:.1f}")
            if f3_bear: factors.append("below SMA20")
            if f4_bear: factors.append("vol spike")
            if f5_bear: factors.append("hist decel")
            return self._make_signal(
                SignalType.SELL, bars,
                confidence=bear_score / 5.0,
                reason=" · ".join(factors),
                metadata={"bear_score": bear_score, "macd": macd_cur, "rsi": rsi[i]},
            )

        return None


# ─── Registry ─────────────────────────────────────────────────────────────────

STRATEGY_REGISTRY: dict[str, type[BaseStrategy]] = {
    "ma_crossover":       MovingAverageCrossover,
    "mean_reversion_bb":  MeanReversionBB,
    "momentum_breakout":  MomentumBreakout,
    "multi_factor":       MultiFactor,
}


def _register_ml_strategies() -> None:
    """Lazy-register ML strategies if their dependencies are available."""
    try:
        from .strategy_ml import RegimeAwareStrategy, MLSignalStrategy
        STRATEGY_REGISTRY["regime_aware"] = RegimeAwareStrategy
        STRATEGY_REGISTRY["ml_xgboost"]   = MLSignalStrategy
    except ImportError as exc:
        import logging
        logging.getLogger(__name__).info(
            "ML strategies not available: %s. Install xgboost to enable.", exc
        )


_register_ml_strategies()


def get_strategy(name: str, symbol: str, params: Optional[dict] = None) -> BaseStrategy:
    """Factory function — resolve a strategy by name from the registry."""
    cls = STRATEGY_REGISTRY.get(name)
    if cls is None:
        raise ValueError(f"Unknown strategy '{name}'. Available: {list(STRATEGY_REGISTRY)}")
    return cls(symbol, params)
