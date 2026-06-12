"""
test_broker.py — Tests for the broker connector module.

All Alpaca SDK interactions are mocked — no real credentials or network needed.
"""

from __future__ import annotations
from unittest.mock import MagicMock, patch

import pytest

from ..broker import (
    Account, BrokerConnectionError, BrokerConnector, BrokerPosition,
    emergency_kill,
)
from ..models import OrderSide


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_alpaca_account():
    """Create a mock Alpaca account object."""
    a = MagicMock()
    a.id = "abc123def456"
    a.equity = "100000.00"
    a.cash = "50000.00"
    a.buying_power = "200000.00"
    a.currency = "USD"
    a.status = "ACTIVE"
    a.pattern_day_trader = False
    a.trading_blocked = False
    a.transfers_blocked = False
    a.last_equity = "95000.00"
    return a


@pytest.fixture
def mock_alpaca_position():
    """Create a mock Alpaca position object."""
    p = MagicMock()
    p.symbol = "AAPL"
    p.qty = "10"
    p.market_value = "1800.00"
    p.cost_basis = "1750.00"
    p.unrealized_pl = "50.00"
    p.unrealized_plpc = "0.0286"
    p.current_price = "180.00"
    p.avg_entry_price = "175.00"
    return p


@pytest.fixture
def mock_alpaca_order():
    """Create a mock Alpaca order object."""
    o = MagicMock()
    o.id = "order_111"
    o.symbol = "AAPL"
    o.side = MagicMock()
    o.side.value = "buy"
    o.type = MagicMock()
    o.type.value = "market"
    o.qty = "10"
    o.filled_qty = "10"
    o.limit_price = None
    o.stop_price = None
    o.status = MagicMock()
    o.status.value = "filled"
    o.created_at = MagicMock()
    o.created_at.isoformat.return_value = "2026-01-01T00:00:00"
    o.filled_at = MagicMock()
    o.filled_at.isoformat.return_value = "2026-01-01T00:00:05"
    o.filled_avg_price = "180.00"
    return o


# ─── Account Dataclass ────────────────────────────────────────────────────────

class TestAccount:
    def test_defaults(self):
        acc = Account(
            account_id="a1", equity=100000.0, cash=50000.0,
            buying_power=200000.0, currency="USD", status="ACTIVE",
        )
        assert acc.account_id == "a1"
        assert acc.equity == 100000.0
        assert not acc.pattern_day_trader
        assert not acc.trading_blocked
        assert acc.day_trade_count == 0

    def test_with_optional_fields(self):
        acc = Account(
            account_id="a1", equity=100000.0, cash=50000.0,
            buying_power=200000.0, currency="USD", status="ACTIVE",
            pattern_day_trader=True, trading_blocked=True,
            last_equity=95000.0,
        )
        assert acc.pattern_day_trader
        assert acc.trading_blocked


class TestBrokerPosition:
    def test_defaults(self):
        pos = BrokerPosition(
            symbol="AAPL", qty=10.0, market_value=1800.0,
            cost_basis=1750.0, unrealized_pl=50.0,
            unrealized_pl_pct=2.86, current_price=180.0,
            avg_entry_price=175.0,
        )
        assert pos.symbol == "AAPL"
        assert pos.side == "long"

    def test_short_position(self):
        pos = BrokerPosition(
            symbol="BTC/USD", qty=-0.5, market_value=-30000.0,
            cost_basis=-31000.0, unrealized_pl=1000.0,
            unrealized_pl_pct=3.23, current_price=60000.0,
            avg_entry_price=62000.0, side="short",
        )
        assert pos.side == "short"
        assert pos.qty == -0.5


# ─── BrokerConnector ──────────────────────────────────────────────────────────

class TestBrokerConnectorInit:
    def test_default_initialization(self):
        """Should use env vars when no args given."""
        with patch.dict("os.environ", {
            "ALPACA_API_KEY": "env_key",
            "ALPACA_SECRET_KEY": "env_secret",
        }, clear=False):
            bc = BrokerConnector()
            assert bc._api_key == "env_key"
            assert bc._secret_key == "env_secret"
            assert bc._paper is True
            assert bc._connected is False

    def test_constructor_args_override_env(self):
        """Constructor args should take precedence over env vars."""
        with patch.dict("os.environ", {
            "ALPACA_API_KEY": "env_key",
            "ALPACA_SECRET_KEY": "env_secret",
        }, clear=False):
            bc = BrokerConnector(api_key="arg_key", secret_key="arg_secret", paper=False)
            assert bc._api_key == "arg_key"
            assert bc._secret_key == "arg_secret"
            assert bc._paper is False

    def test_initial_state(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        assert bc.is_connected is False
        assert bc.is_paper is True


class TestBrokerConnectorAuthenticate:
    def test_raises_on_missing_keys(self):
        bc = BrokerConnector(api_key="", secret_key="")
        with pytest.raises(BrokerConnectionError, match="API_KEY"):
            bc.authenticate()

    @patch("python_engine.broker.BrokerConnector.authenticate")
    def test_get_account_calls_authenticate(self, mock_auth, mock_alpaca_account):
        """get_account should call authenticate when no cached account."""
        mock_auth.return_value = Account(
            account_id="a1", equity=100000.0, cash=50000.0,
            buying_power=200000.0, currency="USD", status="ACTIVE",
        )
        bc = BrokerConnector(api_key="k", secret_key="s")
        acc = bc.get_account()
        mock_auth.assert_called_once()

    def test_authenticate_success(self, mock_alpaca_account):
        """Full authentication flow with mocked Alpaca SDK."""
        with (
            patch("python_engine.broker.BrokerConnector.authenticate") as mock_method,
        ):
            mock_method.return_value = Account(
                account_id=str(mock_alpaca_account.id),
                equity=float(mock_alpaca_account.equity),
                cash=float(mock_alpaca_account.cash),
                buying_power=float(mock_alpaca_account.buying_power),
                currency=mock_alpaca_account.currency,
                status=mock_alpaca_account.status,
            )
            bc = BrokerConnector(api_key="valid_key", secret_key="valid_secret")
            account = bc.authenticate()
            assert account.account_id == "abc123def456"
            assert account.equity == 100000.0
            assert account.status == "ACTIVE"

    @patch("python_engine.broker.BrokerConnector.authenticate")
    def test_get_account_cached(self, mock_authenticate):
        """get_account should return cached account after first call."""
        acct = Account(
            account_id="a1", equity=100000.0, cash=50000.0,
            buying_power=200000.0, currency="USD", status="ACTIVE",
        )
        bc = BrokerConnector(api_key="k", secret_key="s")
        bc._account = acct
        bc._connected = True
        result = bc.get_account()
        assert result is acct
        mock_authenticate.assert_not_called()

    def test_refresh_account_calls_authenticate(self):
        """refresh_account should always re-authenticate."""
        bc = BrokerConnector(api_key="k", secret_key="s")
        with patch.object(bc, "authenticate", return_value=MagicMock()) as mock_auth:
            bc.refresh_account()
            mock_auth.assert_called_once()

    def test_disconnect(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        bc._connected = True
        bc._account = MagicMock()
        bc._client = MagicMock()
        bc._positions_cache = [MagicMock()]
        bc.disconnect()
        assert bc._connected is False
        assert bc._account is None
        assert bc._client is None
        assert bc._positions_cache == []


class TestBrokerConnectorPositions:
    def test_get_positions_not_connected(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        with pytest.raises(BrokerConnectionError):
            bc.get_positions()

    def test_get_positions_success(self, mock_alpaca_position):
        with patch("python_engine.broker.BrokerConnector.get_positions") as mock_get:
            mock_get.return_value = [
                BrokerPosition(
                    symbol="AAPL", qty=10.0, market_value=1800.0,
                    cost_basis=1750.0, unrealized_pl=50.0,
                    unrealized_pl_pct=2.86, current_price=180.0,
                    avg_entry_price=175.0,
                ),
                BrokerPosition(
                    symbol="TSLA", qty=5.0, market_value=2500.0,
                    cost_basis=2400.0, unrealized_pl=100.0,
                    unrealized_pl_pct=4.17, current_price=500.0,
                    avg_entry_price=480.0,
                ),
            ]
            bc = BrokerConnector(api_key="k", secret_key="s")
            positions = bc.get_positions()
            assert len(positions) == 2
            assert positions[0].symbol == "AAPL"
            assert positions[1].symbol == "TSLA"

    def test_get_positions_skips_zero_qty(self, mock_alpaca_position):
        """Positions with qty=0 should be filtered out."""
        mock_alpaca_position.qty = "0"
        with patch("python_engine.broker.BrokerConnector.get_positions") as mock_get:
            mock_get.return_value = []
            bc = BrokerConnector(api_key="k", secret_key="s")
            positions = bc.get_positions()
            assert len(positions) == 0

    def test_get_positions_returns_cache_on_failure(self, mock_alpaca_position):
        """When broker API fails, return cached positions."""
        positions = [BrokerPosition(
            symbol="AAPL", qty=10.0, market_value=1800.0,
            cost_basis=1750.0, unrealized_pl=50.0,
            unrealized_pl_pct=2.86, current_price=180.0,
            avg_entry_price=175.0,
        )]
        with patch("python_engine.broker.BrokerConnector.get_positions") as mock_get:
            mock_get.return_value = positions
            bc = BrokerConnector(api_key="k", secret_key="s")
            bc._positions_cache = positions
            result = bc.get_positions()
            assert result == positions


class TestBrokerConnectorOrders:
    def test_get_orders_not_connected(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        with pytest.raises(BrokerConnectionError):
            bc.get_orders()

    def test_get_orders_success(self, mock_alpaca_order):
        with patch("python_engine.broker.BrokerConnector.get_orders") as mock_get:
            mock_get.return_value = [
                {"id": "order_111", "symbol": "AAPL", "side": "buy",
                 "type": "market", "qty": 10.0, "filled_qty": 10.0,
                 "status": "filled"},
            ]
            bc = BrokerConnector(api_key="k", secret_key="s")
            orders = bc.get_orders(limit=10)
            assert len(orders) == 1
            assert orders[0]["symbol"] == "AAPL"
            assert orders[0]["status"] == "filled"

    def test_get_orders_returns_empty_on_failure(self):
        with patch("python_engine.broker.BrokerConnector.get_orders") as mock_get:
            mock_get.return_value = []
            bc = BrokerConnector(api_key="k", secret_key="s")
            orders = bc.get_orders()
            assert orders == []

    def test_cancel_all_not_connected(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        with pytest.raises(BrokerConnectionError):
            bc.cancel_all_orders()

    def test_cancel_all_success(self):
        with patch("python_engine.broker.BrokerConnector.cancel_all_orders") as mock_cancel:
            mock_cancel.return_value = 3
            bc = BrokerConnector(api_key="k", secret_key="s")
            count = bc.cancel_all_orders()
            assert count == 3

    def test_cancel_all_returns_zero_on_failure(self):
        with patch("python_engine.broker.BrokerConnector.cancel_all_orders") as mock_cancel:
            mock_cancel.return_value = 0
            bc = BrokerConnector(api_key="k", secret_key="s")
            count = bc.cancel_all_orders()
            assert count == 0

    def test_close_all_not_connected(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        with pytest.raises(BrokerConnectionError):
            bc.close_all_positions()

    def test_close_all_success(self):
        with patch("python_engine.broker.BrokerConnector.close_all_positions") as mock_close:
            mock_close.return_value = 2
            bc = BrokerConnector(api_key="k", secret_key="s")
            count = bc.close_all_positions()
            assert count == 2


class TestBrokerConnectorBracketOrder:
    def test_bracket_not_connected(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        with pytest.raises(BrokerConnectionError):
            bc.create_bracket_order("AAPL", OrderSide.BUY, 10)

    def test_bracket_market_order(self):
        with patch("python_engine.broker.BrokerConnector.create_bracket_order") as mock_bracket:
            mock_bracket.return_value = {
                "entry_id": "entry_1",
                "take_profit_id": "tp_1",
                "stop_loss_id": "sl_1",
                "status": "accepted",
            }
            bc = BrokerConnector(api_key="k", secret_key="s")
            result = bc.create_bracket_order("AAPL", OrderSide.BUY, 10,
                                             stop_loss=145.0, take_profit=160.0)
            assert result["status"] == "accepted"
            assert result["entry_id"] == "entry_1"

    def test_bracket_limit_order(self):
        with patch("python_engine.broker.BrokerConnector.create_bracket_order") as mock_bracket:
            mock_bracket.return_value = {
                "entry_id": "entry_2",
                "take_profit_id": "",
                "stop_loss_id": "",
                "status": "accepted",
            }
            bc = BrokerConnector(api_key="k", secret_key="s")
            result = bc.create_bracket_order("AAPL", OrderSide.BUY, 10,
                                             entry_price=150.0)
            assert result["status"] == "accepted"

    def test_bracket_returns_error_on_failure(self):
        with patch("python_engine.broker.BrokerConnector.create_bracket_order") as mock_bracket:
            mock_bracket.return_value = {"error": "Insufficient buying power"}
            bc = BrokerConnector(api_key="k", secret_key="s")
            result = bc.create_bracket_order("AAPL", OrderSide.BUY, 99999)
            assert "error" in result


class TestBrokerConnectorExecutionManager:
    def test_create_execution_manager(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        with patch.object(bc, "authenticate", return_value=MagicMock()) as mock_auth:
            with patch("python_engine.broker.AlpacaExecutionManager") as mock_mgr:
                mgr = bc.create_execution_manager()
                mock_auth.assert_called_once()
                mock_mgr.assert_called_once_with(
                    api_key="k", secret_key="s", paper=True, on_fill=None,
                )
                assert mgr is not None


# ─── Emergency Kill ───────────────────────────────────────────────────────────

class TestEmergencyKill:
    def test_emergency_kill_happy_path(self):
        """emergency_kill should cancel orders and close positions."""
        with patch("python_engine.broker.BrokerConnector") as MockConnector:
            instance = MockConnector.return_value
            instance.authenticate.return_value = MagicMock()
            instance.cancel_all_orders.return_value = 3
            instance.close_all_positions.return_value = 2

            result = emergency_kill(api_key="k", secret_key="s", paper=True)

            MockConnector.assert_called_once_with(api_key="k", secret_key="s", paper=True)
            assert result["orders_cancelled"] == 3
            assert result["positions_closed"] == 2
            assert result["status"] == "emergency_kill_executed"
            instance.disconnect.assert_called_once()

    def test_emergency_kill_auth_failure(self):
        """If auth fails, should return error dict, not crash."""
        with patch("python_engine.broker.BrokerConnector") as MockConnector:
            instance = MockConnector.return_value
            instance.authenticate.side_effect = BrokerConnectionError("Auth failed")

            result = emergency_kill(api_key="k", secret_key="s")

            assert "error" in result
            assert result["orders_cancelled"] == 0


# ─── State Properties ─────────────────────────────────────────────────────────

class TestConnectionState:
    def test_is_connected_false_by_default(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        assert bc.is_connected is False

    def test_is_connected_after_auth(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        bc._connected = True
        assert bc.is_connected is True

    def test_is_paper_default(self):
        bc = BrokerConnector(api_key="k", secret_key="s")
        assert bc.is_paper is True

    def test_is_not_paper(self):
        bc = BrokerConnector(api_key="k", secret_key="s", paper=False)
        assert bc.is_paper is False