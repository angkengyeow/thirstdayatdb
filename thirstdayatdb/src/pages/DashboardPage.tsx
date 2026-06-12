import { useState, useEffect, useCallback } from 'react';
import { getPlayerDashboardStats, getSessions, hasData, clearAllData, populateFromLiveData, updateFromLiveData, getTeamStanding } from '../store';
import { seedDemoData } from '../seed';
import { fetchLiveData } from '../scraper';

type LoadStatus = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [players, setPlayers] = useState(getPlayerDashboardStats);
  const [sessions, setSessions] = useState(getSessions);
  const [standing, setStanding] = useState(getTeamStanding);
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const matchSessions = sessions.filter(s => s.type === 'match');

  const refresh = useCallback(() => {
    setPlayers(getPlayerDashboardStats());
    setSessions(getSessions());
    setStanding(getTeamStanding());
  }, []);

  useEffect(() => {
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
                      {p.stats01Avg > 0 ? <><TrendArrow dir={p.stats01Trend} />{' '}{p.stats01Avg.toFixed(1)}</> : '-'}
                    </td>
                    <td className="py-3 text-center font-mono text-sm text-gray-700">
                      {p.statsCricketAvg > 0 ? <><TrendArrow dir={p.statsCricketTrend} />{' '}{p.statsCricketAvg.toFixed(1)}</> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Match Results Timeline */}
      {matchSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Match Results</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-700 font-medium">
                {matchSessions.filter(s => s.notes?.includes('(W ')).length}W
              </span>
              <span className="text-red-700 font-medium">
                {matchSessions.filter(s => s.notes?.includes('(L ')).length}L
              </span>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {[...matchSessions]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(s => {
                const isWin = s.notes?.includes('(W ');
                const noteParts = s.notes?.match(/(vs|@)\s+(.+?)\s+\((W|L)\s+(\d+)-(\d+)\)/);
                const opponent = noteParts?.[2] || s.notes || '';
                const score = noteParts ? `${noteParts[4]}-${noteParts[5]}` : '';
                return (
                  <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border ${isWin ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${isWin ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                        {isWin ? 'W' : 'L'}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{opponent}</span>
                        <p className="text-xs text-gray-500">{s.date}</p>
                      </div>
                    </div>
                    {score && (
                      <span className={`text-sm font-bold font-mono ${isWin ? 'text-green-700' : 'text-red-700'}`}>
                        {score}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

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