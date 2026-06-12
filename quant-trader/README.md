# QuantexPro — Enterprise Algorithmic Trading Engine

Production-grade, automated algorithmic trading platform with a Python trading engine and real-time React dashboard.

## Architecture

```
┌──────────────┐    Signals     ┌──────────────┐    Orders     ┌──────────────┐
│  Data Feed   │ ─────────────> │   Strategy   │ ───────────> │  Execution   │
│ (Backtest /  │                │   Engine     │               │   Manager    │
│  Live/WS)    │                │              │               │ (Mock/Alpaca)│
└──────────────┘                └──────┬───────┘               └──────┬───────┘
                                       │                             │
                                       v                             v
                                ┌──────────────┐            ┌──────────────┐
                                │    Risk      │            │   Broker     │
                                │   Manager    │            │  Connector   │
                                │ (Gatekeeper) │            │  (Alpaca)    │
                                └──────────────┘            └──────────────┘
```

## Quick Start

```bash
# Backtest with synthetic data
python -m python_engine.main

# Backtest from CSV
python -m python_engine.main --csv data/AAPL_5min.csv

# Paper trade (requires Alpaca credentials)
TRADING_MODE=PAPER_TRADE python -m python_engine.main

# Web UI
npm install
npm run dev
```

## Python Engine

### Components

| Module | Description |
|--------|-------------|
| `trading_engine.py` | Core event loop — orchestrates data → strategy → risk → execution |
| `strategy.py` | Abstract strategy framework + built-in strategies (MA crossover, RSI, MACD, Bollinger, multi-factor) |
| `strategy_ml.py` | ML-enhanced strategies (Random Forest signal classifier, ensemble) |
| `risk_manager.py` | Hard-coded risk gatekeeper — max drawdown, position sizing, stop-loss/take-profit |
| `execution.py` | Order execution — `MockExecutionManager` (backtest/paper) + `AlpacaExecutionManager` (live) |
| `broker.py` | Broker connector — authentication, account sync, positions, orders, bracket orders, emergency kill |
| `portfolio_manager.py` | Portfolio tracking, allocation, rebalancing |
| `data_feed.py` | Data feeds — `BacktestFeed` (CSV/synthetic) + `LiveFeed` (Alpaca WebSocket) |
| `security.py` | Fernet encryption for API keys, audit logging (JSONL), token-bucket rate limiter |
| `config.py` | Environment-aware config (env vars → .env → defaults) |
| `monitoring/` | Multi-channel alerting (Telegram, Discord, Slack), structured logging, Prometheus metrics |
| `api/` | REST + WebSocket API servers for real-time dashboard integration |
| `db/` | Database layer (SQLAlchemy models, repository pattern) |
| `scheduler/` | Cron-style task scheduler for recurring jobs |

### Configuration

Copy `.env.example` to `.env` and set your values:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TRADING_MODE` | `BACKTEST` | `BACKTEST`, `PAPER_TRADE`, or `LIVE_TRADE` |
| `SYMBOL` | `AAPL` | Trading symbol |
| `STRATEGY` | `ma_crossover` | Strategy identifier |
| `STARTING_CASH` | `100000` | Starting capital |
| `ALPACA_API_KEY` | — | Alpaca API key (required for paper/live) |
| `ALPACA_SECRET_KEY` | — | Alpaca secret key |

### Modes

- **BACKTEST** — Runs on CSV or synthetic data. No real orders. Fast.
- **PAPER_TRADE** — Connects to Alpaca paper trading API. Simulated money, real market data.
- **LIVE_TRADE** — Real money. All risk controls active. Use with extreme caution.

### Tests

```bash
cd python_engine && python -m pytest tests/ -v
# 109+ tests covering all major modules
```

## Web Dashboard

Built with React 19 + Vite 8 + Tailwind CSS 4.

### Features

- Real-time price charts with simulated data feed
- Technical indicators: RSI, MACD, Bollinger Bands
- Strategy backtesting with equity curve and trade breakdown
- Auto-trading bot with multi-symbol support and watchlist management
- Order book visualization
- Live engine dashboard
- Strategy comparison mode
- System blueprint documentation

### Tabs

| Tab | Description |
|-----|-------------|
| CHART | Price chart with RSI/MACD indicators and signal overlays |
| BACKTEST | Equity curve and trade breakdown |
| ORDERBOOK | Simulated order book depth |
| TRADES | Historical and live trade log |
| LIVE ENGINE | Real-time engine performance |
| COMPARE | Side-by-side strategy comparison |
| BLUEPRINT | System architecture documentation |

## Docker

```bash
# Full stack (engine + web + nginx + db)
docker compose up -d

# Development
docker compose -f docker-compose.dev.yml up
```

## Infrastructure

- **Engine**: Python 3.11+ in Docker container
- **Web**: Static build served via nginx
- **Database**: PostgreSQL (via Docker Compose)
- **Monitoring**: Prometheus metrics + multi-channel alerts (Telegram/Discord/Slack)
- **Secrets**: Environment variables or AWS Secrets Manager

## Alerting Channels

Configure via environment variables:

| Channel | Variables |
|---------|-----------|
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Discord | `DISCORD_WEBHOOK_URL` |
| Slack | `SLACK_WEBHOOK_URL` |

Alerts are sent for: drawdown thresholds, kill-switch activation, order fills, engine errors, and startup.

## License

Proprietary — for authorized use only.