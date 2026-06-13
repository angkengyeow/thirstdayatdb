import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────
interface CheckoutEntry {
  player: number;
  score: number;
  darts: number;
  description: string;
}

interface LegHistory {
  player1Score: number;
  player2Score: number;
  winner: 1 | 2 | null;
}

// ─── Constants ───────────────────────────────────────────
const DART_VALUES = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const MULTIPLIERS = ['S', 'D', 'T'] as const;
const LEGS_TOTAL = 11;

const CHECKOUTS_2_DART: Record<number, string> = {
  170: 'T20 T20 Bull',
  167: 'T20 T19 Bull',
  164: 'T20 T18 Bull',
  161: 'T20 T17 Bull',
  160: 'T20 T20 D20',
  158: 'T20 T20 D19',
  157: 'T20 T19 D20',
  156: 'T20 T20 D18',
  155: 'T20 T19 D19',
  154: 'T20 T18 D20',
  153: 'T20 T19 D18',
  152: 'T20 T20 D16',
  151: 'T20 T17 D20',
  150: 'T20 T18 D18',
  149: 'T20 T19 D16',
  148: 'T20 T20 D14',
  147: 'T20 T17 D18',
  146: 'T20 T18 D16',
  145: 'T20 T15 D20',
  144: 'T20 T20 D12',
  143: 'T20 T17 D16',
  142: 'T20 T14 D20',
  141: 'T20 T19 D12',
};

const CHECKOUTS_3_DART: Record<number, string> = {
  170: 'T20 T20 Bull',
  167: 'T20 T19 Bull',
  164: 'T20 T18 Bull',
  161: 'T20 T17 Bull',
  160: 'T20 T20 D20',
  158: 'T20 T20 D19',
  157: 'T20 T19 D20',
  156: 'T20 T20 D18',
  155: 'T20 T19 D19',
  154: 'T20 T18 D20',
  153: 'T20 T19 D18',
  152: 'T20 T20 D16',
  151: 'T20 T17 D20',
  150: 'T20 T18 D18',
  149: 'T20 T19 D16',
  148: 'T20 T20 D14',
  147: 'T20 T17 D18',
  146: 'T20 T18 D16',
  145: 'T20 T15 D20',
  144: 'T20 T20 D12',
  143: 'T20 T17 D16',
  142: 'T20 T14 D20',
  141: 'T20 T19 D12',
  140: 'T20 T20 D10',
  139: 'T20 T13 D20',
  138: 'T20 T18 D12',
  137: 'T20 T15 D16',
  136: 'T20 T20 D8',
  135: 'T20 T17 D12',
  134: 'T20 T14 D16',
  133: 'T20 T19 D8',
  132: 'T20 T18 D6',
  131: 'T20 T13 D10',
  130: 'T20 T18 D8',
  129: 'T19 T16 D12',
  128: 'T18 T14 D16',
  127: 'T20 T17 D8',
  126: 'T19 T15 D12',
  125: 'T20 T19 D4',
  124: 'T20 T16 D8',
  123: 'T19 T16 D9',
  122: 'T18 T20 D4',
  121: 'T20 T11 D14',
  120: 'T20 20 D20',
  119: 'T20 19 D11',
  118: 'T20 18 D10',
  117: 'T20 17 D10',
  116: 'T20 16 D10',
  115: 'T20 15 D10',
  114: 'T20 14 D10',
  113: 'T20 13 D10',
  112: 'T20 12 D10',
  111: 'T20 11 D10',
  110: 'T20 10 D10',
  109: 'T20 9 D10',
  108: 'T20 8 D10',
  107: 'T19 10 D10',
  106: 'T20 6 D10',
  105: 'T19 8 D10',
  104: 'T18 10 D10',
  103: 'T20 3 D10',
  102: 'T20 2 D10',
  101: 'T17 10 D10',
  100: 'T20 D20',
  99: 'T19 10 D16',
  98: 'T20 D19',
  97: 'T19 D20',
  96: 'T20 D18',
  95: 'T19 D19',
  94: 'T18 D20',
  93: 'T19 D18',
  92: 'T20 D16',
  91: 'T17 D20',
  90: 'T18 D18',
  89: 'T19 D16',
  88: 'T16 D20',
  87: 'T17 D18',
  86: 'T18 D16',
  85: 'T15 D20',
  84: 'T20 D12',
  83: 'T17 D16',
  82: 'Bull D16',
  81: 'T19 D12',
  80: 'T20 D10',
  79: 'T19 D11',
  78: 'T18 D12',
  77: 'T19 D10',
  76: 'T20 D8',
  75: 'T19 D9',
  74: 'T14 D16',
  73: 'T19 D8',
  72: 'T16 D12',
  71: 'T13 D16',
  70: 'T20 D5',
  69: 'T15 D12',
  68: 'T16 D10',
  67: 'T17 D8',
  66: 'T14 D12',
  65: 'T15 D10',
  64: 'T16 D8',
  63: 'T13 D12',
  62: 'T10 D16',
  61: 'T15 D8',
  60: '20 D20',
  59: '19 D20',
  58: '18 D20',
  57: '17 D20',
  56: '16 D20',
  55: '15 D20',
  54: '14 D20',
  53: '13 D20',
  52: '12 D20',
  51: '11 D20',
  50: '10 D20',
  49: '9 D20',
  48: '8 D20',
  47: '7 D20',
  46: '6 D20',
  45: '13 D16',
  44: '12 D16',
  43: '11 D16',
  42: '10 D16',
  41: '9 D16',
  40: 'D20',
  39: 'D19 R1',
  38: 'D19',
  37: 'D18 R1',
  36: 'D18',
  35: 'D16 R3',
  34: 'D17',
  33: 'D16 R1',
  32: 'D16',
  31: 'D14 R3',
  30: 'D15',
  29: 'D10 R9',
  28: 'D14',
  27: 'D10 R7',
  26: 'D13',
  25: 'D10 R5',
  24: 'D12',
  23: 'D10 R3',
  22: 'D11',
  21: 'D10 R1',
  20: 'D10',
  19: 'D8 R3',
  18: 'D9',
  17: 'D6 R5',
  16: 'D8',
  15: 'D4 R7',
  14: 'D7',
  13: 'D4 R5',
  12: 'D6',
  11: 'D4 R3',
  10: 'D5',
  9: 'D2 R5',
  8: 'D4',
  7: 'D2 R3',
  6: 'D3',
  5: 'D1 R3',
  4: 'D2',
  3: 'D1 R1',
  2: 'D1',
};

function findCheckout(score: number): string | null {
  return CHECKOUTS_3_DART[score] || CHECKOUTS_2_DART[score] || null;
}

// ─── Sub-Components ──────────────────────────────────────

function Keypad({ onInput, onClear, onUndo }: {
  onInput: (val: number) => void;
  onClear: () => void;
  onUndo: () => void;
}) {
  const keys = [
    [7, 8, 9],
    [4, 5, 6],
    [1, 2, 3],
    [0, null, 'C'],
  ];

  return (
    <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto w-full">
      {keys.flat().map((key, i) => {
        if (key === null) return <div key={i} />;
        return (
          <button
            key={i}
            onClick={() => key === 'C' ? onClear() : onInput(key as number)}
            className="h-14 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e] text-white text-xl font-bold
                       active:bg-[#2a2a3e] active:scale-95 transition-all duration-100
                       shadow-lg shadow-black/20"
          >
            {key === 'C' ? (
              <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            ) : key}
          </button>
        );
      })}
      <button
        onClick={onUndo}
        className="col-span-3 h-11 rounded-xl bg-[#1a1a2e]/60 border border-[#2a2a3e]/50 text-[#6b6b8a] text-xs font-medium
                   active:bg-[#1a1a2e] active:scale-[0.98] transition-all duration-100 flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
        </svg>
        Undo Throw
      </button>
    </div>
  );
}

function DartScoreButton({ label, description, color, onClick }: {
  label: string;
  description: string;
  color: 'green' | 'gold';
  onClick: () => void;
}) {
  const colors = {
    green: 'bg-[#00e676]/10 border-[#00e676]/25 text-[#00e676] active:bg-[#00e676]/20',
    gold: 'bg-[#f59e0b]/10 border-[#f59e0b]/25 text-[#f59e0b] active:bg-[#f59e0b]/20',
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 h-12 rounded-xl border ${colors[color]} font-medium
                 active:scale-95 transition-all duration-100 text-center leading-tight`}
    >
      <span className="text-sm block">{label}</span>
      <span className="text-[9px] opacity-70 block">{description}</span>
    </button>
  );
}

function DartValueGrid({ onSelect }: { onSelect: (value: number, multiplier: string) => void }) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedMultiplier, setSelectedMultiplier] = useState<string | null>(null);

  const handleDartSubmit = useCallback(() => {
    if (selectedNumber === null || selectedMultiplier === null) return;
    const multiplierValue = selectedMultiplier === 'S' ? 1 : selectedMultiplier === 'D' ? 2 : 3;
    onSelect(selectedNumber, String(selectedNumber * multiplierValue));
    setSelectedNumber(null);
    setSelectedMultiplier(null);
  }, [selectedNumber, selectedMultiplier, onSelect]);

  return (
    <div className="max-w-[280px] mx-auto w-full space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {DART_VALUES.map(n => (
          <button
            key={n}
            onClick={() => setSelectedNumber(n)}
            className={`h-9 rounded-lg text-xs font-bold transition-all duration-100 border ${
              selectedNumber === n
                ? 'bg-[#00e676] text-black border-[#00e676] shadow-lg shadow-[#00e676]/20'
                : 'bg-[#1a1a2e] text-[#c8c8d8] border-[#2a2a3e] active:bg-[#2a2a3e]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MULTIPLIERS.map(m => (
          <button
            key={m}
            onClick={() => setSelectedMultiplier(m)}
            className={`h-9 rounded-lg text-xs font-bold transition-all duration-100 border ${
              selectedMultiplier === m
                ? 'bg-[#00e676] text-black border-[#00e676]'
                : 'bg-[#1a1a2e] text-[#c8c8d8] border-[#2a2a3e] active:bg-[#2a2a3e]'
            }`}
          >
            {m === 'S' ? 'Single' : m === 'D' ? 'Double' : 'Triple'}
          </button>
        ))}
      </div>
      <button
        onClick={handleDartSubmit}
        disabled={selectedNumber === null || selectedMultiplier === null}
        className="w-full h-10 rounded-xl bg-[#00e676] text-black font-bold text-sm
                   disabled:opacity-30 disabled:cursor-not-allowed
                   active:scale-[0.98] transition-all duration-100 shadow-lg shadow-[#00e676]/20"
      >
        Score This Dart
      </button>
    </div>
  );
}

// ─── Animated Score Display ──────────────────────────────
function AnimatedScore({ score, label, isActive, checkoutHint }: {
  score: number;
  label: string;
  isActive: boolean;
  checkoutHint: string | null;
}) {
  const prevScoreRef = useRef(score);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (prevScoreRef.current !== score) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 300);
      prevScoreRef.current = score;
      return () => clearTimeout(timer);
    }
  }, [score]);

  return (
    <div className={`flex-1 flex flex-col items-center justify-center py-4 px-2 transition-all duration-300 ${
      isActive ? 'opacity-100' : 'opacity-40'
    }`}>
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#6b6b8a] font-medium mb-1">{label}</span>
      <div className={`font-display text-6xl sm:text-7xl leading-none tracking-tight transition-all duration-200 ${
        animate ? 'scale-110 text-[#00e676]' : 'text-white'
      }`}>
        {score}
      </div>
      {checkoutHint && score <= 170 && score > 0 && (
        <div className="mt-2 animate-fade-in">
          <span className="text-[9px] bg-[#00e676]/10 text-[#00e676] px-2 py-0.5 rounded-full border border-[#00e676]/20 font-mono">
            {checkoutHint}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Dart Throw Visualizer ───────────────────────────────
function DartBoardTarget({ score, active }: { score: number; active: boolean }) {
  const segments = [
    { label: 'Bull', color: score >= 170 ? 'bg-[#00e676]' : 'bg-[#2a2a3e]' },
    { label: 'T20', color: score >= 180 ? 'bg-[#00e676]' : 'bg-[#2a2a3e]' },
    { label: 'T19', color: score >= 171 ? 'bg-[#00e676]' : 'bg-[#2a2a3e]' },
    { label: 'D20', color: score >= 160 ? 'bg-[#00e676]' : 'bg-[#2a2a3e]' },
  ];

  if (!active) return null;

  return (
    <div className="flex items-center gap-2 justify-center mt-2 mb-1">
      {segments.map(s => (
        <span key={s.label} className={`w-2 h-2 rounded-full ${s.color} transition-colors duration-300`} title={s.label} />
      ))}
      <span className="text-[8px] text-[#6b6b8a] tracking-wide">TARGET</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
const STARTING_SCORE = 501;

export default function LiveScoringSheet() {
  const [player1Name] = useState('Player 1');
  const [player2Name] = useState('Player 2');
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [scores, setScores] = useState({ 1: STARTING_SCORE, 2: STARTING_SCORE });
  const [currentLeg, setCurrentLeg] = useState(1);
  const [legsWon, setLegsWon] = useState({ 1: 0, 2: 0 });
  const [legHistory, setLegHistory] = useState<LegHistory[]>([]);
  const [recentThrows, setRecentThrows] = useState<{ player: 1 | 2; score: number; bust: boolean }[]>([]);
  const [dartEntryMode, setDartEntryMode] = useState<'keypad' | 'dartboard'>('keypad');
  const [inputBuffer, setInputBuffer] = useState('');
  const [undoStack, setUndoStack] = useState<{ player: 1 | 2; prevScore: number }[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrateText, setCelebrateText] = useState('');

  const otherPlayer = currentPlayer === 1 ? 2 : 1;

  // ─── Apply a score to current player ────────────────────
  const applyThrow = useCallback((rawScore: number) => {
    const currentScore = scores[currentPlayer];
    const newScore = currentScore - rawScore;

    if (newScore < 0) {
      // Bust!
      setRecentThrows(prev => [{ player: currentPlayer, score: rawScore, bust: true }, ...prev].slice(0, 10));
      setUndoStack(prev => [{ player: currentPlayer, prevScore: currentScore }, ...prev]);
      setCurrentPlayer(otherPlayer);
      return;
    }

    if (newScore === 0) {
      // Checkout!
      setRecentThrows(prev => [{ player: currentPlayer, score: rawScore, bust: false }, ...prev].slice(0, 10));
      setScores(prev => ({ ...prev, [currentPlayer]: 0 }));
      setUndoStack(prev => [{ player: currentPlayer, prevScore: currentScore }, ...prev]);

      // Update leg tracking
      const newLegsWon = { ...legsWon, [currentPlayer]: legsWon[currentPlayer] + 1 };
      setLegsWon(newLegsWon);
      setLegHistory(prev => [...prev, {
        player1Score: currentPlayer === 1 ? 0 : scores[1] - (scores[1]),
        player2Score: currentPlayer === 2 ? 0 : scores[2] - (scores[2]),
        winner: currentPlayer,
      }]);

      setCelebrateText(`${currentPlayer === 1 ? player1Name : player2Name} takes the leg!`);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);

      if (currentLeg < LEGS_TOTAL && newLegsWon[currentPlayer] < Math.ceil(LEGS_TOTAL / 2)) {
        setTimeout(() => {
          setScores({ 1: STARTING_SCORE, 2: STARTING_SCORE });
          setCurrentLeg(prev => prev + 1);
          // Player who lost throws first next leg
          setCurrentPlayer(otherPlayer);
        }, 1500);
      } else if (newLegsWon[currentPlayer] >= Math.ceil(LEGS_TOTAL / 2)) {
        setCelebrateText(`🏆 ${currentPlayer === 1 ? player1Name : player2Name} wins the match! 🏆`);
        setShowCelebration(true);
      }
      return;
    }

    // Normal throw
    setScores(prev => ({ ...prev, [currentPlayer]: newScore }));
    setRecentThrows(prev => [{ player: currentPlayer, score: rawScore, bust: false }, ...prev].slice(0, 10));
    setUndoStack(prev => [{ player: currentPlayer, prevScore: currentScore }, ...prev]);
    setCurrentPlayer(otherPlayer);
  }, [scores, currentPlayer, otherPlayer, legsWon, currentLeg, player1Name, player2Name]);

  const handleKeypadInput = useCallback((val: number) => {
    setInputBuffer(prev => {
      const next = prev + String(val);
      const num = parseInt(next, 10);
      if (num > 180) return prev; // Max score in darts is 180
      return next;
    });
  }, []);

  const handleKeypadClear = useCallback(() => {
    setInputBuffer('');
  }, []);

  const handleKeypadSubmit = useCallback(() => {
    if (!inputBuffer) return;
    const score = parseInt(inputBuffer, 10);
    if (score < 1 || score > 180) return;
    applyThrow(score);
    setInputBuffer('');
  }, [inputBuffer, applyThrow]);

  const handleQuickScore = useCallback((score: number) => {
    applyThrow(score);
  }, [applyThrow]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[0];
    setUndoStack(prev => prev.slice(1));
    setScores(prev => ({ ...prev, [last.player]: last.prevScore }));
    setCurrentPlayer(last.player);
    setRecentThrows(prev => prev.slice(1));
  }, [undoStack]);

  const handleDartValueSelect = useCallback((number: number, scoreString: string) => {
    const score = parseInt(scoreString, 10);
    applyThrow(score);
  }, [applyThrow]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleKeypadSubmit();
        return;
      }
      if (e.key === 'Backspace') {
        handleKeypadClear();
        return;
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 0 && num <= 9) {
        handleKeypadInput(num);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKeypadInput, handleKeypadClear, handleKeypadSubmit]);

  // Checkout hints for both players
  const p1Checkout = scores[1] <= 170 && scores[1] > 0 ? findCheckout(scores[1]) : null;
  const p2Checkout = scores[2] <= 170 && scores[2] > 0 ? findCheckout(scores[2]) : null;

  const inputScore = parseInt(inputBuffer, 10) || 0;
  const isValidInput = inputScore >= 1 && inputScore <= 180 && inputScore <= scores[currentPlayer];
  const invalidReason = inputScore > 180 ? 'Max 180' : inputScore > scores[currentPlayer] ? 'Bust!' : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white flex flex-col max-w-lg mx-auto relative overflow-hidden">
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="text-center">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-2xl font-bold text-[#00e676]">{celebrateText}</p>
          </div>
        </div>
      )}

      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00e676]/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#00e676]/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* ─── Status Bar ─────────────────────────────────── */}
      <div className="relative z-10 px-4 pt-3 pb-2">
        <div className="bg-[#111122]/80 backdrop-blur-md rounded-3xl border border-[#1c1c34]/80 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse shadow-lg shadow-[#00e676]/30" />
            <span className="text-xs text-[#c8c8d8] truncate font-medium">
              {player1Name} vs {player2Name}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#6b6b8a]">LEG</span>
              <span className="text-xs font-bold text-[#00e676]">{currentLeg}/{LEGS_TOTAL}</span>
            </div>
            <span className="text-[#2a2a3e]">|</span>
            <div className="flex items-center gap-1 text-[10px] font-medium">
              <span className="text-white">{legsWon[1]}</span>
              <span className="text-[#6b6b8a]">-</span>
              <span className="text-white">{legsWon[2]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Score Display ───────────────────────────────── */}
      <div className="relative z-10 px-4 flex-1 flex flex-col">
        <div className="bg-[#111122]/60 rounded-3xl border border-[#1c1c34]/60 overflow-hidden">
          {/* Player 1 Score */}
          <div
            onClick={() => { if (!showCelebration) setCurrentPlayer(1); }}
            className={`cursor-pointer transition-all duration-300 relative ${
              currentPlayer === 1 ? 'bg-[#00e676]/[0.03]' : ''
            }`}
          >
            <AnimatedScore
              score={scores[1]}
              label={player1Name.toUpperCase()}
              isActive={currentPlayer === 1}
              checkoutHint={p1Checkout}
            />
            <DartBoardTarget score={scores[1]} active={currentPlayer === 1} />
            {currentPlayer === 1 && (
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#00e676] rounded-full shadow-lg shadow-[#00e676]/30 animate-pulse" />
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#2a2a3e] to-transparent mx-4" />

          {/* Player 2 Score */}
          <div
            onClick={() => { if (!showCelebration) setCurrentPlayer(2); }}
            className={`cursor-pointer transition-all duration-300 relative ${
              currentPlayer === 2 ? 'bg-[#00e676]/[0.03]' : ''
            }`}
          >
            <AnimatedScore
              score={scores[2]}
              label={player2Name.toUpperCase()}
              isActive={currentPlayer === 2}
              checkoutHint={p2Checkout}
            />
            <DartBoardTarget score={scores[2]} active={currentPlayer === 2} />
            {currentPlayer === 2 && (
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#00e676] rounded-full shadow-lg shadow-[#00e676]/30 animate-pulse" />
            )}
          </div>
        </div>

        {/* ─── Input Section ─────────────────────────────── */}
        <div className="mt-4 space-y-3 pb-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setDartEntryMode('keypad')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                dartEntryMode === 'keypad'
                  ? 'bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30'
                  : 'bg-[#1a1a2e] text-[#6b6b8a] border border-[#2a2a3e]'
              }`}
            >
              Quick Keypad
            </button>
            <button
              onClick={() => setDartEntryMode('dartboard')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                dartEntryMode === 'dartboard'
                  ? 'bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30'
                  : 'bg-[#1a1a2e] text-[#6b6b8a] border border-[#2a2a3e]'
              }`}
            >
              Dartboard Entry
            </button>
          </div>

          {dartEntryMode === 'keypad' ? (
            <>
              {/* Input display */}
              <div className="max-w-[280px] mx-auto w-full">
                <div className="bg-[#111122] rounded-2xl border border-[#1c1c34] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6b6b8a] font-medium uppercase tracking-wider">Score</span>
                    <span className="font-display text-2xl tracking-wide text-white">
                      {inputBuffer || <span className="text-[#3a3a4e]">—</span>}
                    </span>
                  </div>
                  <button
                    onClick={handleKeypadSubmit}
                    disabled={!isValidInput}
                    className="px-4 py-1.5 rounded-xl bg-[#00e676] text-black text-xs font-bold
                               disabled:opacity-30 disabled:cursor-not-allowed
                               active:scale-95 transition-all duration-100"
                  >
                    THROW
                  </button>
                </div>
                {invalidReason && (
                  <p className="text-[#ef4444] text-[10px] mt-1 text-center">{invalidReason}</p>
                )}
              </div>

              {/* Quick-action buttons */}
              <div className="flex gap-2 max-w-[280px] mx-auto w-full">
                <DartScoreButton
                  label="🎯 Hit 180"
                  description="Triple 20 x3"
                  color="gold"
                  onClick={() => handleQuickScore(180)}
                />
                <DartScoreButton
                  label="💯 100+ Ton"
                  description="100-180 scored"
                  color="green"
                  onClick={() => {
                    const ton = Math.min(100 + Math.floor(Math.random() * 41), 180);
                    handleQuickScore(ton);
                  }}
                />
              </div>

              {/* Keypad */}
              <Keypad
                onInput={handleKeypadInput}
                onClear={handleKeypadClear}
                onUndo={handleUndo}
              />
            </>
          ) : (
            <>
              {/* Dartboard-style entry */}
              <p className="text-[10px] text-center text-[#6b6b8a]">Select a number, then a multiplier</p>
              <DartValueGrid onSelect={handleDartValueSelect} />
            </>
          )}

          {/* ─── Recent Throws Log ───────────────────────── */}
          <div className="max-w-[280px] mx-auto w-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] text-[#6b6b8a] uppercase tracking-wider font-medium">Recent Throws</span>
              <div className="flex-1 h-px bg-[#1c1c34]" />
            </div>
            <div className="flex gap-1.5 flex-wrap min-h-[24px]">
              {recentThrows.length === 0 ? (
                <span className="text-[10px] text-[#3a3a4e]">No throws yet</span>
              ) : (
                recentThrows.slice(0, 8).map((t, i) => (
                  <span
                    key={i}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                      t.bust
                        ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
                        : t.score === 180
                          ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                          : 'bg-[#1a1a2e] text-[#c8c8d8] border-[#2a2a3e]'
                    }`}
                  >
                    P{t.player}:{t.score}{t.bust ? '💥' : ''}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* ─── Leg History ───────────────────────────── */}
          {legHistory.length > 0 && (
            <div className="max-w-[280px] mx-auto w-full pt-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] text-[#6b6b8a] uppercase tracking-wider font-medium">Leg History</span>
                <div className="flex-1 h-px bg-[#1c1c34]" />
              </div>
              <div className="flex gap-1">
                {legHistory.map((leg, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
                      leg.winner === 1
                        ? 'bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/30'
                        : 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30'
                    }`}
                    title={`Leg ${i + 1}: P${leg.winner}`}
                  >
                    P{leg.winner}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}