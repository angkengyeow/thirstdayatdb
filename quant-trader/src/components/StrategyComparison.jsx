// StrategyComparison.jsx — Run & compare strategies side-by-side
// Uses the backend API to benchmark strategies and render results visually

import { useState, useCallback } from 'react';
import { BarChart2, TrendingUp, Activity, Zap, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { SYMBOLS } from '../data/marketData';

const STRATEGIES = [
  { id: 'ma_crossover',       name: 'MA Crossover',       icon: '📊' },
  { id: 'mean_reversion_bb',  name: 'Mean Reversion BB',  icon: '🔄' },
  { id: 'momentum_breakout',  name: 'Momentum Breakout',  icon: '🚀' },
  { id: 'multi_factor',       name: 'Multi Factor',       icon: '🧠' },
  { id: 'regime_aware',       name: 'Regime Aware',       icon: '🌦️' },
  { id: 'ml_xgboost',         name: 'ML XGBoost',         icon: '🤖' },
];

const COLORS = ['var(--accent)', '#a29bfe', 'var(--accent3)', 'var(--accent2)', '#fdcb6e', '#00cec9'];

export default function StrategyComparison() {
  const [symbol, setSymbol] = useState('AAPL');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState({});

  const runAll = useCallback(async () => {
    setLoading(true);
    setResults(null);
    const allResults = [];

    for (const strat of STRATEGIES) {
      setRunning(prev => ({ ...prev, [strat.id]: true }));
      try {
        const res = await api.runBacktest(symbol, strat.id, { bars: 300, cash: 100000 });
        allResults.push({ ...strat, ...res });
      } catch (err) {
        allResults.push({ ...strat, error: err.message });
      }
      setRunning(prev => ({ ...prev, [strat.id]: false }));
    }

    allResults.sort((a, b) => (b.sharpe_ratio || 0) - (a.sharpe_ratio || 0));
    setResults(allResults);
    setLoading(false);
  }, [symbol]);

  const maxReturn = Math.max(...(results || []).map(r => Math.abs(r.total_return_pct || 0)), 1);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2" style={{
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'rgba(162,155,254,0.04)',
      }}>
        <div className="flex items-center gap-3">
          <BarChart2 size={14} style={{ color: '#a29bfe' }} />
          <span style={{ fontSize: 10, fontFamily: 'Space Mono', letterSpacing: '1.5px', color: '#a29bfe' }}>
            STRATEGY COMPARISON BENCHMARK
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2,
              padding: '4px 8px', fontSize: 10, fontFamily: 'Space Mono', color: 'var(--text)',
            }}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={runAll} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              background: 'rgba(162,155,254,0.12)', border: '1px solid rgba(162,155,254,0.3)',
              borderRadius: 2, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 9, fontFamily: 'Space Mono', color: '#a29bfe',
              opacity: loading ? 0.5 : 1,
            }}>
            {loading ? <RotateCcw size={10} className="spin" /> : <Zap size={10} />}
            &nbsp;{loading ? 'BENCHMARKING...' : 'RUN ALL (6)'}
          </button>
        </div>
      </div>

      {/* Results grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {!results && !loading && (
          <div className="flex items-center justify-center h-full flex-col gap-4">
            <Activity size={48} style={{ color: 'var(--border)' }} />
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '2px', fontFamily: 'Space Mono' }}>
              SELECT A SYMBOL & RUN THE BENCHMARK
            </div>
            <div style={{ fontSize: 9, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.8, maxWidth: 400 }}>
              All 6 strategies will be backtested on the same 300 bars of market data
              with identical risk settings. Results are ranked by Sharpe ratio.
            </div>
          </div>
        )}

        {loading && !results && (
          <div className="flex items-center justify-center h-full">
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Space Mono' }}>
              <div className="pulse-dot" style={{ display: 'inline-block', marginRight: 8 }} />
              Benchmarking strategies...
            </div>
          </div>
        )}

        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Rank header */}
            <div className="flex items-center gap-2 px-3 py-2" style={{
              background: 'rgba(162,155,254,0.06)', border: '1px solid rgba(162,155,254,0.2)', borderRadius: 2,
              fontSize: 8, fontFamily: 'Space Mono', color: 'var(--muted)', letterSpacing: '1px',
            }}>
              <span style={{ width: 40 }}>RANK</span>
              <span style={{ flex: 1 }}>STRATEGY</span>
              <span style={{ width: 90, textAlign: 'right' }}>RETURN</span>
              <span style={{ width: 70, textAlign: 'right' }}>SHARPE</span>
              <span style={{ width: 70, textAlign: 'right' }}>MAX DD</span>
              <span style={{ width: 60, textAlign: 'right' }}>TRADES</span>
              <span style={{ width: 80, textAlign: 'right' }}>TIME</span>
            </div>

            {results.map((r, i) => (
              <div key={r.id} style={{
                background: i === 0 ? 'rgba(0,255,136,0.04)' : 'var(--surface)',
                border: `1px solid ${i === 0 ? 'rgba(0,255,136,0.25)' : 'var(--border)'}`,
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div style={{ width: 40, fontSize: 12, fontWeight: 700, color: COLORS[i % COLORS.length], fontFamily: 'Syne' }}>
                    #{i + 1}
                    {i === 0 && <span style={{ fontSize: 10, marginLeft: 2 }}>🏆</span>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{r.icon}</span>
                    <span style={{ fontSize: 10, fontFamily: 'Space Mono', color: COLORS[i % COLORS.length], fontWeight: 700 }}>
                      {r.name}
                    </span>
                    <span style={{ fontSize: 7, color: 'var(--muted)', fontFamily: 'Space Mono' }}>
                      {r.id}
                    </span>
                  </div>

                  {/* Return bar */}
                  <div style={{ width: 90, textAlign: 'right' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, fontFamily: 'Syne',
                      color: r.total_return_pct >= 0 ? 'var(--accent2)' : 'var(--danger)',
                    }}>
                      {r.total_return_pct >= 0 ? '+' : ''}{r.total_return_pct?.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ width: 70, textAlign: 'right', fontFamily: 'Space Mono', fontSize: 10, color: r.sharpe_ratio > 1 ? 'var(--accent2)' : 'var(--text2)' }}>
                    {r.sharpe_ratio?.toFixed(2) || '—'}
                  </div>
                  <div style={{ width: 70, textAlign: 'right', fontFamily: 'Space Mono', fontSize: 10, color: r.max_drawdown_pct > 20 ? 'var(--danger)' : 'var(--text2)' }}>
                    {r.max_drawdown_pct?.toFixed(1)}%
                  </div>
                  <div style={{ width: 60, textAlign: 'right', fontFamily: 'Space Mono', fontSize: 10, color: 'var(--text2)' }}>
                    {r.trade_count}
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontFamily: 'Space Mono', fontSize: 9, color: 'var(--muted)' }}>
                    {r.duration_ms?.toFixed(0)}ms
                  </div>
                </div>

                {/* Visual bar chart for return */}
                <div style={{
                  height: 3, background: 'var(--bg)',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${Math.abs(r.total_return_pct || 0) / maxReturn * 100}%`,
                    height: '100%',
                    background: r.total_return_pct >= 0 ? 'var(--accent2)' : 'var(--danger)',
                    float: r.total_return_pct >= 0 ? 'left' : 'right',
                    opacity: 0.5,
                  }} />
                  {/* 0% baseline */}
                  <div style={{
                    position: 'absolute', left: '50%', top: 0, width: 1, height: '100%',
                    background: 'var(--border)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}