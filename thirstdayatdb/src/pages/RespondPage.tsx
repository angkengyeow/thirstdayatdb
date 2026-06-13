import { useState, useEffect } from 'react';
import { getSessions, getPlayers, saveResponse, generateId } from '../store';
import type { Session, Player, AttendanceStatus } from '../types';

function getSessionIdFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/[?&]session=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const STATUS_OPTIONS: { status: AttendanceStatus; label: string; emoji: string; color: string }[] = [
  { status: 'on-time', label: 'On Time', emoji: '✅', color: 'bg-dart-green hover:bg-[#059669]' },
  { status: 'late', label: 'Late', emoji: '⏰', color: 'bg-gold-400 hover:bg-gold-300' },
  { status: 'absent', label: 'Absent', emoji: '❌', color: 'bg-dart-red hover:bg-[#dc2626]' },
  { status: 'excused', label: 'Excused', emoji: '🙏', color: 'bg-[#6b6b8a] hover:bg-[#5a5a7a]' },
];

export default function RespondPage({ onBackToApp }: { onBackToApp?: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sessionId = getSessionIdFromUrl();
    if (!sessionId) {
      setError(true);
      return;
    }
    const sessions = getSessions();
    const found = sessions.find(s => s.id === sessionId);
    if (!found) {
      setError(true);
      return;
    }
    setSession(found);
    setPlayers(getPlayers());
  }, []);

  function handleSubmit(status: AttendanceStatus) {
    if (!selectedPlayer || !session) return;
    const player = players.find(p => p.id === selectedPlayer);
    if (!player) return;

    saveResponse({
      id: generateId(),
      playerId: selectedPlayer,
      playerName: player.name,
      sessionId: session.id,
      status,
      respondedAt: new Date().toISOString(),
      method: 'link',
    });
    setSubmitted(true);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4">
        <div className="bg-[#111122] rounded-2xl border border-[#1c1c34] p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-[#eeeef4] mb-2">Invalid Link</h1>
          <p className="text-[#6b6b8a] text-sm">
            This attendance link isn't valid. Ask your captain to send a new one.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-6 px-4 py-2 bg-gold-400 text-[#0d0d1a] rounded-lg hover:bg-gold-300 transition-colors text-sm font-medium shadow-lg shadow-gold-400/20"
            >
              ← Back to App
            </button>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    const player = players.find(p => p.id === selectedPlayer);
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4">
        <div className="bg-[#111122] rounded-2xl border border-[#1c1c34] p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4 text-dart-green">✓</div>
          <h1 className="text-xl font-bold text-[#eeeef4] mb-2">Got it, {player?.name}!</h1>
          <p className="text-[#6b6b8a] text-sm mb-6">
            Your attendance has been recorded for <strong className="text-[#eeeef4]">{session?.date}</strong>.
          </p>
          <p className="text-xs text-[#6b6b8a] mb-4">
            You can close this page.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-4 py-2 bg-gold-400 text-[#0d0d1a] rounded-lg hover:bg-gold-300 transition-colors text-sm font-medium shadow-lg shadow-gold-400/20"
            >
              ← Back to App
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center p-4">
        <div className="text-[#6b6b8a] text-lg flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  const sessionType = session.type === 'match' ? '🏆 Match' : '🎯 Practice';
  const note = session.notes ? ` — ${session.notes}` : '';

  return (
    <div className="min-h-screen bg-[#06060f] flex items-start justify-center p-4 pt-12">
      <div className="bg-[#111122] rounded-2xl border border-[#1c1c34] p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{session.type === 'match' ? '🏆' : '🎯'}</div>
          <h1 className="text-xl font-bold text-[#eeeef4]">{sessionType}</h1>
          <p className="text-[#6b6b8a] text-sm">{session.date}{note}</p>
        </div>

        {!selectedPlayer ? (
          <>
            <p className="text-sm text-[#9e9eb4] text-center mb-4">Who are you?</p>
            <div className="space-y-2">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p.id)}
                  className="w-full p-3 rounded-xl border border-[#1c1c34] hover:border-gold-400/50 hover:bg-gold-400/[0.04] transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gold-400/20 text-gold-400 flex items-center justify-center font-bold text-sm">
                    {p.name.charAt(0)}
                  </div>
                  <span className="font-medium text-[#eeeef4]">{p.name}</span>
                  <span className="ml-auto text-[#6b6b8a] text-sm">Tap →</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-[#6b6b8a] mb-1">You are</p>
              <p className="text-lg font-bold text-[#eeeef4]">
                {players.find(p => p.id === selectedPlayer)?.name}
              </p>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-xs text-gold-400 hover:text-gold-300 mt-1"
              >
                Not you? Tap here
              </button>
            </div>
            <p className="text-sm text-[#9e9eb4] text-center mb-4">What's your status?</p>

            <div className="space-y-3">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.status}
                  onClick={() => handleSubmit(opt.status)}
                  className="w-full p-4 rounded-xl text-white font-semibold text-lg transition-all active:scale-95 shadow-sm"
                  style={{ backgroundColor: opt.status === 'late' ? '#f59e0b' : opt.status === 'on-time' ? '#10b981' : opt.status === 'absent' ? '#ef4444' : '#6b6b8a' }}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}