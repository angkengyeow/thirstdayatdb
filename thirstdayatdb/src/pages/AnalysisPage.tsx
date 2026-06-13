import { useState, useEffect, useCallback } from 'react';
import { getAllPlayersGameStats, getPartnerStats, getTeamGameStats, getSessions, getGamePerformancesForSession, getPlayerMatchHistory, getPlayerDashboardStats, getTeamStanding, getPlayerAwardDisplayCounts } from '../store';
import type { PlayerGameStats, PartnerStats } from '../types';

const AWARD_PINS = [
  { name: 'Hat Trick', thresholds: [2, 10, 23, 30] },
  { name: 'High Ton', thresholds: [1, 1, 2, 3] },
  { name: 'Ton 80', thresholds: [1, 2, 2, 2] },
  { name: '3 in a Bed', thresholds: [1, 2, 3, 4] },
  { name: 'White Horse', thresholds: [1, 1, 1, 3] },
  { name: '3 in the Black', thresholds: [1, 1, 1, 1] },
];

const RATING_BRACKETS = [
  { label: '1 – 5.99', min: 1, max: 5.99 },
  { label: '6 – 9.99', min: 6, max: 9.99 },
  { label: '10 – 14.99', min: 10, max: 14.99 },
  { label: '15 – 18', min: 15, max: 18 },
];

function bracketIndex(liveRating: number): number {
  if (liveRating <= 0) return -1;
  if (liveRating < 6) return 0;
  if (liveRating < 10) return 1;
  if (liveRating < 15) return 2;
  return 3;
}

export default function AnalysisPage() {
  const [refresh] = useState(0);
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [partnerStats, setPartnerStats] = useState<PartnerStats[]>([]);
  const [teamStats, setTeamStats] = useState({ totalGames: 0, wins: 0, losses: 0, winPct: 0 });
  const [matchRecord, setMatchRecord] = useState({ wins: 0, losses: 0, winPct: 0 });
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [awardData, setAwardData] = useState<{ playerName: string; awards: Record<string, number> }[]>([]);
  const [dashboardStats, setDashboardStats] = useState<{ player: { id: string; name: string }; liveRating: number }[]>([]);

  const load = useCallback(() => {
    setPlayerStats(getAllPlayersGameStats());
    setPartnerStats(getPartnerStats());
    setTeamStats(getTeamGameStats());
    const standing = getTeamStanding();
    setMatchRecord({ wins: standing.wins, losses: standing.losses, winPct: standing.winRate });
    setAwardData(getPlayerAwardDisplayCounts());
    setDashboardStats(getPlayerDashboardStats());
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
              <th className="pb-3 font-medium">Player / Avg</th>
              <th className="pb-3 font-medium text-center">Games</th>
              <th className="pb-3 font-medium text-center">W</th>
              <th className="pb-3 font-medium text-center">L</th>
              <th className="pb-3 font-medium text-center">Win%</th>
              <th className="pb-3 font-medium text-center">01 Win%</th>
              <th className="pb-3 font-medium text-center">Cricket Win%</th>
              <th className="pb-3 font-medium text-center">Legs W</th>
              <th className="pb-3 font-medium text-center">Legs L</th>
              <th className="pb-3 font-medium text-center">Legs Win%</th>
              <th className="pb-3 font-medium text-center">H-It Legs W</th>
              <th className="pb-3 font-medium text-center">H-It Legs L</th>
              <th className="pb-3 font-medium text-center">Half-It Win%</th>
              <th className="pb-3 font-medium text-center text-indigo-600" title="Hat Trick">🎯HT</th>
              <th className="pb-3 font-medium text-center text-indigo-600" title="High Ton">💯Ton</th>
              <th className="pb-3 font-medium text-center text-indigo-600" title="Ton 80">T80</th>
              <th className="pb-3 font-medium text-center text-indigo-600" title="3 in a Bed">3Bd</th>
              <th className="pb-3 font-medium text-center text-indigo-600" title="White Horse">WH</th>
              <th className="pb-3 font-medium text-center text-indigo-600" title="3 in the Black">3Blk</th>
              <th className="pb-3 font-medium text-center text-indigo-600">Clocked</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map(ps => (
              <tr
                key={ps.playerId}
                onClick={() => setSelectedPlayer(selectedPlayer === ps.playerId ? null : ps.playerId)}
                className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedPlayer === ps.playerId ? 'bg-indigo-50' : ''}`}
              >
                <td className="py-3">
                  <div className="font-medium text-gray-800">{ps.playerName}</div>
                  <div className="text-xs text-gray-400">
                    {ps.stats01Avg > 0 ? `01: ${ps.stats01Avg.toFixed(2)}` : ''}
                    {ps.stats01Avg > 0 && ps.statsCricketAvg > 0 ? ' / ' : ''}
                    {ps.statsCricketAvg > 0 ? `Cr: ${ps.statsCricketAvg.toFixed(2)}` : ''}
                  </div>
                </td>
                <td className="py-3 text-center">{ps.totalGames}</td>
                <td className="py-3 text-center text-green-600 font-medium">{ps.wins}</td>
                <td className="py-3 text-center text-red-600 font-medium">{ps.losses}</td>
                <td className="py-3 text-center"><WinBadge pct={ps.winPct} /></td>
                <td className="py-3 text-center">{ps.format01.games > 0 ? <WinBadge pct={ps.format01.winPct} /> : <span className="text-gray-300">-</span>}</td>
                <td className="py-3 text-center">{ps.cricket.games > 0 ? <WinBadge pct={ps.cricket.winPct} /> : <span className="text-gray-300">-</span>}</td>
                <td className="py-3 text-center text-green-600 font-medium">{ps.legsWon}</td>
                <td className="py-3 text-center text-red-600 font-medium">{ps.legsLost}</td>
                <td className="py-3 text-center"><WinBadge pct={ps.legsWinPct} /></td>
                <td className="py-3 text-center text-green-600 font-medium">{ps.halfIt.games > 0 ? ps.halfIt.legsWon : <span className="text-gray-300">-</span>}</td>
                <td className="py-3 text-center text-red-600 font-medium">{ps.halfIt.games > 0 ? ps.halfIt.legsLost : <span className="text-gray-300">-</span>}</td>
                <td className="py-3 text-center">{ps.halfIt.games > 0 ? <WinBadge pct={ps.halfIt.winPct} /> : <span className="text-gray-300">-</span>}</td>
                {(() => {
                  const playerAward = awardData.find(a => a.playerName === ps.playerName);
                  const awards = playerAward?.awards || {};
                  const ds = dashboardStats.find(d => d.player.id === ps.playerId);
                  const bIdx = ds ? bracketIndex(ds.liveRating) : -1;
                  const clocked = AWARD_PINS.filter(pin => (awards[pin.name] || 0) >= pin.thresholds[bIdx]).length;
                  return AWARD_PINS.map(pin => {
                    const count = awards[pin.name] || 0;
                    return (
                      <td key={pin.name} className="py-3 text-center">
                        <span className={`text-xs font-mono font-bold ${
                          count > 0 ? 'text-indigo-600' : 'text-gray-300'
                        }`}>
                          {count || '0'}
                        </span>
                      </td>
                    );
                  }).concat(
                    <td key="clocked" className="py-3 text-center">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        clocked >= 4 ? 'text-emerald-600 bg-emerald-50' :
                        clocked >= 2 ? 'text-amber-600 bg-amber-50' :
                        'text-gray-400'
                      }`}>
                        {clocked}/6
                      </span>
                    </td>
                  );
                })()}
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
                <th className="pb-3 font-medium text-center">LegsW</th>
                <th className="pb-3 font-medium text-center">LegsL</th>
                <th className="pb-3 font-medium text-center">Leg%</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.filter(ps => ps.halfIt.games > 0).map(ps => {
                const legPct = (ps.halfIt.legsWon + ps.halfIt.legsLost) > 0
                  ? Math.round((ps.halfIt.legsWon / (ps.halfIt.legsWon + ps.halfIt.legsLost)) * 100)
                  : 0;
                return (
                  <tr key={ps.playerId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-800">{ps.playerName}</td>
                    <td className="py-3 text-center">{ps.halfIt.games}</td>
                    <td className="py-3 text-center text-green-600 font-medium">{ps.halfIt.wins}</td>
                    <td className="py-3 text-center text-red-600 font-medium">{ps.halfIt.games - ps.halfIt.wins}</td>
                    <td className="py-3 text-center"><WinBadge pct={ps.halfIt.winPct} /></td>
                    <td className="py-3 text-center text-green-600 font-medium">{ps.halfIt.legsWon}</td>
                    <td className="py-3 text-center text-red-600 font-medium">{ps.halfIt.legsLost}</td>
                    <td className="py-3 text-center"><WinBadge pct={legPct} /></td>
                  </tr>
                );
              })}
              {playerStats.filter(ps => ps.halfIt.games > 0).length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400 text-sm">No Half-It data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Format Game Counts */}
      <GameFormatTotals matchSessions={matchSessions} />

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

      {/* Game-level history across all matches */}
      {matchSessions.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => {
              const el = document.getElementById('game-history');
              if (el) el.classList.toggle('hidden');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View Game History by Slot ▼
          </button>
          <div id="game-history" className="hidden mt-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Game History by Slot</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="pb-2 pr-3 font-medium whitespace-nowrap">Game</th>
                      <th className="pb-2 pr-3 font-medium whitespace-nowrap">Type</th>
                      {matchSessions.map(s => (
                        <th key={s.id} className="pb-2 px-2 font-medium text-center text-[10px] whitespace-nowrap">
                          {s.date.slice(5)}
                        </th>
                      ))}
                      <th className="pb-2 pl-3 font-medium text-center">W%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Build game-level data: for each gameId, collect results across matches
                      const gameData = new Map<number, {
                        gameType: string;
                        format: string;
                        results: { date: string; won: boolean }[];
                      }>();
                      const sortedSessions = [...matchSessions].sort((a, b) => a.date.localeCompare(b.date));

                      for (const s of sortedSessions) {
                        const gps = getGamePerformancesForSession(s.id);
                        const seen = new Set<number>();
                        for (const g of gps) {
                          if (seen.has(g.gameId)) continue;
                          seen.add(g.gameId);
                          if (!gameData.has(g.gameId)) {
                            gameData.set(g.gameId, { gameType: g.gameType, format: g.format, results: [] });
                          }
                          gameData.get(g.gameId)!.results.push({ date: s.date, won: g.won });
                        }
                      }

                      const formatLabel: Record<string, string> = {
                        '01': '01', cricket: 'Cr', 'half-it': '½', mixed: 'Mx',
                      };
                      const gameTypeOrder = ['singles', 'doubles', 'trios', 'team'];
                      const sortedGames = [...gameData.entries()].sort(([a], [b]) => a - b);

                      return sortedGames.map(([gameId, data]) => {
                        const wins = data.results.filter(r => r.won).length;
                        const total = data.results.length;
                        const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
                        return (
                          <tr key={gameId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 pr-3 font-semibold text-gray-800 whitespace-nowrap">G{gameId}</td>
                            <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                              {data.gameType} {formatLabel[data.format] || data.format}
                            </td>
                            {sortedSessions.map(s => {
                              const result = data.results.find(r => r.date === s.date);
                              const r = result?.won;
                              return (
                                <td key={s.id} className="py-2 px-2 text-center">
                                  {r !== undefined ? (
                                    <span className={`inline-block w-5 h-5 leading-5 rounded text-[10px] font-bold ${
                                      r ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                                    }`}>
                                      {r ? 'W' : 'L'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 pl-3 text-center"><WinBadge pct={winPct} /></td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Award Analysis */}
      {awardData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Awards Analysis</h2>
          <p className="text-xs text-gray-500 mb-4">
            Total award achievement counts across all matches. ✓ = meets bracket threshold.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium text-left">Player</th>
                  <th className="pb-3 font-medium text-center">Rt.</th>
                  <th className="pb-3 font-medium text-center">Bracket</th>
                  <th className="pb-3 font-medium text-center">Games</th>
                  {AWARD_PINS.map(pin => (
                    <th key={pin.name} className="pb-3 font-medium text-center text-xs">{pin.name}</th>
                  ))}
                  <th className="pb-3 font-medium text-center">Clocked</th>
                  <th className="pb-3 font-medium text-center">Avg/Game</th>
                </tr>
              </thead>
              <tbody>
                {playerStats
                  .filter(ps => awardData.some(a => a.playerName === ps.playerName))
                  .sort((a, b) => {
                    const aAwd = awardData.find(x => x.playerName === a.playerName);
                    const bAwd = awardData.find(x => x.playerName === b.playerName);
                    const aTotal = aAwd ? Object.values(aAwd.awards).reduce((s, v) => s + v, 0) : 0;
                    const bTotal = bAwd ? Object.values(bAwd.awards).reduce((s, v) => s + v, 0) : 0;
                    return bTotal - aTotal;
                  })
                  .map(ps => {
                    const playerAward = awardData.find(a => a.playerName === ps.playerName);
                    const awards = playerAward?.awards || {};
                    const ds = dashboardStats.find(d => d.player.id === ps.playerId);
                    const bIdx = ds ? bracketIndex(ds.liveRating) : -1;
                    const totalAwards = Object.values(awards).reduce((s, v) => s + v, 0);
                    const avgPerGame = ps.totalGames > 0 ? (totalAwards / ps.totalGames).toFixed(2) : '-';
                    const clocked = AWARD_PINS.filter(pin => (awards[pin.name] || 0) >= pin.thresholds[bIdx]).length;

                    return (
                      <tr key={ps.playerId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 font-medium text-gray-800">{ps.playerName}</td>
                        <td className="py-2.5 text-center font-mono text-gray-700 text-xs">
                          {ds?.liveRating ? ds.liveRating.toFixed(2) : '-'}
                        </td>
                        <td className="py-2.5 text-center">
                          {bIdx >= 0 ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                              {RATING_BRACKETS[bIdx].label}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center font-mono text-gray-600">{ps.totalGames}</td>
                        {AWARD_PINS.map(pin => {
                          const count = awards[pin.name] || 0;
                          const threshold = pin.thresholds[bIdx];
                          const achieved = count >= threshold;
                          return (
                            <td key={pin.name} className="py-2.5 text-center">
                              <span className={`text-xs font-mono font-bold px-1 py-0.5 rounded ${
                                achieved
                                  ? 'text-emerald-600 bg-emerald-50'
                                  : count > 0
                                    ? 'text-amber-600 bg-amber-50'
                                    : 'text-gray-300'
                              }`}>
                                {achieved ? `✓${count}` : count > 0 ? `${count}/${threshold}` : '0'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-2.5 text-center">
                          <span className={`text-sm font-bold ${
                            clocked >= 4 ? 'text-emerald-600' :
                            clocked >= 2 ? 'text-amber-600' :
                            'text-gray-400'
                          }`}>
                            {clocked}/{AWARD_PINS.length}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-mono text-xs text-gray-500">{avgPerGame}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
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

/** Per-player game counts by format with Half-It leg details */
function GameFormatTotals({ matchSessions }: { matchSessions: { id: string }[] }) {
  const formatLabels: Record<string, string> = { singles: 'S', doubles: 'D', trios: 'T', team: 'Tm' };
  const formatOrder = ['singles', 'doubles', 'trios', 'team'] as const;

  const playerData = new Map<string, {
    formatCounts: Record<string, number>;
    halfItGames: number;
    halfItLegsWon: number;
    halfItLegsLost: number;
  }>();
  const formatTotals: Record<string, number> = {};
  for (const fmt of formatOrder) formatTotals[fmt] = 0;
  let totalHalfItGames = 0;
  let totalHalfItLegsWon = 0;
  let totalHalfItLegsLost = 0;

  // Build player ID → name map from playerStats
  const playerStats = getAllPlayersGameStats();
  const idToName = new Map(playerStats.map(ps => [ps.playerId, ps.playerName]));

  for (const s of matchSessions) {
    const games = getGamePerformancesForSession(s.id);
    for (const g of games) {
      const pName = idToName.get(g.playerId) || g.playerId;
      if (!pName) continue;
      if (!playerData.has(pName)) {
        playerData.set(pName, {
          formatCounts: Object.fromEntries(formatOrder.map(f => [f, 0])),
          halfItGames: 0,
          halfItLegsWon: 0,
          halfItLegsLost: 0,
        });
      }
      const pd = playerData.get(pName)!;
      if (g.format === 'half-it') {
        pd.halfItGames++;
        pd.halfItLegsWon += g.legsWon;
        pd.halfItLegsLost += g.legsLost;
        totalHalfItGames++;
        totalHalfItLegsWon += g.legsWon;
        totalHalfItLegsLost += g.legsLost;
      } else {
        pd.formatCounts[g.gameType] = (pd.formatCounts[g.gameType] || 0) + 1;
        formatTotals[g.gameType] = (formatTotals[g.gameType] || 0) + 1;
      }
    }
  }

  const sortedPlayers = [...playerData.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => {
      const totalA = formatOrder.reduce((s, f) => s + (a.formatCounts[f] || 0), 0) + a.halfItGames;
      const totalB = formatOrder.reduce((s, f) => s + (b.formatCounts[f] || 0), 0) + b.halfItGames;
      return totalB - totalA;
    });

  if (sortedPlayers.length === 0) return null;
  const allFormatTotal = formatOrder.reduce((s, f) => s + (formatTotals[f] || 0), 0) + totalHalfItGames;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Game Counts by Format</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 font-medium">Player</th>
              {formatOrder.map(f => (<th key={f} className="pb-2 font-medium text-center" title={f}>{formatLabels[f]}</th>))}
              <th className="pb-2 font-medium text-center" title="Half-It leg win percentage">½It Leg%</th>
              <th className="pb-2 font-medium text-center" title="Half-It games">½It G</th>
              <th className="pb-2 font-medium text-center" title="Half-It legs won">½It LegW</th>
              <th className="pb-2 font-medium text-center" title="Half-It legs lost">½It LegL</th>
              <th className="pb-2 font-medium text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(({ name, formatCounts, halfItGames, halfItLegsWon, halfItLegsLost }) => {
              const total = formatOrder.reduce((s, f) => s + (formatCounts[f] || 0), 0) + halfItGames;
              const halfItLegPct = (halfItLegsWon + halfItLegsLost) > 0
                ? Math.round((halfItLegsWon / (halfItLegsWon + halfItLegsLost)) * 100) : 0;
              return (
                <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 font-medium text-gray-800">{name}</td>
                  {formatOrder.map(f => (<td key={f} className="py-1.5 text-center font-mono text-gray-700">{formatCounts[f] || 0}</td>))}
                  <td className="py-1.5 text-center"><WinBadge pct={halfItLegPct} /></td>
                  <td className="py-1.5 text-center font-mono font-semibold text-amber-600">{halfItGames}</td>
                  <td className="py-1.5 text-center font-mono text-green-600">{halfItLegsWon}</td>
                  <td className="py-1.5 text-center font-mono text-red-500">{halfItLegsLost}</td>
                  <td className="py-1.5 text-center font-mono font-bold text-gray-800">{total}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="py-1.5 text-gray-700">Total</td>
              {formatOrder.map(f => (<td key={f} className="py-1.5 text-center font-mono text-gray-700">{formatTotals[f] || 0}</td>))}
              <td className="py-1.5 text-center font-bold">
                <WinBadge pct={(totalHalfItLegsWon + totalHalfItLegsLost) > 0
                  ? Math.round((totalHalfItLegsWon / (totalHalfItLegsWon + totalHalfItLegsLost)) * 100) : 0} />
              </td>
              <td className="py-1.5 text-center font-mono font-bold text-amber-700">{totalHalfItGames}</td>
              <td className="py-1.5 text-center font-mono font-bold text-green-700">{totalHalfItLegsWon}</td>
              <td className="py-1.5 text-center font-mono font-bold text-red-600">{totalHalfItLegsLost}</td>
              <td className="py-1.5 text-center font-mono font-bold text-gray-800">{allFormatTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
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

