import type { Player, Session, GamePerformance } from './types';
import { deriveRating } from './store';
import { REAL_GAME_PERFORMANCES } from './seedRealData';

let idCounter = 1;
function genId(seed: number): string {
  return `seed-${seed}-${Date.now()}`;
}
function nextId(): string {
  return `seed-gp-${idCounter++}-${Date.now()}`;
}

// Thirstday@DB — official roster from DartsLive API (as of 2026-06-12)
// Each entry: [name, rtRating, notes, stats01Avg, statsCricketAvg, wins, losses]
const playerData: [string, number, string, number, number, number, number][] = [
  ['Clarence Yeo WG', 13.11, 'DL 93.63 · Cr 3.60', 93.63, 3.60, 24, 23],
  ['Melvin Lee XC', 12.42, 'DL 93.16 · Cr 3.32', 93.16, 3.32, 21, 25],
  ['Tan Li Ting', 12.28, 'DL 90.21 · Cr 3.41', 90.21, 3.41, 18, 20],
  ['Ang Keng Yeow', 12.17, 'DL 89.58 · Cr 3.39', 89.58, 3.39, 20, 13],
  ['Wang GuanFei', 11.82, 'DL 90.23 · Cr 3.21', 90.23, 3.21, 17, 21],
  ['Marcus Tan', 11.30, 'DL 87.22 · Cr 3.13', 87.22, 3.13, 5, 5],
  ['Jack Li', 9.99, 'DL 80.06 · Cr 2.89', 80.06, 2.89, 13, 15],
];

interface MatchInfo {
  date: string;
  opponent: string;
  isHome: boolean;
  homeScore: number;
  awayScore: number;
  homeBonus: number;
  awayBonus: number;
}

const matchSchedule: MatchInfo[] = [
  // All opponents play twice — once home, once away
  // Data from DartsLive API (league.dartslive.com)
  { date: '2026-02-12', opponent: 'GOTTaWinThemAllAgain',  isHome: false, homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  { date: '2026-02-26', opponent: 'Heng @ G.U.T.S',        isHome: true,  homeScore: 9, awayScore: 0, homeBonus: 1, awayBonus: 0 },
  { date: '2026-03-05', opponent: 'OBar - Alpha',           isHome: false, homeScore: 1, awayScore: 8, homeBonus: 0, awayBonus: 1 },
  { date: '2026-03-12', opponent: 'Divinities.神將 @GVC',   isHome: true,  homeScore: 1, awayScore: 8, homeBonus: 0, awayBonus: 1 },
  { date: '2026-03-19', opponent: 'CHAOS Primordial',       isHome: false, homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-09', opponent: 'Katana Defenders @ F5',  isHome: true,  homeScore: 2, awayScore: 7, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-16', opponent: 'Yeti @ Shinjyu',         isHome: true,  homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-04-23', opponent: 'Heng @ G.U.T.S',        isHome: false, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-05-07', opponent: 'GOTTaWinThemAllAgain',   isHome: true,  homeScore: 2, awayScore: 7, homeBonus: 0, awayBonus: 1 },
  { date: '2026-05-14', opponent: 'OBar - Alpha',           isHome: true,  homeScore: 7, awayScore: 2, homeBonus: 1, awayBonus: 0 },
  { date: '2026-05-28', opponent: 'Divinities.神將 @GVC',   isHome: false, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-06-04', opponent: 'CHAOS Primordial',       isHome: true,  homeScore: 3, awayScore: 6, homeBonus: 0, awayBonus: 1 },
  { date: '2026-06-11', opponent: 'Katana Defenders @ F5',  isHome: false, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-06-18', opponent: 'Yeti @ Shinjyu',         isHome: false, homeScore: 0, awayScore: 0, homeBonus: 0, awayBonus: 0 },
];

export function seedDemoData(): void {
  idCounter = 1;
  localStorage.removeItem('darts_players');
  localStorage.removeItem('darts_sessions');
  localStorage.removeItem('darts_attendance');
  localStorage.removeItem('darts_performances');
  localStorage.removeItem('darts_game_performances');

  const players: Player[] = playerData.map(([name, rtValue, notes, stats01Avg, statsCricketAvg, wins, losses], i) => ({
    id: genId(i + 1),
    name,
    rating: deriveRating(stats01Avg), // 1-10 derived from 01 avg
    liveRating: rtValue,           // DartsLive Rt. ranking score
    wins,                          // DartsLive season W/L
    losses,
    stats01Avg,                    // DartsLive season averages
    statsCricketAvg,
    notes,
    createdAt: '2026-02-01T00:00:00.000Z',
  }));

  const sessions: Session[] = [];
  const allGamePerformances: GamePerformance[] = [];

  matchSchedule.forEach((m, mi) => {
    // Skip future unfinished matches (0-0 scores)
    const isCompleted = (m.homeScore + m.awayScore) > 0;
    const isWin = m.isHome
      ? (m.homeScore + m.homeBonus) > (m.awayScore + m.awayBonus)
      : (m.awayScore + m.awayBonus) > (m.homeScore + m.homeBonus);
    const result = isCompleted ? (isWin ? 'W' : 'L') : '-';
    const tdScore = m.isHome
      ? `${m.homeScore + m.homeBonus}-${m.awayScore + m.awayBonus}`
      : `${m.awayScore + m.awayBonus}-${m.homeScore + m.homeBonus}`;

    const session: Session = {
      id: genId(100 + mi),
      date: m.date,
      type: 'match' as const,
      notes: `S1 Week ${mi + 1} ${m.isHome ? 'vs' : '@'} ${m.opponent} (${result} ${tdScore})`,
      createdAt: `${m.date}T18:00:00.000Z`,
    };
    sessions.push(session);

    if (!isCompleted) return;

    // Build player name → ID map
    const playerNameToId = new Map(players.map(p => [p.name, p.id]));

    // Per-match entry counts in REAL_GAME_PERFORMANCES (ordered by match)
    const perfCounts = [19, 18, 14, 14, 18, 18, 18, 18, 18, 18, 18, 18, 16];
    let startIdx = 0;
    for (let i = 0; i < mi; i++) startIdx += perfCounts[i];
    const endIdx = startIdx + perfCounts[mi];

    for (let i = startIdx; i < endIdx; i++) {
      const rp = REAL_GAME_PERFORMANCES[i];
      const playerId = playerNameToId.get(rp.playerName);
      if (!playerId) continue;

      const partnerIds = rp.partnerNames
        .map(n => playerNameToId.get(n))
        .filter((id): id is string => !!id);

      allGamePerformances.push({
        id: nextId(),
        playerId,
        sessionId: session.id,
        gameId: rp.gameId,
        gameType: rp.gameType,
        format: rp.format,
        partnerIds,
        won: rp.won,
        legsWon: rp.legsWon,
        legsLost: rp.legsLost,
        stats01: rp.stats01 || undefined,
        statsCricket: rp.statsCricket || undefined,
      });
    }
  });

  localStorage.setItem('darts_players', JSON.stringify(players));
  localStorage.setItem('darts_sessions', JSON.stringify(sessions));
  localStorage.setItem('darts_game_performances', JSON.stringify(allGamePerformances));

  seedAwards();
}

/**
 * Real award achievement counts scraped from DartsLive API across all 13 matches.
 * Only includes the 6 tracked award pin types.
 */
function seedAwards(): void {
  const AWARD_TYPES = ['HAT_TRICK', 'HIGH_TON', 'TON_80', 'THREE_IN_A_BED', 'WHITE_HORSE', 'THREE_IN_THE_BLACK'];
  const awardMap: Record<string, Record<string, number>> = {
    'Clarence Yeo WG': { HAT_TRICK: 29, THREE_IN_A_BED: 2, THREE_IN_THE_BLACK: 1 },
    'Melvin Lee XC':    { HAT_TRICK: 41, HIGH_TON: 1, THREE_IN_A_BED: 1, TON_80: 1 },
    'Tan Li Ting':      { HAT_TRICK: 15, THREE_IN_A_BED: 1 },
    'Ang Keng Yeow':    { HAT_TRICK: 12, WHITE_HORSE: 1 },
    'Wang GuanFei':     { HAT_TRICK: 7, THREE_IN_A_BED: 3, TON_80: 1 },
    'Marcus Tan':       { HAT_TRICK: 1 },
    'Jack Li':          { HAT_TRICK: 9, WHITE_HORSE: 1 },
  };
  localStorage.setItem('darts_awards', JSON.stringify({
    awardMap,
    awardTypes: AWARD_TYPES,
  }));
}