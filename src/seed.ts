import type { Player, Session, GamePerformance, GameFormat, GameFormatCategory } from './types';
import { deriveRating } from './store';

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
  // First game: won 6-4 away against GOTTaWinThemAllAgain
  { date: '2026-02-12', opponent: 'GOTTaWinThemAllAgain',  isHome: false, homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  // Remaining schedule from DartsLive match data
  { date: '2026-02-26', opponent: 'iDarts(SAFRA YISHUN)',  isHome: true,  homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  { date: '2026-03-05', opponent: 'Heng @ G.U.T.S',        isHome: false, homeScore: 9, awayScore: 0, homeBonus: 1, awayBonus: 0 },
  { date: '2026-03-12', opponent: 'OBar - Alpha',           isHome: true,  homeScore: 1, awayScore: 8, homeBonus: 0, awayBonus: 1 },
  { date: '2026-03-19', opponent: 'Divinities.神將 @GVC',   isHome: false, homeScore: 1, awayScore: 8, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-09', opponent: 'Good Cheer @ Stadium',   isHome: true,  homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-16', opponent: 'Katana Defenders @ F5',  isHome: false, homeScore: 2, awayScore: 7, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-23', opponent: 'Yeti @ Shinjyu',         isHome: false, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-05-07', opponent: 'Good Cheer @ Stadium',   isHome: true,  homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-05-14', opponent: 'GOTTaWinThemAllAgain',   isHome: false, homeScore: 2, awayScore: 7, homeBonus: 0, awayBonus: 1 },
  { date: '2026-05-28', opponent: 'OBar - Alpha',           isHome: false, homeScore: 7, awayScore: 2, homeBonus: 1, awayBonus: 0 },
  { date: '2026-06-04', opponent: 'Good Vibes Club',        isHome: true,  homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-06-11', opponent: 'CHAOS Primordial',       isHome: false, homeScore: 3, awayScore: 6, homeBonus: 0, awayBonus: 1 },
  { date: '2026-06-18', opponent: 'Forest 5',               isHome: true,  homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-06-18', opponent: 'Yeti @ Shinjyu',         isHome: false, homeScore: 0, awayScore: 0, homeBonus: 0, awayBonus: 0 },
];

/**
 * Super League game definitions matching LineupPage.tsx.
 * 19 total player-game slots across 9 games.
 */
const GAME_DEFS: { gameId: number; gameType: GameFormat; format: GameFormatCategory; playerCount: number }[] = [
  { gameId: 1, gameType: 'singles', format: '01', playerCount: 1 },
  { gameId: 2, gameType: 'singles', format: 'mixed', playerCount: 1 },
  { gameId: 3, gameType: 'doubles', format: 'mixed', playerCount: 2 },
  { gameId: 4, gameType: 'doubles', format: 'mixed', playerCount: 2 },
  { gameId: 5, gameType: 'doubles', format: 'cricket', playerCount: 2 },
  { gameId: 6, gameType: 'doubles', format: 'half-it', playerCount: 2 },
  { gameId: 7, gameType: 'doubles', format: 'mixed', playerCount: 2 },
  { gameId: 8, gameType: 'trios', format: 'mixed', playerCount: 3 },
  { gameId: 9, gameType: 'team', format: '01', playerCount: 4 },
];

/**
 * Distribute 19 player-game slots across 7 players by index.
 * Higher-rated players get more games.
 * Returns [playerIndex][] for games G1-G9 (flat list, 19 entries).
 */
function getGameLineup(): number[] {
  // Player indices 0-6 (Clarence=0, Melvin=1, Tan Li Ting=2, etc.)
  // Balanced rotation giving top players more appearances
  const assignments: number[][] = [
    [0],          // G1: Clarence
    [1],          // G2: Melvin
    [0, 2],      // G3: Clarence + Tan Li Ting
    [1, 3],      // G4: Melvin + Ang Keng Yeow
    [0, 4],      // G5: Clarence + Wang GuanFei
    [2, 5],      // G6: Tan Li Ting + Jack Li
    [3, 6],      // G7: Ang Keng Yeow + Marcus Tan
    [1, 2, 4],   // G8: Melvin + Tan Li Ting + Wang GuanFei
    [2, 3, 5, 6], // G9: Tan Li Ting + Ang Keng Yeow + Jack Li + Marcus Tan
  ];
  // Flatten
  return assignments.flat();
}

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

    // How many of the 9 games Thirstday actually won
    const gamesWonByThirstday = m.isHome ? m.homeScore : m.awayScore; // 0-9

    // Skill-weighted win distribution — stronger players are more likely to win
    const lineup = getGameLineup();
    // Compute weight per game based on average player skill (deriveRating from 01 avg)
    const gameWeights = GAME_DEFS.map((def, gi) => {
      let totalSkill = 0;
      let slotStart = 0;
      for (let g = 0; g < gi; g++) slotStart += GAME_DEFS[g].playerCount;
      for (let s = 0; s < def.playerCount; s++) {
        const pIdx = lineup[slotStart + s];
        totalSkill += deriveRating(playerData[pIdx][3]);
      }
      return totalSkill / def.playerCount; // average skill rating of players in this game
    });

    // Weighted selection: games with stronger Thirstday players more likely to be wins
    const gameResults: boolean[] = new Array(9).fill(false);
    const winPositions = new Set<number>();
    while (winPositions.size < gamesWonByThirstday) {
      // Weighted random pick among remaining losing positions
      const candidates: { idx: number; weight: number }[] = [];
      for (let i = 0; i < 9; i++) {
        if (!gameResults[i]) candidates.push({ idx: i, weight: gameWeights[i] });
      }
      const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
      let r = Math.random() * totalWeight;
      for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) {
          winPositions.add(c.idx);
          gameResults[c.idx] = true;
          break;
        }
      }
    }
    let slotIdx = 0;

    GAME_DEFS.forEach((gameDef, gi) => {
      const isGameWin = gameResults[gi];

      for (let si = 0; si < gameDef.playerCount; si++) {
        const pIdx = lineup[slotIdx];
        const player = players[pIdx];
        const pd = playerData[pIdx];

        // Add some variance to per-game stats (within ±10% of player average)
        const variance = () => 0.9 + Math.random() * 0.2;
        const stats01 = gameDef.format === '01' || gameDef.format === 'mixed'
          ? Math.round(pd[3] * variance() * 100) / 100
          : undefined;
        const statsCricket = gameDef.format === 'cricket' || gameDef.format === 'mixed'
          ? Math.round(pd[4] * variance() * 100) / 100
          : undefined;

        allGamePerformances.push({
          id: nextId(),
          playerId: player.id,
          sessionId: session.id,
          gameId: gameDef.gameId,
          gameType: gameDef.gameType,
          format: gameDef.format,
          partnerIds: [], // simplified — no partner tracking in seed
          won: isGameWin,
          legsWon: isGameWin ? Math.round(1 + Math.random() * 2) : 0,
          legsLost: isGameWin ? 0 : Math.round(1 + Math.random() * 2),
          stats01,
          statsCricket,
        });

        slotIdx++;
      }
    });
  });

  localStorage.setItem('darts_players', JSON.stringify(players));
  localStorage.setItem('darts_sessions', JSON.stringify(sessions));
  localStorage.setItem('darts_game_performances', JSON.stringify(allGamePerformances));
}