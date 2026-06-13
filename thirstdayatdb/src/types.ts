export type AttendanceStatus = 'on-time' | 'late' | 'absent';
export type SessionType = 'practice' | 'match';

export interface Player {
  id: string;
  name: string;
  rating: number; // 1-10 skill rating
  liveRating: number; // DartsLive Rt. (ranking score, e.g. 13.11)
  wins: number; // DartsLive total wins (season)
  losses: number; // DartsLive total losses (season)
  stats01Avg: number; // DartsLive 01 average
  statsCricketAvg: number; // DartsLive Cricket average
  notes: string;
  createdAt: string;
}

export interface Session {
  id: string;
  date: string;
  type: SessionType;
  notes: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  playerId: string;
  sessionId: string;
  status: AttendanceStatus;
  lateMinutes?: number;
}

export interface MatchPerformance {
  id: string;
  playerId: string;
  sessionId: string;
  score: number; // 0-100 performance score for the match
}

export interface PlayerFormEntry {
  date: string;
  score: number;
}

export interface PlayerWithStats {
  player: Player;
  formAverage: number;
  punctualityScore: number; // 0-100
  recentForm: PlayerFormEntry[];
  compositeScore: number;
  stats01Avg: number;
  statsCricketAvg: number;
  halfItLegWinPct: number; // 0-100 leg win rate in Half-It games
}

export interface LineupSlot {
  player: PlayerWithStats;
  position: number;
}

export type GameFormat = 'singles' | 'doubles' | 'trios' | 'team' | 'half-it';

export interface MatchGame {
  id: number;
  type: GameFormat;
  label: string;
  legs: string; // e.g. "701", "Cricket", "Half-It", "901", "1101"
  playerCount: number;
}

export interface GameAssignment {
  game: MatchGame;
  players: PlayerWithStats[];
}

export interface SkippedGame {
  game: MatchGame;
  reason: string;
}

export interface UnavailablePlayer {
  name: string;
  reason: string;
}

export interface FullLineup {
  assignments: GameAssignment[];
  playerGameCount: { playerName: string; count: number }[];
  skippedGames: SkippedGame[];
  unavailablePlayers: UnavailablePlayer[];
}

export interface PlayerResponse {
  id: string;
  playerId: string;
  playerName: string;
  sessionId: string;
  status: AttendanceStatus;
  respondedAt: string; // ISO timestamp
  method: 'link' | 'manual';
}

// --- Game-level performance tracking ---

export type GameFormatCategory = '01' | 'cricket' | 'half-it' | 'mixed';

export interface GamePerformance {
  id: string;
  playerId: string;
  sessionId: string;
  gameId: number;         // 1-9 matching Super League format; 0 = aggregate
  gameType: GameFormat;    // singles/doubles/trios/team
  format: GameFormatCategory; // 01 vs cricket vs half-it
  partnerIds: string[];
  won: boolean;
  legsWon: number;
  legsLost: number;
  /** Live DartsLive 01 avg (e.g. score per dart) */
  stats01?: number;
  /** Live DartsLive Cricket avg (e.g. marks per turn) */
  statsCricket?: number;
}

export interface PlayerGameStats {
  playerId: string;
  playerName: string;
  totalGames: number;
  wins: number;
  losses: number;
  winPct: number;
  legsWon: number;
  legsLost: number;
  format01: { games: number; wins: number; winPct: number; legsWon: number; legsLost: number };
  cricket: { games: number; wins: number; winPct: number; legsWon: number; legsLost: number };
  halfIt: { games: number; wins: number; winPct: number; legsWon: number; legsLost: number };
  legsWinPct: number;
  byGameType: Record<GameFormat, { games: number; wins: number; winPct: number }>;
  stats01Avg: number;
  statsCricketAvg: number;
}

export interface PartnerStats {
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  gamesTogether: number;
  wins: number;
  winPct: number;
}

// --- Opponent tracking for strategy ---

export interface OpponentPlayerRecord {
  id: string;
  matchDate: string;
  opponentTeam: string;
  playerName: string;
  stats01: number;
  statsCricket: number;
  gameIds: number[];
}

export interface OpponentGameSlotProfile {
  slotGameId: number;
  playersFaced: string[];
  avg01: number;
  avgCricket: number;
  sampleSize: number;
}

export interface OpponentTeamProfile {
  teamName: string;
  lastPlayed: string;
  gameSlots: OpponentGameSlotProfile[];
}

export interface OpponentMatchSlot {
  gameId: number;
  players: string[];
}

export interface OpponentLastMatchLineup {
  matchDate: string;
  slots: OpponentMatchSlot[];
}

export type LineupStrategy = 'optimal' | 'aggressive' | 'balanced';

export interface LineupSuggestion {
  id: string;
  label: string;
  strategy: LineupStrategy;
  lineup: FullLineup;
  winProbability: number;
  totalMatchupScore: number;
}