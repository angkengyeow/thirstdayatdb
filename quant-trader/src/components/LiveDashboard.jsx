// LiveDashboard.jsx — Real-time engine dashboard connected to FastAPI backend
// Shows live portfolio, engine status, control buttons, and WebSocket data stream

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, RotateCcw, Activity, Server, Database, WifiOff } from 'lucide-react';
import { api } from '../api/client';
import useWebSocket from '../hooks/useWebSocket';

const Panel = ({ title, accent, children }) => (
  <div style={{
    background: 'var(--surface)',
    border: `1px solid ${accent || 'var(--border)'}`,
    borderRadius: 2,
  }}>
    <div className="flex items-center justify-between px-3 py-2" style={{
      borderBottom: `1px solid ${accent || 'var(--border)'}`,
      fontSize: 9,
      fontFamily: 'Space Mono',
      letterSpacing: '1.2px',
      color: accent || 'var(--muted)',
    }}>
      {title}
    </div>
    <div className="p-3">
      {children}
    </div>
  </div>
);

const StatRow = ({ label, value, color }) => (
  <div className="flex justify-between py-1" style={{ borderBottom: '1px solid rgba(30,45,69,0.4)', fontSize: 10 }}>
    <span style={{ color: 'var(--text2)' }}>{label}</span>
    <span style={{ color: color || 'var(--text)', fontFamily: 'Space Mono', fontWeight: 700 }}>{value}</span>
  </div>
);

export default function LiveDashboard() {
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const ws = useWebSocket('live-dashboard');

  // ── Fetch engine status on mount + poll ────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const [s, h, c] = await Promise.all([
        api.getStatus(),
        api.getHealth(),
        api.getConfig(),
      ]);
      setStatus(s);
      setHealth(h);
      setConfig(c);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);

  // ── Connect WebSocket ──────────────────────────────────────────────────────
  useEffect(() => { ws.connect(); return () => ws.disconnect(); }, [ws]);

  // ── Engine control handlers ────────────────────────────────────────────────
  const handleStart = async () => { await api.startEngine(); refresh(); };
  const handleStop = async () => { await api.stopEngine(); refresh(); };

  const isRunning = status?.running;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2" style={{
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'rgba(0,212,255,0.04)',
      }}>
        <div className="flex items-center gap-3">
          <Server size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 10, fontFamily: 'Space Mono', letterSpacing: '1.5px', color: 'var(--accent)' }}>
            LIVE ENGINE DASHBOARD
          </span>
          {status && (
            <span className="tag" style={{
              background: isRunning ? 'rgba(0,255,136,0.12)' : 'rgba(255,59,92,0.12)',
              color: isRunning ? 'var(--accent2)' : 'var(--danger)',
            }}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ws.connected && <span className="pulse-dot" style={{ display: 'inline-block' }} />}
          <span style={{ fontSize: 8, color: ws.connected ? 'var(--accent2)' : 'var(--muted)', fontFamily: 'Space Mono' }}>
            {ws.connected ? 'WS LIVE' : 'WS OFFLINE'}
          </span>
          <div className="flex gap-1">
            <button onClick={handleStart} disabled={isRunning}
              className="flex items-center gap-1 px-2 py-1"
              style={{
                background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 2,
                cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.4 : 1, fontSize: 9,
                color: 'var(--accent2)', fontFamily: 'Space Mono',
              }}>
              <Play size={10} /> START
            </button>
            <button onClick={handleStop} disabled={!isRunning}
              className="flex items-center gap-1 px-2 py-1"
              style={{
                background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: 2,
                cursor: !isRunning ? 'not-allowed' : 'pointer', opacity: !isRunning ? 0.4 : 1, fontSize: 9,
                color: 'var(--danger)', fontFamily: 'Space Mono',
              }}>
              <Square size={10} /> STOP
            </button>
            <button onClick={refresh}
              className="flex items-center gap-1 px-2 py-1"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2,
                cursor: 'pointer', fontSize: 9, color: 'var(--text2)', fontFamily: 'Space Mono',
              }}>
              <RotateCcw size={10} /> REFRESH
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-1.5" style={{
          background: 'rgba(255,59,92,0.08)', borderBottom: '1px solid rgba(255,59,92,0.2)',
          fontSize: 9, color: 'var(--danger)', fontFamily: 'Space Mono',
        }}>
          <WifiOff size={10} /> {error}
        </div>
      )}

      {/* Main grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>

        {/* Status panel */}
        <Panel title="ENGINE STATUS" accent="var(--accent)">
          {status ? (
            <div>
              <StatRow label="Mode" value={status.mode} color="var(--accent)" />
              <StatRow label="Strategy" value={status.strategy_id} color="#a29bfe" />
              <StatRow label="Symbol" value={status.symbol} color="var(--accent2)" />
              <StatRow label="Ticks Processed" value={status.tick_count?.toLocaleString()} />
              <StatRow label="Uptime" value={`${(status.uptime_seconds || 0).toFixed(0)}s`} color="var(--accent3)" />
              <StatRow label="Risk Halted" value={status.risk_halted ? 'YES ⚠️' : 'No'} color={status.risk_halted ? 'var(--danger)' : 'var(--accent2)'} />
            </div>
          ) : (
            <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
              {error ? 'Cannot reach engine API' : 'Loading...'}
            </div>
          )}
        </Panel>

        {/* Health panel */}
        <Panel title="INFRASTRUCTURE HEALTH" accent="var(--accent2)">
          {health ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database size={12} color={health.postgres_connected ? 'var(--accent2)' : 'var(--danger)'} />
                <span style={{ fontSize: 9, color: health.postgres_connected ? 'var(--accent2)' : 'var(--danger)', fontFamily: 'Space Mono' }}>
                  PostgreSQL {health.postgres_connected ? 'CONNECTED' : 'DOWN'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Server size={12} color={health.redis_connected ? 'var(--accent2)' : 'var(--danger)'} />
                <span style={{ fontSize: 9, color: health.redis_connected ? 'var(--accent2)' : 'var(--danger)', fontFamily: 'Space Mono' }}>
                  Redis {health.redis_connected ? 'CONNECTED' : 'DOWN'}
                </span>
              </div>
              <StatRow label="API Server" value={`${apiBase}`} color="var(--accent)" />
              <StatRow label="WebSocket" value={ws.connected ? 'CONNECTED' : 'DISCONNECTED'} color={ws.connected ? 'var(--accent2)' : 'var(--danger)'} />
              <StatRow label="API Uptime" value={`${(health.uptime_seconds || 0).toFixed(0)}s`} />
              {health.last_bar_timestamp && (
                <StatRow label="Last Bar" value={new Date(health.last_bar_timestamp).toLocaleTimeString()} color="var(--accent3)" />
              )}
            </div>
          ) : (
            <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
              {error ? 'Infrastructure unreachable' : 'Loading...'}
            </div>
          )}
        </Panel>

        {/* WebSocket data stream */}
        <Panel title="REAL-TIME DATA STREAM" accent="var(--accent3)">
          {ws.connected ? (
            <div style={{ fontSize: 9, lineHeight: 1.8 }}>
              {ws.lastBar && (
                <div style={{ color: 'var(--accent)' }}>
                  <span style={{ color: 'var(--muted)' }}>BAR </span>
                  {ws.lastBar.symbol} @ ${ws.lastBar.close?.toFixed(2)}
                </div>
              )}
              {ws.lastSignal && (
                <div style={{ color: '#a29bfe' }}>
                  <span style={{ color: 'var(--muted)' }}>SIG </span>
                  {ws.lastSignal.signal_type} {ws.lastSignal.symbol} — {ws.lastSignal.reason?.slice(0, 40)}
                </div>
              )}
              {ws.lastFill && (
                <div style={{ color: ws.lastFill.side === 'BUY' ? 'var(--accent2)' : 'var(--danger)' }}>
                  <span style={{ color: 'var(--muted)' }}>FILL </span>
                  {ws.lastFill.side} {ws.lastFill.symbol} qty={ws.lastFill.quantity} @ ${ws.lastFill.price}
                </div>
              )}
              {!ws.lastBar && !ws.lastSignal && !ws.lastFill && (
                <div style={{ color: 'var(--muted)' }}>Waiting for data...</div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2" style={{ fontSize: 9, color: 'var(--danger)', padding: 10 }}>
              <WifiOff size={12} /> WebSocket not connected
            </div>
          )}
        </Panel>

        {/* Portfolio snapshot */}
        <Panel title="PORTFOLIO (WS)" accent="var(--accent2)">
          {ws.portfolio ? (
            <div>
              <StatRow label="Equity" value={`$${ws.portfolio.equity?.toLocaleString()}`} color="var(--accent2)" />
              <StatRow label="Cash" value={`$${ws.portfolio.cash?.toLocaleString()}`} />
              <StatRow label="Realised P&L" value={`${ws.portfolio.realised_pnl >= 0 ? '+' : ''}$${ws.portfolio.realised_pnl?.toFixed(0)}`}
                color={ws.portfolio.realised_pnl >= 0 ? 'var(--accent2)' : 'var(--danger)'} />
              <StatRow label="Unrealised P&L" value={`${ws.portfolio.unrealised_pnl >= 0 ? '+' : ''}$${ws.portfolio.unrealised_pnl?.toFixed(0)}`}
                color={ws.portfolio.unrealised_pnl >= 0 ? 'var(--accent2)' : 'var(--danger)'} />
              <StatRow label="Open Positions" value={ws.portfolio.open_positions} color={ws.portfolio.open_positions > 0 ? 'var(--accent3)' : 'var(--text2)'} />
              <StatRow label="Max Drawdown" value={`${ws.portfolio.max_drawdown_pct?.toFixed(1)}%`} color={ws.portfolio.max_drawdown_pct > 10 ? 'var(--danger)' : 'var(--text2)'} />
            </div>
          ) : (
            <div style={{ fontSize: 9, color: 'var(--muted)', padding: 10 }}>
              Waiting for portfolio snapshot...
            </div>
          )}
        </Panel>

        {/* Config panel */}
        {config && (
          <Panel title="RUNNING CONFIG" accent="#a29bfe">
            <StatRow label="Trading Mode" value={config.mode} color="var(--accent)" />
            <StatRow label="Symbol" value={config.symbol} />
            <StatRow label="Strategy" value={config.strategy} color="#a29bfe" />
            <StatRow label="Starting Cash" value={`$${config.starting_cash?.toLocaleString()}`} />
            <StatRow label="Max Open Positions" value={config.risk?.max_open_positions} />
            <StatRow label="Stop Loss" value={`${((config.risk?.stop_loss_pct || 0) * 100).toFixed(0)}%`} color="var(--danger)" />
            <StatRow label="Take Profit" value={`${((config.risk?.take_profit_pct || 0) * 100).toFixed(0)}%`} color="var(--accent2)" />
          </Panel>
        )}

        {/* API docs link */}
        <Panel title="QUICK LINKS" accent="var(--accent3)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'API Docs (Swagger)', url: `${apiBase}/docs` },
              { label: 'API Docs (ReDoc)', url: `${apiBase}/redoc` },
              { label: 'Health Check', url: `${apiBase}/api/health` },
              { label: 'Prometheus Metrics', url: `${apiBase}/api/metrics` },
              { label: 'Engine Config', url: `${apiBase}/api/config` },
            ].map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'Space Mono', textDecoration: 'none' }}>
                → {link.label}
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}