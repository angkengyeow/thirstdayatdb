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

interface ApiGameDetailLegInfo {
  playerName: string;
}

interface ApiGameDetailTeamInfo {
  legInfoList: ApiGameDetailLegInfo[];
  legResult?: string;
  setScore?: string;
}

interface ApiGameDetailEntry {
  homeTeamLegInfo: ApiGameDetailTeamInfo;
  awayTeamLegInfo: ApiGameDetailTeamInfo;
}

interface ApiGameResult {
  gameName: string;
  gameResultDetailInfoList: ApiGameDetailEntry[];
  gameType?: string;
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
  gameResultInfoList?: ApiGameResult[];
  awardAccomplisherList?: {
    awardType: string;
    displayName: string;
    accomplisherList: { playerName: string; count: number }[];
  }[];
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

export interface LiveMatchGameResult {
  gameId: number;
  gameName: string;
  homeLegs: number;
  awayLegs: number;
  homePlayers: string[];
  awayPlayers: string[];
  thirstdayWon: boolean;
}

export interface LiveMatchAward {
  awardType: string;
  displayName: string;
  counts: { playerName: string; count: number }[];
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
  games: LiveMatchGameResult[];
  awards: LiveMatchAward[];
}

export interface LiveData {
  matches: LiveMatchResult[];
  players: { name: string; stats01Avg: number; statsCricketAvg: number; totalPoints: number; totalWins: number; totalLosses: number; totalWinRate: string; liveRating: number }[];
  fetchedAt: string;
}

/** Thirstday@DB Rt. values from DartsLive (2026-06-12) — fallback when API unavailable */
const FALLBACK_RT: Record<string, number> = {
  'Clarence Yeo WG': 13.11,
  'Melvin Lee XC': 12.42,
  'Tan Li Ting': 12.28,
  'Ang Keng Yeow': 12.17,
  'Wang GuanFei': 11.82,
  'Marcus Tan': 11.30,
  'Jack Li': 9.99,
};

/** Try fetching team member Rt. values from DartsLive API endpoints */
async function fetchTeamRatings(leagueId: string, divisionId: string): Promise<Map<string, number>> {
  const endpoints = [
    `/sg/teamDetail?li=${leagueId}&di=${divisionId}`,
    `/sg/teamMemberList?li=${leagueId}&di=${divisionId}`,
    `/sg/getTeamMemberAllRank?li=${leagueId}&di=${divisionId}`,
    `/sg/getMemberList?li=${leagueId}&di=${divisionId}`,
  ];
  for (const ep of endpoints) {
    try {
      const data = await fetchJson<any>(apiUrl(ep));
      const list = data?.memberList || data?.list || data?.teamMembers || data?.players || (Array.isArray(data) ? data : null);
      if (list && Array.isArray(list)) {
        const map = new Map<string, number>();
        for (const m of list) {
          const name = m.playerName || m.name || '';
          const rt = parseFloat(m.rating || m.rt || m.rtRating || m.rankScore || m.totalScore || '0');
          if (name && rt > 0) map.set(name, rt);
        }
        if (map.size > 0) return map;
      }
    } catch {
      continue;
    }
  }
  // API unavailable — use known Rt. values from DartsLive as fallback
  return new Map(Object.entries(FALLBACK_RT));
}

export async function fetchLiveData(): Promise<LiveData> {
  const rtMap = await fetchTeamRatings(LEAGUE_ID, DIVISION_ID);
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

      // Team appears under different names depending on venue:
      // "Thirstday@DB" (home) or "DB @ BEATTY" (away)
      const isOurTeam = (name?: string) =>
        !!(name?.includes('Thirstday') || name?.includes('BEATTY'));
      const isThirstdayHome = isOurTeam(data.homeTeamInfo?.teamName);
      const isThirstdayAway = isOurTeam(data.awayTeamInfo?.teamName);
      if (!isThirstdayHome && !isThirstdayAway) continue;

      // Parse per-game results from gameResultInfoList
      const games: LiveMatchGameResult[] = [];
      const gameResultList = data.gameResultInfoList || [];
      for (const g of gameResultList) {
        const details = g.gameResultDetailInfoList || [];
        let homeLegsWon = 0;
        let awayLegsWon = 0;
        let homePlayers: string[] = [];
        let awayPlayers: string[] = [];

        for (const d of details) {
          const hi = d.homeTeamLegInfo || {};
          const ai = d.awayTeamLegInfo || {};
          const hp = (hi.legInfoList || [])
            .map(p => p.playerName)
            .filter(Boolean);
          const ap = (ai.legInfoList || [])
            .map(p => p.playerName)
            .filter(Boolean);
          if (hp.length > 0) homePlayers = hp;
          if (ap.length > 0) awayPlayers = ap;
          if (hi.legResult === 'WIN') homeLegsWon++;
          if (ai.legResult === 'WIN') awayLegsWon++;
        }

        const gameNumMatch = g.gameName?.match(/(\d+)/);
        const gameId = gameNumMatch ? parseInt(gameNumMatch[1], 10) : games.length + 1;
        const thirstdayWon = isThirstdayHome
          ? homeLegsWon > awayLegsWon
          : awayLegsWon > homeLegsWon;

        games.push({
          gameId,
          gameName: g.gameName || '',
          homeLegs: homeLegsWon,
          awayLegs: awayLegsWon,
          homePlayers,
          awayPlayers,
          thirstdayWon,
        });
      }

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
          .filter(p => isOurTeam(p.teamName))
          .map(p => ({
            name: p.playerName,
            point: p.point,
            stats01: parseFloat(p.stats01) || 0,
            statsCricket: parseFloat(p.statsCricket) || 0,
            winCount: p.winCount,
            loseCount: p.loseCount,
            winRate: p.winRate,
          })),
        games,
        awards: (data.awardAccomplisherList || []).map(a => ({
          awardType: a.awardType,
          displayName: a.displayName,
          counts: (a.accomplisherList || []).map(c => ({
            playerName: c.playerName,
            count: c.count,
          })),
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
      liveRating: rtMap.get(p.name) || 0,
    }))
    .sort((a, b) => (b.liveRating || b.totalPoints) - (a.liveRating || a.totalPoints));

  return {
    matches: matchResults.sort((a, b) => a.matchDate.localeCompare(b.matchDate)),
    players,
    fetchedAt: new Date().toISOString(),
  };
}