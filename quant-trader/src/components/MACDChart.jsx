import { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { calcMACD } from '../data/marketData';

export default function MACDChart({ candles }) {
  const data = useMemo(() => {
    if (!candles?.length) return [];
    const macd = calcMACD(candles, 12, 26, 9);
    return candles.map((c, i) => ({
      ...c,
      macd: macd[i].macd,
      signal: macd[i].signal,
      histogram: macd[i].histogram,
    }));
  }, [candles]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,45,69,0.6)" />
        <XAxis dataKey="time" hide />
        <YAxis
          orientation="right" width={40}
          tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }}
          axisLine={false} tickLine={false}
          tickFormatter={v => v.toFixed(0)}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="card p-2" style={{ fontFamily: 'Space Mono', fontSize: 9 }}>
                <div style={{ color: d?.macd > 0 ? 'var(--accent2)' : 'var(--danger)' }}>
                  MACD {d?.macd?.toFixed(2)}
                </div>
                <div style={{ color: '#a29bfe' }}>SIG {d?.signal?.toFixed(2)}</div>
                <div style={{ color: d?.histogram > 0 ? 'var(--accent2)' : 'var(--danger)' }}>
                  HIST {d?.histogram?.toFixed(2)}
                </div>
              </div>
            );
          }}
        />
        <Bar
          dataKey="histogram"
          fill="var(--accent2)"
          radius={0}
          cell={data.map((d, i) => (
            { fill: d.histogram >= 0 ? 'rgba(0,255,136,0.5)' : 'rgba(255,59,92,0.5)' }
          ))}
        />
        <Line type="monotone" dataKey="macd" stroke="#00d4ff" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="signal" stroke="#a29bfe" strokeWidth={1.2} strokeDasharray="3 2" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
