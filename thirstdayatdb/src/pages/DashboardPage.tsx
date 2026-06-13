import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerDashboardStats, getSessions,
  populateFromLiveData, updateFromLiveData, getTeamStanding,
  getUpcomingSessions, buildResponseLink, getGamePerformancesForSession,
  getAllPlayersGameStats, shouldSkipAutoUpdate, saveLastUpdated,
} from '../store';
import { seedDemoData } from '../seed';
import { fetchLiveData } from '../scraper';

/* ─── Mini Sparkline SVG (gold) ───────────────────────────────────── */
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
        <linearGradient id="gold-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#gold-fill)" />
      <path d={d} fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      {data.map((_, i) => {
        const [x, y] = points[i].split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r="1.8" fill="#D4AF37" opacity="0.8" />;
      })}
    </svg>
  );
}

/* ─── Gold Stat Number ──────────────────────────────────────────────── */
function StatNumber({ value, suffix = '', size = 'xl', color = '#D4AF37' }: {
  value: string | number; suffix?: string; size?: 'lg' | 'xl' | '2xl' | '3xl'; color?: string;
}) {
  const sizeMap = { lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl' };
  return (
    <span className={`font-display font-bold ${sizeMap[size]} tracking-tight`} style={{ color }}>
      {value}{suffix}
    </span>
  );
}

/* ─── Helper Components ────────────────────────────────────────────── */
function WinBadge({ pct }: { pct: number }) {
  let c = '#DC2626';
  if (pct >= 60) c = '#059669';
  else if (pct >= 40) c = '#D4AF37';
  return (
    <span className="stat-pill" style={{ background: `${c}12`, color: c, border: `1px solid ${c}25` }}>
      {pct}%
    </span>
  );
}

function RtBadge({ rt }: { rt: number }) {
  if (rt <= 0) return <span className="text-xs text-[#CBD5E1]">-</span>;
  return (
    <span className="stat-pill" style={{
      background: 'rgba(212, 175, 55, 0.10)',
      color: '#B8942E',
      border: '1px solid rgba(212, 175, 55, 0.25)',
    }}>
      {rt.toFixed(2)}
    </span>
  );
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'same' }) {
  if (dir === 'up') return <span className="text-[#059669] font-bold">↑</span>;
  if (dir === 'down') return <span className="text-[#DC2626] font-bold">↓</span>;
  return null;
}

/* ─── Section Header ────────────────────────────────────────────────── */
function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-base font-semibold text-[#1E293B] flex items-center gap-3 font-display tracking-tight">
        <span
          className="w-1 h-5 rounded-full inline-block"
          style={{
            background: 'linear-gradient(180deg, #D4AF37, #E8C872)',
            boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)',
          }}
        />
        {title}
      </h2>
      {badge && (
        <span
          className="text-xs font-medium px-3 py-1 rounded-full font-body tracking-wide"
          style={{
            background: 'rgba(212, 175, 55, 0.08)',
            color: '#B8942E',
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [players, setPlayers] = useState(getPlayerDashboardStats);
  const [sessions, setSessions] = useState(getSessions);
  const [standing, setStanding] = useState(getTeamStanding);
  const [upcoming, setUpcoming] = useState(getUpcomingSessions);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const loadingStages = ['Connecting to DartsLive...', 'Fetching match data...', 'Processing results...', 'Building stats...'];
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
    let stageTimer: ReturnType<typeof setInterval>;
    async function autoLoad() {
      if (shouldSkipAutoUpdate()) {
        seedDemoData();
        if (!cancelled) setRefreshKey(k => k + 1);
        return;
      }
      setLoading(true);
      setLoadingStage(0);
      setStatusMessage(loadingStages[0]);

      // Animate through stages while loading
      stageTimer = setInterval(() => {
        setLoadingStage(prev => Math.min(prev + 1, loadingStages.length - 1));
        setStatusMessage(loadingStages[Math.min(loadingStages.length - 1, 0)]);
      }, 2500);

      try {
        const liveData = await fetchLiveData();
        if (cancelled) return;
        setLoadingStage(loadingStages.length - 1);
        setStatusMessage('Building stats...');
        await new Promise(r => setTimeout(r, 300));
        populateFromLiveData(liveData);
        const added = updateFromLiveData(liveData);
        saveLastUpdated();
        clearInterval(stageTimer);
        setStatusMessage(added > 0 ? `Updated — ${added} new match${added > 1 ? 'es' : ''}` : 'Up to date');
        await new Promise(r => setTimeout(r, 400));
        if (!cancelled) { setLoading(false); setRefreshKey(k => k + 1); }
      } catch {
        if (cancelled) return;
        clearInterval(stageTimer);
        seedDemoData();
        setStatusMessage('Seed data loaded');
        await new Promise(r => setTimeout(r, 400));
        if (!cancelled) { setLoading(false); setRefreshKey(k => k + 1); }
      }
    }
    autoLoad();
    return () => { cancelled = true; clearInterval(stageTimer); };
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
          background: isWin ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${isWin ? 'rgba(5, 150, 105, 0.15)' : 'rgba(220, 38, 38, 0.15)'}`,
          animationDelay: `${index * 50}ms`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-sm font-bold px-2.5 py-0.5 rounded shrink-0 font-body"
              style={{
                background: isWin ? 'rgba(5, 150, 105, 0.10)' : 'rgba(220, 38, 38, 0.10)',
                color: isWin ? '#059669' : '#DC2626',
              }}
            >
              {isWin ? 'W' : 'L'}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-[#1E293B] truncate block font-body">{opponent}</span>
              <p className="text-xs text-[#94A3B8] font-body">{s.date}</p>
            </div>
          </div>
          {score && (
            <span
              className="text-base font-bold font-display tracking-tight shrink-0"
              style={{ color: isWin ? '#059669' : '#DC2626' }}
            >
              {score}
            </span>
          )}
        </div>
        {gameIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: '1px solid #E2E8F0' }}>
            {gameIds.map(gid => {
              const g = gameMap.get(gid)!;
              const isHalfIt = g.format === 'half-it';
              return (
                <span
                  key={gid}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded font-body"
                  style={{
                    background: g.won ? 'rgba(5, 150, 105, 0.10)' : 'rgba(220, 38, 38, 0.10)',
                    color: g.won ? '#059669' : '#DC2626',
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
          <h1 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">
            Dashboard
          </h1>
          <p className="text-sm text-[#94A3B8] mt-0.5 font-body">Team overview &amp; match history</p>
        </div>
        {(loading || statusMessage) && (
          <div className="flex items-center gap-3">
            {/* Animated progress steps */}
            <div className="flex items-center gap-2">
              {loadingStages.map((stage, i) => (
                <div
                  key={stage}
                  className="flex items-center gap-1.5 transition-all duration-500"
                  style={{
                    opacity: loadingStage >= i ? 1 : 0.25,
                  }}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                      loadingStage > i ? '' : loadingStage === i && loading ? 'animate-pulse' : ''
                    }`}
                    style={{
                      background: loadingStage > i ? '#059669' : loadingStage === i ? '#D4AF37' : '#CBD5E1',
                    }}
                  />
                  <span
                    className="text-[10px] font-body hidden sm:inline transition-colors duration-500"
                    style={{ color: loadingStage >= i ? '#64748B' : '#CBD5E1' }}
                  >
                    {loadingStage > i ? stage.replace('...', '') : stage}
                  </span>
                </div>
              ))}
            </div>
            {/* Live status pill */}
            <div
              className="flex items-center gap-2 text-xs font-body tracking-wide whitespace-nowrap"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(212, 175, 55, 0.15)',
                borderRadius: '999px',
                padding: '4px 14px',
              }}
            >
              {loading && (
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#D4AF37' }}
                />
              )}
              <span className="text-[#94A3B8]">{statusMessage || 'Loading...'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Skeleton Loading ═══ */}
      {loading && matchSessions.length === 0 && (
        <div className="space-y-6 animate-fade-in">
          {/* Hero card skeleton */}
          <div className="rounded-xl p-6 md:p-8 skeleton-shimmer" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px' }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-24 h-14 skeleton-shimmer" />
                <div className="space-y-2">
                  <div className="w-40 h-5 skeleton-shimmer" />
                  <div className="w-52 h-3 skeleton-shimmer" />
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="space-y-2">
                  <div className="w-12 h-3 skeleton-shimmer" />
                  <div className="w-20 h-10 skeleton-shimmer" />
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-3 skeleton-shimmer" />
                  <div className="w-20 h-10 skeleton-shimmer" />
                </div>
              </div>
            </div>
            {/* Stats grid skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl px-4 py-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="w-16 h-3 skeleton-shimmer mx-auto mb-2" />
                  <div className="w-10 h-6 skeleton-shimmer mx-auto" />
                </div>
              ))}
            </div>
            <hr className="mt-4 mb-3" style={{ borderColor: '#F1F5F9' }} />
          </div>

          {/* Two-column skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl p-6 skeleton-gold" style={{ background: '#FFFFFF', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '16px' }}>
              <div className="w-36 h-4 skeleton-shimmer mb-4" />
              <div className="w-full h-24 skeleton-shimmer" />
            </div>
            <div className="rounded-xl p-6 skeleton-gold" style={{ background: '#FFFFFF', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '16px' }}>
              <div className="w-28 h-4 skeleton-shimmer mb-4" />
              <div className="w-full h-20 skeleton-shimmer mb-2" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-3/4 h-3 skeleton-shimmer mb-2" />
              ))}
            </div>
          </div>

          {/* Match history skeletons */}
          <div className="space-y-2">
            <div className="w-32 h-4 skeleton-shimmer mb-3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl p-4 skeleton-shimmer" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-5 skeleton-shimmer" />
                      <div className="space-y-1">
                        <div className="w-36 h-3 skeleton-shimmer" />
                        <div className="w-20 h-2 skeleton-shimmer" />
                      </div>
                    </div>
                    <div className="w-12 h-6 skeleton-shimmer" />
                  </div>
                  <div className="flex gap-1 mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="w-10 h-4 skeleton-shimmer" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Hero Standing Card ═══ */}
      <div className="glass-card-deep">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Identity */}
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <img src="/logo.jpg" alt="Thirstday@DB" className="w-22 h-12 object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">
                  Thirstday@DB
                </h2>
                <p className="text-sm font-body text-[#94A3B8]">S1 Division · Group 2 · 64 Credits</p>
              </div>
            </div>

            {/* Right: W-L Record */}
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs font-body text-[#94A3B8] tracking-wider mb-1">RECORD</p>
                <p className="text-4xl md:text-5xl font-display font-bold tracking-tight text-[#1E293B]">
                  {standing.wins}<span className="text-[#CBD5E1]">-</span>{standing.losses}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs font-body text-[#94A3B8] tracking-wider mb-1">WIN RATE</p>
                <p
                  className="text-4xl md:text-5xl font-display font-bold tracking-tight"
                  style={{ color: standing.winRate >= 50 ? '#059669' : '#DC2626' }}
                >
                  {standing.winRate}<span className="text-[#94A3B8] text-2xl">%</span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Players', value: players.length, color: '#D4AF37' },
              { label: 'Played', value: standing.played, color: '#1E293B' },
              { label: 'Points For', value: standing.pointsFor, color: '#059669' },
              { label: 'Points Against', value: standing.pointsAgainst, color: '#DC2626' },
              { label: 'Point Diff', value: `${standing.pointDiff >= 0 ? '+' : ''}${standing.pointDiff}`, color: standing.pointDiff >= 0 ? '#059669' : '#DC2626' },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-xl px-4 py-3 text-center"
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <p className="text-[10px] font-body text-[#94A3B8] tracking-widest uppercase mb-1">{stat.label}</p>
                <StatNumber value={stat.value} color={stat.color} size="xl" />
              </div>
            ))}
          </div>

          {/* Bottom bar — gold laser line accent */}
          <hr className="gold-line mt-4 mb-3" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-body text-[#94A3B8]">
            <span>No Handicap · OI/MO</span>
            <span>{standing.remaining} matches remaining</span>
          </div>
        </div>
      </div>

      {/* ═══ Performance Trend + Upcoming ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Trend (span 2) */}
        <div className="glass-card lg:col-span-2">
          <div className="p-6">
            <SectionHeader title="Performance Trend" />
            <div className="flex items-end justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] font-body text-[#94A3B8] tracking-widest uppercase">Overall</p>
                    <p
                      className="text-3xl font-display font-bold tracking-tight"
                      style={{ color: standing.winRate >= 50 ? '#059669' : '#DC2626' }}
                    >
                      {standing.winRate}<span className="text-base text-[#94A3B8]">%</span>
                    </p>
                  </div>
                  <div className="w-px h-10" style={{ background: '#E2E8F0' }} />
                  <div>
                    <p className="text-[10px] font-body text-[#94A3B8] tracking-widest uppercase">Streak</p>
                    <p className="text-lg font-display font-bold text-[#1E293B] tracking-tight">
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
                <div className="flex items-center gap-4 text-xs font-body text-[#94A3B8]">
                  <span><span className="text-[#059669] font-semibold">{completedMatches.filter(s => s.notes?.includes('(W ')).length}</span> Wins</span>
                  <span><span className="text-[#DC2626] font-semibold">{completedMatches.filter(s => s.notes?.includes('(L ')).length}</span> Losses</span>
                  <span><span className="text-[#1E293B] font-semibold">{completedMatches.length}</span> Total</span>
                </div>
              </div>
              {/* Sparkline */}
              {winRateProgression.rate.length >= 2 && (
                <div className="hidden sm:flex flex-col items-end gap-1">
                  <span className="text-[10px] font-body text-[#94A3B8] tracking-widest uppercase">Progression</span>
                  <Sparkline data={winRateProgression.rate} height={40} width={120} />
                  <div className="flex justify-between w-[120px] text-[8px] font-body text-[#CBD5E1] tracking-wider">
                    <span>M1</span>
                    <span>M{winRateProgression.rate.length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Mini Card */}
        <div className="glass-card">
          <div className="p-6">
            <SectionHeader title="Upcoming" badge={`${upcoming.length}`} />
            {upcoming.length === 0 ? (
              <p className="text-xs font-body text-[#94A3B8] text-center py-4">No upcoming matches</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl transition-all duration-200"
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#1E293B] font-body">{s.date}</p>
                      {s.notes && <p className="text-[10px] text-[#94A3B8] font-body">{s.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopyLink(s.id)}
                        className="text-[10px] font-medium px-2 py-1 rounded-lg font-body transition-colors"
                        style={{
                          background: copiedId === s.id ? 'rgba(5, 150, 105, 0.10)' : 'rgba(212, 175, 55, 0.08)',
                          color: copiedId === s.id ? '#059669' : '#B8942E',
                          border: `1px solid ${copiedId === s.id ? 'rgba(5, 150, 105, 0.25)' : 'rgba(212, 175, 55, 0.2)'}`,
                        }}
                      >
                        {copiedId === s.id ? '✓' : 'Link'}
                      </button>
                      <button
                        onClick={() => { handleWhatsAppShare(s); handleCopyLink(s.id); }}
                        className="text-[10px] font-medium px-2 py-1 rounded-lg font-body transition-colors"
                        style={{
                          background: 'rgba(212, 175, 55, 0.10)',
                          color: '#B8942E',
                          border: '1px solid rgba(212, 175, 55, 0.2)',
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
        </div>
      </div>

      {/* ═══ Player Ratings ═══ */}
      <div className="glass-card">
        <div className="p-6">
          <SectionHeader title="Player Ratings" badge={`${players.length} active`} />
          {players.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#94A3B8] font-body mb-2">No data yet</p>
              <p className="text-xs font-body text-[#94A3B8]">Load data to see player ratings.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-body">
                <thead>
                  <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
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
                        borderBottom: '1px solid #F1F5F9',
                        background: i % 2 === 0 ? 'transparent' : '#F8FAFC',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#F8FAFC'}
                    >
                      <td className="py-3 pr-2">
                        <span className="font-display font-bold text-sm text-[#94A3B8]">
                          {i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : `0${i + 1}`}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-medium text-[#1E293B] font-body">{p.player.name}</span>
                      </td>
                      <td className="py-3 text-center">
                        <RtBadge rt={p.liveRating || 0} />
                      </td>
                      <td className="py-3 text-center font-medium text-[#64748B] font-body">{p.games}</td>
                      <td className="py-3 text-center font-body">
                        <span className="font-semibold text-[#059669]">{p.wins}</span>
                      </td>
                      <td className="py-3 text-center font-body">
                        <span className="font-semibold text-[#DC2626]">{p.losses}</span>
                      </td>
                      <td className="py-3 text-center"><WinBadge pct={p.winPct} /></td>
                      <td className="py-3 text-center font-body">
                        <span className="font-mono text-sm text-[#64748B]">
                          {p.stats01Avg > 0 ? <><TrendArrow dir={p.stats01Trend} />{' '}{p.stats01Avg.toFixed(2)}</> : '-'}
                        </span>
                      </td>
                      <td className="py-3 text-center font-body">
                        <span className="font-mono text-sm text-[#64748B]">
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
      </div>

      {/* ═══ Game-Type Breakdown ═══ */}
      <div className="glass-card">
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
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <p className="text-xs font-body text-[#94A3B8] uppercase tracking-[0.08em] mb-2">{gt}</p>
                  <p
                    className="text-3xl md:text-4xl font-display font-bold tracking-tight"
                    style={{
                      color: pct >= 60 ? '#059669' : pct >= 40 ? '#D4AF37' : '#DC2626',
                    }}
                  >
                    {pct}<span className="text-base text-[#94A3B8]">%</span>
                  </p>
                  <p className="text-xs font-body text-[#94A3B8] mt-1">{ws}/{gs} won</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Match Results ═══ */}
      {completedMatches.length > 0 && (
        <div className="glass-card">
          <div className="p-6">
            <SectionHeader title="Match Results" />
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full font-body"
                style={{
                  background: 'rgba(5, 150, 105, 0.10)',
                  color: '#059669',
                  border: '1px solid rgba(5, 150, 105, 0.25)',
                }}
              >
                {completedMatches.filter(s => s.notes?.includes('(W ')).length}W
              </span>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full font-body"
                style={{
                  background: 'rgba(220, 38, 38, 0.10)',
                  color: '#DC2626',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                }}
              >
                {completedMatches.filter(s => s.notes?.includes('(L ')).length}L
              </span>
              <span className="text-xs font-body text-[#94A3B8] ml-auto">{completedMatches.length} total</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-body text-[#94A3B8] uppercase tracking-[0.08em] mb-3">First Half</p>
                <div className="space-y-2">
                  {firstHalf.map((s, i) => <MatchCard key={s.id} s={s} index={i} />)}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-body text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Second Half</p>
                <div className="space-y-2">
                  {secondHalf.map((s, i) => <MatchCard key={s.id} s={s} index={i} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {completedMatches.length === 0 && players.length > 0 && (
        <div className="glass-card">
          <div className="p-8 text-center">
            <p className="text-[#94A3B8] font-body">No completed matches yet</p>
          </div>
        </div>
      )}
    </div>
  );
}