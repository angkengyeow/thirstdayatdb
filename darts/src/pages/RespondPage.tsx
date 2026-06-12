import { useState, useEffect } from 'react';
import { getSessions, getPlayers, saveResponse, generateId } from '../store';
import type { Session, Player, AttendanceStatus } from '../types';

function getSessionIdFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/[?&]session=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const STATUS_OPTIONS: { status: AttendanceStatus; label: string; emoji: string; color: string }[] = [
  { status: 'on-time', label: 'On Time', emoji: '✅', color: 'bg-green-500 hover:bg-green-600' },
  { status: 'late', label: 'Late', emoji: '⏰', color: 'bg-amber-500 hover:bg-amber-600' },
  { status: 'absent', label: 'Absent', emoji: '❌', color: 'bg-red-500 hover:bg-red-600' },
  { status: 'excused', label: 'Excused', emoji: '🙏', color: 'bg-gray-500 hover:bg-gray-600' },
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h1>
          <p className="text-gray-500 text-sm">
            This attendance link isn't valid. Ask your captain to send a new one.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              ← Back to App
            </button>
          )}
        </div>
      </div>
    );
  }

  // Submitted confirmation
  if (submitted) {
    const player = players.find(p => p.id === selectedPlayer);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Got it, {player?.name}!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your attendance has been recorded for <strong>{session?.date}</strong>.
          </p>
          <p className="text-xs text-gray-400 mb-4">
            You can close this page.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              ← Back to App
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  const sessionType = session.type === 'match' ? '🏆 Match' : '🎯 Practice';
  const note = session.notes ? ` — ${session.notes}` : '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{session.type === 'match' ? '🏆' : '🎯'}</div>
          <h1 className="text-xl font-bold text-gray-800">{sessionType}</h1>
          <p className="text-gray-500 text-sm">{session.date}{note}</p>
        </div>

        {/* Player Selection */}
        {!selectedPlayer ? (
          <>
            <p className="text-sm text-gray-600 text-center mb-4">Who are you?</p>
            <div className="space-y-2">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p.id)}
                  className="w-full p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    {p.name.charAt(0)}
                  </div>
                  <span className="font-medium text-gray-800">{p.name}</span>
                  <span className="ml-auto text-gray-400 text-sm">Tap →</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500 mb-1">You are</p>
              <p className="text-lg font-bold text-gray-800">
                {players.find(p => p.id === selectedPlayer)?.name}
              </p>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-xs text-indigo-600 hover:text-indigo-800 mt-1"
              >
                Not you? Tap here
              </button>
            </div>
            <p className="text-sm text-gray-600 text-center mb-4">What's your status?</p>

            <div className="space-y-3">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.status}
                  onClick={() => handleSubmit(opt.status)}
                  className={`w-full p-4 rounded-xl text-white font-semibold text-lg transition-all active:scale-95 shadow-sm ${opt.color}`}
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