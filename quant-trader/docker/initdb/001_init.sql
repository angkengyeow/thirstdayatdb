-- QuantexPro — Database initialisation
-- Creates hypertables for time-series OHLCV data

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ── Trades ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
    id              BIGSERIAL PRIMARY KEY,
    symbol          VARCHAR(20) NOT NULL,
    side            VARCHAR(4) NOT NULL,           -- BUY / SELL
    quantity        DOUBLE PRECISION NOT NULL,
    entry_price     DOUBLE PRECISION NOT NULL,
    exit_price      DOUBLE PRECISION,
    stop_loss       DOUBLE PRECISION,
    take_profit     DOUBLE PRECISION,
    pnl             DOUBLE PRECISION,
    pnl_pct         DOUBLE PRECISION,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN / CLOSED
    strategy_id     VARCHAR(50),
    signal_confidence DOUBLE PRECISION,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    broker_order_id VARCHAR(100),
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_opened_at ON trades(opened_at DESC);
CREATE INDEX idx_trades_status ON trades(status);

-- ── Portfolio Snapshots ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cash            DOUBLE PRECISION NOT NULL,
    equity          DOUBLE PRECISION NOT NULL,
    unrealised_pnl  DOUBLE PRECISION DEFAULT 0,
    realised_pnl    DOUBLE PRECISION DEFAULT 0,
    max_drawdown_pct DOUBLE PRECISION DEFAULT 0,
    open_positions  INTEGER DEFAULT 0,
    snapshot_data   JSONB DEFAULT '{}'
);

SELECT create_hypertable('portfolio_snapshots', 'timestamp', if_not_exists => TRUE);

-- ── OHLCV Bars (historical) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bars (
    time            TIMESTAMPTZ NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    open            DOUBLE PRECISION NOT NULL,
    high            DOUBLE PRECISION NOT NULL,
    low             DOUBLE PRECISION NOT NULL,
    close           DOUBLE PRECISION NOT NULL,
    volume          DOUBLE PRECISION NOT NULL,
    interval        VARCHAR(10) NOT NULL DEFAULT '5min'
);

SELECT create_hypertable('bars', 'time', if_not_exists => TRUE);

CREATE INDEX idx_bars_symbol_time ON bars(symbol, time DESC);

-- ── Signals Log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_log (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol          VARCHAR(20) NOT NULL,
    signal_type     VARCHAR(10) NOT NULL,          -- BUY / SELL / HOLD
    price           DOUBLE PRECISION NOT NULL,
    confidence      DOUBLE PRECISION DEFAULT 0,
    strategy_id     VARCHAR(50),
    reason          TEXT,
    risk_accepted   BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason TEXT,
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_signal_log_timestamp ON signal_log(timestamp DESC);
CREATE INDEX idx_signal_log_symbol ON signal_log(symbol);