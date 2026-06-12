import { useState, useEffect, useCallback } from 'react';
import { getPlayerDashboardStats, getPlayerMatchHistory, getSessions, hasData, clearAllData, populateFromLiveData, updateFromLiveData } from '../store';
import { seedDemoData } from '../seed';
import { fetchLiveData } from '../scraper';

type LoadStatus = 'idle' | 'loading' | 'success' | 'fallback' | 'error';

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [players, setPlayers] = useState(getPlayerDashboardStats);
  const [sessions, setSessions] = useState(getSessions);
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const matchSessions = sessions.filter(s => s.type === 'match');

  const refresh = useCallback(() => {
    setPlayers(getPlayerDashboardStats());
    setSessions(getSessions());
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

      {/* Season Info Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl shadow-sm p-6 mb-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">S1 Division — 64 Credits</h2>
            <p className="text-indigo-200 text-sm mt-1">Thirstday@DB · Thursday League</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="bg-white/15 rounded-lg px-4 py-2 text-center">
              <p className="text-indigo-200 text-xs">Team Size</p>
              <p className="font-bold">{players.length} / 5-7</p>
            </div>
            <div className="bg-white/15 rounded-lg px-4 py-2 text-center">
              <p className="text-indigo-200 text-xs">Matches</p>
              <p className="font-bold">{matchSessions.length} played</p>
            </div>
            <div className="bg-white/15 rounded-lg px-4 py-2 text-center">
              <p className="text-indigo-200 text-xs">Min to Play</p>
              <p className="font-bold">4 players</p>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-indigo-200">
          <span>🎯 Round Robin → Playoff → Final</span>
          <span>🏆 Champion SGD 2,200 · Runner-up SGD 1,200</span>
          <span>📋 No Handicap · OI/MO</span>
        </div>
      </div>

      {/* Player Rankings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Player Rankings</h2>
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
                  <th className="pb-3 font-medium text-center">Games</th>
                  <th className="pb-3 font-medium text-center">W</th>
                  <th className="pb-3 font-medium text-center">L</th>
                  <th className="pb-3 font-medium text-center">Win%</th>
                  <th className="pb-3 font-medium text-center">01 Avg</th>
                  <th className="pb-3 font-medium text-center">Cricket Avg</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.player.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="py-3">
                      <button
                        onClick={() => setExpandedPlayer(expandedPlayer === p.player.id ? null : p.player.id)}
                        className="font-medium text-gray-800 hover:text-indigo-600 transition-colors text-left"
                      >
                        {p.player.name}
                        {p.games > 0 && <span className="text-xs text-indigo-400 ml-1">▼</span>}
                      </button>
                      {p.player.notes && (
                        <span className="text-xs text-gray-400 ml-2">({p.player.notes})</span>
                      )}
                    </td>
                    <td className="py-3 text-center font-medium text-gray-700">{p.games}</td>
                    <td className="py-3 text-center text-green-600 font-medium">{p.wins}</td>
                    <td className="py-3 text-center text-red-600 font-medium">{p.losses}</td>
                    <td className="py-3 text-center"><WinBadge pct={p.winPct} /></td>
                    <td className="py-3 text-center font-mono text-sm text-gray-700">{p.stats01Avg > 0 ? p.stats01Avg.toFixed(1) : '-'}</td>
                    <td className="py-3 text-center font-mono text-sm text-gray-700">{p.statsCricketAvg > 0 ? p.statsCricketAvg.toFixed(1) : '-'}</td>
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
              .slice(0, 10)
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

      {/* Expanded Player Chart */}
      {expandedPlayer && <PlayerChartCard playerId={expandedPlayer} onClose={() => setExpandedPlayer(null)} />}

      {/* Team Stats */}
      {players.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Players</p>
            <p className="text-3xl font-bold text-gray-800">{players.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Matches Played</p>
            <p className="text-3xl font-bold text-gray-800">{sessions.filter(s => s.type === 'match').length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Matches Remaining</p>
            <p className="text-3xl font-bold text-gray-800">{sessions.filter(s => s.type === 'match' && new Date(s.date) >= new Date(new Date().toISOString().split('T')[0])).length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Team W/L</p>
            <p className="text-3xl font-bold text-gray-800">
              {(() => {
                const teamWins = players.reduce((s, p) => s + p.wins, 0);
                const teamLosses = players.reduce((s, p) => s + p.losses, 0);
                const total = teamWins + teamLosses;
                return total > 0 ? `${teamWins}-${teamLosses}` : '-';
              })()}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Team Win%</p>
            <p className="text-3xl font-bold text-gray-800">
              {(() => {
                const teamWins = players.reduce((s, p) => s + p.wins, 0);
                const teamLosses = players.reduce((s, p) => s + p.losses, 0);
                const total = teamWins + teamLosses;
                return total > 0 ? Math.round((teamWins / total) * 100) + '%' : '-';
              })()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerChartCard({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const history = getPlayerMatchHistory(playerId);
  const player = getPlayerDashboardStats().find(p => p.player.id === playerId);
  if (!player || history.length === 0) return null;

  const maxGames = Math.max(...history.map(h => h.totalGames), 1);
  const max01 = Math.max(...history.map(h => h.stats01Avg), 0, 20);
  const maxCricket = Math.max(...history.map(h => h.statsCricketAvg), 0, 5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">{player.player.name} — Match History</h3>
        <button onClick={onClose} className="text-xs text-indigo-500 hover:text-indigo-700">Close</button>
      </div>

      {/* W/L bar chart */}
      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2 font-medium">Games W/L per Match</p>
        <div className="flex items-end gap-2" style={{ minHeight: '100px' }}>
          {history.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex flex-col-reverse w-full items-center" style={{ height: '80px' }}>
                {/* Loss bar (always on bottom) */}
                {h.losses > 0 && (
                  <div
                    className="w-6 bg-red-300 rounded-t"
                    style={{ height: `${(h.losses / maxGames) * 80}px` }}
                    title={`${h.losses} losses`}
                  />
                )}
                {/* Win bar (on top) */}
                {h.wins > 0 && (
                  <div
                    className="w-6 bg-green-400 rounded-t"
                    style={{ height: `${(h.wins / maxGames) * 80}px` }}
                    title={`${h.wins} wins`}
                  />
                )}
                {h.totalGames === 0 && (
                  <div className="w-6 h-0.5 bg-gray-200 mt-auto" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 truncate w-full text-center">
                {h.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 01 Avg trend */}
      {history.some(h => h.stats01Avg > 0) && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">01 Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div
                    className="w-6 bg-indigo-400 rounded-t"
                    style={{ height: `${(h.stats01Avg / max01) * 50}px` }}
                    title={`${h.stats01Avg}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cricket Avg trend */}
      {history.some(h => h.statsCricketAvg > 0) && (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Cricket Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div
                    className="w-6 bg-amber-400 rounded-t"
                    style={{ height: `${(h.statsCricketAvg / maxCricket) * 50}px` }}
                    title={`${h.statsCricketAvg}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{h.date.slice(5)}</span>
              </div>
            ))}
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