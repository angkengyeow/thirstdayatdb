/**
 * DartsLive API Scraper
 * Fetches live match data from DartsLive league API via Vite proxy.
 */

const LEAGUE_ID = 'c3cb721a68a2d84e';
const DIVISION_ID = 'c764de3490fc6ea0';

function apiUrl(path: string): string {
  // Use the Vite proxy in dev, direct URL as fallback
  return `/api/dartslive${path}`;
}

interface ApiPlayer {
  rank: number;
  playerName: string;
  teamName: string;
  point: number;
  stats01: string;
  statsCricket: string;
  winCount: number;
  loseCount: number;
  winRate: string;
}

interface ApiMatchData {
  gameMatch: {
    matchDate: string;
    completed: boolean;
    gameInvalid: boolean;
    inProgress: boolean;
  };
  homeTeamInfo: { teamName: string; point: number; bonusPoint: number };
  awayTeamInfo: { teamName: string; point: number; bonusPoint: number };
  gamePlayerPerformanceRrankList: ApiPlayer[];
}

interface ScheduleWeek {
  matchDate: string;
  matchList: { matchNo: string; status: string }[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.startsWith('<!DOCTYPE')) throw new Error('Received HTML instead of JSON');
  return JSON.parse(text);
}

export interface LiveMatchResult {
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
  players: {
    name: string;
    point: number;
    stats01: number;
    statsCricket: number;
    winCount: number;
    loseCount: number;
    winRate: string;
  }[];
}

export interface LiveData {
  matches: LiveMatchResult[];
  players: { name: string; stats01Avg: number; statsCricketAvg: number; totalPoints: number; totalWins: number; totalLosses: number; totalWinRate: string }[];
  fetchedAt: string;
}

export async function fetchLiveData(): Promise<LiveData> {
  // Fetch schedule
  const schedule = await fetchJson<{ scheduleList: ScheduleWeek[] }>(
    apiUrl(`/sg/allSchedule?li=${LEAGUE_ID}&di=${DIVISION_ID}`)
  );

  // Collect completed match numbers
  const allMatchNos: string[] = [];
  for (const week of schedule.scheduleList) {
    for (const match of week.matchList) {
      // Status 2 = completed, 1 = in progress
      if (match.status === '2' || match.status === '1') {
        allMatchNos.push(match.matchNo);
      }
    }
  }

  // Fetch match details
  const matchResults: LiveMatchResult[] = [];
  for (const mn of allMatchNos) {
    try {
      const data = await fetchJson<ApiMatchData>(
        apiUrl(`/game/api?mn=${mn}&li=${LEAGUE_ID}&di=${DIVISION_ID}`)
      );

      const isThirstdayHome = data.homeTeamInfo?.teamName?.includes('Thirstday') ?? false;
      const isThirstdayAway = data.awayTeamInfo?.teamName?.includes('Thirstday') ?? false;
      if (!isThirstdayHome && !isThirstdayAway) continue;

      matchResults.push({
        matchNo: mn,
        matchDate: data.gameMatch?.matchDate || '',
        homeTeamName: data.homeTeamInfo?.teamName || '',
        awayTeamName: data.awayTeamInfo?.teamName || '',
        homeScore: data.homeTeamInfo?.point || 0,
        awayScore: data.awayTeamInfo?.point || 0,
        homeBonus: data.homeTeamInfo?.bonusPoint || 0,
        awayBonus: data.awayTeamInfo?.bonusPoint || 0,
        isThirstdayHome,
        completed: data.gameMatch?.completed || false,
        players: (data.gamePlayerPerformanceRrankList || [])
          .filter(p => p.teamName?.includes('Thirstday'))
          .map(p => ({
            name: p.playerName,
            point: p.point,
            stats01: parseFloat(p.stats01) || 0,
            statsCricket: parseFloat(p.statsCricket) || 0,
            winCount: p.winCount,
            loseCount: p.loseCount,
            winRate: p.winRate,
          })),
      });
    } catch {
      // skip failed match fetches
    }
  }

  // Aggregate per-player stats across all matches
  const playerMap = new Map<string, {
    name: string;
    stats01List: number[];
    statsCricketList: number[];
    totalPoints: number;
    totalWins: number;
    totalLosses: number;
  }>();

  for (const match of matchResults) {
    for (const p of match.players) {
      const existing = playerMap.get(p.name) || {
        name: p.name,
        stats01List: [],
        statsCricketList: [],
        totalPoints: 0,
        totalWins: 0,
        totalLosses: 0,
      };
      existing.totalPoints += p.point;
      existing.totalWins += p.winCount;
      existing.totalLosses += p.loseCount;
      if (p.stats01 > 0) existing.stats01List.push(p.stats01);
      if (p.statsCricket > 0) existing.statsCricketList.push(p.statsCricket);
      playerMap.set(p.name, existing);
    }
  }

  const avg = (list: number[]) =>
    list.length > 0 ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100 : 0;

  const players = Array.from(playerMap.values())
    .map(p => ({
      name: p.name,
      stats01Avg: avg(p.stats01List),
      statsCricketAvg: avg(p.statsCricketList),
      totalPoints: p.totalPoints,
      totalWins: p.totalWins,
      totalLosses: p.totalLosses,
      totalWinRate: p.totalWins + p.totalLosses > 0
        ? Math.round((p.totalWins / (p.totalWins + p.totalLosses)) * 100) + '%'
        : '0%',
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    matches: matchResults.sort((a, b) => a.matchDate.localeCompare(b.matchDate)),
    players,
    fetchedAt: new Date().toISOString(),
  };
}