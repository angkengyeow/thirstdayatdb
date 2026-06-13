import { useState, useEffect } from 'react';
import { getSessions, getPlayers, saveResponse, generateId } from '../store';
import type { Session, Player, AttendanceStatus } from '../types';

function getSessionIdFromUrl(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/[?&]session=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const STATUS_OPTIONS: { status: AttendanceStatus; label: string; emoji: string }[] = [
  { status: 'on-time', label: 'Yes', emoji: '✅' },
  { status: 'late', label: 'Late', emoji: '⏰' },
  { status: 'absent', label: 'No', emoji: '❌' },
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center font-body" style={{
          boxShadow: '0 10px 30px rgba(212, 175, 55, 0.10), 0 4px 8px rgba(0,0,0,0.04)',
          border: '1px solid rgba(212, 175, 55, 0.10)',
        }}>
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-[#1E293B] mb-2 font-display tracking-tight">Invalid Link</h1>
          <p className="text-[#94A3B8] text-sm">
            This attendance link isn't valid. Ask your captain to send a new one.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-6 btn-gold"
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center font-body" style={{
          boxShadow: '0 10px 30px rgba(212, 175, 55, 0.10), 0 4px 8px rgba(0,0,0,0.04)',
          border: '1px solid rgba(212, 175, 55, 0.10)',
        }}>
          <div className="text-5xl mb-4" style={{ color: '#059669' }}>✓</div>
          <h1 className="text-xl font-bold text-[#1E293B] mb-2 font-display tracking-tight">Got it, {player?.name}!</h1>
          <p className="text-[#94A3B8] text-sm mb-6">
            Your attendance has been recorded for <strong className="text-[#1E293B]">{session?.date}</strong>.
          </p>
          <p className="text-xs text-[#CBD5E1] mb-4">
            You can close this page.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="btn-gold"
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="text-[#94A3B8] text-lg flex items-center gap-3 font-body">
          <div
            className="w-5 h-5 rounded-full animate-spin"
            style={{ border: '2px solid rgba(212, 175, 55, 0.2)', borderTopColor: '#D4AF37' }}
          />
          Loading...
        </div>
      </div>
    );
  }

  const sessionType = session.type === 'match' ? '🏆 Match' : '🎯 Practice';
  const note = session.notes ? ` — ${session.notes}` : '';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center p-4 pt-12">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full font-body" style={{
        boxShadow: '0 10px 30px rgba(212, 175, 55, 0.10), 0 4px 8px rgba(0,0,0,0.04)',
        border: '1px solid rgba(212, 175, 55, 0.10)',
      }}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{session.type === 'match' ? '🏆' : '🎯'}</div>
          <h1 className="text-xl font-bold text-[#1E293B] font-display tracking-tight">{sessionType}</h1>
          <p className="text-[#94A3B8] text-sm">{session.date}{note}</p>
        </div>

        {!selectedPlayer ? (
          <>
            <p className="text-sm text-[#64748B] text-center mb-4">Who are you?</p>
            <div className="space-y-2">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p.id)}
                  className="w-full p-3 rounded-xl transition-colors text-left flex items-center gap-3"
                  style={{
                    border: '1px solid #E2E8F0',
                    background: 'white',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{
                    background: 'rgba(212,175,55,0.15)',
                    color: '#B8942E',
                  }}>
                    {p.name.charAt(0)}
                  </div>
                  <span className="font-medium text-[#1E293B]">{p.name}</span>
                  <span className="ml-auto text-[#94A3B8] text-sm">Tap →</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-[#94A3B8] mb-1">You are</p>
              <p className="text-lg font-bold text-[#1E293B]">
                {players.find(p => p.id === selectedPlayer)?.name}
              </p>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-xs mt-1"
                style={{ color: '#B8942E' }}
                onMouseEnter={e => e.currentTarget.style.color = '#D4AF37'}
                onMouseLeave={e => e.currentTarget.style.color = '#B8942E'}
              >
                Not you? Tap here
              </button>
            </div>
            <p className="text-sm text-[#64748B] text-center mb-4">What's your status?</p>

            <div className="space-y-3">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.status}
                  onClick={() => handleSubmit(opt.status)}
                  className="w-full p-4 rounded-xl text-white font-semibold text-lg transition-all active:scale-95 shadow-sm"
                  style={{ backgroundColor: opt.status === 'late' ? '#f59e0b' : opt.status === 'on-time' ? '#10b981' : '#ef4444' }}
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