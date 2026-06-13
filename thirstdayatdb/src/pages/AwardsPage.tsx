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

const BRACKET_COLORS = ['bg-[#1c1c34]', 'bg-gold-400/10', 'bg-gold-400/20', 'bg-gold-400/30'];

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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#eeeef4] mb-6">Award Pins</h1>

      {/* Info banner */}
      <div className="bg-gold-400/[0.06] border border-gold-400/30 rounded-xl p-4 mb-8 text-sm">
        <p className="font-medium text-gold-400 mb-1">How it works</p>
        <p className="text-[#9e9eb4]">
          Award pins are earned based on your final DARTSLIVE Rating at the end of the season.
          Each bracket requires a certain number of achievements to earn the pin.
          The table below shows actual achievements tracked per match from DartsLive.
        </p>
      </div>

      {/* Pin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {AWARD_PINS.map(pin => (
          <div key={pin.name} className="bg-[#111122] rounded-xl border border-[#1c1c34] p-5 hover:border-gold-400/30 transition-colors duration-200">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{pin.icon}</span>
              <div>
                <h3 className="font-semibold text-[#eeeef4]">{pin.name}</h3>
                <p className="text-xs text-[#6b6b8a]">{pin.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              {RATING_BRACKETS.map((b, i) => (
                <div key={i} className={`${BRACKET_COLORS[i]} rounded p-1.5`}>
                  <p className="font-bold text-[#eeeef4]">{pin.thresholds[i]}</p>
                  <p className="text-[#6b6b8a] mt-0.5">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actual award achievements */}
      {hasData && (
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-6 mb-8 overflow-x-auto">
          <h2 className="text-lg font-semibold text-[#eeeef4] mb-4">Awards Achieved by Player</h2>
          <p className="text-xs text-[#6b6b8a] mb-4">
            Real achievement counts tracked from each match. ✓ = met the bracket threshold.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c1c34] text-[#6b6b8a]">
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
                    <tr key={p.player.id} className="border-b border-[#1c1c34] hover:bg-[#16162a]">
                      <td className="py-2.5 font-medium text-[#eeeef4]">{p.player.name}</td>
                      <td className="py-2.5 text-center font-mono text-[#c8c8d8]">{p.liveRating.toFixed(2)}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${BRACKET_COLORS[bracketIdx]} text-[#eeeef4]`}>
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
                                  ? 'text-gold-400 bg-gold-400/15'
                                  : 'text-[#2e2e52]'
                            }`}>
                              {achieved ? `✓${actual}` : actual > 0 ? `${actual}/${threshold}` : '0'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 text-center">
                        <span className="text-sm font-bold text-gold-400">
                          {clockedCount(playerAwards, bracketIdx)}/{AWARD_PINS.length}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="text-xs text-[#6b6b8a] mt-3">
            ✓ = achieved (met bracket threshold). x/y = earned vs threshold. 0 = none recorded. Load live data to populate.
          </p>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-12">
          <p className="text-lg text-[#6b6b8a]">Load data from DartsLive to see player awards</p>
        </div>
      )}
    </div>
  );
}