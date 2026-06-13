import type { Player, Session, AttendanceRecord, AttendanceStatus, MatchPerformance, PlayerWithStats, LineupSlot, MatchGame, GameAssignment, FullLineup, PlayerResponse, GamePerformance, PlayerGameStats, PartnerStats, GameFormat, GameFormatCategory } from './types';
import { loadAllFromServer, saveAllToServer } from './api';

const STORAGE_KEYS = {
  players: 'darts_players',
  sessions: 'darts_sessions',
  attendance: 'darts_attendance',
  performances: 'darts_performances',
  gamePerformances: 'darts_game_performances',
  responses: 'darts_responses',
  awards: 'darts_awards',
} as const;

// Debounced server sync — batches writes and syncs every 2 seconds
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleServerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    saveAllToServer({
      players: load<Player[]>(STORAGE_KEYS.players, []),
      sessions: load<Session[]>(STORAGE_KEYS.sessions, []),
      attendance: load<AttendanceRecord[]>(STORAGE_KEYS.attendance, []),
      performances: load<MatchPerformance[]>(STORAGE_KEYS.performances, []),
      gamePerformances: load<any[]>(STORAGE_KEYS.gamePerformances, []),
      responses: load<PlayerResponse[]>(STORAGE_KEYS.responses, []),
    });
    syncTimer = null;
  }, 2000);
}

export async function syncFromServer(): Promise<boolean> {
  try {
    const data = await loadAllFromServer();
    if (!data.players || data.players.length === 0) return false;
    // Don't overwrite if server data is missing rating fields (old schema)
    if (data.players.some((p: any) => p.liveRating === undefined)) return false;
    localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(data.players));
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(data.sessions));
    localStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(data.attendance));
    localStorage.setItem(STORAGE_KEYS.performances, JSON.stringify(data.performances));
    localStorage.setItem(STORAGE_KEYS.gamePerformances, JSON.stringify(data.gamePerformances));
    localStorage.setItem(STORAGE_KEYS.responses, JSON.stringify(data.responses));
    if (data.awards) localStorage.setItem(STORAGE_KEYS.awards, JSON.stringify(data.awards));
    return true;
  } catch {
    return false;
  }
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
  scheduleServerSync();
}

// --- Players ---
export function getPlayers(): Player[] {
  return load<Player[]>(STORAGE_KEYS.players, []);
}

export function savePlayer(player: Player): void {
  const players = getPlayers();
  const idx = players.findIndex(p => p.id === player.id);
  if (idx >= 0) players[idx] = player;
  else players.push(player);
  save(STORAGE_KEYS.players, players);
}

export function deletePlayer(id: string): void {
  const players = getPlayers().filter(p => p.id !== id);
  save(STORAGE_KEYS.players, players);
}

// --- Sessions ---
export function getSessions(): Session[] {
  return load<Session[]>(STORAGE_KEYS.sessions, []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function saveSession(session: Session): void {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  save(STORAGE_KEYS.sessions, sessions);
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter(s => s.id !== id);
  save(STORAGE_KEYS.sessions, sessions);
  // Also clean up attendance, performances, and game performances for this session
  const attendance = getAttendance().filter(a => a.sessionId !== id);
  save(STORAGE_KEYS.attendance, attendance);
  const performances = getPerformances().filter(p => p.sessionId !== id);
  save(STORAGE_KEYS.performances, performances);
  const gamePerfs = getGamePerformances().filter(g => g.sessionId !== id);
  save(STORAGE_KEYS.gamePerformances, gamePerfs);
}

// --- Attendance ---
export function getAttendance(): AttendanceRecord[] {
  return load<AttendanceRecord[]>(STORAGE_KEYS.attendance, []);
}

/**
 * Predict a player's attendance status based on historical patterns.
 * Uses:
 *   1. Most common recent status (last 3 similar-type sessions, highest weight)
 *   2. Overall most common status for the session type
 *   3. Player rating as a fallback heuristic
 */
export function predictAttendance(playerId: string, sessionType: 'practice' | 'match'): AttendanceStatus {
  const allRecords = getAttendance().filter(a => a.playerId === playerId);
  const sessions = getSessions();

  if (allRecords.length === 0) {
    return 'on-time'; // optimistic default for new players
  }

  // Get records for same session type, sorted by date descending
  const sameType = allRecords
    .map(r => ({ record: r, session: sessions.find(s => s.id === r.sessionId) }))
    .filter((x): x is { record: AttendanceRecord; session: Session } => x.session !== undefined && x.session.type === sessionType)
    .sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());

  if (sameType.length === 0) {
    // Fall back to all records
    const all = allRecords.map(r => r.status);
    return mostFrequent(all) || 'on-time';
  }

  // Weight recent history more heavily (last 3)
  const recent = sameType.slice(0, 3).map(x => x.record.status);
  const older = sameType.slice(3).map(x => x.record.status);

  // Recent counts double
  const weighted: AttendanceStatus[] = [...recent, ...recent, ...older];
  return mostFrequent(weighted) || 'on-time';
}

function mostFrequent(items: AttendanceStatus[]): AttendanceStatus | null {
  if (items.length === 0) return null;
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let mostFreq: AttendanceStatus = items[0];
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostFreq = item;
    }
  }
  return mostFreq;
}

export function setAttendance(records: AttendanceRecord[]): void {
  save(STORAGE_KEYS.attendance, records);
}

export function saveAttendanceRecord(record: AttendanceRecord): void {
  const records = getAttendance();
  const idx = records.findIndex(r => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  save(STORAGE_KEYS.attendance, records);
}

export function getAttendanceForSession(sessionId: string): AttendanceRecord[] {
  return getAttendance().filter(a => a.sessionId === sessionId);
}

// --- Player Responses (from broadcast links) ---
export function getResponses(): PlayerResponse[] {
  return load<PlayerResponse[]>(STORAGE_KEYS.responses, []);
}

export function saveResponse(response: PlayerResponse): void {
  const responses = getResponses();
  const idx = responses.findIndex(
    r => r.playerId === response.playerId && r.sessionId === response.sessionId
  );
  if (idx >= 0) responses[idx] = response;
  else responses.push(response);
  save(STORAGE_KEYS.responses, responses);

  // Also sync to main attendance
  const existingAttendance = getAttendance();
  const existing = existingAttendance.find(
    a => a.playerId === response.playerId && a.sessionId === response.sessionId
  );
  if (existing) {
    const updated = existingAttendance.map(a =>
      a.id === existing.id ? { ...a, status: response.status } : a
    );
    save(STORAGE_KEYS.attendance, updated);
  } else {
    existingAttendance.push({
      id: generateId(),
      playerId: response.playerId,
      sessionId: response.sessionId,
      status: response.status,
    });
    save(STORAGE_KEYS.attendance, existingAttendance);
  }
}

export function getResponsesForSession(sessionId: string): PlayerResponse[] {
  return getResponses().filter(r => r.sessionId === sessionId);
}

export function buildResponseLink(sessionId: string): string {
  const base = window.location.origin;
  return `${base}/#respond?session=${sessionId}`;
}

export function getSessionAttendanceOverview(sessionId: string) {
  const players = getPlayers();
  const responses = getResponsesForSession(sessionId);
  const attendance = getAttendanceForSession(sessionId);
  const session = getSessions().find(s => s.id === sessionId);

  return players.map(p => {
    const response = responses.find(r => r.playerId === p.id);
    const record = attendance.find(a => a.playerId === p.id);
    const finalStatus = record?.status || response?.status || null;
    const predicted = predictAttendance(p.id, session?.type || 'match');
    return {
      player: p,
      response: response || null,
      attendanceRecord: record || null,
      actualStatus: finalStatus,
      predictedStatus: predicted,
      hasResponded: !!response,
    };
  });
}

/**
 * Returns today's and upcoming match/practice sessions sorted by date ascending.
 */
export function getUpcomingSessions(): Session[] {
  const today = new Date().toISOString().split('T')[0];
  return getSessions()
    .filter(s => s.date >= today && !s.notes?.match(/\((W|L)\s+\d+-\d+\)/))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns count of players who have responded to a session.
 */
export function getResponseCounts(sessionId: string) {
  const overview = getSessionAttendanceOverview(sessionId);
  const total = overview.length;
  const responded = overview.filter(p => p.hasResponded).length;
  const confirmedOnTime = overview.filter(p => p.actualStatus === 'on-time').length;
  const confirmedLate = overview.filter(p => p.actualStatus === 'late').length;
  const confirmedAbsent = overview.filter(p => p.actualStatus === 'absent').length;
  const confirmedExcused = overview.filter(p => p.actualStatus === 'excused').length;
  const confirmedPresent = confirmedOnTime + confirmedLate;
  return { total, responded, confirmedOnTime, confirmedLate, confirmedAbsent, confirmedExcused, confirmedPresent };
}

// --- Match Performances ---
export function getPerformances(): MatchPerformance[] {
  return load<MatchPerformance[]>(STORAGE_KEYS.performances, []);
}

export function setPerformances(performances: MatchPerformance[]): void {
  save(STORAGE_KEYS.performances, performances);
}

export function savePerformance(perf: MatchPerformance): void {
  const performances = getPerformances();
  const idx = performances.findIndex(p => p.id === perf.id);
  if (idx >= 0) performances[idx] = perf;
  else performances.push(perf);
  save(STORAGE_KEYS.performances, performances);
}

export function getPerformancesForSession(sessionId: string): MatchPerformance[] {
  return getPerformances().filter(p => p.sessionId === sessionId);
}

// --- Game Performances ---
export function getGamePerformances(): GamePerformance[] {
  return load<GamePerformance[]>(STORAGE_KEYS.gamePerformances, []);
}

export function saveGamePerformance(gp: GamePerformance): void {
  const all = getGamePerformances();
  const idx = all.findIndex(g => g.id === gp.id);
  if (idx >= 0) all[idx] = gp;
  else all.push(gp);
  save(STORAGE_KEYS.gamePerformances, all);
}

export function getGamePerformancesForSession(sessionId: string): GamePerformance[] {
  return getGamePerformances().filter(g => g.sessionId === sessionId);
}

export function getGamePerformancesForPlayer(playerId: string): GamePerformance[] {
  return getGamePerformances().filter(g => g.playerId === playerId);
}

// Categorize a game's legs format
export function categorizeFormat(legs: string): GameFormatCategory {
  const u = legs.toUpperCase();
  if (u.includes('701') || u.includes('901') || u.includes('1101')) return '01';
  if (u.includes('CRICKET')) return 'cricket';
  if (u.includes('HALF-IT') || u.includes('HALF IT')) return 'half-it';
  // Mixed format detection
  const has01 = /\b(701|901|1101)\b/.test(u);
  const hasCricket = u.includes('CRICKET');
  if (has01 && hasCricket) return 'mixed';
  return '01';
}

// --- Analysis Computations ---

export function getPlayerGameStats(playerId: string): PlayerGameStats {
  const player = getPlayers().find(p => p.id === playerId);
  const games = getGamePerformancesForPlayer(playerId);

  // Use DartsLive aggregate totals to match the dashboard
  const hasStoredRecords = player ? player.wins > 0 || player.losses > 0 : false;
  const totalGames = hasStoredRecords ? (player!.wins + player!.losses) : games.length;
  const wins = hasStoredRecords ? player!.wins : games.filter(g => g.won).length;
  const losses = totalGames - wins;
  const winPct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // By format — filter by actual game format
  const format01Games = games.filter(g => g.format === '01');
  const cricketGames = games.filter(g => g.format === 'cricket');
  const halfItGames = games.filter(g => g.format === 'half-it');
  const format01LegsWon = format01Games.reduce((sum, g) => sum + g.legsWon, 0);
  const format01LegsLost = format01Games.reduce((sum, g) => sum + g.legsLost, 0);
  const cricketLegsWon = cricketGames.reduce((sum, g) => sum + g.legsWon, 0);
  const cricketLegsLost = cricketGames.reduce((sum, g) => sum + g.legsLost, 0);
  const halfItLegsWon = halfItGames.reduce((sum, g) => sum + g.legsWon, 0);
  const halfItLegsLost = halfItGames.reduce((sum, g) => sum + g.legsLost, 0);

  const fmtStats = (gs: GamePerformance[]) => {
    const w = gs.filter(g => g.won).length;
    return { games: gs.length, wins: w, winPct: gs.length > 0 ? Math.round((w / gs.length) * 100) : 0 };
  };

  // By game type
  const byGameType = {} as Record<GameFormat, { games: number; wins: number; winPct: number }>;
  for (const gt of ['singles', 'doubles', 'trios', 'team', 'half-it'] as GameFormat[]) {
    const gs = gt === 'half-it'
      ? games.filter(g => g.format === 'half-it')
      : games.filter(g => g.gameType === gt && g.format !== 'half-it');
    const w = gs.filter(g => g.won).length;
    byGameType[gt] = { games: gs.length, wins: w, winPct: gs.length > 0 ? Math.round((w / gs.length) * 100) : 0 };
  }

  // Average DartsLive stats — prefer stored values, fall back to game performances
  const stats01Values = games.filter(g => g.stats01 !== undefined).map(g => g.stats01!);
  const statsCricketValues = games.filter(g => g.statsCricket !== undefined).map(g => g.statsCricket!);
  const stats01Avg = player && player.stats01Avg > 0
    ? player.stats01Avg
    : (stats01Values.length > 0 ? Math.round((stats01Values.reduce((a, b) => a + b, 0) / stats01Values.length) * 100) / 100 : 0);
  const statsCricketAvg = player && player.statsCricketAvg > 0
    ? player.statsCricketAvg
    : (statsCricketValues.length > 0 ? Math.round((statsCricketValues.reduce((a, b) => a + b, 0) / statsCricketValues.length) * 100) / 100 : 0);

  // Legs won/lost
  const legsWon = games.reduce((sum, g) => sum + g.legsWon, 0);
  const legsLost = games.reduce((sum, g) => sum + g.legsLost, 0);
  const legsWinPct = (legsWon + legsLost) > 0 ? Math.round((legsWon / (legsWon + legsLost)) * 100) : 0;

  return {
    playerId,
    playerName: player?.name || 'Unknown',
    totalGames,
    wins,
    losses,
    winPct,
    legsWon,
    legsLost,
    legsWinPct,
    format01: { ...fmtStats(format01Games), legsWon: format01LegsWon, legsLost: format01LegsLost },
    cricket: { ...fmtStats(cricketGames), legsWon: cricketLegsWon, legsLost: cricketLegsLost },
    halfIt: { ...fmtStats(halfItGames), legsWon: halfItLegsWon, legsLost: halfItLegsLost },
    byGameType,
    stats01Avg,
    statsCricketAvg,
  };
}

export function getAllPlayersGameStats(): PlayerGameStats[] {
  return getPlayers()
    .map(p => getPlayerGameStats(p.id))
    .sort((a, b) => b.totalGames - a.totalGames || b.winPct - a.winPct);
}

export function getPartnerStats(): PartnerStats[] {
  const allGames = getGamePerformances();
  const pairMap = new Map<string, { games: number; wins: number }>();

  for (const game of allGames) {
    if (game.partnerIds.length === 0) continue;
    for (const partnerId of game.partnerIds) {
      const key = [game.playerId, partnerId].sort().join('::');
      const entry = pairMap.get(key) || { games: 0, wins: 0 };
      entry.games++;
      if (game.won) entry.wins++;
      pairMap.set(key, entry);
    }
  }

  const players = getPlayers();
  const playerName = (id: string) => players.find(p => p.id === id)?.name || id;

  return Array.from(pairMap.entries())
    .map(([key, val]) => {
      const [p1, p2] = key.split('::');
      return {
        player1Id: p1,
        player1Name: playerName(p1),
        player2Id: p2,
        player2Name: playerName(p2),
        gamesTogether: val.games,
        wins: val.wins,
        winPct: Math.round((val.wins / val.games) * 100),
      };
    })
    .sort((a, b) => b.gamesTogether - a.gamesTogether);
}

export function getTeamGameStats() {
  const allGames = getGamePerformances();
  const total = allGames.length;
  const wins = allGames.filter(g => g.won).length;
  return {
    totalGames: total,
    wins,
    losses: total - wins,
    winPct: total > 0 ? Math.round((wins / total) * 100) : 0,
  };
}

export function getPlayerWithStats(playerId: string): PlayerWithStats | null {
  const player = getPlayers().find(p => p.id === playerId);
  if (!player) return null;

  // Use real game performance data
  const gps = getGamePerformancesForPlayer(playerId);
  const gamesPlayed = gps.length;
  const wins = gps.filter(g => g.won).length;
  const winPct = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  // Average 01 stat from game performances (the real DartsLive metric)
  const stats01Values = gps.filter(g => g.stats01 !== undefined).map(g => g.stats01!);
  const avg01 = stats01Values.length > 0
    ? stats01Values.reduce((a, b) => a + b, 0) / stats01Values.length
    : 0;
  // DartsLive API returns stats01 as a 0-100 rating already
  const normalized01 = Math.min(100, Math.max(0, avg01));

  const formAverage = winPct;
  const punctualityScore = 50;
  const recentForm = gps
    .reduce((acc, gp) => {
      const s = getSessions().find(s => s.id === gp.sessionId);
      if (!s) return acc;
      if (!acc.find(e => e.date === s.date)) {
        acc.push({ date: s.date, score: gp.won ? 100 : 0 });
      }
      return acc;
    }, [] as { date: string; score: number }[])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);

  // Composite: 01 avg performance (50%) + win rate (50%)
  const compositeScore = Math.round(
    (normalized01 / 100) * 50 +
    (winPct / 100) * 50
  );

  const rawStats01Avg = stats01Values.length > 0 ? avg01 : 0;
  const statsCricketValues = gps.filter(g => g.statsCricket !== undefined).map(g => g.statsCricket!);
  const rawStatsCricketAvg = statsCricketValues.length > 0
    ? statsCricketValues.reduce((a, b) => a + b, 0) / statsCricketValues.length
    : 0;

  // Half-It leg win rate from past Half-It games
  const halfItGames = gps.filter(g => g.format === 'half-it');
  const halfItLegsWon = halfItGames.reduce((s, g) => s + g.legsWon, 0);
  const halfItLegsLost = halfItGames.reduce((s, g) => s + g.legsLost, 0);
  const halfItLegTotal = halfItLegsWon + halfItLegsLost;
  const halfItLegWinPct = halfItLegTotal > 0 ? Math.round((halfItLegsWon / halfItLegTotal) * 100) : 0;

  return { player, formAverage, punctualityScore, recentForm, compositeScore, stats01Avg: rawStats01Avg, statsCricketAvg: rawStatsCricketAvg, halfItLegWinPct };
}

export function getAllPlayersWithStats(): PlayerWithStats[] {
  return getPlayers()
    .map(p => getPlayerWithStats(p.id)!)
    .filter(Boolean)
    .sort((a, b) => b.compositeScore - a.compositeScore);
}

export function generateLineup(
  matchDate: string,
  teamSize: number = 4
): { lineup: LineupSlot[]; bench: PlayerWithStats[] } {
  const allPlayers = getAllPlayersWithStats();
  const matchSessions = getSessions().filter(s => s.date === matchDate && s.type === 'match');
  const matchSession = matchSessions.length > 0 ? matchSessions[0] : null;

  let availablePlayers = allPlayers;

  // If there's a match session for this date, filter by attendance
  if (matchSession) {
    const attendanceRecords = getAttendanceForSession(matchSession.id);
    const presentIds = new Set(
      attendanceRecords
        .filter(a => a.status === 'on-time' || a.status === 'late')
        .map(a => a.playerId)
    );
    availablePlayers = allPlayers.filter(p => presentIds.has(p.player.id));
  }

  // Sort by composite score descending
  const sorted = [...availablePlayers].sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    lineup: sorted.slice(0, teamSize).map((p, i) => ({ player: p, position: i + 1 })),
    bench: sorted.slice(teamSize),
  };
}

/**
 * Generates a SUPER LEAGUE lineup with game assignments.
 * Players can play multiple games — optimized by composite score.
 * Singles get priority for top players, rotation balances game count.
 * When not enough available players for a game, that game is skipped
 * and listed in skippedGames. Unavailable players (absent/excused/no response)
 * are reported in unavailablePlayers.
 */
export function generateFullLineup(
  matchDate: string,
  games: MatchGame[]
): FullLineup {
  const allPlayers = getAllPlayersWithStats();
  const matchSessions = getSessions().filter(s => s.date === matchDate && s.type === 'match');
  const matchSession = matchSessions.length > 0 ? matchSessions[0] : null;

  let availablePlayers = allPlayers;
  const unavailablePlayers: UnavailablePlayer[] = [];

  // Filter by attendance if match session exists
  if (matchSession) {
    const attendanceRecords = getAttendanceForSession(matchSession.id);
    const presentIds = new Set(
      attendanceRecords
        .filter(a => a.status === 'on-time' || a.status === 'late')
        .map(a => a.playerId)
    );
    availablePlayers = allPlayers.filter(p => presentIds.has(p.player.id));

    // Report who's unavailable and why
    const absentIds = new Set(
      attendanceRecords
        .filter(a => a.status === 'absent')
        .map(a => a.playerId)
    );
    const excusedIds = new Set(
      attendanceRecords
        .filter(a => a.status === 'excused')
        .map(a => a.playerId)
    );
    const respondedIds = new Set(attendanceRecords.map(a => a.playerId));
    // Players with no response record = no response yet
    const noResponseIds = new Set(
      getResponsesForSession(matchSession.id)
        .map(r => r.playerId)
    );
    for (const p of allPlayers) {
      if (presentIds.has(p.player.id)) continue;
      if (absentIds.has(p.player.id)) {
        unavailablePlayers.push({ name: p.player.name, reason: 'Absent' });
      } else if (excusedIds.has(p.player.id)) {
        unavailablePlayers.push({ name: p.player.name, reason: 'Excused' });
      } else if (!respondedIds.has(p.player.id) && !noResponseIds.has(p.player.id)) {
        unavailablePlayers.push({ name: p.player.name, reason: 'No response' });
      } else {
        unavailablePlayers.push({ name: p.player.name, reason: 'Not available' });
      }
    }
  }

  const gameCount = new Map<string, number>();
  availablePlayers.forEach(p => gameCount.set(p.player.id, 0));

  const assignments: GameAssignment[] = [];
  const skippedGames: SkippedGame[] = [];

  // Split games into three blocks
  const part1Games = games.filter(g => g.id >= 1 && g.id <= 3);
  const part2Games = games.filter(g => g.id >= 4 && g.id <= 7);
  const part3Games = games.filter(g => g.id >= 8 && g.id <= 9);

  // --- Part 1 (G1-G3): repeat once (max 2 appearances per player) ---
  assignRepeatOnceBlock(part1Games, availablePlayers, gameCount, 'G1-G3', assignments, skippedGames);

  // --- Part 2 (G4-G7): repeat once (max 2 appearances per player in this block) ---
  assignRepeatOnceBlock(part2Games, availablePlayers, gameCount, 'G4-G7', assignments, skippedGames);

  // --- Part 3 (G8-G9): repeat once (max 2 appearances per player in this block) ---
  assignRepeatOnceBlock(part3Games, availablePlayers, gameCount, 'G8-G9', assignments, skippedGames);

  const playerGameCount = Array.from(gameCount.entries())
    .map(([id, count]) => ({
      playerName: allPlayers.find(p => p.player.id === id)?.player.name || 'Unknown',
      count,
    }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count);

  return { assignments, playerGameCount, skippedGames, unavailablePlayers };
}

/**
 * Assigns players to a block of games where each player can appear at most twice
 * (repeat-once rule). Used for Part 2 (G4-G7) and Part 3 (G8-G9).
 */
function assignRepeatOnceBlock(
  games: MatchGame[],
  availablePlayers: PlayerWithStats[],
  gameCount: Map<string, number>,
  blockLabel: string,
  assignments: GameAssignment[],
  skippedGames: SkippedGame[]
): void {
  const blockCounts = new Map<string, number>();

  for (const game of games) {
    const needed = game.playerCount;

    if (availablePlayers.length < needed) {
      skippedGames.push({
        game,
        reason: `Need ${needed} players, only ${availablePlayers.length} available`,
      });
      continue;
    }

    // Exclude players already used twice within this block
    const pool = availablePlayers.filter(p => (blockCounts.get(p.player.id) || 0) < 2);
    if (pool.length < needed) {
      skippedGames.push({
        game,
        reason: `${blockLabel} repeat-once rule: need ${needed} player${needed > 1 ? 's' : ''} with <2 appearances, only ${pool.length} available`,
      });
      continue;
    }

    const assigned: PlayerWithStats[] = [];

    const ranked = [...pool].sort((a, b) => {
      const aScore = formatScore(a, game.legs) - (gameCount.get(a.player.id) || 0) * 10;
      const bScore = formatScore(b, game.legs) - (gameCount.get(b.player.id) || 0) * 10;
      return bScore - aScore;
    });

    for (let i = 0; i < needed; i++) {
      const p = ranked[i];
      assigned.push(p);
      gameCount.set(p.player.id, (gameCount.get(p.player.id) || 0) + 1);
      blockCounts.set(p.player.id, (blockCounts.get(p.player.id) || 0) + 1);
    }

    assignments.push({ game, players: assigned });
  }
}

/** Returns a 0-100 skill score tailored to the game format (01 vs cricket vs half-it vs mixed). */
function formatScore(player: PlayerWithStats, legs: string): number {
  const isOnly01 = !legs.includes('Cricket') && !legs.includes('Choice') && !legs.includes('Half-It');
  const isOnlyCricket = !legs.includes('701') && !legs.includes('901') && !legs.includes('1101') && !legs.includes('Choice') && !legs.includes('Half-It');
  const isHalfIt = legs.includes('Half-It');

  if (isOnly01) {
    // Pure 01 game (G1, G9) — DartsLive API returns 0-100 rating
    return player.stats01Avg > 0 ? Math.min(100, Math.max(0, player.stats01Avg)) : 0;
  }
  if (isOnlyCricket) {
    // Pure cricket game (G5) — use normalized cricket average
    return player.statsCricketAvg > 0 ? Math.min(100, Math.max(0, (player.statsCricketAvg - 1) * 14)) : 0;
  }
  if (isHalfIt) {
    // Half-It (G6) — composite of cricket avg (similar target-hitting gameplay) + past half-it leg performance
    const cricketScore = player.statsCricketAvg > 0 ? Math.min(100, Math.max(0, (player.statsCricketAvg - 1) * 14)) : 0;
    const halfItScore = player.halfItLegWinPct;
    // Weight: 50% cricket skill + 50% past half-it performance
    return Math.round(cricketScore * 0.5 + halfItScore * 0.5);
  }
  // Mixed-format games — use composite (01 avg + win rate)
  return player.compositeScore;
}

// --- Per-player chart data (match-by-match) ---
export function getPlayerMatchHistory(playerId: string) {
  const gps = getGamePerformancesForPlayer(playerId).sort(
    (a, b) => a.sessionId.localeCompare(b.sessionId)
  );
  const sessions = getSessions();
  const matchMap = new Map<string, { wins: number; losses: number; stats01: number[]; statsCricket: number[]; date: string }>();

  for (const gp of gps) {
    const s = sessions.find(s => s.id === gp.sessionId);
    if (!s) continue;
    const entry = matchMap.get(s.id) || { wins: 0, losses: 0, stats01: [], statsCricket: [], date: s.date };
    if (gp.won) entry.wins++;
    else entry.losses++;
    if (gp.stats01) entry.stats01.push(gp.stats01);
    if (gp.statsCricket) entry.statsCricket.push(gp.statsCricket);
    matchMap.set(s.id, entry);
  }

  return Array.from(matchMap.values())
    .map(e => ({
      date: e.date,
      wins: e.wins,
      losses: e.losses,
      totalGames: e.wins + e.losses,
      stats01Avg: e.stats01.length > 0 ? Math.round((e.stats01.reduce((a, b) => a + b, 0) / e.stats01.length) * 100) / 100 : 0,
      statsCricketAvg: e.statsCricket.length > 0 ? Math.round((e.statsCricket.reduce((a, b) => a + b, 0) / e.statsCricket.length) * 100) / 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- Dashboard Stats (from real game performance data) ---
export function getPlayerDashboardStats() {
  return getPlayers().map(p => {
    const gps = getGamePerformancesForPlayer(p.id);
    // Prefer stored DartsLive values, fall back to computed from game performances
    const hasStoredRecords = p.wins > 0 || p.losses > 0;
    const wins = hasStoredRecords ? p.wins : gps.filter(g => g.won).length;
    const losses = hasStoredRecords ? p.losses : gps.length - gps.filter(g => g.won).length;
    const games = wins + losses;
    const stats01Avg = p.stats01Avg > 0 ? p.stats01Avg : 0;
    const statsCricketAvg = p.statsCricketAvg > 0 ? p.statsCricketAvg : 0;

    // Compute trend: compare last 2 match performances
    const matchHistory = getPlayerMatchHistory(p.id);
    let stats01Trend: 'up' | 'down' | 'same' = 'same';
    let statsCricketTrend: 'up' | 'down' | 'same' = 'same';
    if (matchHistory.length >= 2) {
      const last = matchHistory[matchHistory.length - 1];
      const prev = matchHistory[matchHistory.length - 2];
      stats01Trend = last.stats01Avg > prev.stats01Avg ? 'up' : last.stats01Avg < prev.stats01Avg ? 'down' : 'same';
      statsCricketTrend = last.statsCricketAvg > prev.statsCricketAvg ? 'up' : last.statsCricketAvg < prev.statsCricketAvg ? 'down' : 'same';
    }

    return {
      player: p,
      rating: p.rating,
      liveRating: p.liveRating || 0,
      games, wins, losses,
      winPct: games > 0 ? Math.round((wins / games) * 100) : 0,
      stats01Avg: Math.round(stats01Avg * 100) / 100,
      statsCricketAvg: Math.round(statsCricketAvg * 100) / 100,
      stats01Trend,
      statsCricketTrend,
    };
  }).sort((a, b) => (b.liveRating || 0) - (a.liveRating || 0) || b.games - a.games);
}

/** Computes Thirstday's match record from sessions (W/L by parsing notes). */
export function getTeamStanding() {
  const sessions = getSessions().filter(s => s.type === 'match');
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  for (const s of sessions) {
    const noteParts = s.notes?.match(/\((W|L)\s+(\d+)-(\d+)\)/);
    if (!noteParts) continue;
    const result = noteParts[1];
    const tdScore = parseInt(noteParts[2], 10);
    const oppScore = parseInt(noteParts[3], 10);
    if (result === 'W') wins++;
    else if (result === 'L') losses++;
    pointsFor += tdScore;
    pointsAgainst += oppScore;
  }

  const played = wins + losses;
  return {
    wins,
    losses,
    played,
    winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
    pointsFor,
    pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
    remaining: sessions.length - played,
  };
}

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  localStorage.removeItem('darts_game_performances');
}

export function hasData(): boolean {
  return getPlayers().length > 0;
}

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Derive a 1-10 skill rating from DartsLive's 0-100 stats01 average. */
export function deriveRating(stats01Avg: number): number {
  if (stats01Avg <= 0) return 5;
  return Math.max(1, Math.min(10, Math.round(stats01Avg / 10)));
}

// --- Populate from live API data ---
export interface LivePlayerData {
  name: string;
  stats01Avg: number;
  statsCricketAvg: number;
  totalPoints: number;
  totalWins: number;
  totalLosses: number;
  totalWinRate: string;
  liveRating: number; // DartsLive Rt. ranking score (e.g. 13.11)
}

export interface LiveMatchPlayer {
  name: string;
  point: number;
  stats01: number;
  statsCricket: number;
  winCount: number;
  loseCount: number;
  winRate: string;
}

export interface LiveMatchGameResultData {
  gameId: number;
  gameName: string;
  homeLegs: number;
  awayLegs: number;
  homePlayers: string[];
  awayPlayers: string[];
  thirstdayWon: boolean;
}

export interface LiveMatchAwardCount {
  playerName: string;
  count: number;
}

export interface LiveMatchAwardData {
  awardType: string;
  displayName: string;
  counts: LiveMatchAwardCount[];
}

export interface LiveMatchResultData {
  matchNo: string;
  matchDate: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homeBonus: number;
  awayBonus: number;
  isThirstdayHome: boolean;
  completed: boolean;
  players: LiveMatchPlayer[];
  games: LiveMatchGameResultData[];
  awards: LiveMatchAwardData[];
}

export interface LiveDataInput {
  matches: LiveMatchResultData[];
  players: LivePlayerData[];
  fetchedAt: string;
}

// Map DartsLive API award types to our display names
const AWARD_TYPE_MAP: Record<string, string> = {
  HAT_TRICK: 'Hat Trick',
  HIGH_TON: 'High Ton',
  TON_80: 'Ton 80',
  THREE_IN_A_BED: '3 in a Bed',
  WHITE_HORSE: 'White Horse',
  THREE_IN_THE_BLACK: '3 in the Black',
};

/** Computes per-player award totals from all match data and stores them */
function computeAwardTotals(matches: LiveMatchResultData[]) {
  const awardMap = new Map<string, Record<string, number>>();
  const allAwardTypes = new Set<string>();

  for (const m of matches) {
    for (const a of m.awards) {
      allAwardTypes.add(a.awardType);
      for (const c of a.counts) {
        if (!awardMap.has(c.playerName)) {
          awardMap.set(c.playerName, {});
        }
        const pa = awardMap.get(c.playerName)!;
        pa[a.awardType] = (pa[a.awardType] || 0) + c.count;
      }
    }
  }

  save(STORAGE_KEYS.awards, {
    awardMap: Object.fromEntries(awardMap),
    awardTypes: Array.from(allAwardTypes),
  });
}

/** Returns per-player award counts mapped through the AWARD_TYPE_MAP */
export function getPlayerAwardDisplayCounts(): { playerName: string; awards: Record<string, number> }[] {
  const stored = load<any>(STORAGE_KEYS.awards, null);
  if (!stored || !stored.awardMap) return [];
  return Object.entries(stored.awardMap).map(([name, awards]) => ({
    playerName: name,
    awards: Object.fromEntries(
      Object.entries(awards as Record<string, number>).map(([type, count]) => [
        AWARD_TYPE_MAP[type] || type,
        count,
      ])
    ),
  }));
}

// Super League format: 9 games with specific types/formats.
// Since the API only gives total W/L per player (not per-game breakdown),
// we distribute across known game types in round-robin order.
const SUPER_LEAGUE_GAMES: { gameType: GameFormat; format: GameFormatCategory }[] = [
  { gameType: 'singles', format: '01' },       // G1
  { gameType: 'singles', format: 'mixed' },     // G2
  { gameType: 'doubles', format: 'mixed' },     // G3
  { gameType: 'doubles', format: 'mixed' },     // G4
  { gameType: 'doubles', format: 'cricket' },   // G5
  { gameType: 'doubles', format: 'half-it' },   // G6
  { gameType: 'doubles', format: 'mixed' },     // G7
  { gameType: 'trios', format: 'mixed' },       // G8
  { gameType: 'team', format: '01' },           // G9
];

function distributeGameTypes(totalGames: number, matchOffset: number = 0) {
  const result: { gameType: GameFormat; format: GameFormatCategory }[] = [];
  for (let i = 0; i < totalGames; i++) {
    result.push(SUPER_LEAGUE_GAMES[(i + matchOffset) % SUPER_LEAGUE_GAMES.length]);
  }
  return result;
}

function lookupGameFormat(gameId: number): { gameType: GameFormat; format: GameFormatCategory } | null {
  if (gameId >= 1 && gameId <= SUPER_LEAGUE_GAMES.length) {
    return SUPER_LEAGUE_GAMES[gameId - 1];
  }
  return null;
}

export function populateFromLiveData(liveData: LiveDataInput) {
  clearAllData();

  const players = liveData.players.map((p) => {
    return {
      id: generateId(),
      name: p.name,
      rating: deriveRating(p.stats01Avg),
      liveRating: p.liveRating || 0,
      wins: 0,
      losses: 0,
      stats01Avg: p.stats01Avg,
      statsCricketAvg: p.statsCricketAvg,
      notes: `DL ${p.stats01Avg.toFixed(2)} · Cr ${p.statsCricketAvg.toFixed(2)}`,
      createdAt: new Date().toISOString(),
    };
  });

  if (players.length === 0) return;

  const sessions = liveData.matches.map((m) => {
    const thirstdayScore = m.isThirstdayHome ? m.homeScore + m.homeBonus : m.awayScore + m.awayBonus;
    const opponentScore = m.isThirstdayHome ? m.awayScore + m.awayBonus : m.homeScore + m.homeBonus;
    const isWin = thirstdayScore > opponentScore;
    const result = isWin ? 'W' : 'L';
    const opponent = m.isThirstdayHome ? m.awayTeamName : m.homeTeamName;
    return {
      id: generateId(),
      date: m.matchDate,
      type: 'match' as const,
      notes: `${m.isThirstdayHome ? 'vs' : '@'} ${opponent} (${result} ${thirstdayScore}-${opponentScore})`,
      createdAt: `${m.matchDate}T18:00:00.000Z`,
    };
  });

  localStorage.setItem('darts_players', JSON.stringify(players));
  localStorage.setItem('darts_sessions', JSON.stringify(sessions));

  const gamePerformances: any[] = [];
  liveData.matches.forEach((m, matchIdx) => {
    if (m.players.length === 0) return;
    const sessionId = sessions[matchIdx]?.id;
    if (!sessionId) return;

    const playerNameToId = new Map(players.map(p => [p.name, p.id]));

    // Build player stats lookup per match
    const playerStatsMap = new Map<string, { stats01: number; statsCricket: number }>();
    for (const p of m.players) {
      playerStatsMap.set(p.name, {
        stats01: p.stats01,
        statsCricket: p.statsCricket,
      });
    }

    // Check if we have actual per-game data
    if (m.games && m.games.length > 0) {
      // Use real per-game data from the API
      for (const game of m.games) {
        const thirstdayPlayers = m.isThirstdayHome
          ? game.homePlayers
          : game.awayPlayers;

        // Thirstday's leg count
        const ourLegs = m.isThirstdayHome ? game.homeLegs : game.awayLegs;
        const oppLegs = m.isThirstdayHome ? game.awayLegs : game.homeLegs;

        for (const playerName of thirstdayPlayers) {
          const playerId = playerNameToId.get(playerName);
          if (!playerId) continue;

          const gf = lookupGameFormat(game.gameId);
          const stats = playerStatsMap.get(playerName);

          // Partner IDs: other Thirstday players in the same game
          const partnerIds = thirstdayPlayers
            .filter(n => n !== playerName)
            .map(n => playerNameToId.get(n))
            .filter((id): id is string => !!id);

          gamePerformances.push({
            id: generateId(),
            playerId,
            sessionId,
            gameId: game.gameId,
            gameType: gf?.gameType || 'doubles',
            format: gf?.format || 'mixed',
            partnerIds,
            won: game.thirstdayWon,
            legsWon: ourLegs,
            legsLost: oppLegs,
            stats01: stats?.stats01 || 0,
            statsCricket: stats?.statsCricket || 0,
          });
        }
      }
    } else {
      // Fallback: distribute game types round-robin (old behavior)
      m.players.forEach(p => {
        const playerId = playerNameToId.get(p.name);
        if (!playerId) return;
        const totalGames = p.winCount + p.loseCount;
        if (totalGames === 0) return;

        const types = distributeGameTypes(totalGames, matchIdx);
        for (let i = 0; i < totalGames; i++) {
          gamePerformances.push({
            id: generateId(),
            playerId,
            sessionId,
            gameId: i + 1,
            gameType: types[i].gameType,
            format: types[i].format,
            partnerIds: [],
            won: i < p.winCount,
            legsWon: i < p.winCount ? 1 : 0,
            legsLost: i < p.winCount ? 0 : 1,
            stats01: p.stats01,
            statsCricket: p.statsCricket,
          });
        }
      });
    }
  });

  localStorage.setItem('darts_game_performances', JSON.stringify(gamePerformances));

  computeAwardTotals(liveData.matches);
}

/**
 * Incremental update — only adds new matches that haven't been loaded yet.
 * Preserves existing players, attendance, and previously loaded match data.
 * Returns a count of how many new matches were added.
 */
export function updateFromLiveData(liveData: LiveDataInput): number {
  // Get existing data
  const existingPlayers = getPlayers();
  const existingSessions = getSessions();
  const existingGamePerformances = getGamePerformances();
  const existingDates = new Set(existingSessions.filter(s => s.type === 'match').map(s => s.date));

  // Find new matches (dates not already in sessions)
  const newMatches = liveData.matches.filter(m => !existingDates.has(m.matchDate));

  if (newMatches.length === 0) return 0;

  // Create or update players from API data
  const playerMap = new Map(existingPlayers.map(p => [p.name, p]));
  for (const ap of liveData.players) {
    if (playerMap.has(ap.name)) {
      // Update existing player's notes and rating with latest stats
      const existing = playerMap.get(ap.name)!;
      existing.notes = `DL ${ap.stats01Avg.toFixed(2)} · Cr ${ap.statsCricketAvg.toFixed(2)}`;
      existing.rating = deriveRating(ap.stats01Avg);
      existing.liveRating = ap.liveRating || 0;
      playerMap.set(ap.name, existing);
    } else {
      // New player
      const newPlayer = {
        id: generateId(),
        name: ap.name,
        rating: deriveRating(ap.stats01Avg),
        liveRating: ap.liveRating || 0,
        wins: 0,
        losses: 0,
        stats01Avg: ap.stats01Avg,
        statsCricketAvg: ap.statsCricketAvg,
        notes: `DL ${ap.stats01Avg.toFixed(2)} · Cr ${ap.statsCricketAvg.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      };
      playerMap.set(ap.name, newPlayer);
    }
  }
  localStorage.setItem('darts_players', JSON.stringify(Array.from(playerMap.values())));

  // Create sessions and game performances only for new matches
  const allSessions = [...existingSessions];
  const newGamePerformances: any[] = [];
  let addedCount = 0;
  let matchOffset = existingSessions.filter(s => s.type === 'match').length;

  for (const m of newMatches) {
    const thirstdayScore = m.isThirstdayHome ? m.homeScore + m.homeBonus : m.awayScore + m.awayBonus;
    const opponentScore = m.isThirstdayHome ? m.awayScore + m.awayBonus : m.homeScore + m.homeBonus;
    const isWin = thirstdayScore > opponentScore;
    const result = isWin ? 'W' : 'L';
    const opponent = m.isThirstdayHome ? m.awayTeamName : m.homeTeamName;

    const newSession = {
      id: generateId(),
      date: m.matchDate,
      type: 'match' as const,
      notes: `${m.isThirstdayHome ? 'vs' : '@'} ${opponent} (${result} ${thirstdayScore}-${opponentScore})`,
      createdAt: `${m.matchDate}T18:00:00.000Z`,
    };
    allSessions.push(newSession);

    if (m.players.length > 0) {
      // Build player stats lookup per match
      const playerStatsMap = new Map<string, { stats01: number; statsCricket: number }>();
      for (const p of m.players) {
        playerStatsMap.set(p.name, { stats01: p.stats01, statsCricket: p.statsCricket });
      }

      // Check if we have actual per-game data
      if (m.games && m.games.length > 0) {
        for (const game of m.games) {
          const thirstdayPlayers = m.isThirstdayHome
            ? game.homePlayers
            : game.awayPlayers;

          const ourLegs = m.isThirstdayHome ? game.homeLegs : game.awayLegs;
          const oppLegs = m.isThirstdayHome ? game.awayLegs : game.homeLegs;

          for (const playerName of thirstdayPlayers) {
            const player = playerMap.get(playerName);
            if (!player) continue;

            const gf = lookupGameFormat(game.gameId);
            const stats = playerStatsMap.get(playerName);

            const partnerIds = thirstdayPlayers
              .filter(n => n !== playerName)
              .map(n => playerMap.get(n)?.id)
              .filter((id): id is string => !!id);

            newGamePerformances.push({
              id: generateId(),
              playerId: player.id,
              sessionId: newSession.id,
              gameId: game.gameId,
              gameType: gf?.gameType || 'doubles',
              format: gf?.format || 'mixed',
              partnerIds,
              won: game.thirstdayWon,
              legsWon: ourLegs,
              legsLost: oppLegs,
              stats01: stats?.stats01 || 0,
              statsCricket: stats?.statsCricket || 0,
            });
          }
        }
      } else {
        // Fallback: round-robin distribution (no per-game data)
        for (const p of m.players) {
          const player = playerMap.get(p.name);
          if (!player) continue;
          const totalGames = p.winCount + p.loseCount;
          if (totalGames === 0) continue;

          const types = distributeGameTypes(totalGames, matchOffset);
          for (let i = 0; i < totalGames; i++) {
            newGamePerformances.push({
              id: generateId(),
              playerId: player.id,
              sessionId: newSession.id,
              gameId: i + 1,
              gameType: types[i].gameType,
              format: types[i].format,
              partnerIds: [],
              won: i < p.winCount,
              legsWon: i < p.winCount ? 1 : 0,
              legsLost: i < p.winCount ? 0 : 1,
              stats01: p.stats01,
              statsCricket: p.statsCricket,
            });
          }
        }
      }
    }
    addedCount++;
    matchOffset++;
  }

  localStorage.setItem('darts_sessions', JSON.stringify(allSessions));
  localStorage.setItem('darts_game_performances', JSON.stringify([...existingGamePerformances, ...newGamePerformances]));

  computeAwardTotals(liveData.matches);
  return addedCount;
}