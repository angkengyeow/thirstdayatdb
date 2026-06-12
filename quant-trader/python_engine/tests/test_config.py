"""
test_config.py — Tests for engine configuration, env-var loading, and risk defaults.
"""

import os

import pytest

from ..config import EngineConfig, cfg
from ..models import TradingMode
from ..risk_manager import RiskConfig


class TestRiskConfigDefaults:
    def test_default_values(self):
        rc = RiskConfig()
        assert rc.max_drawdown_pct == 0.15
        assert rc.max_position_risk == 0.02
        assert rc.max_portfolio_risk == 0.30
        assert rc.max_open_positions == 5
        assert rc.stop_loss_pct == 0.02
        assert rc.take_profit_pct == 0.05
        assert rc.min_confidence == 0.0
        assert rc.min_notional == 10.0

    def test_custom_values(self):
        rc = RiskConfig(
            max_drawdown_pct=0.20,
            max_position_risk=0.01,
            max_open_positions=3,
            stop_loss_pct=0.015,
            take_profit_pct=0.03,
        )
        assert rc.max_drawdown_pct == 0.20
        assert rc.max_position_risk == 0.01
        assert rc.max_open_positions == 3
        assert rc.stop_loss_pct == 0.015
        assert rc.take_profit_pct == 0.03

    def test_edge_zero_values(self):
        rc = RiskConfig(max_drawdown_pct=0, max_open_positions=0)
        assert rc.max_drawdown_pct == 0
        assert rc.max_open_positions == 0


class TestEngineConfig:
    def test_default_mode_is_backtest(self):
        assert cfg.mode == TradingMode.BACKTEST

    def test_backtest_property(self):
        # Since the default is backtest
        assert cfg.is_backtest

    def test_properties(self):
        assert cfg.symbol is not None
        assert cfg.strategy is not None
        assert cfg.starting_cash > 0
        assert cfg.bar_window > 0
        assert cfg.heartbeat_s > 0