import { ComposedChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function EquityChart({ equity }) {
  if (!equity?.length) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)', fontSize: 11 }}>
      RUN BACKTEST TO SEE EQUITY CURVE
    </div>
  );

  const start = equity[0]?.value || 100000;
  const current = equity[equity.length - 1]?.value || start;
  const isUp = current >= start;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={equity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? '#00ff88' : '#ff3b5c'} stopOpacity={0.2} />
            <stop offset="100%" stopColor={isUp ? '#00ff88' : '#ff3b5c'} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(30,45,69,0.6)" />
        <XAxis
          dataKey="time"
          tickFormatter={v => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }}
          axisLine={false} tickLine={false}
          interval={Math.floor(equity.length / 5)}
        />
        <YAxis
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fill: '#4a5568', fontSize: 9, fontFamily: 'Space Mono' }}
          axisLine={false} tickLine={false} width={48} orientation="right"
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const v = payload[0]?.value;
            const ret = ((v - start) / start * 100).toFixed(2);
            return (
              <div className="card p-3 text-xs" style={{ fontFamily: 'Space Mono' }}>
                <div style={{ color: v >= start ? 'var(--accent2)' : 'var(--danger)', fontSize: 14, fontWeight: 700 }}>
                  ${v?.toLocaleString()}
                </div>
                <div style={{ color: 'var(--text2)', marginTop: 2 }}>{ret > 0 ? '+' : ''}{ret}% return</div>
              </div>
            );
          }}
        />
        <Area
          type="monotone" dataKey="value"
          stroke={isUp ? '#00ff88' : '#ff3b5c'} strokeWidth={2}
          fill="url(#equityGrad)"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
