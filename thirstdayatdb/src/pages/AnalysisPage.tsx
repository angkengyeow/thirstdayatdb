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
          <h1 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">Analysis</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5 font-body">Player performance, partnerships, and game history</p>
        </div>
        <div className="glass-card p-12 text-center">
          <p className="text-[#94A3B8] font-body text-lg mb-2">No game data yet</p>
          <p className="text-[#94A3B8] text-sm font-body">Game performance data will appear here once matches are played and logged.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">Analysis</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5 font-body">Player performance, partnerships, and game history</p>
      </div>

      {/* Per-Format Game Counts */}
      <GameFormatTotals matchSessions={matchSessions} />

      {/* Player Performance Table */}
      <div className="glass-card p-6 mb-6 overflow-x-auto">
        <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight flex items-center gap-2">
          <span className="w-1 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)', boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)' }} />
          Player Performance
        </h2>
        <table className="w-full text-left text-sm font-body">
          <thead>
            <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <th className="pb-3 font-semibold font-body">Player / Avg</th>
              <th className="pb-3 font-semibold font-body text-center">Games</th>
              <th className="pb-3 font-semibold font-body text-center">W</th>
              <th className="pb-3 font-semibold font-body text-center">L</th>
              <th className="pb-3 font-semibold font-body text-center">Win%</th>
              <th className="pb-3 font-semibold font-body text-center">01 Win%</th>
              <th className="pb-3 font-semibold font-body text-center">Cricket Win%</th>
                            <th className="pb-3 font-semibold font-body text-center">Half-It Win%</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map((ps, i) => (
              <tr
                key={ps.playerId}
                onClick={() => setSelectedPlayer(selectedPlayer === ps.playerId ? null : ps.playerId)}
                className="cursor-pointer transition-colors duration-150"
                style={{
                  borderBottom: '1px solid #F1F5F9',
                  background: selectedPlayer === ps.playerId ? 'rgba(212, 175, 55, 0.06)' : i % 2 === 0 ? 'transparent' : '#F8FAFC',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = selectedPlayer === ps.playerId ? 'rgba(212, 175, 55, 0.06)' : i % 2 === 0 ? 'transparent' : '#F8FAFC'}
              >
                <td className="py-3">
                  <div className="font-medium text-[#1E293B] font-body">{ps.playerName}</div>
                  <div className="text-xs text-[#94A3B8] font-body">
                    {ps.stats01Avg > 0 ? `01: ${ps.stats01Avg.toFixed(2)}` : ''}
                    {ps.stats01Avg > 0 && ps.statsCricketAvg > 0 ? ' / ' : ''}
                    {ps.statsCricketAvg > 0 ? `Cr: ${ps.statsCricketAvg.toFixed(2)}` : ''}
                  </div>
                </td>
                <td className="py-3 text-center text-[#64748B] font-body">{ps.totalGames}</td>
                <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.wins}</span></td>
                <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.losses}</span></td>
                <td className="py-3 text-center"><WinBadge pct={ps.winPct} /></td>
                <td className="py-3 text-center">{ps.format01.games > 0 ? <WinBadge pct={ps.format01.winPct} /> : <span className="text-[#CBD5E1]">-</span>}</td>
                <td className="py-3 text-center">{ps.cricket.games > 0 ? <WinBadge pct={ps.cricket.winPct} /> : <span className="text-[#CBD5E1]">-</span>}</td>
                                <td className="py-3 text-center">{ps.halfIt.games > 0 ? <WinBadge pct={ps.halfIt.winPct} /> : <span className="text-[#CBD5E1]">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedPlayer && <PlayerDetail playerId={selectedPlayer} playerStats={playerStats} />}
        {selectedPlayer && <PlayerChartCard playerId={selectedPlayer} />}
      </div>

      {/* 01 Analysis */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight flex items-center gap-2">
          <span className="w-1 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)', boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)' }} />
          01
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-body">
            <thead>
              <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th className="pb-3 font-semibold font-body">Player</th>
                <th className="pb-3 font-semibold font-body text-center">W</th>
                <th className="pb-3 font-semibold font-body text-center">L</th>
                <th className="pb-3 font-semibold font-body text-center">Win%</th>
                <th className="pb-3 font-semibold font-body text-center">LegsW</th>
                <th className="pb-3 font-semibold font-body text-center">LegsL</th>
                <th className="pb-3 font-semibold font-body text-center">Leg%</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.filter(ps => ps.format01.games > 0).map(ps => {
                const legPct = (ps.format01.legsWon + ps.format01.legsLost) > 0
                  ? Math.round((ps.format01.legsWon / (ps.format01.legsWon + ps.format01.legsLost)) * 100)
                  : 0;
                return (
                  <tr key={ps.playerId} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-3 font-medium text-[#1E293B] font-body">{ps.playerName}</td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.format01.wins}</span></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.format01.games - ps.format01.wins}</span></td>
                    <td className="py-3 text-center"><WinBadge pct={ps.format01.winPct} /></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.format01.legsWon}</span></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.format01.legsLost}</span></td>
                    <td className="py-3 text-center"><WinBadge pct={legPct} /></td>
                  </tr>
                );
              })}
              {playerStats.filter(ps => ps.format01.games > 0).length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[#94A3B8] text-sm font-body">No 01 data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cricket Analysis */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight flex items-center gap-2">
          <span className="w-1 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)', boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)' }} />
          Cricket
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-body">
            <thead>
              <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th className="pb-3 font-semibold font-body">Player</th>
                <th className="pb-3 font-semibold font-body text-center">W</th>
                <th className="pb-3 font-semibold font-body text-center">L</th>
                <th className="pb-3 font-semibold font-body text-center">Win%</th>
                <th className="pb-3 font-semibold font-body text-center">LegsW</th>
                <th className="pb-3 font-semibold font-body text-center">LegsL</th>
                <th className="pb-3 font-semibold font-body text-center">Leg%</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.filter(ps => ps.cricket.games > 0).map(ps => {
                const legPct = (ps.cricket.legsWon + ps.cricket.legsLost) > 0
                  ? Math.round((ps.cricket.legsWon / (ps.cricket.legsWon + ps.cricket.legsLost)) * 100)
                  : 0;
                return (
                  <tr key={ps.playerId} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-3 font-medium text-[#1E293B] font-body">{ps.playerName}</td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.cricket.wins}</span></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.cricket.games - ps.cricket.wins}</span></td>
                    <td className="py-3 text-center"><WinBadge pct={ps.cricket.winPct} /></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.cricket.legsWon}</span></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.cricket.legsLost}</span></td>
                    <td className="py-3 text-center"><WinBadge pct={legPct} /></td>
                  </tr>
                );
              })}
              {playerStats.filter(ps => ps.cricket.games > 0).length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[#94A3B8] text-sm font-body">No Cricket data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Half-It Analysis */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight flex items-center gap-2">
          <span className="w-1 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)', boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)' }} />
          Half-It
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-body">
            <thead>
              <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th className="pb-3 font-semibold font-body">Player</th>
                <th className="pb-3 font-semibold font-body text-center">Games</th>
                <th className="pb-3 font-semibold font-body text-center">W</th>
                <th className="pb-3 font-semibold font-body text-center">L</th>
                <th className="pb-3 font-semibold font-body text-center">Win%</th>
                <th className="pb-3 font-semibold font-body text-center">LegsW</th>
                <th className="pb-3 font-semibold font-body text-center">LegsL</th>
                <th className="pb-3 font-semibold font-body text-center">Leg%</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.filter(ps => ps.halfIt.games > 0).map(ps => {
                const legPct = (ps.halfIt.legsWon + ps.halfIt.legsLost) > 0
                  ? Math.round((ps.halfIt.legsWon / (ps.halfIt.legsWon + ps.halfIt.legsLost)) * 100)
                  : 0;
                return (
                  <tr key={ps.playerId} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-3 font-medium text-[#1E293B] font-body">{ps.playerName}</td>
                    <td className="py-3 text-center text-[#64748B] font-body">{ps.halfIt.games}</td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.halfIt.wins}</span></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.halfIt.games - ps.halfIt.wins}</span></td>
                    <td className="py-3 text-center"><WinBadge pct={ps.halfIt.winPct} /></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.halfIt.legsWon}</span></td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#DC2626]">{ps.halfIt.legsLost}</span></td>
                    <td className="py-3 text-center"><WinBadge pct={legPct} /></td>
                  </tr>
                );
              })}
              {playerStats.filter(ps => ps.halfIt.games > 0).length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-[#94A3B8] text-sm font-body">No Half-It data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Analysis */}
      {partnerStats.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight flex items-center gap-2">
            <span className="w-1 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)', boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)' }} />
            Partner Analysis
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-body">
              <thead>
                <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th className="pb-3 font-semibold font-body">Players</th>
                  <th className="pb-3 font-semibold font-body text-center">Games Together</th>
                  <th className="pb-3 font-semibold font-body text-center">Wins</th>
                  <th className="pb-3 font-semibold font-body text-center">Win%</th>
                </tr>
              </thead>
              <tbody>
                {partnerStats.map(ps => (
                  <tr key={`${ps.player1Id}::${ps.player2Id}`} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-3">
                      <span className="font-medium text-[#1E293B] font-body">{ps.player1Name}</span>
                      <span className="text-[#94A3B8] mx-1 font-body">+</span>
                      <span className="font-medium text-[#1E293B] font-body">{ps.player2Name}</span>
                    </td>
                    <td className="py-3 text-center text-[#64748B] font-body">{ps.gamesTogether}</td>
                    <td className="py-3 text-center font-body"><span className="font-semibold text-[#059669]">{ps.wins}</span></td>
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
        <div className="glass-card p-6 mt-6">
          <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight">Game History by Slot</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body">
              <thead>
                <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
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
                      <tr key={gameId} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="py-2 pr-3 font-semibold text-[#1E293B] whitespace-nowrap font-body">G{gameId}</td>
                        <td className="py-2 pr-3 text-[#94A3B8] whitespace-nowrap font-body">
                          {data.gameType} {formatLabel[data.format] || data.format}
                        </td>
                        {matchSessions.map(s => {
                          const result = data.results.find(r => r.date === s.date);
                          const r = result?.won;
                          return (
                            <td key={s.id} className="py-2 px-2 text-center">
                              {r !== undefined ? (
                                <span className={`inline-block w-5 h-5 leading-5 rounded text-[10px] font-bold ${
                                  r ? 'text-[#059669]' : 'text-[#DC2626]'
                                }`} style={{
                                  background: r ? 'rgba(5,150,105,0.10)' : 'rgba(220,38,38,0.10)',
                                }}>
                                  {r ? 'W' : 'L'}
                                </span>
                              ) : (
                                <span className="text-[#CBD5E1]">-</span>
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
  let c = '#DC2626';
  if (pct >= 60) c = '#059669';
  else if (pct >= 40) c = '#D4AF37';
  return <span className="stat-pill" style={{ background: `${c}12`, color: c, border: `1px solid ${c}25` }}>{pct}%</span>;
}

function GameFormatTotals({ matchSessions }: { matchSessions: { id: string }[] }) {
  const formatLabels: Record<string, string> = { singles: 'S', doubles: 'D', trios: 'T', team: 'Tm' };
  const formatOrder = ['singles', 'doubles', 'trios', 'team'] as const;

  const playerData = new Map<string, {
    formatCounts: Record<string, number>;
    halfItGames: number;
    seenGames: Set<string>;
  }>();

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

      if (!pd.seenGames.has(gameKey)) {
        pd.seenGames.add(gameKey);
        if (g.format === 'half-it') {
          pd.halfItGames++;
        } else {
          pd.formatCounts[g.gameType] = (pd.formatCounts[g.gameType] || 0) + 1;
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

  return (
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[#1E293B] font-display tracking-tight">Game Counts by Format</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-body">
          <thead>
            <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <th className="pb-2 font-medium font-body">Player</th>
              {formatOrder.map(f => (<th key={f} className="pb-2 font-medium text-center font-body" title={f}>{formatLabels[f]}</th>))}
              <th className="pb-2 font-medium text-center font-body" title="Half-It games">½It G</th>
              <th className="pb-2 font-medium text-center font-body">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(({ name, formatCounts, halfItGames }) => {
              const total = formatOrder.reduce((s, f) => s + (formatCounts[f] || 0), 0) + halfItGames;
              return (
                <tr key={name} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="py-1.5 font-medium text-[#1E293B] font-body">{name}</td>
                  {formatOrder.map(f => (<td key={f} className="py-1.5 text-center font-mono text-[#64748B] font-body">{formatCounts[f] || 0}</td>))}
                  <td className="py-1.5 text-center font-mono font-semibold font-body" style={{ color: '#B8942E' }}>{halfItGames}</td>
                  <td className="py-1.5 text-center font-mono font-bold text-[#1E293B] font-body">{total}</td>
                </tr>
              );
            })}
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
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E2E8F0' }}>
      <h4 className="text-sm font-semibold text-[#64748B] mb-3 font-body">Breakdown for {ps.playerName}</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['singles', 'doubles', 'trios', 'team', 'half-it'] as const).map(gt => {
          const s = ps.byGameType[gt];
          return (
            <div key={gt} className="text-center p-3 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p className="text-xs text-[#94A3B8] capitalize mb-1 font-body">{gt}</p>
              <p className={`text-lg font-bold font-display tracking-tight ${s.winPct >= 60 ? 'text-[#059669]' : s.winPct >= 40 ? 'text-[#D4AF37]' : 'text-[#DC2626]'}`}>
                {s.winPct}%
              </p>
              <p className="text-xs text-[#94A3B8] font-body">{s.wins}/{s.games}</p>
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
      <div className="mt-4 glass-card p-5">
        <h3 className="font-semibold text-[#1E293B] font-body">{player.player.name} — Match History</h3>
        <p className="text-sm text-[#94A3B8] mt-3 font-body">No match data loaded yet.</p>
      </div>
    );
  }

  const maxGames = Math.max(...history.map(h => h.totalGames), 1);
  const max01 = Math.max(...history.map(h => h.stats01Avg), 0, 100);
  const maxCricket = Math.max(...history.map(h => h.statsCricketAvg), 0, 5);

  return (
    <div className="mt-4 glass-card p-5">
      <h3 className="font-semibold text-[#1E293B] mb-4 font-body">{player.player.name} — Match History</h3>

      <div className="mb-5">
        <p className="text-xs text-[#94A3B8] mb-2 font-medium font-body">Games W/L per Match</p>
        <div className="flex items-end gap-2" style={{ minHeight: '100px' }}>
          {history.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex flex-col-reverse w-full items-center" style={{ height: '80px' }}>
                {h.losses > 0 && (
                  <div className="w-6 rounded-t" style={{ background: 'rgba(220,38,38,0.4)', height: `${(h.losses / maxGames) * 80}px` }} title={`${h.losses} losses`} />
                )}
                {h.wins > 0 && (
                  <div className="w-6 rounded-t" style={{ background: 'rgba(5,150,105,0.5)', height: `${(h.wins / maxGames) * 80}px` }} title={`${h.wins} wins`} />
                )}
                {h.totalGames === 0 && <div className="w-6 h-0.5" style={{ background: '#CBD5E1', marginTop: 'auto' }} />}
              </div>
              <span className="text-[10px] text-[#94A3B8] truncate w-full text-center font-body">{h.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {history.some(h => h.stats01Avg > 0) && (
        <div className="mb-4">
          <p className="text-xs text-[#94A3B8] mb-2 font-medium font-body">01 Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div className="w-6 rounded-t" style={{ background: 'rgba(212,175,55,0.5)', height: `${(h.stats01Avg / max01) * 50}px` }} title={`${h.stats01Avg}`} />
                </div>
                <span className="text-[10px] text-[#94A3B8] font-body">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.some(h => h.statsCricketAvg > 0) && (
        <div>
          <p className="text-xs text-[#94A3B8] mb-2 font-medium font-body">Cricket Avg per Match</p>
          <div className="flex items-end gap-2" style={{ minHeight: '60px' }}>
            {history.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center" style={{ height: '50px' }}>
                  <div className="w-6 rounded-t" style={{ background: 'rgba(212,175,55,0.4)', height: `${(h.statsCricketAvg / maxCricket) * 50}px` }} title={`${h.statsCricketAvg}`} />
                </div>
                <span className="text-[10px] text-[#94A3B8] font-body">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}