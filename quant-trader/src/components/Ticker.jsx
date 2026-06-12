import { useEffect, useState } from 'react';
import { BASE_PRICES, SYMBOLS, VOLATILITY } from '../data/marketData';

export default function Ticker() {
  const [prices, setPrices] = useState({ ...BASE_PRICES });
  const [changes, setChanges] = useState(Object.fromEntries(SYMBOLS.map(s => [s, 0])));

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        const nextChanges = {};
        SYMBOLS.forEach(sym => {
          const vol = VOLATILITY[sym] || 0.003;
          const delta = (Math.random() - 0.49) * vol * prev[sym];
          next[sym] = +(prev[sym] + delta).toFixed(2);
          nextChanges[sym] = +((next[sym] - BASE_PRICES[sym]) / BASE_PRICES[sym] * 100).toFixed(2);
        });
        setChanges(nextChanges);
        return next;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const items = [...SYMBOLS, ...SYMBOLS]; // duplicate for seamless loop

  return (
    <div className="border-b overflow-hidden py-1.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="ticker-inner">
        {items.map((sym, i) => {
          const chg = changes[sym] || 0;
          const pos = chg >= 0;
          return (
            <span key={i} className="inline-flex items-center gap-2 px-5 text-xs">
              <span style={{ color: 'var(--text2)', fontSize: '10px', letterSpacing: '1px' }}>{sym}</span>
              <span style={{ fontWeight: 700, color: pos ? 'var(--accent2)' : 'var(--danger)', fontSize: '11px' }}>
                {prices[sym]?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '10px', color: pos ? 'var(--accent2)' : 'var(--danger)' }}>
                {pos ? '+' : ''}{chg}%
              </span>
              <span style={{ color: 'var(--border)', fontSize: '10px' }}>·</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
