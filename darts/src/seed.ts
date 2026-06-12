import type { Player, Session } from './types';

function genId(seed: number): string {
  return `seed-${seed}-${Date.now()}`;
}

// Thirstday@DB — official roster from DartsLive ranking page
const playerData: [string, number, string][] = [
  ['Clarence Yeo WG', 9, 'DL 12.92'],
  ['Melvin Lee XC', 8, 'DL 12.31'],
  ['Tan Li Ting', 8, 'DL 12.23'],
  ['Ang Keng Yeow', 8, 'DL 12.04'],
  ['Wang GuanFei', 7, 'DL 11.77'],
  ['Jack Li', 7, 'DL ~11.0'],
  ['Marcus Tan', 7, 'DL 11.30'],
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
  { date: '2026-02-12', opponent: 'GOTTaWinThemAllAgain', isHome: false, homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  { date: '2026-02-26', opponent: 'Heng @ G.U.T.S', isHome: true, homeScore: 9, awayScore: 0, homeBonus: 1, awayBonus: 0 },
  { date: '2026-03-05', opponent: 'OBar - Alpha', isHome: false, homeScore: 1, awayScore: 8, homeBonus: 0, awayBonus: 1 },
  { date: '2026-03-12', opponent: 'Divinities.神將 @GVC', isHome: true, homeScore: 1, awayScore: 8, homeBonus: 0, awayBonus: 1 },
  { date: '2026-03-19', opponent: 'CHAOS Primordial', isHome: false, homeScore: 4, awayScore: 5, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-09', opponent: 'Katana Defenders @ F5', isHome: true, homeScore: 2, awayScore: 7, homeBonus: 0, awayBonus: 1 },
  { date: '2026-04-16', opponent: 'Yeti @ Shinjyu', isHome: true, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-04-23', opponent: 'Heng @ G.U.T.S', isHome: false, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-05-07', opponent: 'GOTTaWinThemAllAgain', isHome: true, homeScore: 2, awayScore: 7, homeBonus: 0, awayBonus: 1 },
  { date: '2026-05-14', opponent: 'OBar - Alpha', isHome: true, homeScore: 7, awayScore: 2, homeBonus: 1, awayBonus: 0 },
  { date: '2026-05-28', opponent: 'Divinities.神將 @GVC', isHome: false, homeScore: 5, awayScore: 4, homeBonus: 1, awayBonus: 0 },
  { date: '2026-06-04', opponent: 'CHAOS Primordial', isHome: true, homeScore: 3, awayScore: 6, homeBonus: 0, awayBonus: 1 },
  { date: '2026-06-11', opponent: 'Katana Defenders @ F5', isHome: false, homeScore: 0, awayScore: 0, homeBonus: 0, awayBonus: 0 },
  { date: '2026-06-18', opponent: 'Yeti @ Shinjyu', isHome: false, homeScore: 0, awayScore: 0, homeBonus: 0, awayBonus: 0 },
];

export function seedDemoData(): void {
  localStorage.removeItem('darts_players');
  localStorage.removeItem('darts_sessions');
  localStorage.removeItem('darts_attendance');
  localStorage.removeItem('darts_performances');
  localStorage.removeItem('darts_game_performances');

  const players: Player[] = playerData.map(([name, rating, notes], i) => ({
    id: genId(i + 1),
    name,
    rating,
    notes,
    createdAt: '2026-02-01T00:00:00.000Z',
  }));

  // Create match sessions only — no fake game performances
  const sessions: Session[] = matchSchedule.map((m, i) => {
    const isWin = m.isHome
      ? (m.homeScore + m.homeBonus) > (m.awayScore + m.awayBonus)
      : (m.awayScore + m.awayBonus) > (m.homeScore + m.homeBonus);
    const result = isWin ? 'W' : 'L';
    const tdScore = m.isHome
      ? `${m.homeScore + m.homeBonus}-${m.awayScore + m.awayBonus}`
      : `${m.awayScore + m.awayBonus}-${m.homeScore + m.homeBonus}`;
    return {
      id: genId(100 + i),
      date: m.date,
      type: 'match' as const,
      notes: `S1 Week ${i + 1} ${m.isHome ? 'vs' : '@'} ${m.opponent} (${result} ${tdScore})`,
      createdAt: `${m.date}T18:00:00.000Z`,
    };
  });

  localStorage.setItem('darts_players', JSON.stringify(players));
  localStorage.setItem('darts_sessions', JSON.stringify(sessions));
}