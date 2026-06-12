function Metric({ label, value, color, sub }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'Space Mono' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'Syne, sans-serif', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'Space Mono' }}>{sub}</div>}
    </div>
  );
}

export default function MetricsBar({ metrics }) {
  const {
    totalReturn = 0, winRate = 0, maxDrawdown = 0, sharpe = 0,
    tradeCount = 0, portfolioValue = 100000,
  } = metrics || {};

  const isUp = totalReturn >= 0;

  return (
    <div className="grid grid-cols-6 gap-px" style={{ borderBottom: '1px solid var(--border)' }}>
      {[
        {
          label: 'PORTFOLIO VALUE',
          value: `$${portfolioValue?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          color: 'var(--accent)',
        },
        {
          label: 'TOTAL RETURN',
          value: `${isUp ? '+' : ''}${totalReturn?.toFixed(2)}%`,
          color: isUp ? 'var(--accent2)' : 'var(--danger)',
          sub: isUp ? 'OUTPERFORMING' : 'UNDERPERFORMING',
        },
        {
          label: 'WIN RATE',
          value: `${winRate}%`,
          color: parseFloat(winRate) >= 50 ? 'var(--accent2)' : 'var(--danger)',
          sub: `${tradeCount} TRADES`,
        },
        {
          label: 'MAX DRAWDOWN',
          value: `-${maxDrawdown}%`,
          color: maxDrawdown > 10 ? 'var(--danger)' : 'var(--text)',
          sub: maxDrawdown < 5 ? 'HEALTHY' : maxDrawdown < 10 ? 'MODERATE' : 'HIGH RISK',
        },
        {
          label: 'SHARPE RATIO',
          value: sharpe?.toFixed(2),
          color: sharpe > 1.5 ? 'var(--accent2)' : sharpe > 0.5 ? 'var(--text)' : 'var(--danger)',
          sub: sharpe > 2 ? 'EXCELLENT' : sharpe > 1 ? 'GOOD' : sharpe > 0 ? 'POOR' : 'NEGATIVE',
        },
        {
          label: 'TRADE COUNT',
          value: tradeCount,
          color: 'var(--text)',
          sub: 'COMPLETED',
        },
      ].map((m, i) => (
        <div key={i} className="px-4 py-3" style={{ borderRight: i < 5 ? '1px solid var(--border)' : 'none' }}>
          <Metric {...m} />
        </div>
      ))}
    </div>
  );
}
