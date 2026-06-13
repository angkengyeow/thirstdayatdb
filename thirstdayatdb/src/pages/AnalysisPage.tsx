import { useState, useEffect, useCallback } from 'react';
import { getAllPlayersGameStats, getPartnerStats, getTeamGameStats, getSessions, getGamePerformancesForSession, getPlayerMatchHistory, getPlayerDashboardStats, getTeamStanding } from '../store';
import type { PlayerGameStats, PartnerStats } from '../types';

export default function AnalysisPage() {
  const [refresh] = useState(0);
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [partnerStats, setPartnerStats] = useState<PartnerStats[]>([]);
  const [teamStats, setTeamStats] = useState({ totalGames: 0, wins: 0, losses: 0, winPct: 0 });
  const [matchRecord, setMatchRecord] = useState({ wins: 0, losses: 0, winPct: 0 });
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const load = useCallback(() => {
    setPlayerStats(getAllPlayersGameStats());
    setPartnerStats(getPartnerStats());
    setTeamStats(getTeamGameStats());
    const standing = getTeamStanding();
    setMatchRecord({ wins: standing.wins, losses: standing.losses, winPct: standing.winRate });
  }, []);

  useEffect(() => { load(); }, [refresh, load]);

  const matchSessions = getSessions().filter(s => s.type === 'match');

  if (teamStats.totalGames === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Analysis</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-lg mb-2">No game data yet</p>
          <p className="text-gray-400 text-sm">Game performance data will appear here once matches are played and logged.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Analysis</h1>

      {/* Team Overview — Match Level */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Match Record</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-indigo-50 rounded-lg">
            <p className="text-2xl font-bold text-indigo-600">{matchRecord.wins + matchRecord.losses}</p>
            <p className="text-xs text-gray-500">Matches Played</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{matchRecord.wins}</p>
            <p className="text-xs text-gray-500">Wins</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{matchRecord.losses}</p>
            <p className="text-xs text-gray-500">Losses</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <p className="text-2xl font-bold text-amber-600">{matchRecord.winPct}%</p>
            <p className="text-xs text-gray-500">Win Rate</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Player Game Slots</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-indigo-50/50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600">{teamStats.totalGames}</p>
              <p className="text-xs text-gray-500">Total Games</p>
            </div>
            <div className="text-center p-3 bg-green-50/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{teamStats.wins}</p>
              <p className="text-xs text-gray-500">Wins</p>
            </div>
            <div className="text-center p-3 bg-red-50/50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{teamStats.losses}</p>
              <p className="text-xs text-gray-500">Losses</p>
            </div>
            <div className="text-center p-3 bg-amber-50/50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{teamStats.winPct}%</p>
              <p className="text-xs text-gray-500">Win Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Player Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Player Performance</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-3 font-medium">Player</th>
              <th className="pb-3 font-medium text-center">Games</th>
              <th className="pb-3 font-medium text-center">W</th>
              <th className="pb-3 font-medium text-center">L</th>
              <th className="pb-3 font-medium text-center">Legs W</th>
              <th className="pb-3 font-medium text-center">Legs L</th>
              <th className="pb-3 font-medium text-center">Win%</th>
              <th className="pb-3 font-medium text-center">01 Avg</th>
              <th className="pb-3 font-medium text-center">Cricket Avg</th>
              <th className="pb-3 font-medium text-center">01 Win%</th>
              <th className="pb-3 font-medium text-center">Cricket Win%</th>
              <th className="pb-3 font-medium text-center">Half-It Win%</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map(ps => (
              <tr
                key={ps.playerId}
                onClick={() => setSelectedPlayer(selectedPlayer === ps.playerId ? null : ps.playerId)}
                className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedPlayer === ps.playerId ? 'bg-indigo-50' : ''}`}
              >
                <td className="py-3 font-medium text-gray-800">{ps.playerName}</td>
                <td className="py-3 text-center">{ps.totalGames}</td>
                <td className="py-3 text-center text-green-600 font-medium">{ps.wins}</td>
                <td className="py-3 text-center text-red-600 font-medium">{ps.losses}</td>
                <td className="py-3 text-center text-green-600 font-medium">{ps.legsWon}</td>
                <td className="py-3 text-center text-red-600 font-medium">{ps.legsLost}</td>
                <td className="py-3 text-center"><WinBadge pct={ps.winPct} /></td>
                <td className="py-3 text-center font-mono text-sm text-gray-700">{ps.stats01Avg > 0 ? ps.stats01Avg.toFixed(2) : '-'}</td>
                <td className="py-3 text-center font-mono text-sm text-gray-700">{ps.statsCricketAvg > 0 ? ps.statsCricketAvg.toFixed(2) : '-'}</td>
                <td className="py-3 text-center">{ps.format01.games > 0 ? <WinBadge pct={ps.format01.winPct} /> : <span className="text-gray-300">-</span>}</td>
                <td className="py-3 text-center">{ps.cricket.games > 0 ? <WinBadge pct={ps.cricket.winPct} /> : <span className="text-gray-300">-</span>}</td>
                <td className="py-3 text-center">{ps.halfIt.games > 0 ? <WinBadge pct={ps.halfIt.winPct} /> : <span className="text-gray-300">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Expanded per-player detail */}
        {selectedPlayer && <PlayerDetail playerId={selectedPlayer} playerStats={playerStats} />}

        {/* Player match history chart */}
        {selectedPlayer && <PlayerChartCard playerId={selectedPlayer} />}
      </div>

      {/* Game-Type Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">By Game Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
            const gs = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].games, 0);
            const ws = playerStats.reduce((sum, ps) => sum + ps.byGameType[gt].wins, 0);
            const pct = gs > 0 ? Math.round((ws / gs) * 100) : 0;
            return (
              <div key={gt} className="text-center p-4 rounded-lg border border-gray-200">
                <p className="text-lg font-bold text-gray-800 capitalize">{gt}</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{pct}%</p>
                <p className="text-xs text-gray-400">{ws}/{gs} games won</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Half-It Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Half-It</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-3 font-medium">Player</th>
                <th className="pb-3 font-medium text-center">Games</th>
                <th className="pb-3 font-medium text-center">W</th>
                <th className="pb-3 font-medium text-center">L</th>
                <th className="pb-3 font-medium text-center">Win%</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.filter(ps => ps.halfIt.games > 0).map(ps => (
                <tr key={ps.playerId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-800">{ps.playerName}</td>
                  <td className="py-3 text-center">{ps.halfIt.games}</td>
                  <td className="py-3 text-center text-green-600 font-medium">{ps.halfIt.wins}</td>
                  <td className="py-3 text-center text-red-600 font-medium">{ps.halfIt.games - ps.halfIt.wins}</td>
                  <td className="py-3 text-center"><WinBadge pct={ps.halfIt.winPct} /></td>
                </tr>
              ))}
              {playerStats.filter(ps => ps.halfIt.games > 0).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No Half-It data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Analysis */}
      {partnerStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Partner Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">Players</th>
                  <th className="pb-3 font-medium text-center">Games Together</th>
                  <th className="pb-3 font-medium text-center">Wins</th>
                  <th className="pb-3 font-medium text-center">Win%</th>
                </tr>
              </thead>
              <tbody>
                {partnerStats.map(ps => (
                  <tr key={`${ps.player1Id}::${ps.player2Id}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <span className="font-medium text-gray-800">{ps.player1Name}</span>
                      <span className="text-gray-400 mx-1">+</span>
                      <span className="font-medium text-gray-800">{ps.player2Name}</span>
                    </td>
                    <td className="py-3 text-center">{ps.gamesTogether}</td>
                    <td className="py-3 text-center text-green-600 font-medium">{ps.wins}</td>
                    <td className="py-3 text-center"><WinBadge pct={ps.winPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Match-by-match game results */}
      {matchSessions.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => {
              const el = document.getElementById('match-results');
              if (el) el.classList.toggle('hidden');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View Match-by-Match Results ▼
          </button>
          <div id="match-results" className="hidden mt-3 space-y-2">
            {matchSessions.map(s => {
              const gps = getGamePerformancesForSession(s.id);
              if (gps.length === 0) return null;
              const matchNote = s.notes?.match(/\((W|L)\s+(\d+)-(\d+)\)/);
              const matchResult = matchNote ? `${matchNote[1]} ${matchNote[2]}-${matchNote[3]}` : '';
              const isMatchWin = matchNote?.[1] === 'W';
              return (
                <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">{s.date}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isMatchWin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {matchResult || s.date}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                    {gps.filter((g, i, a) => a.findIndex(x => x.gameId === g.gameId) === i).map(g => {
                      const gameGps = gps.filter(x => x.gameId === g.gameId);
                      const won = gameGps.some(x => x.won);
                      return (
                        <div key={g.gameId} className={`text-xs p-1.5 rounded ${won ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          <span className="font-medium">G{g.gameId}</span>
                          <span className="ml-1">{won ? 'W' : 'L'}</span>
                        </div>
                      );
                    })}
                  </div>
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

function PlayerDetail({ playerId, playerStats }: { playerId: string; playerStats: PlayerGameStats[] }) {
  const ps = playerStats.find(p => p.playerId === playerId);
  if (!ps) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h4 className="text-sm font-semibold text-gray-600 mb-3">Breakdown for {ps.playerName}</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
          const s = ps.byGameType[gt];
          return (
            <div key={gt} className="text-center p-3 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500 capitalize mb-1">{gt}</p>
              <p className={`text-lg font-bold ${s.winPct >= 60 ? 'text-green-600' : s.winPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {s.winPct}%
              </p>
              <p className="text-xs text-gray-400">{s.wins}/{s.games}</p>
            </div>
          );
        })}
              </div>
    </div>
  );
}

function PlayerChartCard({ playerId }: { playerId: string }) {
  const history = getPlayerMatchHistory(playerId);
  const player = getPlayerDashboardStats().find(p => p.player.id === playerId);
  if (!player) return null;

  if (history.length === 0) {
    return (
      <div className="mt-4 bg-white rounded-xl shadow-sm border border-indigo-100 p-5">
        <h3 className="font-semibold text-gray-700">{player.player.name} — Match History</h3>
        <p className="text-sm text-gray-400 mt-3">No match data loaded yet.</p>
      </div>
    );
  }

  const maxGames = Math.max(...history.map(h => h.totalGames), 1);
  const max01 = Math.max(...history.map(h => h.stats01Avg), 0, 100);
  const maxCricket = Math.max(...history.map(h => h.statsCricketAvg), 0, 5);

  return (
    <div className="mt-4 bg-white rounded-xl shadow-sm border border-indigo-100 p-5">
      <h3 className="font-semibold text-gray-700 mb-4">{player.player.name} — Match History</h3>

      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2 font-medium">Games W/L per Match</p>
        <div className="flex items-end gap-2" style={{ minHeight: '100px' }}>
          {history.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex flex-col-reverse w-full items-center" style={{ height: '80px' }}>
                {h.losses > 0 && (
                  <div className="w-6 bg-red-300 rounded-t" style={{ height: `${(h.losses / maxGames) * 80}px` }} title={`${h.losses} losses`} />
                )}
                {h.wins > 0 && (
                  <div className="w-6 bg-green-400 rounded-t" style={{ height: `${(h.wins / maxGames) * 80}px` }} title={`${h.wins} wins`} />
                )}
                {h.totalGames === 0 && <div className="w-6 h-0.5 bg-gray-200 mt-auto" />}
              </div>
              <span className="text-[10px] text-gray-400 truncate w-full text-center">{h.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {history.some(h => h.stats01Avg > 0) && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">01 Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div className="w-6 bg-indigo-400 rounded-t" style={{ height: `${(h.stats01Avg / max01) * 50}px` }} title={`${h.stats01Avg}`} />
                </div>
                <span className="text-[10px] text-gray-400">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.some(h => h.statsCricketAvg > 0) && (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Cricket Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div className="w-6 bg-amber-400 rounded-t" style={{ height: `${(h.statsCricketAvg / maxCricket) * 50}px` }} title={`${h.statsCricketAvg}`} />
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

