import { useEffect, useRef } from 'react';

export default function TradeLog({ trades, liveOrders }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [trades, liveOrders]);

  const all = [
    ...(liveOrders || []).map(o => ({ ...o, isLive: true })),
    ...(trades || []).map(t => ({ ...t, type: 'CLOSED' })),
  ].sort((a, b) => new Date(b.time || b.timestamp) - new Date(a.time || a.timestamp));

  return (
    <div ref={ref} className="h-full overflow-y-auto" style={{ fontFamily: 'Space Mono, monospace' }}>
      {all.length === 0 ? (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)', fontSize: 11 }}>
          NO TRADES YET — AWAITING SIGNALS...
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 9, letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>
              <th className="px-3 py-2 text-left">TIME</th>
              <th className="px-3 py-2 text-left">TYPE</th>
              <th className="px-3 py-2 text-right">ENTRY</th>
              <th className="px-3 py-2 text-right">EXIT</th>
              <th className="px-3 py-2 text-right">QTY</th>
              <th className="px-3 py-2 text-right">PNL</th>
              <th className="px-3 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {all.map((t, i) => {
              const isWin = t.pnl >= 0;
              return (
                <tr key={i} className="hover:bg-white/5" style={{ borderBottom: '1px solid rgba(30,45,69,0.4)', transition: 'background 0.1s' }}>
                  <td className="px-3 py-1.5" style={{ color: 'var(--text2)' }}>
                    {new Date(t.time || t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-3 py-1.5">
                    {t.isLive ? (
                      <span className="tag" style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent)', border: '1px solid rgba(0,212,255,0.3)' }}>LIVE</span>
                    ) : (
                      <span className="tag" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text2)', border: '1px solid var(--border)' }}>CLOSED</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text)' }}>{t.entry?.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text)' }}>{t.exit?.toFixed(2) || '—'}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text2)' }}>{t.qty}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: t.pnl !== undefined ? (isWin ? 'var(--accent2)' : 'var(--danger)') : 'var(--text2)', fontWeight: 700 }}>
                    {t.pnl !== undefined ? `${isWin ? '+' : ''}$${t.pnl?.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: t.pct !== undefined ? (isWin ? 'var(--accent2)' : 'var(--danger)') : 'var(--text2)' }}>
                    {t.pct !== undefined ? `${isWin ? '+' : ''}${t.pct}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
