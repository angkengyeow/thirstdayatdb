import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerDashboardStats, getSessions, hasData, clearAllData,
  populateFromLiveData, updateFromLiveData, getTeamStanding,
  getUpcomingSessions, buildResponseLink, getGamePerformancesForSession,
} from '../store';
import type { GameFormat } from '../types';
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
  const matchSessions = sessions.filter(s => s.type === 'match');

  const refresh = useCallback(() => {
    setPlayers(getPlayerDashboardStats());
    setSessions(getSessions());
    setStanding(getTeamStanding());
    setUpcoming(getUpcomingSessions());
  }, []);

  // Auto-load seed data on mount
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
      `[Darts S1 Manager] 🏆 Match on ${session.date}${session.notes ? ` — ${session.notes}` : ''}\n\nPlease respond with your attendance:`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  // Split completed matches into first and second half
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

    // Per-game breakdown from store
    const sessionGames = getGamePerformancesForSession(s.id);
    const gameMap = new Map<number, { won: boolean; format: string }>();
    for (const g of sessionGames) {
      const existing = gameMap.get(g.gameId);
      if (!existing) gameMap.set(g.gameId, { won: g.won, format: g.format });
    }
    const gameIds = Array.from(gameMap.keys()).sort((a, b) => a - b);

    return (
      <div className={`p-3 rounded-lg border ${isWin ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-sm font-bold px-2 py-0.5 rounded shrink-0 ${isWin ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
              {isWin ? 'W' : 'L'}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-800 truncate block">{opponent}</span>
              <p className="text-xs text-gray-500">{s.date}</p>
            </div>
          </div>
          {score && (
            <span className={`text-sm font-bold font-mono shrink-0 ${isWin ? 'text-green-700' : 'text-red-700'}`}>
              {score}
            </span>
          )}
        </div>
        {gameIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-gray-200/60">
            {gameIds.map(gid => {
              const g = gameMap.get(gid)!;
              const isHalfIt = g.format === 'half-it';
              return (
                <span
                  key={gid}
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    g.won
                      ? 'text-green-600 bg-green-100/80'
                      : 'text-red-500 bg-red-100/80'
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
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={handleLoadData}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {loading ? 'Loading...' : 'Load Live Data'}
          </button>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* Load Status Banner */}
      {loadStatus === 'loading' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-indigo-700">{statusMessage}</span>
        </div>
      )}
      {loadStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-2">
          <span className="text-green-600 text-lg">✓</span>
          <span className="text-sm text-green-700">{statusMessage}</span>
        </div>
      )}
      {loadStatus === 'fallback' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center gap-2">
          <span className="text-amber-500 text-lg">⚠</span>
          <span className="text-sm text-amber-700">{statusMessage}</span>
        </div>
      )}
      {loadStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
          <span className="text-red-500 text-lg">✗</span>
          <span className="text-sm text-red-700">{statusMessage}</span>
        </div>
      )}

      {/* Team Standing */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl shadow-sm p-6 mb-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Thirstday@DB</h2>
            <p className="text-indigo-200 text-sm">S1 Division · Group 2</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{standing.wins}W - {standing.losses}L</p>
            <p className="text-indigo-200 text-xs">{standing.played} played · {standing.remaining} remaining</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white/15 rounded-lg px-4 py-3 text-center">
            <p className="text-indigo-200 text-xs">Players</p>
            <p className="text-xl font-bold">{players.length}</p>
          </div>
          <div className="bg-white/15 rounded-lg px-4 py-3 text-center">
            <p className="text-indigo-200 text-xs">Win Rate</p>
            <p className="text-xl font-bold">{standing.winRate}%</p>
          </div>
          <div className="bg-white/15 rounded-lg px-4 py-3 text-center">
            <p className="text-indigo-200 text-xs">Points For</p>
            <p className="text-xl font-bold">{standing.pointsFor}</p>
          </div>
          <div className="bg-white/15 rounded-lg px-4 py-3 text-center">
            <p className="text-indigo-200 text-xs">Points Against</p>
            <p className="text-xl font-bold">{standing.pointsAgainst}</p>
          </div>
          <div className="bg-white/15 rounded-lg px-4 py-3 text-center">
            <p className="text-indigo-200 text-xs">Point Diff</p>
            <p className={`text-xl font-bold ${standing.pointDiff >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {standing.pointDiff >= 0 ? '+' : ''}{standing.pointDiff}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-indigo-200">
          <span>64 Credits · No Handicap · OI/MO</span>
        </div>
      </div>

      {/* Upcoming Matches + Attendance */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Upcoming Matches</h2>
            <span className="text-xs text-gray-400">{upcoming.length} upcoming</span>
          </div>
          <div className="space-y-3">
            {upcoming.map(s => {
              return (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border border-indigo-100 bg-indigo-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏆</span>
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{s.date}</span>
                      {s.notes && <p className="text-xs text-gray-500">{s.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        copiedId === s.id
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      {copiedId === s.id ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => { handleWhatsAppShare(s); handleCopyLink(s.id); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                    >
                      Share
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Ratings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Player Ratings</h2>
        {players.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-3">No data yet</p>
            <p className="text-sm text-gray-400">Click <strong>Load Live Data</strong> to fetch from DartsLive — or load static seed data if the API is unavailable.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
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
                  <tr key={p.player.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-3">
                      <span className="font-medium text-gray-800">{p.player.name}</span>
                    </td>
                    <td className="py-3 text-center">
                      <RtBadge rt={p.liveRating || 0} />
                    </td>
                    <td className="py-3 text-center font-medium text-gray-700">{p.games}</td>
                    <td className="py-3 text-center text-green-600 font-medium">{p.wins}</td>
                    <td className="py-3 text-center text-red-600 font-medium">{p.losses}</td>
                    <td className="py-3 text-center"><WinBadge pct={p.winPct} /></td>
                    <td className="py-3 text-center font-mono text-sm text-gray-700">
                      {p.stats01Avg > 0 ? <><TrendArrow dir={p.stats01Trend} />{' '}{p.stats01Avg.toFixed(2)}</> : '-'}
                    </td>
                    <td className="py-3 text-center font-mono text-sm text-gray-700">
                      {p.statsCricketAvg > 0 ? <><TrendArrow dir={p.statsCricketTrend} />{' '}{p.statsCricketAvg.toFixed(2)}</> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Match Results — 2 columns: first half / second half */}
      {completedMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Match Results</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-700 font-medium">{completedMatches.filter(s => s.notes?.includes('(W ')).length}W</span>
              <span className="text-red-700 font-medium">{completedMatches.filter(s => s.notes?.includes('(L ')).length}L</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Half */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">First Half</p>
              <div className="space-y-2">
                {firstHalf.map(s => <MatchCard key={s.id} s={s} />)}
              </div>
            </div>
            {/* Second Half */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Second Half</p>
              <div className="space-y-2">
                {secondHalf.map(s => <MatchCard key={s.id} s={s} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-Format Game Counts */}
      {players.length > 0 && <GameFormatTotals players={players} matchSessions={matchSessions} refresh={refreshKey} />}

      </div>
  );
}

function WinBadge({ pct }: { pct: number }) {
  let color = 'text-red-600 bg-red-50';
  if (pct >= 60) color = 'text-green-600 bg-green-50';
  else if (pct >= 40) color = 'text-amber-600 bg-amber-50';
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${color}`}>{pct}%</span>;
}

function RtBadge({ rt }: { rt: number }) {
  if (rt <= 0) return <span className="text-xs text-gray-300">-</span>;
  let color = 'text-amber-600 bg-amber-50';
  if (rt >= 12.5) color = 'text-yellow-600 bg-yellow-100';
  else if (rt >= 11.5) color = 'text-blue-600 bg-blue-50';
  else if (rt >= 10) color = 'text-indigo-600 bg-indigo-50';
  return (
    <span className={`text-xs font-semibold font-mono px-1.5 py-0.5 rounded ${color}`}>
      {rt.toFixed(2)}
    </span>
  );
}

function TrendArrow({ dir }: { dir: 'up' | 'down' | 'same' }) {
  if (dir === 'up') return <span className="text-green-500 font-bold">↑</span>;
  if (dir === 'down') return <span className="text-red-500 font-bold">↓</span>;
  return null;
}

/** Per-player game counts by format (singles, doubles, trios, team, half-it) */
function GameFormatTotals({ players, matchSessions }: { players: any[]; matchSessions: any[]; refresh: number }) {
  const formatLabels: Record<string, string> = {
    singles: 'S',
    doubles: 'D',
    trios: 'T',
    team: 'Tm',
    'half-it': '½It',
  };
  const formatOrder = ['singles', 'doubles', 'trios', 'team', 'half-it'] as const;

  const playerFormatCounts = new Map<string, Record<string, number>>();
  const formatTotals: Record<string, number> = {};
  for (const fmt of formatOrder) formatTotals[fmt] = 0;

  for (const s of matchSessions) {
    const games = getGamePerformancesForSession(s.id);
    for (const g of games) {
      const pName = players.find(p => p.player.id === g.playerId)?.player.name;
      if (!pName) continue;
      if (!playerFormatCounts.has(pName)) {
        playerFormatCounts.set(pName, Object.fromEntries(formatOrder.map(f => [f, 0])));
      }
      playerFormatCounts.get(pName)![g.gameType] = (playerFormatCounts.get(pName)![g.gameType] || 0) + 1;
      formatTotals[g.gameType] = (formatTotals[g.gameType] || 0) + 1;
      // Also count half-it format separately
      if (g.format === 'half-it') {
        playerFormatCounts.get(pName)!['half-it'] = (playerFormatCounts.get(pName)!['half-it'] || 0) + 1;
        formatTotals['half-it'] = (formatTotals['half-it'] || 0) + 1;
      }
    }
  }

  const sortedPlayers = [...playerFormatCounts.entries()]
    .map(([name, counts]) => ({ name, counts }))
    .sort((a, b) => {
      const totalA = formatOrder.reduce((s, f) => s + (a.counts[f] || 0), 0);
      const totalB = formatOrder.reduce((s, f) => s + (b.counts[f] || 0), 0);
      return totalB - totalA;
    });

  if (sortedPlayers.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Game Counts by Format</h2>
        <span className="text-xs text-gray-400">singles · doubles · trios · team · half-it</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 font-medium">Player</th>
              {formatOrder.map(f => (
                <th key={f} className="pb-2 font-medium text-center" title={f}>
                  {formatLabels[f]}
                </th>
              ))}
              <th className="pb-2 font-medium text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(({ name, counts }) => {
              const total = formatOrder.reduce((s, f) => s + (counts[f] || 0), 0);
              return (
                <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 font-medium text-gray-800">{name}</td>
                  {formatOrder.map(f => (
                    <td key={f} className={`py-1.5 text-center font-mono ${f === 'half-it' ? 'text-amber-600 font-semibold' : 'text-gray-700'}`}>
                      {counts[f] || 0}
                    </td>
                  ))}
                  <td className="py-1.5 text-center font-mono font-bold text-gray-800">{total}</td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="py-1.5 text-gray-700">Total</td>
              {formatOrder.map(f => (
                <td key={f} className={`py-1.5 text-center font-mono ${f === 'half-it' ? 'text-amber-700 font-bold' : 'text-gray-700'}`}>
                  {formatTotals[f] || 0}
                </td>
              ))}
              <td className="py-1.5 text-center font-mono font-bold text-gray-800">
                {formatOrder.reduce((s, f) => s + (formatTotals[f] || 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}