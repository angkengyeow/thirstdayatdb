import { useEffect, useState } from 'react';

function generateBook(midPrice) {
  const asks = Array.from({ length: 10 }, (_, i) => ({
    price: +(midPrice + (i + 1) * midPrice * 0.0002).toFixed(2),
    size: +(Math.random() * 5 + 0.1).toFixed(3),
    total: 0,
  }));
  const bids = Array.from({ length: 10 }, (_, i) => ({
    price: +(midPrice - (i + 1) * midPrice * 0.0002).toFixed(2),
    size: +(Math.random() * 5 + 0.1).toFixed(3),
    total: 0,
  }));

  let askTotal = 0;
  asks.forEach(a => { askTotal += a.size; a.total = +askTotal.toFixed(3); });
  let bidTotal = 0;
  bids.forEach(b => { bidTotal += b.size; b.total = +bidTotal.toFixed(3); });

  const maxTotal = Math.max(askTotal, bidTotal);
  asks.forEach(a => { a.pct = a.total / maxTotal * 100; });
  bids.forEach(b => { b.pct = b.total / maxTotal * 100; });

  return { asks: asks.reverse(), bids };
}

export default function OrderBook({ price }) {
  const [book, setBook] = useState(() => generateBook(price || 100));

  useEffect(() => {
    setBook(generateBook(price || 100));
    const interval = setInterval(() => setBook(generateBook(price || 100)), 800);
    return () => clearInterval(interval);
  }, [price]);

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }}>
      <div className="grid grid-cols-3 px-3 py-1.5" style={{ color: 'var(--muted)', fontSize: 9, letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>
        <span>PRICE</span>
        <span className="text-right">SIZE</span>
        <span className="text-right">TOTAL</span>
      </div>

      {/* Asks */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {book.asks.map((ask, i) => (
          <div key={i} className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/5" style={{ cursor: 'default' }}>
            <div className="absolute inset-y-0 right-0" style={{ width: `${ask.pct}%`, background: 'rgba(255,59,92,0.08)' }} />
            <span style={{ color: 'var(--danger)', position: 'relative', zIndex: 1 }}>{ask.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="text-right" style={{ color: 'var(--text)', position: 'relative', zIndex: 1 }}>{ask.size.toFixed(3)}</span>
            <span className="text-right" style={{ color: 'var(--text2)', position: 'relative', zIndex: 1 }}>{ask.total.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="px-3 py-2 text-center" style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
          {price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="ml-2" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '1px' }}>SPREAD</span>
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-hidden">
        {book.bids.map((bid, i) => (
          <div key={i} className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-white/5" style={{ cursor: 'default' }}>
            <div className="absolute inset-y-0 right-0" style={{ width: `${bid.pct}%`, background: 'rgba(0,255,136,0.08)' }} />
            <span style={{ color: 'var(--accent2)', position: 'relative', zIndex: 1 }}>{bid.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="text-right" style={{ color: 'var(--text)', position: 'relative', zIndex: 1 }}>{bid.size.toFixed(3)}</span>
            <span className="text-right" style={{ color: 'var(--text2)', position: 'relative', zIndex: 1 }}>{bid.total.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
