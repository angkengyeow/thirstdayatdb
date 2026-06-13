import { useState } from 'react';
import { getPlayers } from '../store';
import { getPlayerDashboardStats } from '../store';

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

/** Map DartsLive rating to bracket index */
function estimateBracketIndex(liveRating: number): number {
  if (liveRating === 0) return -1; // no rating
  if (liveRating < 6) return 0;    // 1-5.99
  if (liveRating < 10) return 1;   // 6-9.99
  if (liveRating < 15) return 2;   // 10-14.99
  return 3;                         // 15-18
}

const BRACKET_COLORS = ['bg-gray-100', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300'];

export default function AwardsPage() {
  const [players] = useState(() => getPlayerDashboardStats());
  const allPlayers = getPlayers();
  const hasData = allPlayers.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Award Pins</h1>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
        <p className="font-medium mb-1">How it works</p>
        <p>
          Award pins are earned based on your final DARTSLIVE Rating at the end of the season.
          Each bracket requires a certain number of achievements to earn the pin.
          Check your DARTSLIVE card for your exact rating.
        </p>
      </div>

      {/* Pin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {AWARD_PINS.map(pin => (
          <div key={pin.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{pin.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-800">{pin.name}</h3>
                <p className="text-xs text-gray-500">{pin.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs">
              {RATING_BRACKETS.map((b, i) => (
                <div key={i} className={`${BRACKET_COLORS[i]} rounded p-1.5`}>
                  <p className="font-bold text-gray-700">{pin.thresholds[i]}</p>
                  <p className="text-gray-500 mt-0.5">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Thresholds table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Pin Requirements</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-3 font-medium text-left">Award</th>
              <th className="pb-3 font-medium text-center">1 – 5.99</th>
              <th className="pb-3 font-medium text-center">6 – 9.99</th>
              <th className="pb-3 font-medium text-center">10 – 14.99</th>
              <th className="pb-3 font-medium text-center">15 – 18</th>
            </tr>
          </thead>
          <tbody>
            {AWARD_PINS.map(pin => (
              <tr key={pin.name} className="border-b border-gray-100">
                <td className="py-3 font-medium text-gray-800">{pin.name}</td>
                {pin.thresholds.map((t, i) => (
                  <td key={i} className="py-3 text-center font-mono text-gray-700">{t}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Player performance context */}
      {hasData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Player Performance Context</h2>
          <p className="text-xs text-gray-500 mb-4">
            Below is an estimated bracket based on each player's 01 average. Your actual DARTSLIVE Rating may differ — check your card.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-3 font-medium text-left">Player</th>
                <th className="pb-3 font-medium text-center">01 Avg</th>
                <th className="pb-3 font-medium text-center">Cricket Avg</th>
                <th className="pb-3 font-medium text-center">DartsLive Rt.</th>
                <th className="pb-3 font-medium text-center">Est. Rating Bracket</th>
                <th className="pb-3 font-medium text-center">Hat Trick</th>
                <th className="pb-3 font-medium text-center">High Ton</th>
                <th className="pb-3 font-medium text-center">Ton 80</th>
                <th className="pb-3 font-medium text-center">3 in a Bed</th>
                <th className="pb-3 font-medium text-center">White Horse</th>
                <th className="pb-3 font-medium text-center">3 in Black</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const bracketIdx = estimateBracketIndex(p.liveRating);
                const hasRating = bracketIdx >= 0;
                return (
                  <tr key={p.player.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-800">{p.player.name}</td>
                    <td className="py-3 text-center font-mono text-gray-700">{p.stats01Avg > 0 ? p.stats01Avg.toFixed(1) : '-'}</td>
                    <td className="py-3 text-center font-mono text-gray-700">{p.statsCricketAvg > 0 ? p.statsCricketAvg.toFixed(1) : '-'}</td>
                    <td className="py-3 text-center font-mono text-gray-700 font-semibold">{p.liveRating > 0 ? p.liveRating.toFixed(2) : '-'}</td>
                    <td className="py-3 text-center">
                      {hasRating ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${BRACKET_COLORS[bracketIdx]} text-gray-700`}>
                          {RATING_BRACKETS[bracketIdx].label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    {AWARD_PINS.map(pin => (
                      <td key={pin.name} className="py-3 text-center font-mono text-gray-600">
                        {hasRating ? pin.thresholds[bracketIdx] : '-'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Load data from DartsLive to see player brackets</p>
        </div>
      )}
    </div>
  );
}