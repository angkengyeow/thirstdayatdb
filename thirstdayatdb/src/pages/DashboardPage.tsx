import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerDashboardStats, getSessions,
  populateFromLiveData, updateFromLiveData, getTeamStanding,
  getUpcomingSessions, buildResponseLink, getGamePerformancesForSession,
  getAllPlayersGameStats, shouldSkipAutoUpdate, saveLastUpdated,
} from '../store';
import { seedDemoData } from '../seed';
import { fetchLiveData } from '../scraper';

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
      // If data exists and was last updated after the most recent match, skip
      if (shouldSkipAutoUpdate()) {
        // Still ensure seed data is present as a baseline
        seedDemoData();
        if (!cancelled) {
          setRefreshKey(k => k + 1);
        }
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
        const msg = added > 0
          ? `Updated — ${added} new match${added > 1 ? 'es' : ''}`
          : 'Up to date';
        setStatusMessage(msg);
      } catch {
        if (cancelled) return;
        seedDemoData();
        setStatusMessage('Seed data loaded');
      }
      if (!cancelled) {
        setLoading(false);
        setRefreshKey(k => k + 1);
      }
    }
    autoLoad();
    return () => { cancelled = true; };
  }, []);

  // Refresh view whenever underlying data changes
  useEffect(() => {
    refresh();
  }, [refreshKey, refresh]);

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
        className={`p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01] ${
          isWin
            ? 'border-dart-green/30 bg-dart-green/[0.06] hover:bg-dart-green/[0.09] hover:shadow-lg hover:shadow-dart-green/5'
            : 'border-dart-red/30 bg-dart-red/[0.06] hover:bg-dart-red/[0.09] hover:shadow-lg hover:shadow-dart-red/5'
        }`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-sm font-bold px-2 py-0.5 rounded shrink-0 ${isWin ? 'text-dart-green bg-dart-green/20' : 'text-dart-red bg-dart-red/20'}`}>
              {isWin ? 'W' : 'L'}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-[#e8e0f4] truncate block">{opponent}</span>
              <p className="text-xs text-[#5a4a8a]">{s.date}</p>
            </div>
          </div>
          {score && (
            <span className={`text-sm font-bold font-mono shrink-0 ${isWin ? 'text-dart-green' : 'text-dart-red'}`}>
              {score}
            </span>
          )}
        </div>
        {gameIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-[#150d40]/60">
            {gameIds.map(gid => {
              const g = gameMap.get(gid)!;
              const isHalfIt = g.format === 'half-it';
              return (
                <span
                  key={gid}
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    g.won
                      ? 'text-dart-green bg-dart-green/15'
                      : 'text-dart-red bg-dart-red/15'
                  }`}
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
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e8e0f4] font-display tracking-wider">Dashboard</h1>
          <p className="text-sm text-[#5a4a8a] mt-0.5">Team overview and match history</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#5a4a8a] bg-[#0d0830]/80 px-3 py-1.5 rounded-full border border-[#1a2a5a]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_4px_rgba(0,229,255,0.5)]" />
            Loading...
          </div>
        )}
        {!loading && statusMessage && (
          <div className="text-[11px] text-[#3a2a6a] bg-[#0d0830]/60 px-3 py-1.5 rounded-full border border-[#1a2a5a]">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Team Standing */}
      <Section animate>
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/20 flex items-center justify-center">
                <span className="text-lg font-display text-[#00e5ff] font-bold">TT</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#00e5ff] font-display tracking-wider">Thirstday@DB</h2>
                <p className="text-[#5a4a8a] text-xs">S1 Division · Group 2</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#00e5ff]">{standing.wins}W - {standing.losses}L</p>
              <p className="text-[#5a4a8a] text-xs">{standing.played} played · {standing.remaining} remaining</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#0d0830]/80 rounded-xl px-4 py-3 text-center border border-[#1a2a5a]">
              <p className="text-[#5a4a8a] text-xs">Players</p>
              <p className="text-xl font-bold text-[#e8e0f4]">{players.length}</p>
            </div>
            <div className="bg-[#0d0830]/80 rounded-xl px-4 py-3 text-center border border-[#1a2a5a]">
              <p className="text-[#5a4a8a] text-xs">Win Rate</p>
              <p className="text-xl font-bold text-dart-green">{standing.winRate}%</p>
            </div>
            <div className="bg-[#0d0830]/80 rounded-xl px-4 py-3 text-center border border-[#1a2a5a]">
              <p className="text-[#5a4a8a] text-xs">Points For</p>
              <p className="text-xl font-bold text-[#e8e0f4]">{standing.pointsFor}</p>
            </div>
            <div className="bg-[#0d0830]/80 rounded-xl px-4 py-3 text-center border border-[#1a2a5a]">
              <p className="text-[#5a4a8a] text-xs">Points Against</p>
              <p className="text-xl font-bold text-[#e8e0f4]">{standing.pointsAgainst}</p>
            </div>
            <div className="bg-[#0d0830]/80 rounded-xl px-4 py-3 text-center border border-[#1a2a5a]">
              <p className="text-[#5a4a8a] text-xs">Point Diff</p>
              <p className={`text-xl font-bold ${standing.pointDiff >= 0 ? 'text-dart-green' : 'text-dart-red'}`}>
                {standing.pointDiff >= 0 ? '+' : ''}{standing.pointDiff}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#150d40] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#5a4a8a]">
            <span>64 Credits · No Handicap · OI/MO</span>
          </div>
        </div>
      </Section>

      {/* Upcoming Matches */}
      {upcoming.length > 0 && (
        <Section title="Upcoming Matches" badge={`${upcoming.length} upcoming`}>
          <div className="space-y-3">
            {upcoming.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border border-[#150d40] bg-[#0a0520]/80 hover:border-cyan-400/30 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-400/5">
                <div className="flex items-center gap-3">
                  <span className="text-lg text-cyan-400">🏆</span>
                  <div>
                    <span className="text-sm font-semibold text-[#e8e0f4]">{s.date}</span>
                    {s.notes && <p className="text-xs text-[#5a4a8a]">{s.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      copiedId === s.id
                        ? 'bg-dart-green/20 text-dart-green border border-dart-green/30'
                        : 'bg-[#0d0830] text-cyan-400 border border-[#3a2a6a] hover:bg-[#150d40] hover:border-cyan-400/50'
                    }`}
                  >
                    {copiedId === s.id ? '✓ Copied' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => { handleWhatsAppShare(s); handleCopyLink(s.id); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dart-green/15 text-dart-green border border-dart-green/30 hover:bg-dart-green/25 transition-colors"
                  >
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Player Ratings */}
      <Section title="Player Ratings">
        {players.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#150d40] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#5a4a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[#5a4a8a] mb-2">No data yet</p>
            <p className="text-xs text-[#5a4a8a]">Click <strong className="text-cyan-400">Load Live Data</strong> to fetch from DartsLive.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#150d40] text-[#5a4a8a] text-[11px] uppercase tracking-wider">
                  <th className="pb-3 font-semibold">#</th>
                  <th className="pb-3 font-semibold">Player</th>
                  <th className="pb-3 font-semibold text-center">Rt.</th>
                  <th className="pb-3 font-semibold text-center">G</th>
                  <th className="pb-3 font-semibold text-center">W</th>
                  <th className="pb-3 font-semibold text-center">L</th>
                  <th className="pb-3 font-semibold text-center">Win%</th>
                  <th className="pb-3 font-semibold text-center">01 Avg</th>
                  <th className="pb-3 font-semibold text-center">Cricket Avg</th>
                </tr>
              </thead>
              <tbody>
                {[...players]
                  .sort((a, b) => (b.liveRating || 0) - (a.liveRating || 0) || b.games - a.games)
                  .map((p, i) => (
                  <tr key={p.player.id} className={`border-b border-[#150d40] hover:bg-[#100a30] transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0520]/50'}`}>
                    <td className={`py-3 font-medium ${i < 3 ? 'text-cyan-400' : 'text-[#5a4a8a]'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="py-3">
                      <span className="font-medium text-[#e8e0f4]">{p.player.name}</span>
                    </td>
                    <td className="py-3 text-center">
                      <RtBadge rt={p.liveRating || 0} />
                    </td>
                    <td className="py-3 text-center font-medium text-[#b8aad8]">{p.games}</td>
                    <td className="py-3 text-center text-dart-green font-medium">{p.wins}</td>
                    <td className="py-3 text-center text-dart-red font-medium">{p.losses}</td>
                    <td className="py-3 text-center"><WinBadge pct={p.winPct} /></td>
                    <td className="py-3 text-center font-mono text-sm text-[#b8aad8]">
                      {p.stats01Avg > 0 ? <><TrendArrow dir={p.stats01Trend} />{' '}{p.stats01Avg.toFixed(2)}</> : '-'}
                    </td>
                    <td className="py-3 text-center font-mono text-sm text-[#b8aad8]">
                      {p.statsCricketAvg > 0 ? <><TrendArrow dir={p.statsCricketTrend} />{' '}{p.statsCricketAvg.toFixed(2)}</> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Game-Type Breakdown */}
      <Section title="By Game Type">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
            const gs = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].games, 0);
            const ws = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].wins, 0);
            const pct = gs > 0 ? Math.round((ws / gs) * 100) : 0;
            return (
              <div
                key={gt}
                className="text-center p-4 rounded-lg border border-[#150d40] bg-[#0a0520]/60 hover:bg-[#100a30] hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/5 transition-all duration-200"
              >
                <p className="text-xs font-semibold text-[#5a4a8a] uppercase tracking-wider mb-2">{gt}</p>
                <p className="text-3xl font-bold text-cyan-400">{pct}%</p>
                <p className="text-xs text-[#5a4a8a] mt-1">{ws}/{gs} won</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Match Results */}
      {completedMatches.length > 0 && (
        <Section title="Match Results">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-dart-green bg-dart-green/15 px-3 py-1 rounded-full">{completedMatches.filter(s => s.notes?.includes('(W ')).length}W</span>
            <span className="text-sm font-medium text-dart-red bg-dart-red/15 px-3 py-1 rounded-full">{completedMatches.filter(s => s.notes?.includes('(L ')).length}L</span>
            <span className="text-xs text-[#5a4a8a] ml-auto">{completedMatches.length} total</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[#5a4a8a] uppercase tracking-wider mb-2">First Half</p>
              <div className="space-y-2">
                {firstHalf.map((s, i) => <MatchCard key={s.id} s={s} index={i} />)}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#5a4a8a] uppercase tracking-wider mb-2">Second Half</p>
              <div className="space-y-2">
                {secondHalf.map((s, i) => <MatchCard key={s.id} s={s} index={i} />)}
              </div>
            </div>
          </div>
        </Section>
      )}

      {completedMatches.length === 0 && players.length > 0 && (
        <Section title="Match Results">
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#150d40] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#5a4a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-[#5a4a8a]">No completed matches yet</p>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, badge, children, animate }: { title?: string; badge?: string; children: React.ReactNode; animate?: boolean }) {
  return (
    <div className={`glass-card rounded-xl p-6 mb-8 transition-all duration-200 ${animate ? '' : ''}`}>
      {title && (
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#e8e0f4] flex items-center gap-2">
            <span className="w-1 h-5 bg-[#00e5ff] rounded-full inline-block shadow-[0_0_6px_rgba(0,229,255,0.4)]" />
            {title}
          </h2>
          {badge && <span className="text-xs text-[#5a4a8a] bg-[#0a0520] px-2 py-1 rounded-lg border border-[#1a2a5a]">{badge}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

function WinBadge({ pct }: { pct: number }) {
  let color = 'bg-[#ff1744]/15 text-[#ff1744] border border-[#ff1744]/25';
  if (pct >= 60) color = 'bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/25';
  else if (pct >= 40) color = 'bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/25';
  return <span className={`stat-pill ${color}`}>{pct}%</span>;
}

function RtBadge({ rt }: { rt: number }) {
  if (rt <= 0) return <span className="text-xs text-[#3a2a6a]">-</span>;
  if (rt >= 12.5) return <span className="stat-pill stat-pill-ppd">{rt.toFixed(2)}</span>;
  if (rt >= 11.5) return <span className="stat-pill bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20">{rt.toFixed(2)}</span>;
  return <span className="stat-pill bg-[#00e5ff]/8 text-[#00e5ff] border border-[#00e5ff]/15">{rt.toFixed(2)}</span>;
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'same' }) {
  if (dir === 'up') return <span className="text-dart-green font-bold">↑</span>;
  if (dir === 'down') return <span className="text-dart-red font-bold">↓</span>;
  return null;
}