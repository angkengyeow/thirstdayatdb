import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerDashboardStats, getSessions,
  populateFromLiveData, updateFromLiveData, getTeamStanding,
  getUpcomingSessions, buildResponseLink, getGamePerformancesForSession,
  getAllPlayersGameStats, shouldSkipAutoUpdate, saveLastUpdated,
} from '../store';
import { seedDemoData } from '../seed';
import { fetchLiveData } from '../scraper';
import RotatingBorderCard from '../components/RotatingBorderCard';

/* ─── Mini Sparkline SVG ─────────────────────────────────────────── */
function Sparkline({ data, height = 32, width = 100 }: { data: number[]; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join('');
  const fillD = `${d}L${width - pad},${height}L${pad},${height}Z`;

  return (
    <svg width={width} height={height} className="shrink-0" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <filter id="glow-line">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#line-grad)" />
      <path d={d} fill="none" stroke="#00e5ff" strokeWidth="1.5" filter="url(#glow-line)" />
      {/* Data point dots */}
      {data.map((_, i) => {
        const [x, y] = points[i].split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r="1.8" fill="#00e5ff" opacity="0.8" />;
      })}
    </svg>
  );
}

/* ─── Glowing Stat Number ──────────────────────────────────────────── */
function StatNumber({ value, suffix = '', glow = false, size = 'xl', color = '#00e5ff' }: {
  value: string | number; suffix?: string; glow?: boolean; size?: 'lg' | 'xl' | '2xl' | '3xl'; color?: string;
}) {
  const sizeMap = { lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl' };
  return (
    <span
      className={`font-display ${sizeMap[size]} tracking-wider`}
      style={{
        color,
        textShadow: glow ? `0 0 12px ${color}40, 0 0 30px ${color}20` : undefined,
      }}
    >
      {value}{suffix}
    </span>
  );
}

/* ─── Helper Components ────────────────────────────────────────────── */
function WinBadge({ pct }: { pct: number }) {
  let c = '#ff1744';
  if (pct >= 60) c = '#00e676';
  else if (pct >= 40) c = '#00e5ff';
  return (
    <span
      className="stat-pill"
      style={{ background: `${c}18`, color: c, border: `1px solid ${c}30` }}
    >
      {pct}%
    </span>
  );
}

function RtBadge({ rt }: { rt: number }) {
  if (rt <= 0) return <span className="text-xs text-[#3a2a6a]">-</span>;
  return (
    <span className="stat-pill" style={{
      background: rt >= 12.5 ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.08)',
      color: '#00e5ff',
      border: `1px solid ${rt >= 12.5 ? 'rgba(0,229,255,0.25)' : 'rgba(0,229,255,0.15)'}`,
    }}>
      {rt.toFixed(2)}
    </span>
  );
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'same' }) {
  if (dir === 'up') return <span className="text-dart-green font-bold">↑</span>;
  if (dir === 'down') return <span className="text-dart-red font-bold">↓</span>;
  return null;
}

/* ─── Extreme Glass Card Wrapper ────────────────────────────────────── */
function GlassCard({ children, className = '', hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={`rounded-2xl transition-all duration-300 ${hover ? 'hover:border-cyan-400/25' : ''} ${className}`}
      style={{
        background: 'rgba(8, 4, 26, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 229, 255, 0.10)',
        boxShadow: '0 0 40px rgba(0, 229, 255, 0.04), 0 0 80px rgba(42, 90, 255, 0.03), inset 0 1px 0 rgba(0, 229, 255, 0.06)',
      }}
    >
      {children}
    </div>
  );
}

/* ─── Section Header ────────────────────────────────────────────────── */
function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-lg font-semibold text-[#e8e0f4] flex items-center gap-3 font-body tracking-wide">
        <span
          className="w-1 h-5 rounded-full inline-block"
          style={{
            background: '#00e5ff',
            boxShadow: '0 0 8px rgba(0, 229, 255, 0.5)',
          }}
        />
        {title}
      </h2>
      {badge && (
        <span
          className="text-xs font-medium px-3 py-1 rounded-full font-body tracking-wide"
          style={{
            background: 'rgba(0, 229, 255, 0.08)',
            color: '#00e5ff',
            border: '1px solid rgba(0, 229, 255, 0.2)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [players, setPlayers] = useState(getPlayerDashboardStats);
  const [sessions, setSessions] = useState(getSessions);
  const [standing, setStanding] = useState(getTeamStanding);
  const [upcoming, setUpcoming] = useState(getUpcomingSessions);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [playerStats, setPlayerStats] = useState(getAllPlayersGameStats());
  const matchSessions = sessions.filter(s => s.type === 'match');

  const refresh = useCallback(() => {
    setPlayers(getPlayerDashboardStats());
    setSessions(getSessions());
    setStanding(getTeamStanding());
    setUpcoming(getUpcomingSessions());
    setPlayerStats(getAllPlayersGameStats());
  }, []);

  // Auto-fetch live data on page mount; skip if already up-to-date
  useEffect(() => {
    let cancelled = false;
    async function autoLoad() {
      if (shouldSkipAutoUpdate()) {
        seedDemoData();
        if (!cancelled) setRefreshKey(k => k + 1);
        return;
      }
      setLoading(true);
      setStatusMessage('Loading data...');
      try {
        const liveData = await fetchLiveData();
        if (cancelled) return;
        populateFromLiveData(liveData);
        const added = updateFromLiveData(liveData);
        saveLastUpdated();
        setStatusMessage(added > 0 ? `Updated — ${added} new match${added > 1 ? 'es' : ''}` : 'Up to date');
      } catch {
        if (cancelled) return;
        seedDemoData();
        setStatusMessage('Seed data loaded');
      }
      if (!cancelled) { setLoading(false); setRefreshKey(k => k + 1); }
    }
    autoLoad();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { refresh(); }, [refreshKey, refresh]);

  function handleCopyLink(sessionId: string) {
    const link = buildResponseLink(sessionId);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(sessionId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleWhatsAppShare(session: { date: string; notes?: string }) {
    const msg = encodeURIComponent(
      `[Captain Liting (Virtual)] 🏆 Match on ${session.date}${session.notes ? ` — ${session.notes}` : ''}\n\nPlease respond with your attendance:`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  const completedMatches = [...matchSessions]
    .filter(s => s.notes?.match(/\((W|L)\s+/))
    .sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.ceil(completedMatches.length / 2);
  const firstHalf = completedMatches.slice(0, half);
  const secondHalf = completedMatches.slice(half);

  // Cumulative win rate data for sparkline
  const winRateProgression = completedMatches.reduce<{ matches: number[]; rate: number[] }>((acc, s, i) => {
    acc.matches.push(i + 1);
    const isWin = s.notes?.includes('(W ');
    const prevRate = i > 0 ? acc.rate[i - 1] : 0;
    const winsSoFar = isWin ? (prevRate * i / 100) + 1 : (prevRate * i / 100);
    acc.rate.push(Math.round((winsSoFar / (i + 1)) * 100));
    return acc;
  }, { matches: [], rate: [] });

  /* ───── Match Card ───── */
  function MatchCard({ s, index }: { s: typeof matchSessions[0]; index: number }) {
    const isWin = s.notes?.includes('(W ');
    const noteParts = s.notes?.match(/(vs|@)\s+(.+?)\s+\((W|L)\s+(\d+)-(\d+)\)/);
    const opponent = noteParts?.[2] || s.notes || '';
    const score = noteParts ? `${noteParts[4]}-${noteParts[5]}` : '';

    const sessionGames = getGamePerformancesForSession(s.id);
    const gameMap = new Map<number, { won: boolean; format: string }>();
    for (const g of sessionGames) {
      const existing = gameMap.get(g.gameId);
      if (!existing) gameMap.set(g.gameId, { won: g.won, format: g.format });
    }
    const gameIds = Array.from(gameMap.keys()).sort((a, b) => a - b);

    return (
      <div
        className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]"
        style={{
          background: isWin
            ? 'linear-gradient(135deg, rgba(0,230,118,0.06), rgba(0,230,118,0.02))'
            : 'linear-gradient(135deg, rgba(255,23,68,0.06), rgba(255,23,68,0.02))',
          border: `1px solid ${isWin ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)'}`,
          animationDelay: `${index * 50}ms`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-sm font-bold px-2.5 py-0.5 rounded shrink-0 font-body"
              style={{
                background: isWin ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)',
                color: isWin ? '#00e676' : '#ff1744',
              }}
            >
              {isWin ? 'W' : 'L'}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-[#e8e0f4] truncate block font-body">{opponent}</span>
              <p className="text-xs text-[#5a4a8a] font-body">{s.date}</p>
            </div>
          </div>
          {score && (
            <span
              className="text-base font-bold font-display tracking-wider shrink-0"
              style={{ color: isWin ? '#00e676' : '#ff1744' }}
            >
              {score}
            </span>
          )}
        </div>
        {gameIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(21,13,64,0.5)' }}>
            {gameIds.map(gid => {
              const g = gameMap.get(gid)!;
              const isHalfIt = g.format === 'half-it';
              return (
                <span
                  key={gid}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded font-body"
                  style={{
                    background: g.won ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)',
                    color: g.won ? '#00e676' : '#ff1744',
                  }}
                  title={g.format}
                >
                  G{gid}{isHalfIt ? '½' : ''}{g.won ? 'W' : 'L'}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-[0.08em] font-display"
            style={{
              background: 'linear-gradient(135deg, #00e5ff, #66f0ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
            }}
          >
            DASHBOARD
          </h1>
          <p className="text-sm text-[#5a4a8a] mt-0.5 font-body">Team overview &amp; match history</p>
        </div>
        {(loading || statusMessage) && (
          <div
            className="flex items-center gap-2 text-xs font-body tracking-wide"
            style={{
              background: 'rgba(13, 8, 48, 0.7)',
              border: '1px solid rgba(0, 229, 255, 0.15)',
              borderRadius: '999px',
              padding: '4px 14px',
            }}
          >
            {loading && (
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: '#00e5ff',
                  boxShadow: '0 0 6px rgba(0, 229, 255, 0.6)',
                }}
              />
            )}
            <span className="text-[#5a4a8a]">{statusMessage || 'Loading...'}</span>
          </div>
        )}
      </div>

      {/* ═══ Hero Standing Card (Rotating Neon Border) ═══ */}
      <RotatingBorderCard colors={['#00e5ff', '#2a5aff', '#00e676', '#00e5ff']} speed={6} glowIntensity={10}>
      <GlassCard hover={false}>
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Identity */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(42,90,255,0.1))',
                  border: '1px solid rgba(0,229,255,0.25)',
                  boxShadow: '0 0 20px rgba(0,229,255,0.08)',
                }}
              >
                <span className="text-xl font-display font-bold" style={{ color: '#00e5ff' }}>TT</span>
              </div>
              <div>
                <h2
                  className="text-xl font-bold tracking-[0.06em] font-display"
                  style={{
                    background: 'linear-gradient(135deg, #e8e0f4, #b8aad8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  THIRSTDAY@DB
                </h2>
                <p className="text-sm font-body text-[#5a4a8a] tracking-wide">S1 Division · Group 2 · 64 Credits</p>
              </div>
            </div>

            {/* Right: W-L Record */}
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs font-body text-[#5a4a8a] tracking-wider mb-1">RECORD</p>
                <p className="text-4xl md:text-5xl font-display font-bold tracking-wider" style={{ color: '#00e5ff', textShadow: '0 0 20px rgba(0,229,255,0.2)' }}>
                  {standing.wins}<span className="text-[#5a4a8a]">-</span>{standing.losses}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs font-body text-[#5a4a8a] tracking-wider mb-1">WIN RATE</p>
                <p
                  className="text-4xl md:text-5xl font-display font-bold tracking-wider"
                  style={{
                    color: standing.winRate >= 50 ? '#00e676' : '#ff1744',
                    textShadow: `0 0 20px ${standing.winRate >= 50 ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)'}`,
                  }}
                >
                  {standing.winRate}<span className="text-[#5a4a8a]" style={{ fontSize: '0.5em' }}>%</span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Players', value: players.length, color: '#00e5ff' },
              { label: 'Played', value: standing.played, color: '#b8aad8' },
              { label: 'Points For', value: standing.pointsFor, color: '#00e676' },
              { label: 'Points Against', value: standing.pointsAgainst, color: '#ff1744' },
              { label: 'Point Diff', value: `${standing.pointDiff >= 0 ? '+' : ''}${standing.pointDiff}`, color: standing.pointDiff >= 0 ? '#00e676' : '#ff1744' },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl px-4 py-3 text-center"
                style={{
                  background: 'rgba(13, 8, 48, 0.6)',
                  border: '1px solid rgba(0, 229, 255, 0.08)',
                }}
              >
                <p className="text-[10px] font-body text-[#5a4a8a] tracking-widest uppercase mb-1">{stat.label}</p>
                <StatNumber value={stat.value} color={stat.color} size="xl" glow />
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div
            className="mt-4 pt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-body text-[#5a4a8a]"
            style={{ borderTop: '1px solid rgba(0, 229, 255, 0.06)' }}
          >
            <span>No Handicap · OI/MO</span>
            <span>{standing.remaining} matches remaining</span>
          </div>
        </div>
      </GlassCard>
      </RotatingBorderCard>

      {/* ═══ Performance Trend + Upcoming ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Trend (span 2) */}
        <GlassCard className="lg:col-span-2">
          <div className="p-6">
            <SectionHeader title="Performance Trend" />
            <div className="flex items-end justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] font-body text-[#5a4a8a] tracking-widest uppercase">Overall</p>
                    <p
                      className="text-3xl font-display font-bold tracking-wider"
                      style={{
                        color: standing.winRate >= 50 ? '#00e676' : '#ff1744',
                        textShadow: standing.winRate >= 50
                          ? '0 0 15px rgba(0,230,118,0.2)'
                          : '0 0 15px rgba(255,23,68,0.2)',
                      }}
                    >
                      {standing.winRate}<span className="text-base text-[#5a4a8a]">%</span>
                    </p>
                  </div>
                  <div className="w-px h-10" style={{ background: 'rgba(0,229,255,0.1)' }} />
                  <div>
                    <p className="text-[10px] font-body text-[#5a4a8a] tracking-widest uppercase">Streak</p>
                    <p className="text-lg font-display font-bold text-[#b8aad8] tracking-wider">
                      {completedMatches.length > 0 ? (() => {
                        let streak = 0;
                        for (let i = completedMatches.length - 1; i >= 0; i--) {
                          if (completedMatches[i].notes?.includes('(W ')) streak++;
                          else break;
                        }
                        return `W${streak}`;
                      })() : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-body text-[#5a4a8a]">
                  <span><span className="text-dart-green font-semibold">{completedMatches.filter(s => s.notes?.includes('(W ')).length}</span> Wins</span>
                  <span><span className="text-dart-red font-semibold">{completedMatches.filter(s => s.notes?.includes('(L ')).length}</span> Losses</span>
                  <span><span className="text-[#b8aad8] font-semibold">{completedMatches.length}</span> Total</span>
                </div>
              </div>
              {/* Sparkline */}
              {winRateProgression.rate.length >= 2 && (
                <div className="hidden sm:flex flex-col items-end gap-1">
                  <span className="text-[10px] font-body text-[#5a4a8a] tracking-widest uppercase">Progression</span>
                  <Sparkline data={winRateProgression.rate} height={40} width={120} />
                  <div className="flex justify-between w-[120px] text-[8px] font-body text-[#3a2a6a] tracking-wider">
                    <span>M1</span>
                    <span>M{winRateProgression.rate.length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Upcoming Mini Card */}
        <GlassCard>
          <div className="p-6">
            <SectionHeader title="Upcoming" badge={`${upcoming.length}`} />
            {upcoming.length === 0 ? (
              <p className="text-xs font-body text-[#5a4a8a] text-center py-4">No upcoming matches</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl transition-all duration-200"
                    style={{
                      background: 'rgba(10, 5, 32, 0.5)',
                      border: '1px solid rgba(0, 229, 255, 0.08)',
                    }}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#e8e0f4] font-body">{s.date}</p>
                      {s.notes && <p className="text-[10px] text-[#5a4a8a] font-body">{s.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopyLink(s.id)}
                        className="text-[10px] font-medium px-2 py-1 rounded-lg font-body transition-colors"
                        style={{
                          background: copiedId === s.id ? 'rgba(0,230,118,0.15)' : 'rgba(0,229,255,0.08)',
                          color: copiedId === s.id ? '#00e676' : '#00e5ff',
                          border: `1px solid ${copiedId === s.id ? 'rgba(0,230,118,0.25)' : 'rgba(0,229,255,0.15)'}`,
                        }}
                      >
                        {copiedId === s.id ? '✓' : 'Link'}
                      </button>
                      <button
                        onClick={() => { handleWhatsAppShare(s); handleCopyLink(s.id); }}
                        className="text-[10px] font-medium px-2 py-1 rounded-lg font-body transition-colors"
                        style={{
                          background: 'rgba(0,230,118,0.1)',
                          color: '#00e676',
                          border: '1px solid rgba(0,230,118,0.2)',
                        }}
                      >
                        Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ═══ Player Ratings ═══ */}
      <GlassCard>
        <div className="p-6">
          <SectionHeader title="Player Ratings" badge={`${players.length} active`} />
          {players.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#5a4a8a] font-body mb-2">No data yet</p>
              <p className="text-xs font-body text-[#5a4a8a]">Load data to see player ratings.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-body">
                <thead>
                  <tr className="text-[10px] text-[#5a4a8a] uppercase tracking-[0.12em]" style={{ borderBottom: '1px solid rgba(0,229,255,0.08)' }}>
                    <th className="pb-3 font-semibold font-body">#</th>
                    <th className="pb-3 font-semibold font-body">Player</th>
                    <th className="pb-3 font-semibold font-body text-center">Rt.</th>
                    <th className="pb-3 font-semibold font-body text-center">G</th>
                    <th className="pb-3 font-semibold font-body text-center">W</th>
                    <th className="pb-3 font-semibold font-body text-center">L</th>
                    <th className="pb-3 font-semibold font-body text-center">Win%</th>
                    <th className="pb-3 font-semibold font-body text-center">01 Avg</th>
                    <th className="pb-3 font-semibold font-body text-center">Cricket Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {[...players]
                    .sort((a, b) => (b.liveRating || 0) - (a.liveRating || 0) || b.games - a.games)
                    .map((p, i) => (
                    <tr
                      key={p.player.id}
                      className="transition-colors duration-150"
                      style={{
                        borderBottom: '1px solid rgba(21, 13, 64, 0.5)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(10, 5, 32, 0.4)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(10,5,32,0.4)'}
                    >
                      <td className="py-3 pr-2">
                        <span
                          className="font-display font-bold text-sm"
                          style={{ color: i < 3 ? '#00e5ff' : '#5a4a8a' }}
                        >
                          {i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : `0${i + 1}`}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-medium text-[#e8e0f4] font-body">{p.player.name}</span>
                      </td>
                      <td className="py-3 text-center">
                        <RtBadge rt={p.liveRating || 0} />
                      </td>
                      <td className="py-3 text-center font-medium text-[#b8aad8] font-body">{p.games}</td>
                      <td className="py-3 text-center font-body">
                        <span className="font-semibold" style={{ color: '#00e676' }}>{p.wins}</span>
                      </td>
                      <td className="py-3 text-center font-body">
                        <span className="font-semibold" style={{ color: '#ff1744' }}>{p.losses}</span>
                      </td>
                      <td className="py-3 text-center"><WinBadge pct={p.winPct} /></td>
                      <td className="py-3 text-center font-body">
                        <span className="font-mono text-sm" style={{ color: '#b8aad8' }}>
                          {p.stats01Avg > 0 ? <><TrendArrow dir={p.stats01Trend} />{' '}{p.stats01Avg.toFixed(2)}</> : '-'}
                        </span>
                      </td>
                      <td className="py-3 text-center font-body">
                        <span className="font-mono text-sm" style={{ color: '#b8aad8' }}>
                          {p.statsCricketAvg > 0 ? <><TrendArrow dir={p.statsCricketTrend} />{' '}{p.statsCricketAvg.toFixed(2)}</> : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ═══ Game-Type Breakdown ═══ */}
      <GlassCard>
        <div className="p-6">
          <SectionHeader title="By Game Type" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
              const gs = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].games, 0);
              const ws = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].wins, 0);
              const pct = gs > 0 ? Math.round((ws / gs) * 100) : 0;
              return (
                <div
                  key={gt}
                  className="rounded-xl p-4 text-center transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(13, 8, 48, 0.5)',
                    border: '1px solid rgba(0, 229, 255, 0.08)',
                  }}
                >
                  <p className="text-xs font-body text-[#5a4a8a] uppercase tracking-[0.1em] mb-2">{gt}</p>
                  <p
                    className="text-3xl md:text-4xl font-display font-bold tracking-wider"
                    style={{
                      color: pct >= 60 ? '#00e676' : pct >= 40 ? '#00e5ff' : '#ff1744',
                      textShadow: `0 0 12px ${pct >= 60 ? 'rgba(0,230,118,0.15)' : pct >= 40 ? 'rgba(0,229,255,0.15)' : 'rgba(255,23,68,0.15)'}`,
                    }}
                  >
                    {pct}<span className="text-base text-[#5a4a8a]">%</span>
                  </p>
                  <p className="text-xs font-body text-[#5a4a8a] mt-1">{ws}/{gs} won</p>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* ═══ Match Results ═══ */}
      {completedMatches.length > 0 && (
        <GlassCard>
          <div className="p-6">
            <SectionHeader title="Match Results" />
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full font-body"
                style={{
                  background: 'rgba(0,230,118,0.12)',
                  color: '#00e676',
                  border: '1px solid rgba(0,230,118,0.25)',
                }}
              >
                {completedMatches.filter(s => s.notes?.includes('(W ')).length}W
              </span>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full font-body"
                style={{
                  background: 'rgba(255,23,68,0.12)',
                  color: '#ff1744',
                  border: '1px solid rgba(255,23,68,0.25)',
                }}
              >
                {completedMatches.filter(s => s.notes?.includes('(L ')).length}L
              </span>
              <span className="text-xs font-body text-[#5a4a8a] ml-auto">{completedMatches.length} total</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-body text-[#5a4a8a] uppercase tracking-[0.12em] mb-3">First Half</p>
                <div className="space-y-2">
                  {firstHalf.map((s, i) => <MatchCard key={s.id} s={s} index={i} />)}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-body text-[#5a4a8a] uppercase tracking-[0.12em] mb-3">Second Half</p>
                <div className="space-y-2">
                  {secondHalf.map((s, i) => <MatchCard key={s.id} s={s} index={i} />)}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {completedMatches.length === 0 && players.length > 0 && (
        <GlassCard>
          <div className="p-8 text-center">
            <p className="text-[#5a4a8a] font-body text-lg">No completed matches yet</p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}