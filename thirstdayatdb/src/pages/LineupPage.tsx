import { useState, useEffect } from 'react';
import { generateFullLineup, getSessions, updateFromLiveData } from '../store';
import { fetchLiveData } from '../scraper';
import type { MatchGame, FullLineup, SkippedGame, UnavailablePlayer } from '../types';

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
  singles: { border: 'border-gold-400/20', badge: 'bg-gold-400/15 text-gold-400 border-gold-400/30', dot: 'bg-gold-400' },
  doubles: { border: 'border-dart-green/20', badge: 'bg-dart-green/15 text-dart-green border-dart-green/30', dot: 'bg-dart-green' },
  trios: { border: 'border-[#6b6b8a]/20', badge: 'bg-[#6b6b8a]/15 text-[#6b6b8a] border-[#6b6b8a]/30', dot: 'bg-[#6b6b8a]' },
  team: { border: 'border-gold-400/20', badge: 'bg-gold-400/15 text-gold-400 border-gold-400/30', dot: 'bg-gold-400' },
};

interface LineupPageProps {
  preselectDate?: string | null;
}

export default function LineupPage({ preselectDate }: LineupPageProps) {
  const [matchDate, setMatchDate] = useState(preselectDate || new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<FullLineup | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'done' | 'uptodate' | 'error'>('idle');

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
    const today = new Date().toISOString().split('T')[0];
    const sessions = getSessions();
    const isMatchDay = sessions.some(s => s.type === 'match' && s.date === today);
    if (!isMatchDay) return;

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
  }, []);

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#eeeef4]">Lineup Generator</h1>
        <p className="text-sm text-[#6b6b8a] mt-0.5">Optimize player assignments across all 9 Super League games</p>
      </div>

      {/* Controls */}
      <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-[#9e9eb4] mb-1">Match Date</label>
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
              className="w-full px-4 py-2 bg-gold-400 text-[#0d0d1a] rounded-lg hover:bg-gold-300 transition-colors font-medium shadow-lg shadow-gold-400/20"
            >
              Generate Lineup
            </button>
          </div>
        </div>

        {refreshStatus === 'loading' && (
          <div className="bg-[#1e1e3e] border border-[#2e2e5e] rounded-lg p-3 mt-4 flex items-center gap-2 text-sm text-[#c8c8d8]">
            <div className="w-4 h-4 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
            Refreshing game stats from DartsLive...
          </div>
        )}
        {refreshStatus === 'done' && (
          <div className="bg-dart-green/[0.06] border border-dart-green/30 rounded-lg p-3 mt-4 flex items-center gap-2 text-sm text-dart-green">
            ✓ Latest game stats loaded for match day
          </div>
        )}
        {refreshStatus === 'uptodate' && (
          <div className="bg-gold-400/[0.06] border border-gold-400/30 rounded-lg p-3 mt-4 flex items-center gap-2 text-sm text-gold-400">
            ✓ All match data already up to date
          </div>
        )}
        {refreshStatus === 'error' && (
          <div className="bg-dart-red/[0.06] border border-dart-red/30 rounded-lg p-3 mt-4 flex items-center gap-2 text-sm text-dart-red">
            ⚠ Could not refresh stats — using existing data
          </div>
        )}

        {preselectDate && (
          <div className="bg-[#1e1e3e] border border-[#2e2e5e] rounded-lg p-3 mt-4 flex items-center gap-2 text-sm text-[#c8c8d8]">
            <span>📋</span>
            <span>Lineup planned from Attendance — only responding players (on-time/late) are available</span>
          </div>
        )}

        <div className="mt-4 p-4 bg-[#0d0d1a]/80 rounded-lg border border-[#1c1c34] text-sm">
          <p className="text-gold-400 font-medium mb-1">S1 Division — 64 Credits (No Handicap, OI/MO)</p>
          <p className="mt-1 text-[#9e9eb4]">
            <span className="font-medium text-[#eeeef4]">Ranking by game type:</span>
          </p>
          <ul className="mt-1 space-y-0.5 list-disc list-inside text-[#9e9eb4]">
            <li><strong className="text-[#eeeef4]">G1, G9</strong> (pure 01) → ranked by <strong className="text-gold-400">01 Avg</strong></li>
            <li><strong className="text-[#eeeef4]">G5</strong> (pure Cricket) → ranked by <strong className="text-gold-400">Cricket Avg</strong></li>
            <li><strong className="text-[#eeeef4]">G2–G4, G7, G8</strong> (mixed) → ranked by <strong className="text-gold-400">Composite</strong> (01 Avg + Cricket Avg + Win Rate + Partner Chemistry — weightage TBD)</li>
            <li><strong className="text-[#eeeef4]">G6</strong> (Half-It) → ranked by <strong className="text-gold-400">Half-It Composite</strong> (50% Cricket Avg + 50% Half-It Leg Win Rate)</li>
          </ul>
          <p className="text-[#6b6b8a] mt-1">
            <strong className="text-[#eeeef4]">Rules:</strong> Part 1 (G1–G3) = no repeats. Part 2 (G4–G7) &amp; Part 3 (G8–G9) = at most 2 appearances per player per block.
            Game count balancing spreads play across all games.
          </p>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Game Assignments — 3 parts with headers */}
          <div className="mb-8 space-y-8">
            {(() => {
              const assignMap = new Map(result.assignments.map(a => [a.game.id, a]));
              const skipMap = new Map(result.skippedGames.map(s => [s.game.id, s]));

              const renderCard = (game: MatchGame) => {
                const assignment = assignMap.get(game.id);
                const skipped = skipMap.get(game.id);
                const styles = GAME_TYPE_STYLES[game.type];

                if (skipped) {
                  return (
                    <div key={game.id} className="bg-[#111122] rounded-xl border border-dart-red/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-dart-red/15 text-dart-red border-dart-red/30">FORFEITED</span>
                        <span className="text-sm font-semibold text-[#6b6b8a] line-through">{game.label}</span>
                        <span className="text-[10px] text-[#6b6b8a] ml-auto font-mono">G{game.id}</span>
                      </div>
                      {game.legs && <p className="text-xs text-[#6b6b8a] mb-2">{game.legs}</p>}
                      <p className="text-xs text-dart-red/70">{skipped.reason}</p>
                    </div>
                  );
                }

                if (!assignment) return null;

                return (
                  <div key={game.id} className={`bg-[#111122] rounded-xl shadow-lg border ${styles.border} p-3 hover:bg-[#16162a] hover:scale-[1.02] hover:shadow-xl transition-all duration-200`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles.badge}`}>
                        {game.type.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-[#eeeef4]">{game.label}</span>
                      <span className="text-[10px] text-[#6b6b8a] ml-auto font-mono">G{game.id}</span>
                    </div>
                    {game.legs && <p className="text-xs text-[#6b6b8a] mb-2">{game.legs}</p>}
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
                        return (
                          <div key={p.player.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full ${styles.dot} text-white flex items-center justify-center text-[10px] font-bold`}>{i + 1}</span>
                              <span className="text-sm font-medium text-[#eeeef4]">{p.player.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-gold-400" title={`${statLabel}: ${statValue}`}>{statValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              const g1_3 = SUPER_LEAGUE_FORMAT.filter(g => g.id >= 1 && g.id <= 3);
              const g4_7 = SUPER_LEAGUE_FORMAT.filter(g => g.id >= 4 && g.id <= 7);
              const g8_9 = SUPER_LEAGUE_FORMAT.filter(g => g.id >= 8 && g.id <= 9);

              return (
                <>
                  {/* Part 1 */}
                  <div>
                    <h3 className="text-md font-semibold text-gold-400 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-5 bg-gold-400 rounded-full inline-block" />
                      Part 1 — No repeats
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {g1_3.map(renderCard)}
                    </div>
                  </div>
                  {/* Part 2 */}
                  <div>
                    <h3 className="text-md font-semibold text-dart-green mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-5 bg-dart-green rounded-full inline-block" />
                      Part 2 — Repeat once (max 2 per player)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {g4_7.map(renderCard)}
                    </div>
                  </div>
                  {/* Part 3 */}
                  <div>
                    <h3 className="text-md font-semibold text-[#6b6b8a] mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-5 bg-[#6b6b8a] rounded-full inline-block" />
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
              <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Unavailable Players</h2>
              <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {result.unavailablePlayers.map(up => (
                    <div key={up.name} className="flex items-center gap-2 p-2 rounded-lg bg-[#0d0d1a]/60 border border-[#1c1c34]">
                      <span className="w-2 h-2 rounded-full bg-dart-red" />
                      <span className="text-sm text-[#c8c8d8]">{up.name}</span>
                      <span className="text-xs text-[#6b6b8a] ml-auto">{up.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Player Rotation */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Player Rotation</h2>
            <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-4 hover:border-[#252544] transition-colors duration-200">
              {result.playerGameCount.length === 0 ? (
                <p className="text-[#6b6b8a] text-center py-2">No players assigned</p>
              ) : (
                <div className="space-y-2">
                  {result.playerGameCount.map(({ playerName, count }) => {
                    const maxCount = Math.max(...result.playerGameCount.map(p => p.count));
                    const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={playerName} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#eeeef4] w-40 truncate">{playerName}</span>
                        <div className="flex-1 h-4 bg-[#0d0d1a] rounded-full overflow-hidden border border-[#1c1c34]">
                          <div
                            className="h-full bg-gradient-to-r from-gold-400/80 to-gold-400 rounded-full transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gold-400 w-6 text-right">{count}</span>
                        <span className="text-[10px] text-[#6b6b8a]">games</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Format Reference */}
          <div className="bg-[#0d0d1a]/80 rounded-xl border border-[#1c1c34] p-4">
            <h3 className="text-xs font-semibold text-[#6b6b8a] mb-2 uppercase tracking-wider">Match Format</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#6b6b8a]">
              {SUPER_LEAGUE_FORMAT.map(g => {
                const dot = GAME_TYPE_STYLES[g.type]?.dot || 'bg-gray-400';
                return (
                  <div key={g.id} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span>G{g.id}: {g.playerCount}P {g.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!result && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1c1c34] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#6b6b8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-lg text-[#6b6b8a] mb-2">Select a match date and generate a Super League lineup</p>
          <p className="text-sm text-[#6b6b8a]">
            9 games — singles, doubles, trios &amp; team. Players can play multiple games
            with rotation optimized by rating, form, and punctuality.
          </p>
          <div className="mt-6 inline-block text-left bg-[#111122] rounded-xl border border-[#1c1c34] p-5 hover:border-[#252544] transition-colors duration-200">
            <p className="font-medium text-[#9e9eb4] text-sm mb-2">Format breakdown:</p>
            <ul className="text-sm space-y-1 text-[#6b6b8a]">
              <li className="text-gold-400 font-medium">Part 1 — Unique players only (no repeats across G1-G3)</li>
              <li>• G1: Singles 701/701/701 (1P)</li>
              <li>• G2: Singles 701/Cricket/701 (1P)</li>
              <li>• G3: Doubles 701/Cricket/Choice (2P)</li>
              <li className="text-dart-green font-medium mt-2">Part 2 — Max 2 appearances per player across G4-G7</li>
              <li>• G4: Doubles 701/Cricket/701 (2P)</li>
              <li>• G5: Doubles Cricket/Cricket/Cricket (2P)</li>
              <li>• G6: Doubles Half-It x3 (2P)</li>
              <li>• G7: Doubles 701/Cricket/Choice (2P)</li>
              <li className="text-[#6b6b8a] font-medium mt-2">Part 3 — Max 2 appearances per player across G8-G9</li>
              <li>• G8: Trios 901/Cricket/Choice (3P)</li>
              <li>• G9: Team 1101 (4P)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}