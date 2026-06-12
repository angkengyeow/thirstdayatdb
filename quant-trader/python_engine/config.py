"""
config.py — Centralised, environment-aware configuration.

Priority chain (highest → lowest):
  1. Environment variables   (TRADING_MODE, ALPACA_API_KEY, …)
  2. .env file               (loaded via python-dotenv if installed)
  3. Hardcoded defaults      (safe for local development only)

Security rules:
  • API keys are NEVER stored in source code.
  • Use environment variables or a secrets manager (AWS Secrets Manager,
    HashiCorp Vault, GCP Secret Manager) in production.
  • .env files must be added to .gitignore and NEVER committed.

Usage example:
  from python_engine.config import cfg, RiskConfig
  engine = TradingEngine(..., mode=cfg.mode)
"""

from __future__ import annotations
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from .models import TradingMode
from .risk_manager import RiskConfig

logger = logging.getLogger(__name__)

# ── Load .env if present ───────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
        logger.info("Loaded .env from %s", _env_path)
except ImportError:
    pass  # python-dotenv is optional


# ─── Main Config ──────────────────────────────────────────────────────────────

@dataclass
class EngineConfig:
    # ── Trading mode ──────────────────────────────────────────────────────────
    mode: TradingMode = field(
        default_factory=lambda: TradingMode(
            os.getenv("TRADING_MODE", TradingMode.BACKTEST.value)
        )
    )

    # ── Broker credentials (loaded from env — never hardcoded) ───────────────
    alpaca_api_key:    str = field(default_factory=lambda: os.getenv("ALPACA_API_KEY", ""))
    alpaca_secret_key: str = field(default_factory=lambda: os.getenv("ALPACA_SECRET_KEY", ""))
    alpaca_paper:      bool = field(
        default_factory=lambda: os.getenv("ALPACA_PAPER", "true").lower() == "true"
    )

    # ── Symbol & strategy ─────────────────────────────────────────────────────
    symbol:      str  = field(default_factory=lambda: os.getenv("SYMBOL", "AAPL"))
    strategy:    str  = field(default_factory=lambda: os.getenv("STRATEGY", "ma_crossover"))
    bar_type:    str  = field(default_factory=lambda: os.getenv("BAR_TYPE", "5Min"))

    # ── Capital ───────────────────────────────────────────────────────────────
    starting_cash: float = field(
        default_factory=lambda: float(os.getenv("STARTING_CASH", "100000"))
    )

    # ── Engine tuning ─────────────────────────────────────────────────────────
    bar_window:   int   = 200
    heartbeat_s:  float = 0.05

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    # ── Risk parameters ───────────────────────────────────────────────────────
    risk: RiskConfig = field(default_factory=RiskConfig)

    def __post_init__(self) -> None:
        logging.basicConfig(
            level   = getattr(logging, self.log_level, logging.INFO),
            format  = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
            datefmt = "%Y-%m-%dT%H:%M:%S",
        )
        if self.mode != TradingMode.BACKTEST:
            if not self.alpaca_api_key or not self.alpaca_secret_key:
                raise EnvironmentError(
                    "ALPACA_API_KEY and ALPACA_SECRET_KEY must be set for "
                    f"mode={self.mode.value}.  "
                    "Set them as environment variables or in a .env file."
                )

    @property
    def is_live(self) -> bool:
        return self.mode == TradingMode.LIVE_TRADE

    @property
    def is_paper(self) -> bool:
        return self.mode == TradingMode.PAPER_TRADE

    @property
    def is_backtest(self) -> bool:
        return self.mode == TradingMode.BACKTEST


# ── Singleton ─────────────────────────────────────────────────────────────────
cfg = EngineConfig()
