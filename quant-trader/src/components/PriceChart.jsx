import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { calcSMA, calcEMA, calcBollingerBands } from '../data/marketData';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="card p-3 text-xs" style={{ minWidth: 160, fontFamily: 'Space Mono, monospace' }}>
      <div style={{ color: 'var(--text2)', marginBottom: 6, fontSize: 10 }}>
        {new Date(d.timestamp).toLocaleTimeString()}
      </div>
      {d.close && <div className="flex justify-between gap-4"><span style={{ color: 'var(--text2)' }}>CLOSE</span><span style={{ color: 'var(--accent)' }}>{d.close?.toFixed(2)}</span></div>}
      {d.sma20 && <div className="flex justify-between gap-4"><span style={{ color: 'var(--text2)' }}>SMA20</span><span style={{ color: '#ff9f43' }}>{d.sma20?.toFixed(2)}</span></div>}
      {d.ema50 && <div className="flex justify-between gap-4"><span style={{ color: 'var(--text2)' }}>EMA50</span><span style={{ color: '#a29bfe' }}>{d.ema50?.toFixed(2)}</span></div>}
      {d.bbUpper && <div className="flex justify-between gap-4"><span style={{ color: 'var(--text2)' }}>BB+</span><span style={{ color: '#74b9ff' }}>{d.bbUpper?.toFixed(2)}</span></div>}
      {d.volume && <div className="flex justify-between gap-4"><span style={{ color: 'var(--text2)' }}>VOL</span><span style={{ color: 'var(--text)' }}>{d.volume?.toLocaleString()}</span></div>}
    </div>
  );
};

export default function PriceChart({ candles, signals }) {
  const data = useMemo(() => {
    if (!candles?.length) return [];
    const sma20 = calcSMA(candles, 20);
    const ema50 = calcEMA(candles, 50);
    const bb = calcBollingerBands(candles, 20);
    return candles.map((c, i) => ({
      ...c,
      sma20: sma20[i],
      ema50: ema50[i],
      bbUpper: bb[i].upper,
      bbLower: bb[i].lower,
      bbMiddle: bb[i].middle,
      signal: signals?.find(s => s.timestamp === c.timestamp)?.signal,
    }));
  }, [candles, signals]);

  const prices = data.map(d => d.close).filter(Boolean);
  const minPrice = Math.min(...prices) * 0.999;
  const maxPrice = Math.max(...prices) * 1.001;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#74b9ff" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#74b9ff" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,45,69,0.6)" />
          <XAxis
            dataKey="time"
            tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }}
            axisLine={false} tickLine={false}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(1)}
            tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }}
            axisLine={false} tickLine={false} width={52}
            orientation="right"
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Bollinger Bands fill */}
          <Area dataKey="bbUpper" stroke="none" fill="url(#bbGrad)" fillOpacity={1} dot={false} />
          <Area dataKey="bbLower" stroke="none" fill="transparent" dot={false} />
          {/* BB lines */}
          <Line type="monotone" dataKey="bbUpper" stroke="#74b9ff" strokeWidth={0.8} strokeDasharray="3 3" dot={false} />
          <Line type="monotone" dataKey="bbLower" stroke="#74b9ff" strokeWidth={0.8} strokeDasharray="3 3" dot={false} />
          <Line type="monotone" dataKey="bbMiddle" stroke="#74b9ff" strokeWidth={0.5} strokeOpacity={0.4} dot={false} />
          {/* Moving averages */}
          <Line type="monotone" dataKey="sma20" stroke="#ff9f43" strokeWidth={1.2} dot={false} strokeOpacity={0.9} />
          <Line type="monotone" dataKey="ema50" stroke="#a29bfe" strokeWidth={1.2} dot={false} strokeOpacity={0.9} />
          {/* Price area */}
          <Area
            type="monotone" dataKey="close"
            stroke="#00d4ff" strokeWidth={1.5}
            fill="url(#priceGrad)"
            dot={false}
          />
          {/* Signal dots */}
          {signals?.map((sig, i) => (
            <ReferenceLine
              key={i}
              x={sig.time}
              stroke={sig.signal === 'BUY' ? '#00ff88' : '#ff3b5c'}
              strokeWidth={1}
              strokeDasharray="2 2"
              strokeOpacity={0.6}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height="25%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,45,69,0.4)" />
          <XAxis dataKey="time" hide />
          <YAxis orientation="right" width={52} tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
          <Bar dataKey="volume" fill="rgba(0,212,255,0.2)" stroke="rgba(0,212,255,0.4)" strokeWidth={0.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
