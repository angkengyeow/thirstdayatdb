import { useState, useEffect } from 'react';
import { getPlayers, getPlayerDashboardStats, getPlayerAwardDisplayCounts } from '../store';

interface AwardPin {
  name: string;
  icon: string;
  description: string;
  thresholds: [number, number, number, number];
}

const AWARD_PINS: AwardPin[] = [
  {
    name: 'Hat Trick',
    icon: '🎯',
    description: '3 consecutive bullseyes in a single game',
    thresholds: [2, 10, 23, 30],
  },
  {
    name: 'High Ton',
    icon: '💯',
    description: 'A score of 151–180 in a single throw (01 games)',
    thresholds: [1, 1, 2, 3],
  },
  {
    name: 'Ton 80',
    icon: '🎯',
    description: 'Three triple 20s in a single throw (180)',
    thresholds: [1, 2, 2, 2],
  },
  {
    name: '3 in a Bed',
    icon: '🛏️',
    description: 'Three darts in the same number (any bed)',
    thresholds: [1, 2, 3, 4],
  },
  {
    name: 'White Horse',
    icon: '🐴',
    description: 'Three different triples in Cricket',
    thresholds: [1, 1, 1, 3],
  },
  {
    name: '3 in the Black',
    icon: '⚫',
    description: 'Three darts in the bullseye (inner or outer)',
    thresholds: [1, 1, 1, 1],
  },
];

const RATING_BRACKETS = [
  { label: '1 – 5.99', min: 1, max: 5.99 },
  { label: '6 – 9.99', min: 6, max: 9.99 },
  { label: '10 – 14.99', min: 10, max: 14.99 },
  { label: '15 – 18', min: 15, max: 18 },
];

function estimateBracketIndex(liveRating: number): number {
  if (liveRating === 0) return -1;
  if (liveRating < 6) return 0;
  if (liveRating < 10) return 1;
  if (liveRating < 15) return 2;
  return 3;
}

const BRACKET_COLORS = ['bg-[#150d40]', 'bg-cyan-400/10', 'bg-cyan-400/20', 'bg-cyan-400/30'];

function clockedCount(awards: Record<string, number>, bracketIdx: number): number {
  let clocked = 0;
  for (const pin of AWARD_PINS) {
    const actual = awards[pin.name] || 0;
    const threshold = pin.thresholds[bracketIdx];
    if (actual >= threshold) clocked++;
  }
  return clocked;
}

export default function AwardsPage() {
  const [players] = useState(() => getPlayerDashboardStats());
  const allPlayers = getPlayers();
  const hasData = allPlayers.length > 0;
  const [awardData, setAwardData] = useState<{ playerName: string; awards: Record<string, number> }[]>([]);

  useEffect(() => {
    setAwardData(getPlayerAwardDisplayCounts());
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e8e0f4]">Award Pins</h1>
        <p className="text-sm text-[#5a4a8a] mt-0.5">Track achievements and bracket milestones</p>
      </div>

      {/* Info banner */}
      <div className="bg-cyan-400/[0.06] border border-cyan-400/30 rounded-xl p-4 mb-8 text-sm">
        <p className="font-medium text-cyan-400 mb-1">How it works</p>
        <p className="text-[#8a7aaa]">
          Award pins are earned based on your final DARTSLIVE Rating at the end of the season.
          Each bracket requires a certain number of achievements to earn the pin.
          The table below shows actual achievements tracked per match from DartsLive.
        </p>
      </div>

      {/* Pin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {AWARD_PINS.map(pin => (
          <div key={pin.name} className="glass-card rounded-xl p-5 hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/5 hover:scale-[1.02] transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{pin.icon}</span>
              <div>
                <h3 className="font-semibold text-[#e8e0f4]">{pin.name}</h3>
                <p className="text-xs text-[#5a4a8a]">{pin.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              {RATING_BRACKETS.map((b, i) => (
                <div key={i} className={`${BRACKET_COLORS[i]} rounded p-1.5`}>
                  <p className="font-bold text-[#e8e0f4]">{pin.thresholds[i]}</p>
                  <p className="text-[#5a4a8a] mt-0.5">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actual award achievements */}
      {hasData && (
        <div className="glass-card rounded-xl p-6 mb-8 overflow-x-auto">
          <h2 className="text-lg font-semibold text-[#e8e0f4] mb-4 flex items-center gap-2"><span className="w-1 h-5 bg-[#00e5ff] rounded-full inline-block shadow-[0_0_6px_rgba(0,229,255,0.4)]" />Awards Achieved by Player</h2>
          <p className="text-xs text-[#5a4a8a] mb-4">
            Real achievement counts tracked from each match. ✓ = met the bracket threshold.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#150d40] text-[#5a4a8a]">
                <th className="pb-3 font-medium text-left">Player</th>
                <th className="pb-3 font-medium text-center">DartsLive Rt.</th>
                <th className="pb-3 font-medium text-center">Bracket</th>
                {AWARD_PINS.map(pin => (
                  <th key={pin.name} className="pb-3 font-medium text-center" title={`${pin.name}: ${pin.description}`}>{pin.icon}</th>
                ))}
                <th className="pb-3 font-medium text-center">Clocked</th>
              </tr>
            </thead>
            <tbody>
              {[...players]
                .filter(p => p.liveRating > 0)
                .sort((a, b) => b.liveRating - a.liveRating)
                .map(p => {
                  const bracketIdx = estimateBracketIndex(p.liveRating);
                  const playerAwards = awardData.find(a => a.playerName === p.player.name)?.awards || {};
                  return (
                    <tr key={p.player.id} className="border-b border-[#150d40] hover:bg-[#100a30]">
                      <td className="py-2.5 font-medium text-[#e8e0f4]">{p.player.name}</td>
                      <td className="py-2.5 text-center font-mono text-[#b8aad8]">{p.liveRating.toFixed(2)}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${BRACKET_COLORS[bracketIdx]} text-[#e8e0f4]`}>
                          {RATING_BRACKETS[bracketIdx].label}
                        </span>
                      </td>
                      {AWARD_PINS.map(pin => {
                        const actual = playerAwards[pin.name] || 0;
                        const threshold = pin.thresholds[bracketIdx];
                        const achieved = actual >= threshold;
                        return (
                          <td key={pin.name} className="py-2.5 text-center">
                            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                              achieved
                                ? 'text-dart-green bg-dart-green/15'
                                : actual > 0
                                  ? 'text-cyan-400 bg-cyan-400/15'
                                  : 'text-[#3a2a6a]'
                            }`}>
                              {achieved ? `✓${actual}` : actual > 0 ? `${actual}/${threshold}` : '0'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 text-center">
                        <span className="text-sm font-bold text-cyan-400">
                          {clockedCount(playerAwards, bracketIdx)}/{AWARD_PINS.length}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="text-xs text-[#5a4a8a] mt-3">
            ✓ = achieved (met bracket threshold). x/y = earned vs threshold. 0 = none recorded. Load live data to populate.
          </p>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#150d40] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#5a4a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <p className="text-lg text-[#5a4a8a]">Load data from DartsLive to see player awards</p>
        </div>
      )}
    </div>
  );
}