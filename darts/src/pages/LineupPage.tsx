import { useState, useEffect, useRef } from 'react';
import { generateFullLineup, getSessions, updateFromLiveData, getResponsesForSession, buildResponseLink, getPlayers, getAttendanceForSession, setAttendance, generateId } from '../store';
import { fetchLiveData } from '../scraper';
import type { MatchGame, FullLineup, PlayerResponse, Player, AttendanceStatus } from '../types';

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

const STATUS_BADGE: Record<AttendanceStatus, { label: string; color: string }> = {
  'on-time': { label: 'On Time', color: 'bg-green-100 text-green-700 border-green-200' },
  'late': { label: 'Late', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'absent': { label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' },
  'excused': { label: 'Excused', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function LineupPage() {
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<FullLineup | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'done' | 'uptodate' | 'error'>('idle');
  const [responses, setResponses] = useState<PlayerResponse[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [pollingActive, setPollingActive] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string | null>(null);
  const [lineupLive, setLineupLive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find the match session for the selected date
  const matchSession = getSessions().find(s => s.type === 'match' && s.date === matchDate);
  const isToday = matchDate === new Date().toISOString().split('T')[0];

  // Auto-select next upcoming match date
  useEffect(() => {
    const sessions = getSessions();
    const matchSessions = sessions
      .filter(s => s.type === 'match')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const today = new Date().toISOString().split('T')[0];
    const nextMatch = matchSessions.find(s => s.date >= today);
    if (nextMatch) {
      setMatchDate(nextMatch.date);
    }
  }, []);

  // Refresh responses and players when matchDate changes
  useEffect(() => {
    setAllPlayers(getPlayers());
    if (matchSession) {
      setResponses(getResponsesForSession(matchSession.id));
    } else {
      setResponses([]);
    }
  }, [matchDate, matchSession]);

  // Auto-fetch on mount for match day + start polling
  useEffect(() => {
    if (!isToday || !matchSession) {
      stopPolling();
      return;
    }

    doRefresh();
    startPolling();

    return () => stopPolling();
  }, [isToday, matchSession?.id]);

  function startPolling() {
    stopPolling();
    setPollingActive(true);
    pollRef.current = setInterval(() => {
      doPoll();
    }, 30000); // every 30 seconds
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPollingActive(false);
  }

  async function doRefresh() {
    setRefreshStatus('loading');
    try {
      const liveData = await fetchLiveData();
      const added = updateFromLiveData(liveData);
      setRefreshStatus(added > 0 ? 'done' : 'uptodate');
      if (added > 0) {
        // Regenerate lineup if we already have one
        setResult(prev => {
          const newLineup = generateFullLineup(matchDate, SUPER_LEAGUE_FORMAT);
          return prev ? newLineup : null;
        });
        setLineupLive(true);
      }
    } catch {
      setRefreshStatus('error');
    }
  }

  async function doPoll() {
    try {
      const liveData = await fetchLiveData();
      const added = updateFromLiveData(liveData);
      setLastPollTime(new Date().toLocaleTimeString());
      if (added > 0) {
        setRefreshStatus('done');
        setLineupLive(true);
        // Auto-regenerate with latest stats
        setResult(prev => {
          const newLineup = generateFullLineup(matchDate, SUPER_LEAGUE_FORMAT);
          return prev ? newLineup : null;
        });
      }
      // Also refresh responses
      if (matchSession) {
        setResponses(getResponsesForSession(matchSession.id));
      }
    } catch {
      // Silent poll failure — don't spam the user
    }
  }

  function handleGenerate() {
    const lineup = generateFullLineup(matchDate, SUPER_LEAGUE_FORMAT);
    setResult(lineup);
    setLineupLive(false);
  }

  function handleBroadcastWhatsApp() {
    if (!matchSession) return;
    const link = buildResponseLink(matchSession.id);
    const dateStr = new Date(matchDate).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const message = `Thirstday@DB Match Day! 📋\n\nDate: ${dateStr}\n\nPlease confirm your attendance for this week's league match.\n\nTap here to respond: ${link}\n\nRespond as soon as possible so I can finalize the lineup!\n\n— Captain`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener');
  }

  function handleBroadcastTelegram() {
    if (!matchSession) return;
    const link = buildResponseLink(matchSession.id);
    const dateStr = new Date(matchDate).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const message = `Thirstday@DB Match Day! 📋\n\nDate: ${dateStr}\n\nPlease confirm your attendance for this week's league match.\n\nTap here to respond: ${link}\n\nRespond as soon as possible so I can finalize the lineup!`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
    window.open(tgUrl, '_blank', 'noopener');
  }

  function copyResponseLink() {
    if (!matchSession) return;
    const link = buildResponseLink(matchSession.id);
    navigator.clipboard.writeText(link);
  }

  function handleTogglePlayerAttendance(playerId: string) {
    if (!matchSession) return;
    const records = getAttendanceForSession(matchSession.id);
    const existing = records.find(r => r.playerId === playerId);
    const statusCycle: AttendanceStatus[] = ['on-time', 'late', 'absent', 'excused'];
    let newStatus: AttendanceStatus;
    if (!existing) {
      newStatus = 'on-time';
    } else {
      const idx = statusCycle.indexOf(existing.status);
      newStatus = statusCycle[(idx + 1) % statusCycle.length];
    }
    const updated = existing
      ? records.map(r => r.playerId === playerId ? { ...r, status: newStatus } : r)
      : [...records, { id: generateId(), playerId, sessionId: matchSession.id, status: newStatus }];
    setAttendance(updated);
    // Force re-render by updating responses
    setResponses([...getResponsesForSession(matchSession.id)]);
    // Refresh lineup if it exists
    setResult(prev => prev ? generateFullLineup(matchDate, SUPER_LEAGUE_FORMAT) : null);
  }

  const confirmedPlayers = responses.filter(r => r.status === 'on-time' || r.status === 'late');
  const totalResponded = responses.length;
  const attendanceRecords = matchSession ? getAttendanceForSession(matchSession.id) : [];
  const allAttendanceMap = new Map(attendanceRecords.map(r => [r.playerId, r.status]));

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
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Generate Lineup
            </button>
            {isToday && matchSession && (
              <button
                onClick={doRefresh}
                disabled={refreshStatus === 'loading'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200 disabled:opacity-50"
                title="Refresh live stats"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Live/polling indicator */}
        {pollingActive && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-green-600 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              LIVE — Auto-polling every 30s
            </span>
            {lastPollTime && (
              <span className="text-gray-400">Last check: {lastPollTime}</span>
            )}
            {lineupLive && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                Auto lineup active
              </span>
            )}
          </div>
        )}

        {/* Refresh status banners */}
        {refreshStatus === 'loading' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mt-3 flex items-center gap-2 text-sm text-indigo-700">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Refreshing game stats from DartsLive...
          </div>
        )}
        {refreshStatus === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3 flex items-center gap-2 text-sm text-green-700">
            ✓ Latest game stats loaded
          </div>
        )}
        {refreshStatus === 'uptodate' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3 flex items-center gap-2 text-sm text-blue-700">
            ✓ All match data already up to date
          </div>
        )}
        {refreshStatus === 'error' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 flex items-center gap-2 text-sm text-amber-700">
            ⚠ Could not refresh stats — using existing data
          </div>
        )}

        {/* Attendance Broadcast Section */}
        {matchSession && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Attendance Request</h3>
              <span className="text-xs text-gray-400">
                {totalResponded} responded · {confirmedPlayers.length} confirmed
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={handleBroadcastWhatsApp}
                className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </button>
              <button
                onClick={handleBroadcastTelegram}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Telegram
              </button>
              <button
                onClick={copyResponseLink}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors border border-gray-200 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Link
              </button>
            </div>

            {/* Player Attendance Status */}
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Player Attendance</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                {allPlayers.map(p => {
                  const attStatus = allAttendanceMap.get(p.id);
                  const response = responses.find(r => r.playerId === p.id);
                  const status = response?.status || attStatus || 'unknown';
                  const statusInfo = STATUS_BADGE[status as AttendanceStatus] || { label: 'Pending', color: 'bg-gray-50 text-gray-400 border-gray-100' };
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleTogglePlayerAttendance(p.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all hover:shadow-sm ${
                        status === 'on-time' ? 'border-green-200 bg-green-50' :
                        status === 'late' ? 'border-amber-200 bg-amber-50' :
                        status === 'absent' ? 'border-red-200 bg-red-50' :
                        status === 'excused' ? 'border-gray-200 bg-gray-50' :
                        'border-gray-100 bg-gray-50'
                      }`}
                      title="Tap to cycle: On Time → Late → Absent → Excused"
                    >
                      <span className="font-medium text-gray-700">{p.name}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] leading-tight ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Tap a player to cycle their status · Lineup auto-updates based on attendance &amp; stats
              </p>
            </div>
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
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Game Assignments</h2>
              {lineupLive && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Live
                </span>
              )}
            </div>
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
            {matchSession
              ? 'Players confirmed via attendance responses will be included in the lineup.'
              : 'No match session found for this date. Add match sessions to enable attendance tracking.'}
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