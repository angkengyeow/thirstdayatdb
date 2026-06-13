import { useState, useEffect, useCallback } from 'react';
import { getAllPlayersGameStats, getPartnerStats, getPlayerMatchHistory, getPlayerDashboardStats, getGamePerformancesForSession, getSessions } from '../store';
import type { PlayerGameStats, PartnerStats } from '../types';

export default function AnalysisPage() {
  const [refresh] = useState(0);
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [partnerStats, setPartnerStats] = useState<PartnerStats[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const load = useCallback(() => {
    setPlayerStats(getAllPlayersGameStats());
    setPartnerStats(getPartnerStats());
  }, []);

  useEffect(() => { load(); }, [refresh, load]);

  const matchSessions = getSessions()
    .filter(s => s.type === 'match')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (playerStats.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#eeeef4]">Analysis</h1>
          <p className="text-sm text-[#6b6b8a] mt-0.5">Player performance, partnerships, and game history</p>
        </div>
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1c1c34] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#6b6b8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[#6b6b8a] text-lg mb-2">No game data yet</p>
          <p className="text-[#6b6b8a] text-sm">Game performance data will appear here once matches are played and logged.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#eeeef4]">Analysis</h1>
        <p className="text-sm text-[#6b6b8a] mt-0.5">Player performance, partnerships, and game history</p>
      </div>

      {/* Per-Format Game Counts */}
      <GameFormatTotals matchSessions={matchSessions} />

      {/* Player Performance Table */}
      <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-6 overflow-x-auto hover:border-[#252544] transition-colors duration-200">
        <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Player Performance</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
              <th className="pb-3 font-medium">Player / Avg</th>
              <th className="pb-3 font-medium text-center">Games</th>
              <th className="pb-3 font-medium text-center">W</th>
              <th className="pb-3 font-medium text-center">L</th>
              <th className="pb-3 font-medium text-center">Win%</th>
              <th className="pb-3 font-medium text-center">01 Win%</th>
              <th className="pb-3 font-medium text-center">Cricket Win%</th>
                            <th className="pb-3 font-medium text-center">Half-It Win%</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map((ps, i) => (
              <tr
                key={ps.playerId}
                onClick={() => setSelectedPlayer(selectedPlayer === ps.playerId ? null : ps.playerId)}
                className={`border-b border-[#1c1c34] hover:bg-[#16162a] cursor-pointer transition-colors ${selectedPlayer === ps.playerId ? 'bg-gold-400/[0.06]' : ''} ${i % 2 === 0 ? '' : 'bg-[#0d0d1a]/40'}`}
              >
                <td className="py-3">
                  <div className="font-medium text-[#eeeef4]">{ps.playerName}</div>
                  <div className="text-xs text-[#6b6b8a]">
                    {ps.stats01Avg > 0 ? `01: ${ps.stats01Avg.toFixed(2)}` : ''}
                    {ps.stats01Avg > 0 && ps.statsCricketAvg > 0 ? ' / ' : ''}
                    {ps.statsCricketAvg > 0 ? `Cr: ${ps.statsCricketAvg.toFixed(2)}` : ''}
                  </div>
                </td>
                <td className="py-3 text-center text-[#c8c8d8]">{ps.totalGames}</td>
                <td className="py-3 text-center text-dart-green font-medium">{ps.wins}</td>
                <td className="py-3 text-center text-dart-red font-medium">{ps.losses}</td>
                <td className="py-3 text-center"><WinBadge pct={ps.winPct} /></td>
                <td className="py-3 text-center">{ps.format01.games > 0 ? <WinBadge pct={ps.format01.winPct} /> : <span className="text-[#2e2e52]">-</span>}</td>
                <td className="py-3 text-center">{ps.cricket.games > 0 ? <WinBadge pct={ps.cricket.winPct} /> : <span className="text-[#2e2e52]">-</span>}</td>
                                <td className="py-3 text-center">{ps.halfIt.games > 0 ? <WinBadge pct={ps.halfIt.winPct} /> : <span className="text-[#2e2e52]">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedPlayer && <PlayerDetail playerId={selectedPlayer} playerStats={playerStats} />}

        {selectedPlayer && <PlayerChartCard playerId={selectedPlayer} />}
      </div>

      {/* Half-It Analysis */}
      <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-6 hover:border-[#252544] transition-colors duration-200">
        <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Half-It</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
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
                  <tr key={ps.playerId} className="border-b border-[#1c1c34] hover:bg-[#16162a]">
                    <td className="py-3 font-medium text-[#eeeef4]">{ps.playerName}</td>
                    <td className="py-3 text-center text-[#c8c8d8]">{ps.halfIt.games}</td>
                    <td className="py-3 text-center text-dart-green font-medium">{ps.halfIt.wins}</td>
                    <td className="py-3 text-center text-dart-red font-medium">{ps.halfIt.games - ps.halfIt.wins}</td>
                    <td className="py-3 text-center"><WinBadge pct={ps.halfIt.winPct} /></td>
                    <td className="py-3 text-center text-dart-green font-medium">{ps.halfIt.legsWon}</td>
                    <td className="py-3 text-center text-dart-red font-medium">{ps.halfIt.legsLost}</td>
                    <td className="py-3 text-center"><WinBadge pct={legPct} /></td>
                  </tr>
                );
              })}
              {playerStats.filter(ps => ps.halfIt.games > 0).length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-[#6b6b8a] text-sm">No Half-It data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Analysis */}
      {partnerStats.length > 0 && (
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-6 hover:border-[#252544] transition-colors duration-200">
          <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Partner Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
                  <th className="pb-3 font-medium">Players</th>
                  <th className="pb-3 font-medium text-center">Games Together</th>
                  <th className="pb-3 font-medium text-center">Wins</th>
                  <th className="pb-3 font-medium text-center">Win%</th>
                </tr>
              </thead>
              <tbody>
                {partnerStats.map(ps => (
                  <tr key={`${ps.player1Id}::${ps.player2Id}`} className="border-b border-[#1c1c34] hover:bg-[#16162a]">
                    <td className="py-3">
                      <span className="font-medium text-[#eeeef4]">{ps.player1Name}</span>
                      <span className="text-[#6b6b8a] mx-1">+</span>
                      <span className="font-medium text-[#eeeef4]">{ps.player2Name}</span>
                    </td>
                    <td className="py-3 text-center text-[#c8c8d8]">{ps.gamesTogether}</td>
                    <td className="py-3 text-center text-dart-green font-medium">{ps.wins}</td>
                    <td className="py-3 text-center"><WinBadge pct={ps.winPct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Game History by Slot */}
      {matchSessions.length > 0 && (
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mt-6 hover:border-[#252544] transition-colors duration-200">
          <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Game History by Slot</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
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
                  const gameData = new Map<number, {
                    gameType: string;
                    format: string;
                    results: { date: string; won: boolean }[];
                  }>();
                  for (const s of matchSessions) {
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
                  const sortedGames = [...gameData.entries()].sort(([a], [b]) => a - b);

                  return sortedGames.map(([gameId, data]) => {
                    const wins = data.results.filter(r => r.won).length;
                    const total = data.results.length;
                    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
                    return (
                      <tr key={gameId} className="border-b border-[#1c1c34] hover:bg-[#16162a]">
                        <td className="py-2 pr-3 font-semibold text-[#eeeef4] whitespace-nowrap">G{gameId}</td>
                        <td className="py-2 pr-3 text-[#6b6b8a] whitespace-nowrap">
                          {data.gameType} {formatLabel[data.format] || data.format}
                        </td>
                        {matchSessions.map(s => {
                          const result = data.results.find(r => r.date === s.date);
                          const r = result?.won;
                          return (
                            <td key={s.id} className="py-2 px-2 text-center">
                              {r !== undefined ? (
                                <span className={`inline-block w-5 h-5 leading-5 rounded text-[10px] font-bold ${
                                  r ? 'bg-dart-green/20 text-dart-green' : 'bg-dart-red/15 text-dart-red'
                                }`}>
                                  {r ? 'W' : 'L'}
                                </span>
                              ) : (
                                <span className="text-[#2e2e52]">-</span>
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

function GameFormatTotals({ matchSessions }: { matchSessions: { id: string }[] }) {
  const formatLabels: Record<string, string> = { singles: 'S', doubles: 'D', trios: 'T', team: 'Tm' };
  const formatOrder = ['singles', 'doubles', 'trios', 'team'] as const;

  const playerData = new Map<string, {
    formatCounts: Record<string, number>;
    halfItGames: number;
    seenGames: Set<string>;
  }>();
  const formatTotals: Record<string, number> = {};
  for (const fmt of formatOrder) formatTotals[fmt] = 0;
  let totalHalfItGames = 0;

  // Track unique games per format for the total row
  const seenFormatGames = new Map<string, Set<string>>();
  for (const fmt of formatOrder) seenFormatGames.set(fmt, new Set());
  const seenHalfItGames = new Set<string>();

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
          seenGames: new Set(),
        });
      }
      const pd = playerData.get(pName)!;
      const gameKey = `${s.id}:${g.gameId}`;

      // Per-player: count each unique game once (one entry per game per player)
      if (!pd.seenGames.has(gameKey)) {
        pd.seenGames.add(gameKey);
        if (g.format === 'half-it') {
          pd.halfItGames++;
        } else {
          pd.formatCounts[g.gameType] = (pd.formatCounts[g.gameType] || 0) + 1;
        }
      }

      // Total row: count each unique game instance once across all players
      if (g.format === 'half-it') {
        if (!seenHalfItGames.has(gameKey)) {
          seenHalfItGames.add(gameKey);
          totalHalfItGames++;
        }
      } else {
        const seen = seenFormatGames.get(g.gameType);
        if (seen && !seen.has(gameKey)) {
          seen.add(gameKey);
          formatTotals[g.gameType] = (formatTotals[g.gameType] || 0) + 1;
        }
      }
    }
  }

  const sortedPlayers = [...playerData.entries()]
    .map(([name, d]) => ({ name, formatCounts: d.formatCounts, halfItGames: d.halfItGames }))
    .sort((a, b) => {
      const totalA = formatOrder.reduce((s, f) => s + (a.formatCounts[f] || 0), 0) + a.halfItGames;
      const totalB = formatOrder.reduce((s, f) => s + (b.formatCounts[f] || 0), 0) + b.halfItGames;
      return totalB - totalA;
    });

  if (sortedPlayers.length === 0) return null;
  const allFormatTotal = formatOrder.reduce((s, f) => s + (formatTotals[f] || 0), 0) + totalHalfItGames;

  return (
    <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#eeeef4]">Game Counts by Format</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
              <th className="pb-2 font-medium">Player</th>
              {formatOrder.map(f => (<th key={f} className="pb-2 font-medium text-center" title={f}>{formatLabels[f]}</th>))}
              <th className="pb-2 font-medium text-center" title="Half-It games">½It G</th>
              <th className="pb-2 font-medium text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(({ name, formatCounts, halfItGames }) => {
              const total = formatOrder.reduce((s, f) => s + (formatCounts[f] || 0), 0) + halfItGames;
              return (
                <tr key={name} className="border-b border-[#1c1c34] hover:bg-[#16162a]">
                  <td className="py-1.5 font-medium text-[#eeeef4]">{name}</td>
                  {formatOrder.map(f => (<td key={f} className="py-1.5 text-center font-mono text-[#c8c8d8]">{formatCounts[f] || 0}</td>))}
                  <td className="py-1.5 text-center font-mono font-semibold text-gold-400">{halfItGames}</td>
                  <td className="py-1.5 text-center font-mono font-bold text-[#eeeef4]">{total}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[#2e2e52] bg-[#0d0d1a]/80 font-semibold">
              <td className="py-1.5 text-[#6b6b8a]">Total</td>
              {formatOrder.map(f => (<td key={f} className="py-1.5 text-center font-mono text-[#c8c8d8]">{formatTotals[f] || 0}</td>))}
              <td className="py-1.5 text-center font-mono font-bold text-gold-400">{totalHalfItGames}</td>
              <td className="py-1.5 text-center font-mono font-bold text-[#eeeef4]">{allFormatTotal}</td>
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
    <div className="mt-4 pt-4 border-t border-[#1c1c34]">
      <h4 className="text-sm font-semibold text-[#9e9eb4] mb-3">Breakdown for {ps.playerName}</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
          const s = ps.byGameType[gt];
          return (
            <div key={gt} className="text-center p-3 rounded-lg bg-[#0d0d1a]/60 border border-[#1c1c34]">
              <p className="text-xs text-[#6b6b8a] capitalize mb-1">{gt}</p>
              <p className={`text-lg font-bold ${s.winPct >= 60 ? 'text-dart-green' : s.winPct >= 40 ? 'text-gold-400' : 'text-dart-red'}`}>
                {s.winPct}%
              </p>
              <p className="text-xs text-[#6b6b8a]">{s.wins}/{s.games}</p>
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
      <div className="mt-4 bg-[#111122] rounded-xl border border-[#1c1c34] p-5">
        <h3 className="font-semibold text-[#eeeef4]">{player.player.name} — Match History</h3>
        <p className="text-sm text-[#6b6b8a] mt-3">No match data loaded yet.</p>
      </div>
    );
  }

  const maxGames = Math.max(...history.map(h => h.totalGames), 1);
  const max01 = Math.max(...history.map(h => h.stats01Avg), 0, 100);
  const maxCricket = Math.max(...history.map(h => h.statsCricketAvg), 0, 5);

  return (
    <div className="mt-4 bg-[#111122] rounded-xl border border-[#1c1c34] p-5">
      <h3 className="font-semibold text-[#eeeef4] mb-4">{player.player.name} — Match History</h3>

      <div className="mb-5">
        <p className="text-xs text-[#6b6b8a] mb-2 font-medium">Games W/L per Match</p>
        <div className="flex items-end gap-2" style={{ minHeight: '100px' }}>
          {history.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex flex-col-reverse w-full items-center" style={{ height: '80px' }}>
                {h.losses > 0 && (
                  <div className="w-6 bg-dart-red/50 rounded-t" style={{ height: `${(h.losses / maxGames) * 80}px` }} title={`${h.losses} losses`} />
                )}
                {h.wins > 0 && (
                  <div className="w-6 bg-dart-green/60 rounded-t" style={{ height: `${(h.wins / maxGames) * 80}px` }} title={`${h.wins} wins`} />
                )}
                {h.totalGames === 0 && <div className="w-6 h-0.5 bg-[#2e2e52] mt-auto" />}
              </div>
              <span className="text-[10px] text-[#6b6b8a] truncate w-full text-center">{h.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {history.some(h => h.stats01Avg > 0) && (
        <div className="mb-4">
          <p className="text-xs text-[#6b6b8a] mb-2 font-medium">01 Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div className="w-6 bg-gold-400/60 rounded-t" style={{ height: `${(h.stats01Avg / max01) * 50}px` }} title={`${h.stats01Avg}`} />
                </div>
                <span className="text-[10px] text-[#6b6b8a]">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.some(h => h.statsCricketAvg > 0) && (
        <div>
          <p className="text-xs text-[#6b6b8a] mb-2 font-medium">Cricket Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div className="w-6 bg-[#6b6b8a]/60 rounded-t" style={{ height: `${(h.statsCricketAvg / maxCricket) * 50}px` }} title={`${h.statsCricketAvg}`} />
                </div>
                <span className="text-[10px] text-[#6b6b8a]">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}