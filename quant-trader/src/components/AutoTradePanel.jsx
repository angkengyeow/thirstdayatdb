import { Bot, TrendingUp, TrendingDown, CheckCircle, XCircle, Pause, Play, RotateCcw, Layers, Target } from 'lucide-react';
import { AUTO_MODES, WATCHLISTS, getOpenPnl, getPortfolioValue, getSymbolAllocation } from '../engine/autoTrader';

function StatBox({ label, value, sub, color, small }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 2, padding: '8px 10px' }}>
      <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 17, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'Syne', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AutoTradePanel({
  isAuto, onToggle, onReset,
  autoMode, onModeChange,
  watchlist, onWatchlistChange,
  focusSymbol,
  portfolio, prices, eventLog,
}) {
  const portfolioValue = getPortfolioValue(portfolio, prices);
  const openPnl = getOpenPnl(portfolio, prices);
  const totalReturn = ((portfolioValue - portfolio.startingCash) / portfolio.startingCash * 100);
  const isUp = totalReturn >= 0;
  const openPositions = Object.entries(portfolio.positions);
  const wins = portfolio.closedTrades.filter(t => t.pnl >= 0).length;
  const total = portfolio.closedTrades.length;
  const winRate = total ? (wins / total * 100).toFixed(0) : '--';
  const allocation = getSymbolAllocation(portfolio, prices);
  const activeSymbols = watchlist === 'FOCUSED'
    ? [focusSymbol]
    : (WATCHLISTS[watchlist]?.symbols || [focusSymbol]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Space Mono, monospace', overflow: 'hidden' }}>

      {/* Start/Stop */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: isAuto ? 'rgba(255,107,53,0.04)' : 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bot size={12} style={{ color: isAuto ? 'var(--accent3)' : 'var(--muted)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: isAuto ? 'var(--accent3)' : 'var(--text)', letterSpacing: '1px' }}>AUTO TRADER</span>
          </div>
          {isAuto && <span className="pulse-dot" style={{ background: 'var(--accent3)', boxShadow: '0 0 8px var(--accent3)' }} />}
        </div>

        <button
          onClick={onToggle}
          style={{
            width: '100%', padding: '9px',
            background: isAuto ? 'rgba(255,59,92,0.12)' : 'rgba(0,255,136,0.12)',
            border: `1px solid ${isAuto ? 'rgba(255,59,92,0.4)' : 'rgba(0,255,136,0.4)'}`,
            borderRadius: 2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px',
            color: isAuto ? 'var(--danger)' : 'var(--accent2)',
            transition: 'all 0.2s',
          }}
        >
          {isAuto ? <><Pause size={11} /> STOP BOT</> : <><Play size={11} /> START BOT</>}
        </button>

        {!isAuto && (
          <button onClick={onReset} style={{ width: '100%', marginTop: 5, padding: '5px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'Space Mono', fontSize: 9, color: 'var(--muted)' }}>
            <RotateCcw size={9} /> RESET $100K
          </button>
        )}
      </div>

      {/* Watchlist / scope selector */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Layers size={10} style={{ color: 'var(--muted)' }} />
          <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1.5px' }}>TRADING UNIVERSE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {Object.entries(WATCHLISTS).map(([key, cfg]) => {
            const active = watchlist === key;
            return (
              <button
                key={key}
                onClick={() => !isAuto && onWatchlistChange(key)}
                disabled={isAuto}
                style={{
                  padding: '6px 4px', textAlign: 'center',
                  background: active ? 'rgba(0,212,255,0.1)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(0,212,255,0.5)' : 'var(--border)'}`,
                  borderRadius: 2, cursor: isAuto ? 'not-allowed' : 'pointer',
                  opacity: isAuto && !active ? 0.35 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text2)', fontFamily: 'Space Mono', fontWeight: active ? 700 : 400, lineHeight: 1.3 }}>
                  {cfg.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active symbols chips */}
        {isAuto && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {activeSymbols.map(sym => {
              const hasPos = !!portfolio.positions[sym];
              return (
                <span key={sym} style={{
                  fontSize: 8, padding: '2px 5px', borderRadius: 2,
                  background: hasPos ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${hasPos ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
                  color: hasPos ? 'var(--accent2)' : 'var(--muted)',
                  fontFamily: 'Space Mono',
                }}>
                  {sym}{hasPos ? ' ●' : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Risk profile */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Target size={10} style={{ color: 'var(--muted)' }} />
          <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1.5px' }}>RISK PROFILE</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Object.entries(AUTO_MODES).map(([key, cfg]) => {
            const active = autoMode === key;
            return (
              <button key={key} onClick={() => !isAuto && onModeChange(key)} disabled={isAuto}
                style={{
                  padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: active ? `${cfg.color}14` : 'transparent',
                  border: `1px solid ${active ? cfg.color + '55' : 'var(--border)'}`,
                  borderRadius: 2, cursor: isAuto ? 'not-allowed' : 'pointer',
                  opacity: isAuto && !active ? 0.35 : 1, transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 10, color: active ? cfg.color : 'var(--text2)', fontFamily: 'Space Mono', fontWeight: active ? 700 : 400 }}>{cfg.label}</span>
                <span style={{ fontSize: 8, color: 'var(--muted)' }}>×{cfg.maxPositions} max</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Portfolio summary */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 8 }}>PORTFOLIO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 3 }}>
          <StatBox label="VALUE" value={`$${portfolioValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="var(--accent)" small />
          <StatBox label="RETURN" value={`${isUp ? '+' : ''}${totalReturn.toFixed(1)}%`} color={isUp ? 'var(--accent2)' : 'var(--danger)'} small />
          <StatBox label="OPEN P&L" value={`${openPnl >= 0 ? '+' : ''}$${openPnl.toFixed(0)}`} color={openPnl >= 0 ? 'var(--accent2)' : 'var(--danger)'} small />
          <StatBox label="WIN RATE" value={`${winRate}%`} sub={`${total} closed`} color="var(--text)" small />
        </div>

        {/* Allocation bars */}
        {allocation.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1px', marginBottom: 5 }}>ALLOCATION</div>
            {allocation.map(({ symbol: sym, value, pct }) => (
              <div key={sym} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 8, color: 'var(--accent)', fontFamily: 'Space Mono' }}>{sym}</span>
                  <span style={{ fontSize: 8, color: 'var(--text2)' }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 1, transition: 'width 0.3s' }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'Space Mono' }}>CASH</span>
                <span style={{ fontSize: 8, color: 'var(--text2)' }}>{((portfolio.cash / portfolioValue) * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(portfolio.cash / portfolioValue) * 100}%`, background: 'var(--muted)', borderRadius: 1, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 6 }}>OPEN ({openPositions.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {openPositions.map(([sym, pos]) => {
              const cur = prices[sym] || pos.entryPrice;
              const pnl = (cur - pos.entryPrice) * pos.qty;
              const pct = (cur - pos.entryPrice) / pos.entryPrice * 100;
              const w = pnl >= 0;
              return (
                <div key={sym} style={{ padding: '5px 7px', background: w ? 'rgba(0,255,136,0.05)' : 'rgba(255,59,92,0.05)', border: `1px solid ${w ? 'rgba(0,255,136,0.18)' : 'rgba(255,59,92,0.18)'}`, borderRadius: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>{sym}</span>
                    <span style={{ fontSize: 9, color: w ? 'var(--accent2)' : 'var(--danger)', fontWeight: 700 }}>{w ? '+' : ''}${pnl.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'var(--muted)' }}>
                    <span>@${pos.entryPrice.toFixed(2)}</span>
                    <span style={{ color: w ? 'var(--accent2)' : 'var(--danger)' }}>{w ? '+' : ''}{pct.toFixed(2)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Execution log */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 12px', fontSize: 8, color: 'var(--muted)', letterSpacing: '1.5px', borderBottom: '1px solid var(--border)' }}>
          EXEC LOG ({eventLog.length})
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '5px' }}>
          {eventLog.length === 0 ? (
            <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', marginTop: 14, lineHeight: 1.8 }}>
              {isAuto ? 'SCANNING MARKETS...' : 'START BOT TO BEGIN'}
            </div>
          ) : (
            [...eventLog].reverse().map((ev, i) => {
              const isBuy = ev.type === 'BUY';
              const isWin = ev.pnl >= 0;
              const color = isBuy ? 'var(--accent2)' : (isWin ? 'var(--accent2)' : 'var(--danger)');
              const Icon = isBuy ? TrendingUp : (isWin ? CheckCircle : XCircle);
              return (
                <div key={i} style={{ padding: '5px 7px', marginBottom: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderLeft: `2px solid ${color}`, borderRadius: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon size={8} style={{ color }} />
                      <span style={{ fontSize: 8, color, fontWeight: 700 }}>{ev.type}</span>
                      <span style={{ fontSize: 8, color: 'var(--accent)', fontWeight: 700 }}>{ev.symbol}</span>
                    </div>
                    {ev.pnl !== undefined && (
                      <span style={{ fontSize: 9, color, fontWeight: 700 }}>{ev.pnl >= 0 ? '+' : ''}${ev.pnl.toFixed(0)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.4 }}>
                    @${ev.price?.toFixed(2)}{ev.qty ? ` ×${ev.qty?.toFixed(4)}` : ''} · {ev.reason}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
