import { useMemo } from 'react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { calcRSI } from '../data/marketData';

export default function RSIChart({ candles }) {
  const data = useMemo(() => {
    if (!candles?.length) return [];
    const rsi = calcRSI(candles, 14);
    return candles.map((c, i) => ({ ...c, rsi: rsi[i] }));
  }, [candles]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,45,69,0.6)" />
        <XAxis dataKey="time" hide />
        <YAxis domain={[0, 100]} orientation="right" width={32} tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} ticks={[30, 50, 70]} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const rsi = payload[0]?.value;
            return (
              <div className="card p-2 text-xs" style={{ fontFamily: 'Space Mono' }}>
                <span style={{ color: rsi > 70 ? 'var(--danger)' : rsi < 30 ? 'var(--accent2)' : 'var(--accent)' }}>
                  RSI {rsi?.toFixed(1)}
                </span>
              </div>
            );
          }}
        />
        <ReferenceLine y={70} stroke="rgba(255,59,92,0.4)" strokeDasharray="3 3" strokeWidth={1} />
        <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" strokeWidth={1} />
        <ReferenceLine y={30} stroke="rgba(0,255,136,0.4)" strokeDasharray="3 3" strokeWidth={1} />
        <Line type="monotone" dataKey="rsi" stroke="#f9ca24" strokeWidth={1.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
