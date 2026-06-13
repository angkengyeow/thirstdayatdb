import { useState, useEffect } from 'react';
import { generateFullLineup, getSessions, updateFromLiveData } from '../store';
import { fetchLiveData } from '../scraper';
import type { MatchGame, FullLineup } from '../types';

const SUPER_LEAGUE_FORMAT: MatchGame[] = [
  // Part 1 — No repeats
  { id: 1, type: 'singles', label: 'Singles 701 x3', legs: '701·701·701', playerCount: 1 },
  { id: 2, type: 'singles', label: 'Singles 701/Cricket/701', legs: '701·Cricket·701', playerCount: 1 },
  { id: 3, type: 'doubles', label: 'Doubles 701/Cricket/Choice', legs: '701·Cricket·Choice', playerCount: 2 },
  // Part 2 — Repeat once allowed
  { id: 4, type: 'doubles', label: 'Doubles 701/Cricket/701', legs: '701·Cricket·701', playerCount: 2 },
  { id: 5, type: 'doubles', label: 'Doubles Cricket x3', legs: 'Cricket·Cricket·Cricket', playerCount: 2 },
  { id: 6, type: 'doubles', label: 'Doubles Half-It x3', legs: 'Half-It·Half-It·Half-It', playerCount: 2 },
  { id: 7, type: 'doubles', label: 'Doubles 701/Cricket/Choice', legs: '701·Cricket·Choice', playerCount: 2 },
  // Part 3 — Repeat once allowed
  { id: 8, type: 'trios', label: 'Trios 901/Cricket/Choice', legs: '901·Cricket·Choice', playerCount: 3 },
  { id: 9, type: 'team', label: 'Team 1101', legs: '1101', playerCount: 4 },
];

const GAME_COLORS: Record<string, string> = {
  singles: 'bg-blue-100 text-blue-700 border-blue-200',
  doubles: 'bg-purple-100 text-purple-700 border-purple-200',
  trios: 'bg-amber-100 text-amber-700 border-amber-200',
  team: 'bg-green-100 text-green-700 border-green-200',
};

const GAME_BADGE_COLORS: Record<string, string> = {
  singles: 'bg-blue-500',
  doubles: 'bg-purple-500',
  trios: 'bg-amber-500',
  team: 'bg-green-500',
};

interface LineupPageProps {
  preselectDate?: string | null;
}

export default function LineupPage({ preselectDate }: LineupPageProps) {
  const [matchDate, setMatchDate] = useState(preselectDate || new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<FullLineup | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'done' | 'uptodate' | 'error'>('idle');

  // Auto-select next upcoming match date (only if no preselect)
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

  // Auto-fetch live stats on match day — only fetches new matches
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

  // Auto-generate lineup when navigating from Attendance page with a preselect date
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Lineup Generator</h1>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Match Date</label>
            <input
              type="date"
              value={matchDate}
              onChange={e => setMatchDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <button
              onClick={handleGenerate}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Generate Lineup
            </button>
          </div>
        </div>

        {/* Match-day refresh banner */}
        {refreshStatus === 'loading' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-indigo-700">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Refreshing game stats from DartsLive...
          </div>
        )}
        {refreshStatus === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-green-700">
            ✓ Latest game stats loaded for match day
          </div>
        )}
        {refreshStatus === 'uptodate' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-blue-700">
            ✓ All match data already up to date
          </div>
        )}
        {refreshStatus === 'error' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-amber-700">
            ⚠ Could not refresh stats — using existing data
          </div>
        )}

        {/* Attendance-based lineup banner */}
        {preselectDate && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-indigo-700">
            <span>📋</span>
            <span>Lineup planned from Attendance — only responding players (on-time/late) are available</span>
          </div>
        )}

        <div className="mt-4 p-4 bg-indigo-50 rounded-lg text-sm text-indigo-800">
          <p className="font-medium mb-1">S1 Division — 64 Credits (No Handicap, OI/MO)</p>
          <p>Composite = 01 Avg Performance (50%) + Win Rate (50%)</p>
          <p className="mt-1">
            <span className="font-medium">Format-aware ranking:</span> Pure 01 games (G1, G9) rank by 01 Avg. Pure Cricket (G5) ranks by Cricket Avg. Mixed games use the overall Composite.
          </p>
          <p className="mt-1">
            <span className="font-medium">Repeat of players:</span> G1 player is exclusive (no repeat). G4 allows 1 repeat from Part 1. G8 allows 1 repeat from Parts 1-2.
          </p>
          <p className="text-indigo-600 mt-1">
            Game count is balanced across the roster. Min 4 players to play.
          </p>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Game Assignments */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Game Assignments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.assignments.map(assignment => {
                const game = assignment.game;
                const colorClass = GAME_COLORS[game.type];
                const badgeColor = GAME_BADGE_COLORS[game.type];
                return (
                  <div
                    key={game.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
                        {game.type.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{game.label}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {game.id <= 3 ? 'P1' : game.id <= 7 ? 'P2' : 'P3'}
                        <span className="ml-1">G{game.id}</span>
                      </span>
                    </div>
                    {game.legs && (
                      <p className="text-xs text-gray-400 mb-2">{game.legs}</p>
                    )}
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
                              <span className={`w-5 h-5 rounded-full ${badgeColor} text-white flex items-center justify-center text-[10px] font-bold`}>
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-800">{p.player.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-indigo-600" title={`${statLabel}: ${statValue}`}>{statValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player Game Count */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Player Rotation</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              {result.playerGameCount.length === 0 ? (
                <p className="text-gray-400 text-center py-2">No players assigned</p>
              ) : (
                <div className="space-y-2">
                  {result.playerGameCount.map(({ playerName, count }) => {
                    const maxCount = Math.max(...result.playerGameCount.map(p => p.count));
                    const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={playerName} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-40 truncate">{playerName}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-indigo-600 w-6 text-right">{count}</span>
                        <span className="text-xs text-gray-400">games</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Format Reference */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Match Format</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
              {SUPER_LEAGUE_FORMAT.map(g => (
                <div key={g.id} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${g.type === 'singles' ? 'bg-blue-400' : g.type === 'doubles' ? 'bg-purple-400' : g.type === 'trios' ? 'bg-amber-400' : 'bg-green-400'}`} />
                  <span>G{g.id}: {g.playerCount}P {g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!result && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">Select a match date and generate a Super League lineup</p>
          <p className="text-sm">
            9 games — singles, doubles, trios &amp; team. Players can play multiple games
            with rotation optimized by rating, form, and punctuality.
          </p>
          <div className="mt-6 inline-block text-left">
            <p className="font-medium text-gray-500 text-sm mb-2">Format breakdown:</p>
            <ul className="text-sm space-y-1 text-gray-400">
              <li className="text-indigo-400 font-medium">Part 1 — No repeats</li>
              <li>• G1: Singles 701/701/701 (1P)</li>
              <li>• G2: Singles 701/Cricket/701 (1P)</li>
              <li>• G3: Doubles 701/Cricket/Choice (2P)</li>
              <li className="text-indigo-400 font-medium mt-2">Part 2 — Repeat once</li>
              <li>• G4: Doubles 701/Cricket/701 (2P)</li>
              <li>• G5: Doubles Cricket/Cricket/Cricket (2P)</li>
              <li>• G6: Doubles Half-It x3 (2P)</li>
              <li>• G7: Doubles 701/Cricket/Choice (2P)</li>
              <li className="text-indigo-400 font-medium mt-2">Part 3 — Repeat once</li>
              <li>• G8: Trios 901/Cricket/Choice (3P)</li>
              <li>• G9: Team 1101 (4P)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}