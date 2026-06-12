import { useState } from 'react';

const SECTIONS = ['ARCHITECTURE', 'COMPONENTS', 'STACK', 'INFRASTRUCTURE', 'PYTHON ENGINE'];

const TAG = ({ children, color = 'var(--accent)' }) => (
  <span style={{
    fontSize: 8, letterSpacing: '1.5px', fontFamily: 'Space Mono',
    padding: '2px 7px', borderRadius: 2,
    background: color === 'var(--accent)' ? 'rgba(0,212,255,0.1)' : `${color}18`,
    border: `1px solid ${color === 'var(--accent)' ? 'rgba(0,212,255,0.3)' : `${color}55`}`,
    color,
  }}>
    {children}
  </span>
);

const Card = ({ title, tag, tagColor, children, accent = false }) => (
  <div style={{
    background: accent ? 'rgba(0,212,255,0.04)' : 'var(--surface)',
    border: `1px solid ${accent ? 'rgba(0,212,255,0.25)' : 'var(--border)'}`,
    borderRadius: 2, padding: 16,
  }}>
    <div className="flex items-center justify-between mb-3">
      <span style={{ fontSize: 10, fontFamily: 'Space Mono', letterSpacing: '1.5px', color: 'var(--text)', fontWeight: 700 }}>
        {title}
      </span>
      {tag && <TAG color={tagColor}>{tag}</TAG>}
    </div>
    {children}
  </div>
);

const Row = ({ label, value, mono = true, color }) => (
  <div className="flex justify-between items-start py-1" style={{ borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
    <span style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.5px' }}>{label}</span>
    <span style={{ fontSize: 9, fontFamily: mono ? 'Space Mono' : 'inherit', color: color || 'var(--text2)', textAlign: 'right', maxWidth: '60%' }}>
      {value}
    </span>
  </div>
);

const Arrow = ({ label }) => (
  <div className="flex flex-col items-center" style={{ gap: 2 }}>
    <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
    <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '1px' }}>{label}</div>
    <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--border)' }} />
  </div>
);

const FlowBox = ({ label, sub, color = 'var(--accent)', icon }) => (
  <div style={{
    border: `1px solid ${color}55`,
    background: `${color}09`,
    borderRadius: 2, padding: '8px 12px',
    textAlign: 'center', minWidth: 100,
  }}>
    {icon && <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>}
    <div style={{ fontSize: 9, color, fontFamily: 'Space Mono', letterSpacing: '1px', fontWeight: 700 }}>{label}</div>
    {sub && <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

// ─── Section: Architecture ────────────────────────────────────────────────────
function ArchitectureSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Flow diagram */}
      <Card title="EVENT-DRIVEN FLOW" tag="CORE LOOP" accent>
        <div className="flex flex-col items-center" style={{ gap: 0, padding: '8px 0' }}>
          <FlowBox label="DATA FEED" sub="WS / CSV / REST" color="var(--accent)" icon="📡" />
          <Arrow label="Bar objects" />
          <FlowBox label="STRATEGY ENGINE" sub="Signal generation" color="#a29bfe" icon="🧠" />
          <Arrow label="Signal (BUY/SELL/HOLD)" />
          <FlowBox label="RISK MANAGER" sub="Validate + size" color="var(--accent2)" icon="🛡️" />
          <Arrow label="OrderRequest" />
          <FlowBox label="EXECUTION MANAGER" sub="Broker API" color="var(--accent3)" icon="⚡" />
          <Arrow label="Fill callback" />
          <FlowBox label="PORTFOLIO STATE" sub="Positions + P&L" color="var(--danger)" icon="📊" />
        </div>
      </Card>

      {/* Mode switch */}
      <Card title="BACKTEST ↔ LIVE SWITCH">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { mode: 'BACKTEST', feed: 'BacktestFeed (CSV/DB)', exec: 'MockExecutionManager', color: '#a29bfe' },
            { mode: 'PAPER TRADE', feed: 'WebSocketFeed (Alpaca)', exec: 'MockExecutionManager', color: '#74b9ff' },
            { mode: 'LIVE TRADE', feed: 'WebSocketFeed (Alpaca)', exec: 'AlpacaExecutionManager', color: 'var(--accent3)' },
          ].map(m => (
            <div key={m.mode} style={{ border: `1px solid ${m.color}44`, background: `${m.color}08`, borderRadius: 2, padding: 10 }}>
              <TAG color={m.color}>{m.mode}</TAG>
              <div className="mt-2" style={{ fontSize: 8, color: 'var(--text2)', lineHeight: 1.8 }}>
                <div>Feed: <span style={{ color: m.color }}>{m.feed}</span></div>
                <div>Exec: <span style={{ color: m.color }}>{m.exec}</span></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 8, color: 'var(--muted)', lineHeight: 1.8, padding: '8px', background: 'rgba(0,212,255,0.04)', borderRadius: 2, border: '1px solid rgba(0,212,255,0.1)' }}>
          Strategy logic is <span style={{ color: 'var(--accent)' }}>identical</span> across all modes.
          Only the Feed and ExecutionManager implementations change —
          controlled by a single <code style={{ color: 'var(--accent2)' }}>TRADING_MODE</code> env var.
        </div>
      </Card>
    </div>
  );
}

// ─── Section: Components ─────────────────────────────────────────────────────
function ComponentsSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[
        {
          title: 'DATA INGESTION ENGINE', tag: 'data_feed.py', tagColor: 'var(--accent)',
          items: [
            ['BacktestFeed', 'CSV / DB → Bar objects, replay at configurable speed'],
            ['AlpacaWebSocketFeed', 'Real-time bar stream with auto-reconnect & exponential back-off'],
            ['REST Backfill', 'Prefetches last N bars on startup to warm indicator windows'],
            ['Thread Safety', 'Feed runs in daemon thread; bars land in thread-safe Queue'],
            ['feed.drain()', 'Engine drains queue on each heartbeat — zero blocking'],
          ]
        },
        {
          title: 'STRATEGY & SIGNAL ENGINE', tag: 'strategy.py', tagColor: '#a29bfe',
          items: [
            ['BaseStrategy', 'Abstract class; subclass and implement generate_signal()'],
            ['MovingAverageCrossover', 'SMA golden/death cross (fast=20, slow=50)'],
            ['MeanReversionBB', 'RSI extreme + Bollinger Band touch confluence'],
            ['MomentumBreakout', 'N-bar high/low breakout with configurable buffer'],
            ['MultiFactor', '3-of-5 confluence scoring (MACD, RSI, trend, volume, histogram)'],
            ['Stateless design', 'Receives full bar window; returns Signal | None'],
          ]
        },
        {
          title: 'RISK MANAGEMENT ENGINE', tag: 'risk_manager.py', tagColor: 'var(--accent2)',
          items: [
            ['Kill-switch', 'Halts ALL new positions when max drawdown % is breached'],
            ['Portfolio heat check', 'Rejects signal if aggregate risk-at-stake exceeds threshold'],
            ['Position cap', 'Hard limit on concurrent open positions'],
            ['Fixed-fractional sizing', 'qty = (equity × risk%) / (price × stop_pct)'],
            ['Mandatory SL/TP', 'Every OrderRequest has stop-loss and take-profit — non-negotiable'],
            ['Min confidence filter', 'Configurable threshold on signal.confidence score'],
          ]
        },
        {
          title: 'ORDER EXECUTION MANAGER', tag: 'execution.py', tagColor: 'var(--accent3)',
          items: [
            ['MockExecutionManager', 'In-process fill simulation with slippage model'],
            ['AlpacaExecutionManager', 'Alpaca REST + WebSocket, order state syncing'],
            ['Fill callback', 'Asynchronous: engine receives fill events, updates portfolio'],
            ['Partial fill handling', 'OrderStatus.PARTIALLY_FILLED tracked and emitted'],
            ['Network dropout', 'Reconnect loop with exponential back-off in WebSocketFeed'],
            ['Order lifecycle', 'PENDING → SUBMITTED → FILLED / CANCELLED / REJECTED'],
          ]
        },
      ].map(({ title, tag, tagColor, items }) => (
        <Card key={title} title={title} tag={tag} tagColor={tagColor}>
          {items.map(([k, v]) => <Row key={k} label={k} value={v} mono={false} />)}
        </Card>
      ))}
    </div>
  );
}

// ─── Section: Stack ───────────────────────────────────────────────────────────
function StackSection() {
  const stack = [
    { layer: 'Language', choice: 'Python 3.11+', reason: 'Best library ecosystem for quant; use Cython/Numba for hot paths', color: '#74b9ff' },
    { layer: 'OLAP / Historical', choice: 'TimescaleDB or DuckDB', reason: 'Columnar HFT data; DuckDB for local, TimescaleDB for cloud', color: 'var(--accent)' },
    { layer: 'OLTP / State', choice: 'PostgreSQL + Redis', reason: 'Portfolio state in Postgres; order cache + pub-sub in Redis', color: '#a29bfe' },
    { layer: 'Message Broker', choice: 'Redis Pub/Sub', reason: 'Sub-millisecond for retail quant; upgrade to Kafka at HFT scale', color: 'var(--accent2)' },
    { layer: 'Live Data', choice: 'WebSocket (alpaca-py)', reason: 'Native async push; no polling latency', color: '#fdcb6e' },
    { layer: 'Historical Data', choice: 'REST + Parquet cache', reason: 'Backfill on startup; persist locally to avoid API rate limits', color: 'var(--accent3)' },
    { layer: 'Secrets', choice: 'AWS Secrets Manager / .env', reason: 'Never in source code; .env for dev, Secrets Manager for prod', color: 'var(--danger)' },
    { layer: 'Monitoring', choice: 'Prometheus + Grafana', reason: 'P&L, drawdown, fill latency dashboards', color: '#00cec9' },
    { layer: 'Alerts', choice: 'Telegram Bot / Discord', reason: 'Instant signal/fill/error notifications to mobile', color: '#6c5ce7' },
    { layer: 'Containerisation', choice: 'Docker + docker-compose', reason: 'Identical dev/prod environment; one-command startup', color: '#0984e3' },
    { layer: 'Cloud Host', choice: 'AWS EC2 t3.medium', reason: '24/7 uptime; keep close to exchange for lowest latency', color: '#e17055' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title="RECOMMENDED TECH STACK" tag="PRODUCTION GRADE" accent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {stack.map(({ layer, choice, reason, color }) => (
            <div key={layer} className="flex gap-3 items-start py-2" style={{ borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
              <div style={{ width: 90, flexShrink: 0, fontSize: 8, color: 'var(--muted)', letterSpacing: '0.5px', paddingTop: 1 }}>{layer}</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 9, color, fontFamily: 'Space Mono', fontWeight: 700 }}>{choice}</span>
                <div style={{ fontSize: 8, color: 'var(--text2)', marginTop: 2, lineHeight: 1.5 }}>{reason}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="LATENCY CHARACTERISTICS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'WebSocket tick → signal', value: '< 5 ms', color: 'var(--accent2)' },
            { label: 'Signal → order submit', value: '< 2 ms', color: 'var(--accent2)' },
            { label: 'Order → fill confirm', value: '50–200 ms', color: '#fdcb6e' },
            { label: 'Redis pub-sub round-trip', value: '< 1 ms local', color: 'var(--accent)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 2, padding: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Syne' }}>{value}</div>
              <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Section: Infrastructure ──────────────────────────────────────────────────
function InfrastructureSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title="24/7 DEPLOYMENT TOPOLOGY" tag="AWS + DOCKER" accent>
        <div style={{ fontSize: 9, color: 'var(--text2)', lineHeight: 2, fontFamily: 'Space Mono' }}>
          {`EC2 t3.medium (us-east-1)
  └─ docker-compose up -d
       ├─ quantex-engine   (python_engine/)
       ├─ redis            (pub-sub + order cache)
       ├─ postgres         (portfolio state)
       ├─ prometheus       (metrics scrape)
       └─ grafana          (dashboard UI)`}
        </div>
      </Card>

      <Card title="SECRET MANAGEMENT">
        <Row label="Development" value=".env file (gitignored, never committed)" mono={false} color="var(--accent2)" />
        <Row label="Production" value="AWS Secrets Manager via boto3.client('secretsmanager')" mono={false} color="var(--accent)" />
        <Row label="Docker" value="Pass via --env-file or docker secrets mount" mono={false} />
        <Row label="CI/CD" value="GitHub Actions encrypted secrets → injected at deploy time" mono={false} />
        <div style={{ marginTop: 8, padding: 8, background: 'rgba(255,59,92,0.06)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 2, fontSize: 8, color: 'var(--danger)', lineHeight: 1.7 }}>
          RULE: API keys MUST NOT appear in source code, logs, or docker-compose.yml.
          Use environment variables exclusively.
        </div>
      </Card>

      <Card title="UPTIME & ALERTING">
        {[
          ['Process supervisor', 'supervisord or systemd keeps engine alive on crash'],
          ['Health endpoint', 'HTTP /health returns engine state + last bar timestamp'],
          ['Dead-man switch', 'Telegram alert if no tick received in > 60 seconds'],
          ['Fill alerts', 'Instant Telegram message on every BUY/SELL fill'],
          ['Drawdown alert', 'Alert when drawdown crosses 50 % of kill-switch level'],
          ['Log shipping', 'CloudWatch Logs + Loki for persistent log storage'],
          ['Grafana dashboard', 'P&L curve, drawdown %, fill latency, position heat map'],
        ].map(([k, v]) => <Row key={k} label={k} value={v} mono={false} />)}
      </Card>

      <Card title="DOCKER QUICKSTART" tag="docker-compose.yml">
        <pre style={{ fontSize: 8, color: 'var(--accent)', lineHeight: 1.8, overflow: 'auto', margin: 0, fontFamily: 'Space Mono' }}>
{`version: "3.9"
services:
  engine:
    build: .
    env_file: .env          # NEVER commit .env
    depends_on: [redis, postgres]
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    restart: unless-stopped

volumes:
  pgdata:`}
        </pre>
      </Card>
    </div>
  );
}

// ─── Section: Python Engine ───────────────────────────────────────────────────
function PythonEngineSection() {
  const files = [
    { file: 'models.py', lines: '~180', desc: 'Immutable dataclasses: Bar, Tick, Signal, OrderRequest, Order, Position, PortfolioSnapshot', color: 'var(--accent)' },
    { file: 'strategy.py', lines: '~280', desc: 'BaseStrategy ABC + 4 concrete strategies + STRATEGY_REGISTRY factory', color: '#a29bfe' },
    { file: 'risk_manager.py', lines: '~200', desc: 'RiskManager: kill-switch, heat check, fixed-fractional sizing, mandatory SL/TP', color: 'var(--accent2)' },
    { file: 'execution.py', lines: '~250', desc: 'MockExecutionManager (slippage simulation) + AlpacaExecutionManager (live REST+WS)', color: 'var(--accent3)' },
    { file: 'data_feed.py', lines: '~260', desc: 'BacktestFeed (CSV replay) + AlpacaWebSocketFeed (live + backfill) + create_feed factory', color: '#fdcb6e' },
    { file: 'trading_engine.py', lines: '~230', desc: 'TradingEngine: main event loop, bar processing, fill callback, SL/TP monitor, P&L tracking', color: '#00cec9' },
    { file: 'config.py', lines: '~80', desc: 'EngineConfig dataclass; env-var driven; dotenv integration; validates credentials at init', color: '#e17055' },
    { file: 'main.py', lines: '~90', desc: 'Entry point; argparse CLI; synthetic demo data generator; wires all components', color: 'var(--text2)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title="ENGINE FILE MAP" tag="python_engine/" accent>
        {files.map(({ file, lines, desc, color }) => (
          <div key={file} className="flex gap-3 items-start py-2" style={{ borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
            <div style={{ width: 130, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color, fontFamily: 'Space Mono', fontWeight: 700 }}>{file}</span>
              <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 1 }}>{lines} lines</div>
            </div>
            <div style={{ fontSize: 8, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </Card>

      <Card title="QUICKSTART">
        <pre style={{ fontSize: 8, color: 'var(--accent2)', lineHeight: 2, overflow: 'auto', margin: 0, fontFamily: 'Space Mono' }}>
{`# 1. Install dependencies
pip install -r python_engine/requirements.txt

# 2. Backtest with synthetic demo data (no keys needed)
python -m python_engine.main

# 3. Backtest from CSV
SYMBOL=AAPL python -m python_engine.main --csv data/AAPL.csv

# 4. Paper trading on Alpaca
export TRADING_MODE=PAPER_TRADE
export ALPACA_API_KEY=your_key_here
export ALPACA_SECRET_KEY=your_secret_here
export SYMBOL=AAPL
export STRATEGY=multi_factor
python -m python_engine.main

# 5. Add a custom strategy
# Subclass BaseStrategy in strategy.py, add to STRATEGY_REGISTRY`}
        </pre>
      </Card>

      <Card title="ADDING A CUSTOM STRATEGY">
        <pre style={{ fontSize: 8, color: '#a29bfe', lineHeight: 2, overflow: 'auto', margin: 0, fontFamily: 'Space Mono' }}>
{`from python_engine.strategy import BaseStrategy
from python_engine.models import Bar, Signal, SignalType
from typing import Optional, Sequence

class MyStrategy(BaseStrategy):
    strategy_id = "my_strategy"

    def _configure(self, params):
        self.period = params.get("period", 14)

    @property
    def min_bars(self): return self.period + 1

    def generate_signal(self, bars: Sequence[Bar]) -> Optional[Signal]:
        # Your logic here — return a Signal or None
        if my_condition:
            return self._make_signal(
                SignalType.BUY, bars,
                confidence=0.8,
                reason="My custom condition met",
            )
        return None

# Register it:
from python_engine.strategy import STRATEGY_REGISTRY
STRATEGY_REGISTRY["my_strategy"] = MyStrategy`}
        </pre>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BlueprintPage() {
  const [activeSection, setActiveSection] = useState('ARCHITECTURE');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Section nav */}
      <div className="flex items-center" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            padding: '8px 14px',
            fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '1.2px',
            color: activeSection === s ? 'var(--accent)' : 'var(--muted)',
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${activeSection === s ? 'var(--accent)' : 'transparent'}`,
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {s}
          </button>
        ))}
        <div className="ml-auto px-3" style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'Space Mono' }}>
          SYSTEM DESIGN BLUEPRINT v1.0
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeSection === 'ARCHITECTURE'   && <ArchitectureSection />}
        {activeSection === 'COMPONENTS'     && <ComponentsSection />}
        {activeSection === 'STACK'          && <StackSection />}
        {activeSection === 'INFRASTRUCTURE' && <InfrastructureSection />}
        {activeSection === 'PYTHON ENGINE'  && <PythonEngineSection />}
      </div>
    </div>
  );
}
