import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerDashboardStats, getSessions, hasData, clearAllData,
  populateFromLiveData, updateFromLiveData, getTeamStanding,
  getUpcomingSessions, buildResponseLink, getGamePerformancesForSession,
  getAllPlayersGameStats,
} from '../store';
import { seedDemoData } from '../seed';
import { fetchLiveData } from '../scraper';

type LoadStatus = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [players, setPlayers] = useState(getPlayerDashboardStats);
  const [sessions, setSessions] = useState(getSessions);
  const [standing, setStanding] = useState(getTeamStanding);
  const [upcoming, setUpcoming] = useState(getUpcomingSessions);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
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

  useEffect(() => {
    seedDemoData();
    refresh();
  }, [refreshKey, refresh]);

  async function loadFromApi() {
    setLoading(true);
    setLoadStatus('loading');

    const isFirstLoad = !hasData();

    try {
      const liveData = await fetchLiveData();
      if (isFirstLoad) {
        populateFromLiveData(liveData);
        setStatusMessage(`Loaded live data — ${liveData.players.length} players, ${liveData.matches.length} matches`);
      } else {
        const added = updateFromLiveData(liveData);
        if (added > 0) {
          setStatusMessage(`Added ${added} new match${added > 1 ? 'es' : ''} from DartsLive`);
        } else {
          setStatusMessage('All matches already up to date');
        }
      }
      setLoadStatus('success');
    } catch {
      setStatusMessage('DartsLive API unavailable — loading static seed data instead');
      try {
        seedDemoData();
        setLoadStatus('fallback');
        setStatusMessage('Static seed data loaded (API was unavailable)');
      } catch {
        setLoadStatus('error');
        setStatusMessage('Failed to load data from both API and static seed');
      }
    }
    setLoading(false);
    setRefreshKey(k => k + 1);
  }

  function handleLoadData() {
    if (hasData() && !confirm('This will replace all existing data. Continue?')) return;
    loadFromApi();
  }

  function handleClearData() {
    if (!confirm('Delete all data?')) return;
    clearAllData();
    setLoadStatus('idle');
    setStatusMessage('');
    setRefreshKey(k => k + 1);
  }

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

  function MatchCard({ s }: { s: typeof matchSessions[0] }) {
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
      <div className={`p-3 rounded-lg border ${isWin ? 'border-dart-green/30 bg-dart-green/[0.06]' : 'border-dart-red/30 bg-dart-red/[0.06]'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-sm font-bold px-2 py-0.5 rounded shrink-0 ${isWin ? 'text-dart-green bg-dart-green/20' : 'text-dart-red bg-dart-red/20'}`}>
              {isWin ? 'W' : 'L'}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-[#eeeef4] truncate block">{opponent}</span>
              <p className="text-xs text-[#6b6b8a]">{s.date}</p>
            </div>
          </div>
          {score && (
            <span className={`text-sm font-bold font-mono shrink-0 ${isWin ? 'text-dart-green' : 'text-dart-red'}`}>
              {score}
            </span>
          )}
        </div>
        {gameIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-[#1c1c34]/60">
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#eeeef4]">Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={handleLoadData}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading
                ? 'bg-[#1c1c34] text-[#6b6b8a] cursor-not-allowed'
                : 'bg-gold-400 text-[#0d0d1a] hover:bg-gold-300 shadow-lg shadow-gold-400/20'
            }`}
          >
            {loading ? 'Loading...' : 'Load Live Data'}
          </button>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-dart-red/15 text-dart-red rounded-lg hover:bg-dart-red/25 transition-colors text-sm font-medium"
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* Load Status Banners */}
      {loadStatus === 'loading' && (
        <div className="bg-[#1e1e3e] border border-[#2e2e5e] rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
          <span className="text-sm text-[#c8c8d8]">{statusMessage}</span>
        </div>
      )}
      {loadStatus === 'success' && (
        <div className="bg-dart-green/[0.06] border border-dart-green/30 rounded-lg p-4 mb-6 flex items-center gap-2">
          <span className="text-dart-green text-lg">✓</span>
          <span className="text-sm text-dart-green">{statusMessage}</span>
        </div>
      )}
      {loadStatus === 'fallback' && (
        <div className="bg-gold-400/[0.06] border border-gold-400/30 rounded-lg p-4 mb-6 flex items-center gap-2">
          <span className="text-gold-400 text-lg">⚠</span>
          <span className="text-sm text-gold-400">{statusMessage}</span>
        </div>
      )}
      {loadStatus === 'error' && (
        <div className="bg-dart-red/[0.06] border border-dart-red/30 rounded-lg p-4 mb-6 flex items-center gap-2">
          <span className="text-dart-red text-lg">✗</span>
          <span className="text-sm text-dart-red">{statusMessage}</span>
        </div>
      )}

      {/* Team Standing */}
      <div className="bg-gradient-to-br from-[#0d0d1a] via-[#16162a] to-[#1c1c34] rounded-xl border border-[#2e2e52] shadow-lg shadow-gold-400/5 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gold-400 font-display tracking-wider">Thirstday@DB</h2>
            <p className="text-[#6b6b8a] text-xs">S1 Division · Group 2</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gold-400">{standing.wins}W - {standing.losses}L</p>
            <p className="text-[#6b6b8a] text-xs">{standing.played} played · {standing.remaining} remaining</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-[#111122]/80 rounded-lg px-4 py-3 text-center border border-[#1c1c34]">
            <p className="text-[#6b6b8a] text-xs">Players</p>
            <p className="text-xl font-bold text-[#eeeef4]">{players.length}</p>
          </div>
          <div className="bg-[#111122]/80 rounded-lg px-4 py-3 text-center border border-[#1c1c34]">
            <p className="text-[#6b6b8a] text-xs">Win Rate</p>
            <p className="text-xl font-bold text-dart-green">{standing.winRate}%</p>
          </div>
          <div className="bg-[#111122]/80 rounded-lg px-4 py-3 text-center border border-[#1c1c34]">
            <p className="text-[#6b6b8a] text-xs">Points For</p>
            <p className="text-xl font-bold text-[#eeeef4]">{standing.pointsFor}</p>
          </div>
          <div className="bg-[#111122]/80 rounded-lg px-4 py-3 text-center border border-[#1c1c34]">
            <p className="text-[#6b6b8a] text-xs">Points Against</p>
            <p className="text-xl font-bold text-[#eeeef4]">{standing.pointsAgainst}</p>
          </div>
          <div className="bg-[#111122]/80 rounded-lg px-4 py-3 text-center border border-[#1c1c34]">
            <p className="text-[#6b6b8a] text-xs">Point Diff</p>
            <p className={`text-xl font-bold ${standing.pointDiff >= 0 ? 'text-dart-green' : 'text-dart-red'}`}>
              {standing.pointDiff >= 0 ? '+' : ''}{standing.pointDiff}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[#1c1c34] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#6b6b8a]">
          <span>64 Credits · No Handicap · OI/MO</span>
        </div>
      </div>

      {/* Upcoming Matches */}
      {upcoming.length > 0 && (
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#eeeef4]">Upcoming Matches</h2>
            <span className="text-xs text-[#6b6b8a]">{upcoming.length} upcoming</span>
          </div>
          <div className="space-y-3">
            {upcoming.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border border-[#1c1c34] bg-[#0d0d1a]/80">
                <div className="flex items-center gap-3">
                  <span className="text-lg text-gold-400">🏆</span>
                  <div>
                    <span className="text-sm font-semibold text-[#eeeef4]">{s.date}</span>
                    {s.notes && <p className="text-xs text-[#6b6b8a]">{s.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      copiedId === s.id
                        ? 'bg-dart-green/20 text-dart-green border border-dart-green/30'
                        : 'bg-[#111122] text-gold-400 border border-[#2e2e52] hover:bg-[#1c1c34]'
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
        </div>
      )}

      {/* Player Ratings */}
      <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-8">
        <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Player Ratings</h2>
        {players.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[#6b6b8a] mb-3">No data yet</p>
            <p className="text-xs text-[#6b6b8a]">Click <strong className="text-gold-400">Load Live Data</strong> to fetch from DartsLive.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
                  <th className="pb-3 font-medium">#</th>
                  <th className="pb-3 font-medium">Player</th>
                  <th className="pb-3 font-medium text-center">Rt.</th>
                  <th className="pb-3 font-medium text-center">Games</th>
                  <th className="pb-3 font-medium text-center">W</th>
                  <th className="pb-3 font-medium text-center">L</th>
                  <th className="pb-3 font-medium text-center">Win%</th>
                  <th className="pb-3 font-medium text-center">01 Avg</th>
                  <th className="pb-3 font-medium text-center">Cricket Avg</th>
                </tr>
              </thead>
              <tbody>
                {[...players]
                  .sort((a, b) => (b.liveRating || 0) - (a.liveRating || 0) || b.games - a.games)
                  .map((p, i) => (
                  <tr key={p.player.id} className="border-b border-[#1c1c34] hover:bg-[#16162a]">
                    <td className="py-3 text-[#6b6b8a] font-medium">{i + 1}</td>
                    <td className="py-3">
                      <span className="font-medium text-[#eeeef4]">{p.player.name}</span>
                    </td>
                    <td className="py-3 text-center">
                      <RtBadge rt={p.liveRating || 0} />
                    </td>
                    <td className="py-3 text-center font-medium text-[#c8c8d8]">{p.games}</td>
                    <td className="py-3 text-center text-dart-green font-medium">{p.wins}</td>
                    <td className="py-3 text-center text-dart-red font-medium">{p.losses}</td>
                    <td className="py-3 text-center"><WinBadge pct={p.winPct} /></td>
                    <td className="py-3 text-center font-mono text-sm text-[#c8c8d8]">
                      {p.stats01Avg > 0 ? <><TrendArrow dir={p.stats01Trend} />{' '}{p.stats01Avg.toFixed(2)}</> : '-'}
                    </td>
                    <td className="py-3 text-center font-mono text-sm text-[#c8c8d8]">
                      {p.statsCricketAvg > 0 ? <><TrendArrow dir={p.statsCricketTrend} />{' '}{p.statsCricketAvg.toFixed(2)}</> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Game-Type Breakdown */}
      <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-8">
        <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">By Game Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
            const gs = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].games, 0);
            const ws = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].wins, 0);
            const pct = gs > 0 ? Math.round((ws / gs) * 100) : 0;
            return (
              <div key={gt} className="text-center p-4 rounded-lg border border-[#1c1c34] bg-[#0d0d1a]/60">
                <p className="text-sm font-bold text-[#6b6b8a] capitalize">{gt}</p>
                <p className="text-2xl font-bold text-gold-400 mt-1">{pct}%</p>
                <p className="text-xs text-[#6b6b8a]">{ws}/{gs} won</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match Results */}
      {completedMatches.length > 0 && (
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#eeeef4]">Match Results</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-dart-green font-medium">{completedMatches.filter(s => s.notes?.includes('(W ')).length}W</span>
              <span className="text-dart-red font-medium">{completedMatches.filter(s => s.notes?.includes('(L ')).length}L</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[#6b6b8a] uppercase tracking-wider mb-2">First Half</p>
              <div className="space-y-2">
                {firstHalf.map(s => <MatchCard key={s.id} s={s} />)}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#6b6b8a] uppercase tracking-wider mb-2">Second Half</p>
              <div className="space-y-2">
                {secondHalf.map(s => <MatchCard key={s.id} s={s} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WinBadge({ pct }: { pct: number }) {
  let color = 'text-dart-red bg-dart-red/15';
  if (pct >= 60) color = 'text-dart-green bg-dart-green/15';
  else if (pct >= 40) color = 'text-gold-400 bg-gold-400/15';
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${color}`}>{pct}%</span>;
}

function RtBadge({ rt }: { rt: number }) {
  if (rt <= 0) return <span className="text-xs text-[#2e2e52]">-</span>;
  let color = 'text-gold-400 bg-gold-400/15';
  if (rt >= 12.5) color = 'text-gold-400 bg-gold-400/25';
  else if (rt >= 11.5) color = 'text-gold-400 bg-gold-400/20';
  else if (rt >= 10) color = 'text-gold-400 bg-gold-400/10';
  return (
    <span className={`text-xs font-semibold font-mono px-1.5 py-0.5 rounded ${color}`}>
      {rt.toFixed(2)}
    </span>
  );
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'same' }) {
  if (dir === 'up') return <span className="text-dart-green font-bold">↑</span>;
  if (dir === 'down') return <span className="text-dart-red font-bold">↓</span>;
  return null;
}