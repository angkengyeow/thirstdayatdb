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

const BRACKET_COLORS = ['bg-gold-100', 'bg-gold-100', 'bg-gold-200', 'bg-gold-200'];

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
        <h1 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">Award Pins</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5 font-body">Track achievements and bracket milestones</p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl p-4 mb-8 text-sm font-body" style={{
        background: 'rgba(212, 175, 55, 0.06)',
        border: '1px solid rgba(212, 175, 55, 0.2)',
      }}>
        <p className="font-medium mb-1" style={{ color: '#B8942E' }}>How it works</p>
        <p className="text-[#64748B]">
          Award pins are earned based on your final DARTSLIVE Rating at the end of the season.
          Each bracket requires a certain number of achievements to earn the pin.
          The table below shows actual achievements tracked per match from DartsLive.
        </p>
      </div>

      {/* Pin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {AWARD_PINS.map(pin => (
          <div
            key={pin.name}
            className="glass-card rounded-xl p-5 transition-all duration-200 hover:scale-[1.02]"
            style={{ borderColor: 'rgba(212, 175, 55, 0.15)', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.08), 0 2px 4px rgba(0,0,0,0.03)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{pin.icon}</span>
              <div>
                <h3 className="font-semibold text-[#1E293B] font-body">{pin.name}</h3>
                <p className="text-xs text-[#94A3B8] font-body">{pin.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center text-xs font-body">
              {RATING_BRACKETS.map((b, i) => (
                <div key={i} className={`${BRACKET_COLORS[i]} rounded p-1.5`} style={{ border: '1px solid rgba(212,175,55,0.1)' }}>
                  <p className="font-bold text-[#1E293B]">{pin.thresholds[i]}</p>
                  <p className="text-[#94A3B8] mt-0.5">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actual award achievements */}
      {hasData && (
        <div className="glass-card rounded-xl p-6 mb-8 overflow-x-auto">
          <h2 className="text-base font-semibold text-[#1E293B] mb-4 font-display tracking-tight flex items-center gap-2">
            <span className="w-1 h-5 rounded-full inline-block" style={{ background: 'linear-gradient(180deg, #D4AF37, #E8C872)', boxShadow: '0 0 6px rgba(212, 175, 55, 0.3)' }} />
            Awards Achieved by Player
          </h2>
          <p className="text-xs text-[#94A3B8] mb-4 font-body">
            Real achievement counts tracked from each match. ✓ = met the bracket threshold.
          </p>
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-[10px] text-[#94A3B8] uppercase tracking-[0.08em]" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th className="pb-3 font-semibold text-left font-body">Player</th>
                <th className="pb-3 font-semibold text-center font-body">DartsLive Rt.</th>
                <th className="pb-3 font-semibold text-center font-body">Bracket</th>
                {AWARD_PINS.map(pin => (
                  <th key={pin.name} className="pb-3 font-semibold text-center font-body" title={`${pin.name}: ${pin.description}`}>{pin.icon}</th>
                ))}
                <th className="pb-3 font-semibold text-center font-body">Clocked</th>
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
                    <tr key={p.player.id} className="transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="py-2.5 font-medium text-[#1E293B] font-body">{p.player.name}</td>
                      <td className="py-2.5 text-center font-mono text-[#64748B] font-body">{p.liveRating.toFixed(2)}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-xs font-bold px-2 py-1 rounded-full font-body" style={{ background: 'rgba(212,175,55,0.12)', color: '#B8942E', border: '1px solid rgba(212,175,55,0.2)' }}>
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
                                ? 'text-[#059669]'
                                : actual > 0
                                  ? 'text-[#B8942E]'
                                  : 'text-[#CBD5E1]'
                            }`} style={{
                              background: achieved ? 'rgba(5,150,105,0.10)' : actual > 0 ? 'rgba(212,175,55,0.10)' : 'transparent',
                            }}>
                              {achieved ? `✓${actual}` : actual > 0 ? `${actual}/${threshold}` : '0'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 text-center">
                        <span className="text-sm font-bold font-body" style={{ color: '#B8942E' }}>
                          {clockedCount(playerAwards, bracketIdx)}/{AWARD_PINS.length}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="text-xs text-[#94A3B8] mt-3 font-body">
            ✓ = achieved (met bracket threshold). x/y = earned vs threshold. 0 = none recorded. Load live data to populate.
          </p>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-12">
          <p className="text-lg text-[#94A3B8] font-body">Load data from DartsLive to see player awards</p>
        </div>
      )}
    </div>
  );
}