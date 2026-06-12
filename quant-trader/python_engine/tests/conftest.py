"""
conftest.py — Shared test fixtures for all test modules.

Provides:
  - generate_test_bars() — deterministic OHLCV bar sequences
  - Fully wired MockEngine for integration tests
"""

from __future__ import annotations
import random
from datetime import datetime, timedelta, timezone
from typing import Sequence

import pytest

from ..models import Bar


def generate_test_bars(
    symbol: str = "TEST",
    count: int = 200,
    base_price: float = 100.0,
    volatility: float = 0.005,
    seed: int = 42,
    trend: float = 0.0,  # drift per bar
) -> list[Bar]:
    """
    Generate deterministic OHLCV bars for testing.

    With trend=0, bars follow a seeded random walk (reproducible).
    With trend > 0, bars drift upward (bullish) or downward (bearish).
    """
    rng = random.Random(seed)
    price = base_price
    bars: list[Bar] = []
    now = datetime.now(timezone.utc)

    for i in range(count, 0, -1):
        change = (rng.random() - 0.49) * volatility * price + trend * price
        close_p = max(price + change, 0.01)
        high_p = max(price, close_p) + rng.random() * volatility * price * 0.5
        low_p = min(price, close_p) - rng.random() * volatility * price * 0.5
        volume = rng.randint(500, 15000)

        bars.append(Bar(
            symbol=symbol,
            timestamp=now - timedelta(minutes=5 * i),
            open=round(price, 6),
            high=round(high_p, 6),
            low=round(low_p, 6),
            close=round(close_p, 6),
            volume=float(volume),
        ))
        price = close_p

    return bars


@pytest.fixture
def test_bars() -> list[Bar]:
    """200 bars of synthetic data with no trend."""
    return generate_test_bars(count=200)


@pytest.fixture
def bullish_bars() -> list[Bar]:
    """200 bars with upward drift (2% per bar) — strong uptrend."""
    return generate_test_bars(count=200, trend=0.002, volatility=0.003)


@pytest.fixture
def bearish_bars() -> list[Bar]:
    """200 bars with downward drift — strong downtrend."""
    return generate_test_bars(count=200, trend=-0.002, volatility=0.003, seed=99)


@pytest.fixture
def volatile_bars() -> list[Bar]:
    """200 bars with high volatility — for risk manager testing."""
    return generate_test_bars(count=200, volatility=0.03, seed=7)