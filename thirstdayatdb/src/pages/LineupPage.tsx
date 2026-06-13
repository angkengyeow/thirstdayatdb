import { useState, useEffect } from 'react';
import {
  generateFullLineup, getSessions, updateFromLiveData,
  getMatchSessionForDate, getGameResultsForSession, getMatchScore,
  saveLiveLineup, loadLiveLineup, getAllPlayersWithStats,
  getOpponentTeamProfile, matchupBonus, formatScore,
} from '../store';
import { fetchLiveData } from '../scraper';
import type { MatchGame, FullLineup, OpponentTeamProfile } from '../types';

const SUPER_LEAGUE_FORMAT: MatchGame[] = [
  { id: 1, type: 'singles', label: 'Singles 701 x3', legs: '701·701·701', playerCount: 1 },
  { id: 2, type: 'singles', label: 'Singles 701/Cricket/701', legs: '701·Cricket·701', playerCount: 1 },
  { id: 3, type: 'doubles', label: 'Doubles 701/Cricket/Choice', legs: '701·Cricket·Choice', playerCount: 2 },
  { id: 4, type: 'doubles', label: 'Doubles 701/Cricket/701', legs: '701·Cricket·701', playerCount: 2 },
  { id: 5, type: 'doubles', label: 'Doubles Cricket x3', legs: 'Cricket·Cricket·Cricket', playerCount: 2 },
  { id: 6, type: 'doubles', label: 'Doubles Half-It x3', legs: 'Half-It·Half-It·Half-It', playerCount: 2 },
  { id: 7, type: 'doubles', label: 'Doubles 701/Cricket/Choice', legs: '701·Cricket·Choice', playerCount: 2 },
  { id: 8, type: 'trios', label: 'Trios 901/Cricket/Choice', legs: '901·Cricket·Choice', playerCount: 3 },
  { id: 9, type: 'team', label: 'Team 1101', legs: '1101', playerCount: 4 },
];

const GAME_TYPE_STYLES: Record<string, { border: string; badge: string; dot: string }> = {
  singles: { border: 'rgba(212,175,55,0.15)', badge: '#B8942E', dot: '#D4AF37' },
  doubles: { border: 'rgba(5,150,105,0.15)', badge: '#059669', dot: '#059669' },
  trios: { border: 'rgba(100,116,139,0.15)', badge: '#64748B', dot: '#64748B' },
  team: { border: 'rgba(212,175,55,0.15)', badge: '#B8942E', dot: '#D4AF37' },
};

interface LineupPageProps {
  preselectDate?: string | null;
}

export default function LineupPage({ preselectDate }: LineupPageProps) {
  const [matchDate, setMatchDate] = useState(preselectDate || new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<FullLineup | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'done' | 'uptodate' | 'error'>('idle');

  // Live match-day state
  const [isMatchDay, setIsMatchDay] = useState(false);
  const [matchSessionId, setMatchSessionId] = useState<string | null>(null);
  const [gameResults, setGameResults] = useState<Map<number, { won: boolean; legsWon: number; legsLost: number }>>(new Map());
  const [score, setScore] = useState({ thirstday: 0, opponent: 0, total: 0 });
  const [swapTarget, setSwapTarget] = useState<{ gameId: number; playerIdx: number } | null>(null);

  useEffect(() => {
    if (preselectDate) return;
    const sessions = getSessions();
    const matchSessions = sessions
      .filter(s => s.type === 'match')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const today = new Date().toISOString().split('T')[0];
    const nextMatch = matchSessions.find(s => s.date >= today);
    if (nextMatch) {
      setMatchDate(nextMatch.date);
    }
  }, [preselectDate]);

  useEffect(() => {
    const session = getMatchSessionForDate(matchDate);
    if (session) {
      setIsMatchDay(true);
      setMatchSessionId(session.id);
      const saved = loadLiveLineup(session.id);
      if (saved) {
        setResult(saved);
      }
    } else {
      setIsMatchDay(false);
      setMatchSessionId(null);
    }
  }, [matchDate]);

  useEffect(() => {
    if (preselectDate) return;
    const today = new Date().toISOString().split('T')[0];
    const sessions = getSessions();
    const isMatchDayToday = sessions.some(s => s.type === 'match' && s.date === today);
    if (!isMatchDayToday) return;

    const doRefresh = () => {
      setRefreshStatus('loading');
      fetchLiveData()
        .then(liveData => {
          const added = updateFromLiveData(liveData);
          setRefreshStatus(added > 0 ? 'done' : 'uptodate');
          if (added > 0) {
            setResult(prev => prev ? generateFullLineup(matchDate, SUPER_LEAGUE_FORMAT) : null);
          }
        })
        .catch(() => {
          setRefreshStatus('error');
        });
    };

    doRefresh();
    const interval = setInterval(doRefresh, 60000);
    return () => clearInterval(interval);
  }, [matchDate, preselectDate]);

  useEffect(() => {
    if (!matchSessionId) return;
    const updateResults = () => {
      setGameResults(getGameResultsForSession(matchSessionId));
      setScore(getMatchScore(matchSessionId));
    };
    updateResults();
    const interval = setInterval(updateResults, 15000);
    return () => clearInterval(interval);
  }, [matchSessionId]);

  useEffect(() => {
    if (matchSessionId && result) {
      saveLiveLineup(matchSessionId, result);
    }
  }, [result, matchSessionId]);

  useEffect(() => {
    if (preselectDate) {
      const lineup = generateFullLineup(preselectDate, SUPER_LEAGUE_FORMAT);
      setResult(lineup);
    }
  }, [preselectDate]);

  function handleGenerate() {
    const lineup = generateFullLineup(matchDate, SUPER_LEAGUE_FORMAT);
    setResult(lineup);
  }

  function handleSwapPlayer(gameId: number, playerIdx: number, newPlayerId: string) {
    if (!result || !matchSessionId) return;
    const idx = result.assignments.findIndex(a => a.game.id === gameId);
    if (idx === -1) return;
    if (playerIdx >= result.assignments[idx].players.length) return;

    const assignment = result.assignments[idx];
    const players = getAllPlayersWithStats();
    const replacement = players.find(p => p.player.id === newPlayerId);
    if (!replacement) return;

    const newPlayers = [...assignment.players];
    newPlayers[playerIdx] = replacement;

    const countMap = new Map<string, number>();
    const newAssignments = result.assignments.map((a, i) => {
      if (i !== idx) {
        for (const p of a.players) {
          countMap.set(p.player.id, (countMap.get(p.player.id) || 0) + 1);
        }
        return a;
      }
      for (const p of newPlayers) {
        countMap.set(p.player.id, (countMap.get(p.player.id) || 0) + 1);
      }
      return { ...a, players: newPlayers };
    });

    const playerGameCount = Array.from(countMap.entries())
      .map(([playerId, count]) => {
        const p = players.find(pp => pp.player.id === playerId);
        return { playerName: p?.player?.name || playerId, count };
      })
      .sort((a, b) => b.count - a.count);

    setResult({ ...result, assignments: newAssignments, playerGameCount });
    setSwapTarget(null);
  }

  const anPill = (c: string) => ({ background: `${c}12`, color: c, border: `1px solid ${c}25` });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">Lineup Generator</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5 font-body">Optimize player assignments across all 9 Super League games</p>
      </div>

      {/* Live Match Banner */}
      {isMatchDay && matchSessionId && (
        <div className="glass-card rounded-xl p-5 mb-8" style={{ borderColor: 'rgba(212, 175, 55, 0.25)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full font-body"
              style={{ background: 'rgba(212, 175, 55, 0.10)', color: '#B8942E', border: '1px solid rgba(212, 175, 55, 0.25)' }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#D4AF37' }} />
              LIVE
            </span>
            <span className="text-sm text-[#64748B] font-body">
              Match on {matchDate}
            </span>
            {score.total > 0 && (
              <span className="ml-auto text-lg font-bold font-display tracking-tight tabular-nums">
                <span style={{ color: score.thirstday > score.opponent ? '#059669' : '#DC2626' }}>
                  {score.thirstday}
                </span>
                <span className="text-[#CBD5E1] mx-1">-</span>
                <span style={{ color: score.opponent > score.thirstday ? '#059669' : '#DC2626' }}>
                  {score.opponent}
                </span>
                <span className="text-xs text-[#94A3B8] ml-1.5">/ {score.total}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPER_LEAGUE_FORMAT.map(g => {
              const r = gameResults.get(g.id);
              const isCompleted = r !== undefined;
              return (
                <span
                  key={g.id}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium font-body"
                  style={isCompleted ? anPill(r!.won ? '#059669' : '#DC2626') : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}
                >
                  G{g.id} {isCompleted ? (r!.won ? 'W' : 'L') : '-'}
                </span>
              );
            })}
          </div>
          {score.total > 0 && score.total < 9 && (
            <p className="text-xs mt-2 font-body" style={{ color: 'rgba(212,175,55,0.7)' }}>Results auto-refresh every 15s — swap players on pending games below</p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="glass-card p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-[#64748B] mb-1 font-body">Match Date</label>
            <input
              type="date"
              value={matchDate}
              onChange={e => setMatchDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <button
              onClick={handleGenerate}
              className="btn-gold w-full"
            >
              {isMatchDay ? 'Generate / Reset Lineup' : 'Generate Lineup'}
            </button>
          </div>
        </div>

        {refreshStatus === 'loading' && (
          <div className="rounded-lg p-3 mt-4 flex items-center gap-2 text-sm font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37' }} />
            Refreshing game stats from DartsLive...
          </div>
        )}
        {refreshStatus === 'done' && (
          <div className="rounded-lg p-3 mt-4 flex items-center gap-2 text-sm font-body" style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', color: '#059669' }}>
            ✓ Latest game stats loaded for match day
          </div>
        )}
        {refreshStatus === 'uptodate' && (
          <div className="rounded-lg p-3 mt-4 flex items-center gap-2 text-sm font-body" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', color: '#B8942E' }}>
            ✓ All match data already up to date
          </div>
        )}
        {refreshStatus === 'error' && (
          <div className="rounded-lg p-3 mt-4 flex items-center gap-2 text-sm font-body" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626' }}>
            ⚠ Could not refresh stats — using existing data
          </div>
        )}

        {preselectDate && (
          <div className="rounded-lg p-3 mt-4 flex items-center gap-2 text-sm font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <span>📋</span>
            <span>Lineup planned from Attendance — only responding players (on-time/late) are available</span>
          </div>
        )}

        {isMatchDay && !preselectDate && (
          <div className="rounded-lg p-3 mt-4 flex items-center gap-2 text-sm font-body" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', color: '#B8942E' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#D4AF37' }} />
            <span>Match day — lineups are auto-saved. Click a player to swap if someone's not in their prime.</span>
          </div>
        )}

        <div className="mt-4 p-4 rounded-lg text-sm font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="font-medium mb-1" style={{ color: '#B8942E' }}>S1 Division — 64 Credits (No Handicap, OI/MO)</p>
          <p className="mt-1 text-[#64748B]">
            <span className="font-medium text-[#1E293B]">Ranking by game type:</span>
          </p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside text-[#64748B]">
            <li><strong className="text-[#1E293B]">G1, G9</strong> (pure 01) → ranked by <strong style={{ color: '#B8942E' }}>01 Avg</strong></li>
            <li><strong className="text-[#1E293B]">G5</strong> (pure Cricket) → ranked by <strong style={{ color: '#B8942E' }}>Cricket Avg</strong></li>
            <li><strong className="text-[#1E293B]">G2–G4, G7, G8</strong> (mixed) → ranked by <strong style={{ color: '#B8942E' }}>Composite</strong> (01 Avg + Cricket Avg + Win Rate + Partner Chemistry — weightage TBD)</li>
            <li><strong className="text-[#1E293B]">G6</strong> (Half-It) → ranked by <strong style={{ color: '#B8942E' }}>Half-It Composite</strong> (50% Cricket Avg + 50% Half-It Leg Win Rate)</li>
          </ul>
          <p className="text-[#94A3B8] mt-1">
            <strong className="text-[#1E293B]">Rules:</strong> Part 1 = no repeats. Part 2 &amp; Part 3 = at most 2 appearances per player per block.
            Game count balancing spreads play across all games.
          </p>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="mb-8 space-y-8">
            {(() => {
              const assignMap = new Map(result.assignments.map(a => [a.game.id, a]));
              const skipMap = new Map(result.skippedGames.map(s => [s.game.id, s]));

              const renderCard = (game: MatchGame) => {
                const assignment = assignMap.get(game.id);
                const skipped = skipMap.get(game.id);
                const styles = GAME_TYPE_STYLES[game.type];
                const completed = gameResults.get(game.id);

                if (skipped) {
                  return (
                    <div key={game.id} className="rounded-xl p-3 font-body" style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.15)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full font-body" style={{ background: 'rgba(220,38,38,0.10)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>FORFEITED</span>
                        <span className="text-sm font-semibold text-[#94A3B8] line-through font-body">{game.label}</span>
                        <span className="text-[10px] text-[#94A3B8] ml-auto font-mono font-body">G{game.id}</span>
                      </div>
                      {game.legs && <p className="text-xs text-[#94A3B8] mb-2 font-body">{game.legs}</p>}
                      <p className="text-xs font-body" style={{ color: 'rgba(220,38,38,0.7)' }}>{skipped.reason}</p>
                    </div>
                  );
                }

                if (!assignment) return null;

                return (
                  <div key={game.id} className="rounded-xl p-3 transition-all duration-200 font-body" style={{
                    background: '#FFFFFF',
                    border: `1px solid ${completed ? (completed.won ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)') : styles.border}`,
                    boxShadow: '0 2px 8px rgba(212,175,55,0.06), 0 1px 2px rgba(0,0,0,0.03)',
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      {completed ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full font-body" style={completed.won ? { background: 'rgba(5,150,105,0.10)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' } : { background: 'rgba(220,38,38,0.10)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                          {completed.won ? 'W' : 'L'} {completed.legsWon}-{completed.legsLost}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full font-body" style={{ background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                          PENDING
                        </span>
                      )}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full font-body" style={{ background: `${styles.badge}15`, color: styles.badge, border: `1px solid ${styles.badge}30` }}>
                        {game.type.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-[#1E293B] font-body">{game.label}</span>
                      <span className="text-[10px] text-[#94A3B8] ml-auto font-mono font-body">G{game.id}</span>
                    </div>
                    {game.legs && <p className="text-xs text-[#94A3B8] mb-2 font-body">{game.legs}</p>}
                    <div className="space-y-1.5">
                      {assignment.players.map((p, i) => {
                        const legs = game.legs;
                        const isOnly01 = !legs.includes('Cricket') && !legs.includes('Choice') && !legs.includes('Half-It');
                        const isOnlyCricket = !legs.includes('701') && !legs.includes('901') && !legs.includes('1101') && !legs.includes('Choice') && !legs.includes('Half-It');
                        const statLabel = isOnly01 ? '01' : isOnlyCricket ? 'Cr' : 'Cmp';
                        const statValue = isOnly01
                          ? (p.stats01Avg > 0 ? p.stats01Avg.toFixed(1) : '-')
                          : isOnlyCricket
                            ? (p.statsCricketAvg > 0 ? p.statsCricketAvg.toFixed(1) : '-')
                            : String(p.compositeScore);
                        const isSwapping = swapTarget?.gameId === game.id && swapTarget?.playerIdx === i;
                        return (
                          <div key={p.player.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: styles.dot }}>
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium text-[#1E293B] truncate font-body">{p.player.name}</span>
                              <span className="text-xs font-semibold shrink-0 font-body" style={{ color: '#B8942E' }} title={`${statLabel}: ${statValue}`}>{statValue}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!completed && isMatchDay && !preselectDate && (
                                <button
                                  onClick={() => setSwapTarget(isSwapping ? null : { gameId: game.id, playerIdx: i })}
                                  className="text-[10px] px-2 py-0.5 rounded font-body transition-colors"
                                  style={isSwapping ? { background: 'rgba(212,175,55,0.12)', color: '#B8942E', border: '1px solid rgba(212,175,55,0.25)' } : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}
                                >
                                  Swap
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {isMatchDay && !completed && !preselectDate && swapTarget?.gameId === game.id && (
                      <SwapDropdown
                        currentPlayerIds={assignment.players.map(p => p.player.id)}
                        onSelect={(pid) => handleSwapPlayer(game.id, swapTarget.playerIdx, pid)}
                        onClose={() => setSwapTarget(null)}
                      />
                    )}
                  </div>
                );
              };

              const g1_3 = SUPER_LEAGUE_FORMAT.filter(g => g.id >= 1 && g.id <= 3);
              const g4_7 = SUPER_LEAGUE_FORMAT.filter(g => g.id >= 4 && g.id <= 7);
              const g8_9 = SUPER_LEAGUE_FORMAT.filter(g => g.id >= 8 && g.id <= 9);

              return (
                <>
                  <div>
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2 font-body" style={{ color: '#B8942E' }}>
                      <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)' }} />
                      Part 1 — No repeats
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {g1_3.map(renderCard)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2 font-body" style={{ color: '#059669' }}>
                      <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#059669' }} />
                      Part 2 — Repeat once (max 2 per player)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {g4_7.map(renderCard)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2 font-body" style={{ color: '#64748B' }}>
                      <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#64748B' }} />
                      Part 3 — Repeat once (max 2 per player)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {g8_9.map(renderCard)}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Unavailable Players */}
          {result.unavailablePlayers.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight">Unavailable Players</h2>
              <div className="glass-card rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {result.unavailablePlayers.map(up => (
                    <div key={up.name} className="flex items-center gap-2 p-2 rounded-lg font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: '#DC2626' }} />
                      <span className="text-sm text-[#64748B] font-body">{up.name}</span>
                      <span className="text-xs text-[#94A3B8] ml-auto font-body">{up.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Player Rotation */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight">Player Rotation</h2>
            <div className="glass-card rounded-xl p-4">
              {result.playerGameCount.length === 0 ? (
                <p className="text-[#94A3B8] text-center py-2 font-body">No players assigned</p>
              ) : (
                <div className="space-y-2">
                  {result.playerGameCount.map(({ playerName, count }) => {
                    const maxCount = Math.max(...result.playerGameCount.map(p => p.count));
                    const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={playerName} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#1E293B] w-40 truncate font-body">{playerName}</span>
                        <div className="flex-1 h-4 rounded-full overflow-hidden font-body" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${widthPct}%`, background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.6), #D4AF37)' }}
                          />
                        </div>
                        <span className="text-sm font-semibold font-body w-6 text-right" style={{ color: '#B8942E' }}>{count}</span>
                        <span className="text-[10px] text-[#94A3B8] font-body">games</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Format Reference */}
          <div className="rounded-xl p-4 font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <h3 className="text-xs font-semibold text-[#94A3B8] mb-2 uppercase tracking-wider font-body">Match Format</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#94A3B8] font-body">
              {SUPER_LEAGUE_FORMAT.map(g => {
                return (
                  <div key={g.id} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: GAME_TYPE_STYLES[g.type]?.dot || '#94A3B8' }} />
                    <span>G{g.id}: {g.playerCount}P {g.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Opponent Scouting */}
      {matchSessionId && (
        <OpponentScouting matchDate={matchDate} result={result} />
      )}

      {!result && (
        <div className="text-center py-16">
          <p className="text-lg text-[#94A3B8] mb-2 font-body">Select a match date and generate a Super League lineup</p>
          <p className="text-sm text-[#94A3B8] font-body">
            9 games — singles, doubles, trios &amp; team. Players can play multiple games
            with rotation optimized by rating, form, and punctuality.
          </p>
          <div className="mt-6 inline-block text-left glass-card rounded-xl p-5">
            <p className="font-medium text-[#64748B] text-sm mb-2 font-body">Format breakdown:</p>
            <ul className="text-sm space-y-1 text-[#94A3B8] font-body">
              <li className="font-medium" style={{ color: '#B8942E' }}>Part 1 — No repeats across G1-G3</li>
              <li>• G1: Singles 701/701/701 (1P)</li>
              <li>• G2: Singles 701/Cricket/701 (1P)</li>
              <li>• G3: Doubles 701/Cricket/Choice (2P)</li>
              <li className="font-medium mt-2" style={{ color: '#059669' }}>Part 2 — Max 2 appearances per player across G4-G7</li>
              <li>• G4: Doubles 701/Cricket/701 (2P)</li>
              <li>• G5: Doubles Cricket/Cricket/Cricket (2P)</li>
              <li>• G6: Doubles Half-It x3 (2P)</li>
              <li>• G7: Doubles 701/Cricket/Choice (2P)</li>
              <li className="font-medium mt-2" style={{ color: '#64748B' }}>Part 3 — Max 2 appearances per player across G8-G9</li>
              <li>• G8: Trios 901/Cricket/Choice (3P)</li>
              <li>• G9: Team 1101 (4P)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function OpponentScouting({ matchDate, result }: { matchDate: string; result: FullLineup | null }) {
  const [profile, setProfile] = useState<OpponentTeamProfile | null>(null);
  const [bestMatchups, setBestMatchups] = useState<Map<number, { name: string; score: number }[]>>(new Map());

  useEffect(() => {
    const prof = getOpponentTeamProfile(matchDate);
    setProfile(prof);
    if (prof && result) {
      const players = getAllPlayersWithStats();
      const matchups = new Map<number, { name: string; score: number }[]>();
      for (const slot of prof.gameSlots) {
        const game = SUPER_LEAGUE_FORMAT.find(g => g.id === slot.slotGameId);
        if (!game) continue;
        const ranked = [...players]
          .map(pl => ({
            name: pl.player.name,
            score: formatScore(pl, game.legs) + matchupBonus(pl, game.id, prof),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        matchups.set(slot.slotGameId, ranked);
      }
      setBestMatchups(matchups);
    }
  }, [matchDate, result]);

  if (!profile || profile.gameSlots.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold font-body" style={{ color: '#B8942E' }}>📋 Opponent Scouting</span>
          <span className="text-xs text-[#94A3B8] font-body">vs {profile.teamName}</span>
          {profile.lastPlayed && (
            <span className="text-xs text-[#94A3B8] ml-auto font-body">Last met: {profile.lastPlayed}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-body">
            <thead>
              <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th className="pb-2 font-semibold text-left font-body">Game</th>
                <th className="pb-2 font-semibold text-center font-body">Players Faced</th>
                <th className="pb-2 font-semibold text-center font-body">Avg 01</th>
                <th className="pb-2 font-semibold text-center font-body">Avg Cricket</th>
                <th className="pb-2 font-semibold text-center font-body">Data Points</th>
                <th className="pb-2 font-semibold text-center font-body">Best Match (us)</th>
              </tr>
            </thead>
            <tbody>
              {profile.gameSlots.map(slot => {
                const best = bestMatchups.get(slot.slotGameId) || [];
                return (
                  <tr key={slot.slotGameId} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-2 font-medium text-[#1E293B] font-body">G{slot.slotGameId}</td>
                    <td className="py-2 text-center text-[#64748B] font-body max-w-[120px] truncate" title={slot.playersFaced.join(', ')}>
                      {slot.playersFaced.join(', ')}
                    </td>
                    <td className="py-2 text-center font-mono font-body" style={{ color: slot.avg01 > 0 ? '#B8942E' : '#CBD5E1' }}>
                      {slot.avg01 > 0 ? slot.avg01.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 text-center font-mono font-body" style={{ color: slot.avgCricket > 0 ? '#B8942E' : '#CBD5E1' }}>
                      {slot.avgCricket > 0 ? slot.avgCricket.toFixed(1) : '-'}
                    </td>
                    <td className="py-2 text-center text-[#94A3B8] font-body">{slot.sampleSize}</td>
                    <td className="py-2 text-center">
                      <span className="text-[#1E293B] font-medium font-body">
                        {best.map(b => b.name).join(', ') || '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#94A3B8] mt-3 font-body">
          Opponent data is collected from past matches. Lineup optimizer uses matchup scores to pair our strongest players against opponent weaknesses per game slot.
        </p>
      </div>
    </div>
  );
}

function SwapDropdown({
  currentPlayerIds,
  onSelect,
  onClose,
}: {
  currentPlayerIds: string[];
  onSelect: (newPlayerId: string) => void;
  onClose: () => void;
}) {
  const [players, setPlayers] = useState<{ id: string; name: string; info: string }[]>([]);

  useEffect(() => {
    const all = getAllPlayersWithStats();
    const filtered = all
      .filter(p => !currentPlayerIds.includes(p.player.id))
      .map(p => ({
        id: p.player.id,
        name: p.player.name,
        info: `Rt ${p.player.liveRating.toFixed(1)}`,
      }));
    setPlayers(filtered);
  }, [currentPlayerIds]);

  return (
    <div className="mt-2 pt-2 font-body" style={{ borderTop: '1px solid #E2E8F0' }}>
      <p className="text-[10px] text-[#94A3B8] mb-1.5 font-body">Swap with:</p>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {players.length === 0 && (
          <span className="text-xs text-[#94A3B8] font-body">No other players available</span>
        )}
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="text-xs px-2.5 py-1 rounded-lg font-body transition-colors"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.08)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.color = '#B8942E'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
          >
            {p.name} <span style={{ color: '#94A3B8' }}>({p.info})</span>
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="text-[10px] mt-1 font-body"
        style={{ color: '#94A3B8' }}
        onMouseEnter={e => e.currentTarget.style.color = '#64748B'}
        onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
      >
        Cancel
      </button>
    </div>
  );
}