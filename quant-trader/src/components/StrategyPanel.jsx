import { useState } from 'react';
import { Zap, TrendingUp, BarChart3, RefreshCw, Layers } from 'lucide-react';

const STRATEGIES = [
  {
    id: 'multi_factor',
    name: 'Multi-Factor',
    icon: Layers,
    badge: 'BEST',
    badgeColor: 'var(--accent3)',
    desc: 'MACD × RSI × Volume × Trend — requires 3-of-5 confluence. Highest win rate.',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    icon: TrendingUp,
    desc: 'SMA 20/50 crossover with trend following',
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    icon: RefreshCw,
    desc: 'RSI + Bollinger Bands oversold/overbought',
  },
  {
    id: 'breakout',
    name: 'Breakout',
    icon: Zap,
    desc: 'Price breakout from N-bar high/low range',
  },
];

export default function StrategyPanel({ strategy, onStrategyChange, onRun, isRunning }) {
  const [riskPct, setRiskPct] = useState(5);
  const [stopLoss, setStopLoss] = useState(2);
  const [takeProfit, setTakeProfit] = useState(6);

  return (
    <div className="h-full flex flex-col overflow-y-auto" style={{ fontFamily: 'Space Mono, monospace' }}>
      {/* Strategy selection */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 8 }}>STRATEGY ENGINE</div>
        <div className="flex flex-col gap-1.5">
          {STRATEGIES.map(s => {
            const Icon = s.icon;
            const active = strategy === s.id;
            const isMultiFactor = s.id === 'multi_factor';
            return (
              <button
                key={s.id}
                onClick={() => onStrategyChange(s.id)}
                className="text-left p-2.5 transition-all"
                style={{
                  background: active
                    ? isMultiFactor ? 'rgba(255,107,53,0.08)' : 'rgba(0,212,255,0.08)'
                    : 'transparent',
                  border: `1px solid ${active
                    ? isMultiFactor ? 'rgba(255,107,53,0.5)' : 'var(--accent)'
                    : 'var(--border)'}`,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={12} style={{
                      color: active
                        ? isMultiFactor ? 'var(--accent3)' : 'var(--accent)'
                        : 'var(--muted)'
                    }} />
                    <span style={{
                      fontSize: 11,
                      color: active
                        ? isMultiFactor ? 'var(--accent3)' : 'var(--accent)'
                        : 'var(--text)',
                      fontWeight: active ? 700 : 400
                    }}>
                      {s.name}
                    </span>
                  </div>
                  {s.badge && (
                    <span style={{
                      fontSize: 8, letterSpacing: '1px', padding: '1px 5px',
                      background: `${s.badgeColor}20`,
                      border: `1px solid ${s.badgeColor}50`,
                      color: s.badgeColor, borderRadius: 2,
                    }}>
                      {s.badge}
                    </span>
                  )}
                </div>
                {active && (
                  <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
                    {s.desc}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-factor legend when selected */}
      {strategy === 'multi_factor' && (
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,107,53,0.03)' }}>
          <div style={{ fontSize: 9, color: 'var(--accent3)', letterSpacing: '1.5px', marginBottom: 8 }}>SIGNAL FACTORS</div>
          {[
            { label: 'MACD Crossover', desc: 'Bullish/bearish signal line cross' },
            { label: 'RSI Filter', desc: 'Entry only at 40–62 (avoids extremes)' },
            { label: 'Trend Alignment', desc: 'Price vs SMA20 direction' },
            { label: 'Volume Spike', desc: '>1.2× average vol = conviction' },
            { label: 'Hist Acceleration', desc: 'MACD histogram expanding' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--accent3)', flexShrink: 0, width: 16 }}>{i + 1}.</span>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text)', fontWeight: 700 }}>{f.label}</div>
                <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)', borderRadius: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--accent3)', letterSpacing: '0.5px' }}>
              FIRES ONLY ON 3+ FACTORS — FEWER TRADES, HIGHER PRECISION
            </span>
          </div>
        </div>
      )}

      {/* Risk management */}
      <div className="p-3 border-b flex-1" style={{ borderColor: 'var(--border)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 10 }}>RISK MANAGEMENT</div>

        {[
          { label: 'Risk Per Trade', value: riskPct, set: setRiskPct, min: 1, max: 20, unit: '%' },
          { label: 'Stop Loss', value: stopLoss, set: setStopLoss, min: 0.5, max: 10, unit: '%' },
          { label: 'Take Profit', value: takeProfit, set: setTakeProfit, min: 1, max: 30, unit: '%' },
        ].map((item, i) => (
          <div key={i} className="mb-4">
            <div className="flex justify-between mb-1.5">
              <span style={{ fontSize: 9, color: 'var(--text2)', letterSpacing: '0.5px' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{item.value}{item.unit}</span>
            </div>
            <input
              type="range" min={item.min} max={item.max} step={0.5}
              value={item.value}
              onChange={e => item.set(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div className="flex justify-between mt-0.5">
              <span style={{ fontSize: 8, color: 'var(--muted)' }}>{item.min}{item.unit}</span>
              <span style={{ fontSize: 8, color: 'var(--muted)' }}>{item.max}{item.unit}</span>
            </div>
          </div>
        ))}

        <div className="mt-2 p-2.5" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)', borderRadius: 2 }}>
          <div style={{ fontSize: 9, color: 'var(--accent3)', letterSpacing: '1px', marginBottom: 4 }}>RISK/REWARD</div>
          <div style={{ fontSize: 16, color: 'var(--accent3)', fontWeight: 700, fontFamily: 'Syne' }}>
            1 : {(takeProfit / stopLoss).toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
            {takeProfit / stopLoss >= 2 ? 'OPTIMAL RATIO' : 'SUBOPTIMAL — INCREASE R:R'}
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="p-3">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ width: '100%', opacity: isRunning ? 0.7 : 1 }}
        >
          {isRunning ? (
            <><span className="cursor">_</span>RUNNING BACKTEST...</>
          ) : (
            <><BarChart3 size={12} />RUN BACKTEST</>
          )}
        </button>
        <div className="mt-2" style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
          SIMULATES 100 5-MIN CANDLES<br />
          STARTING WITH $100,000
        </div>
      </div>
    </div>
  );
}
