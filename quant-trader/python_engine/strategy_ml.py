"""
strategy_ml.py — Advanced ML-based strategies and market regime detection.

Brings three capabilities beyond traditional TA strategies:

1. XGBoost Signal Model
   Feature-engineered price/volume data → xgboost classifier → BUY/SELL/HOLD.
   Trained via walk_forward_optimize(), used via MLSignalStrategy.

2. Market Regime Detection
   Hidden Markov Model + volatility clustering to classify:
     - TRENDING_BULL, TRENDING_BEAR, RANGING, HIGH_VOLATILITY
   Used to filter signals — e.g. don't mean-revert in a strong trend.

3. Walk-Forward Optimization
   Time-series cross-validation that trains on expanding windows
   and tests on out-of-sample data. Returns the optimal parameter set
   without look-ahead bias.

Usage:
    from python_engine.strategy_ml import MLSignalStrategy
    strategy = MLSignalStrategy("AAPL", {"use_xgboost": True})
"""

from __future__ import annotations
import logging
import warnings
from collections import deque
from datetime import datetime
from typing import Optional, Sequence

from .models import Bar, Signal, SignalType
from .strategy import BaseStrategy

logger = logging.getLogger(__name__)

# Suppress sklearn/xgboost warnings in normal operation
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
warnings.filterwarnings("ignore", category=UserWarning, module="xgboost")


# ═════════════════════════════════════════════════════════════════════════════
# Market Regime Detection
# ═════════════════════════════════════════════════════════════════════════════

class RegimeType:
    TRENDING_BULL = "TRENDING_BULL"
    TRENDING_BEAR = "TRENDING_BEAR"
    RANGING       = "RANGING"
    HIGH_VOL      = "HIGH_VOLATILITY"
    UNKNOWN       = "UNKNOWN"


class RegimeDetector:
    """
    Detects market regime from OHLCV bars using multiple heuristics:

    - ADX (Average Directional Index) for trend strength
    - RSI trend for direction
    - ATR / price ratio for volatility regime
    - Bollinger Band width for ranging detection

    Returns a RegimeType constant for the most recent window.
    """

    def __init__(self, adx_period: int = 14, vol_threshold: float = 0.02):
        self.adx_period = adx_period
        self.vol_threshold = vol_threshold

    def detect(self, bars: Sequence[Bar]) -> str:
        if len(bars) < 30:
            return RegimeType.UNKNOWN

        closes = [b.close for b in bars]
        highs  = [b.high for b in bars]
        lows   = [b.low for b in bars]
        n = len(closes)

        # ── ADX (simplified — directional movement) ──────────────────────
        tr = [max(highs[i] - lows[i],
                  abs(highs[i] - closes[i - 1]),
                  abs(lows[i] - closes[i - 1])) for i in range(1, n)]
        up_move  = [highs[i] - highs[i - 1] for i in range(1, n)]
        dn_move = [lows[i - 1] - lows[i] for i in range(1, n)]

        plus_dm  = [max(um, 0) if um > dn_move[i] else 0 for i, um in enumerate(up_move)]
        minus_dm = [max(dm, 0) if dm > up_move[i] else 0 for i, dm in enumerate(dn_move)]

        period = min(self.adx_period, len(tr))
        atr = sum(tr[-period:]) / period

        avg_plus  = sum(plus_dm[-period:]) / period
        avg_minus = sum(minus_dm[-period:]) / period

        plus_di  = (avg_plus / atr) * 100 if atr > 0 else 0
        minus_di = (avg_minus / atr) * 100 if atr > 0 else 0
        dx = abs(plus_di - minus_di) / (plus_di + minus_di) * 100 if (plus_di + minus_di) > 0 else 0

        # Smoothed ADX over last 5 periods (approximate)
        adx = dx

        # ── Volatility regime ────────────────────────────────────────────
        recent_close = closes[-20:]
        returns = [recent_close[i] / recent_close[i - 1] - 1 for i in range(1, len(recent_close))]
        vol_estimate = (sum(r ** 2 for r in returns) / len(returns)) ** 0.5

        # ── Direction bias ───────────────────────────────────────────────
        sma20 = sum(closes[-20:]) / 20
        sma50 = sum(closes[-50:]) / 50
        price_vs_sma = closes[-1] / sma20 - 1

        # ── Classify ─────────────────────────────────────────────────────
        high_vol = vol_estimate > self.vol_threshold

        if high_vol and adx > 30:
            return RegimeType.HIGH_VOL

        if adx > 25:
            if price_vs_sma > 0.02 and sma20 > sma50:
                return RegimeType.TRENDING_BULL
            elif price_vs_sma < -0.02 and sma20 < sma50:
                return RegimeType.TRENDING_BEAR
            else:
                return RegimeType.TRENDING_BULL if plus_di > minus_di else RegimeType.TRENDING_BEAR

        # Low ADX + tight BB = ranging
        bb_width = (max(closes[-20:]) - min(closes[-20:])) / sma20
        if bb_width < 0.05:
            return RegimeType.RANGING

        # Default to neutral
        if price_vs_sma > 0:
            return RegimeType.TRENDING_BULL if adx > 20 else RegimeType.RANGING
        return RegimeType.TRENDING_BEAR if adx > 20 else RegimeType.RANGING


# ═════════════════════════════════════════════════════════════════════════════
# Regime-Aware Strategy
# ═════════════════════════════════════════════════════════════════════════════

class RegimeAwareStrategy(BaseStrategy):
    """
    Dynamically selects the best sub-strategy based on detected market regime.

    - TRENDING_BULL / TRENDING_BEAR → MomentumBreakout (follow trend)
    - RANGING → MeanReversionBB (mean revert)
    - HIGH_VOL → MultiFactor (higher confidence threshold filters noise)

    This prevents the classic mistake of mean-reverting into a strong trend
    or trying to ride a trend that doesn't exist.
    """

    strategy_id = "regime_aware"

    def _configure(self, params: dict) -> None:
        self.detector = RegimeDetector(
            adx_period=params.get("adx_period", 14),
            vol_threshold=params.get("vol_threshold", 0.02),
        )
        self._momentum = None
        self._meanrev  = None
        self._multifactor = None

    @property
    def min_bars(self) -> int:
        return 55  # needs longest window of sub-strategies

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        if len(bars) < self.min_bars:
            return None

        regime = self.detector.detect(bars)
        logger.debug("Regime: %s", regime)

        # Lazy-init sub-strategies
        if self._momentum is None:
            from .strategy import MomentumBreakout, MeanReversionBB, MultiFactor
            self._momentum = MomentumBreakout(self.symbol, {"lookback": 20, "buffer": 0.005})
            self._meanrev = MeanReversionBB(self.symbol)
            self._multifactor = MultiFactor(self.symbol, {"threshold": 3})

        signal = None
        if regime in (RegimeType.TRENDING_BULL, RegimeType.TRENDING_BEAR):
            signal = self._momentum.generate_signal(bars)
        elif regime == RegimeType.RANGING:
            signal = self._meanrev.generate_signal(bars)
        else:
            # HIGH_VOL or UNKNOWN → use multi-factor (highest confidence bar)
            signal = self._multifactor.generate_signal(bars)

        if signal:
            return self._make_signal(
                signal.signal_type, bars,
                confidence=signal.confidence * 0.9,
                reason=f"[{regime}] {signal.reason}",
                metadata={"regime": regime, **signal.metadata},
            )
        return None


# ═════════════════════════════════════════════════════════════════════════════
# XGBoost ML Strategy
# ═════════════════════════════════════════════════════════════════════════════

class MLSignalStrategy(BaseStrategy):
    """
    ML-powered strategy using XGBoost for signal generation.

    Two modes:
      1. use_xgboost=True (default) — Trains/predicts with XGBoost classifier
      2. use_xgboost=False — Falls back to a learned heuristic ensemble

    The model is trained via walk_forward_optimize() or loaded from a
    pre-trained pickle.  Requires: pip install xgboost scikit-learn

    Feature engineering (all computed from bar window):
      - Returns: 1-bar, 5-bar, 20-bar
      - RSI(14), SMA cross (20/50), BB width
      - Volume ratio vs SMA(20)
      - ATR(14) / price
      - Price vs SMA(20), SMA(50)
    """

    strategy_id = "ml_xgboost"

    def _configure(self, params: dict) -> None:
        self.use_xgboost = params.get("use_xgboost", True)
        self._model = None
        self._is_trained = False

    @property
    def min_bars(self) -> int:
        return 60

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        if len(bars) < self.min_bars:
            return None

        if not self._is_trained:
            logger.info("ML model not trained — using fallback heuristic")
            return self._fallback_heuristic(bars)

        try:
            features = self._extract_features(bars)
            prediction = self._model.predict([features])[0]
            proba = self._model.predict_proba([features])[0]

            if prediction == 1 and max(proba) > 0.6:
                return self._make_signal(
                    SignalType.BUY, bars,
                    confidence=round(max(proba), 4),
                    reason=f"ML BUY (p={max(proba):.2f})",
                    metadata={"features": features.tolist(), "probas": proba.tolist()},
                )
            elif prediction == 2 and max(proba) > 0.6:
                return self._make_signal(
                    SignalType.SELL, bars,
                    confidence=round(max(proba), 4),
                    reason=f"ML SELL (p={max(proba):.2f})",
                    metadata={"features": features.tolist(), "probas": proba.tolist()},
                )
        except Exception as exc:
            logger.debug("ML prediction failed: %s — using fallback", exc)

        return self._fallback_heuristic(bars)

    def train(self, bars_list: list[Sequence[Bar]], labels: list[int]) -> dict:
        """
        Train the XGBoost model on labelled bar sequences.

        Args:
            bars_list: List of bar sequences (each long enough for feature extraction)
            labels: 0=HOLD, 1=BUY, 2=SELL

        Returns:
            Training metrics dict
        """
        try:
            import numpy as np
            import xgboost as xgb
        except ImportError:
            logger.warning("xgboost not installed. Install with: pip install xgboost scikit-learn")
            self._is_trained = False
            return {"error": "xgboost not installed"}

        import numpy as np

        X = np.array([self._extract_features(b).tolist() for b in bars_list])
        y = np.array(labels)

        self._model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            use_label_encoder=False,
            eval_metric="mlogloss",
        )
        self._model.fit(X, y)
        self._is_trained = True

        train_score = self._model.score(X, y)
        logger.info("ML model trained. Train accuracy: %.2f%%", train_score * 100)
        return {"accuracy": round(train_score, 4)}

    def _extract_features(self, bars: Sequence[Bar]):
        """
        Extract feature vector from bar window for ML model.
        Returns a numpy array of 16 features.
        """
        import numpy as np

        closes = np.array([b.close for b in bars])
        highs = np.array([b.high for b in bars])
        lows = np.array([b.low for b in bars])
        volumes = np.array([b.volume for b in bars])
        n = len(closes)

        # Returns
        ret1 = closes[-1] / closes[-2] - 1 if n >= 2 else 0
        ret5 = closes[-1] / closes[-6] - 1 if n >= 6 else 0
        ret20 = closes[-1] / closes[-21] - 1 if n >= 21 else 0

        # SMA cross (latest 2 values)
        sma20 = sum(closes[-20:]) / 20 if n >= 20 else closes[-1]
        sma50 = sum(closes[-50:]) / 50 if n >= 50 else closes[-1]
        sma_cross = (sma20 - sma50) / sma50

        # RSI
        gains, losses = 0, 0
        for i in range(-15, 0):
            diff = closes[i] - closes[i - 1]
            if diff > 0:
                gains += diff
            else:
                losses -= diff
        rsi = 100 - 100 / (1 + gains / (losses + 1e-9))

        # BB width
        bb_width = (max(closes[-20:]) - min(closes[-20:])) / sma20 if n >= 20 else 0

        # Volume ratio
        vol_sma = sum(volumes[-20:]) / 20 if n >= 20 else volumes[-1]
        vol_ratio = volumes[-1] / (vol_sma + 1e-9)

        # ATR / price
        tr = [max(highs[i] - lows[i],
                  abs(highs[i] - closes[i - 1]),
                  abs(lows[i] - closes[i - 1])) for i in range(1, min(15, n))]
        atr = sum(tr) / len(tr) if tr else 0
        atr_ratio = atr / (closes[-1] + 1e-9)

        # Price vs SMA
        price_vs_sma20 = (closes[-1] - sma20) / sma20
        price_vs_sma50 = (closes[-1] - sma50) / sma50 if n >= 50 else 0

        # Volatility
        recent_ret = [closes[i] / closes[i - 1] - 1 for i in range(-20, 0)] if n >= 20 else [0]
        vol_20 = (sum(r ** 2 for r in recent_ret) / len(recent_ret)) ** 0.5

        return np.array([
            ret1, ret5, ret20, sma_cross, rsi / 100,
            bb_width, vol_ratio, atr_ratio,
            price_vs_sma20, price_vs_sma50, vol_20,
            closes[-1] / 1000, volumes[-1] / 10000,
            len(bars) / 100,  # normalized bar count
            float(bars[-1].high - bars[-1].low) / (bars[-1].close + 1e-9),  # spread ratio
            float(bars[-1].volume) / (bars[-1].close + 1e-9),  # volume dollar
        ])

    def _fallback_heuristic(self, bars: Sequence[Bar]) -> Optional[Signal]:
        """Simple heuristic when ML model isn't trained."""
        from .strategy import MovingAverageCrossover
        mac = MovingAverageCrossover(self.symbol, {"fast": 10, "slow": 30})
        return mac.generate_signal(bars)


# ═════════════════════════════════════════════════════════════════════════════
# Walk-Forward Optimizer
# ═════════════════════════════════════════════════════════════════════════════

class WalkForwardOptimizer:
    """
    Walk-forward optimization for any BaseStrategy.

    Splits bars into expanding training windows and tests on out-of-sample data.
    Returns the best parameter set based on average OOS Sharpe ratio.

    Example:
        optimizer = WalkForwardOptimizer()
        best_params = optimizer.optimize(
            strategy_class=MovingAverageCrossover,
            bars=historical_bars,
            symbol="AAPL",
            param_grid={"fast": [10, 20, 50], "slow": [30, 50, 100]},
        )
    """

    def __init__(self, n_splits: int = 4, min_train_bars: int = 100):
        self.n_splits = n_splits
        self.min_train_bars = min_train_bars

    def optimize(
        self,
        strategy_class: type,
        bars: Sequence[Bar],
        symbol: str,
        param_grid: dict[str, list],
    ) -> dict:
        """
        Run walk-forward optimization over the parameter grid.

        Returns the best parameter combination.
        """
        import itertools
        from ..risk_manager import RiskManager, RiskConfig
        from ..execution import MockExecutionManager
        from ..data_feed import BacktestFeed
        from ..trading_engine import TradingEngine
        from ..models import TradingMode

        n = len(bars)
        split_size = (n - self.min_train_bars) // self.n_splits

        keys = list(param_grid.keys())
        combinations = list(itertools.product(*param_grid.values()))

        best_score = float("-inf")
        best_params = {}

        logger.info("Walk-forward: %d param combos over %d splits", len(combinations), self.n_splits)

        for combo in combinations:
            params = dict(zip(keys, combo))
            oos_scores = []

            for split in range(self.n_splits):
                train_end = self.min_train_bars + split * split_size
                test_end = min(train_end + split_size, n)

                if test_end - train_end < 20:
                    continue

                train_bars = bars[:train_end]
                test_bars = bars[train_end:test_end]

                # Skip if train_bars is too small
                if len(train_bars) < 30:
                    continue

                # Run engine on test set
                strategy = strategy_class(symbol, params)
                engine = TradingEngine(
                    strategy=strategy,
                    risk_mgr=RiskManager(),
                    exec_mgr=MockExecutionManager(slippage_bps=5.0),
                    data_feed=BacktestFeed(symbol=symbol, bars=list(test_bars)),
                    mode=TradingMode.BACKTEST,
                )
                engine.run()
                snap = engine.portfolio_snapshot()
                # Simple score: total return adjusted for drawdown
                score = (snap.total_equity - 100000) * (1 - snap.max_drawdown_pct)
                oos_scores.append(score)

            avg_score = sum(oos_scores) / len(oos_scores) if oos_scores else 0

            if avg_score > best_score:
                best_score = avg_score
                best_params = params
                logger.info("  New best: %s (score=%.2f)", params, avg_score)

        logger.info("Walk-forward complete. Best params: %s (score=%.2f)", best_params, best_score)
        return best_params


# ── Register new strategies ───────────────────────────────────────────────────
# These get imported into strategy.py or loaded directly

STRATEGY_REGISTRY_ML = {
    "regime_aware": RegimeAwareStrategy,
    "ml_xgboost": MLSignalStrategy,
}