import { useState, useEffect, useCallback } from 'react';
import {
  getUpcomingSessions,
  getSessionAttendanceOverview,
  getResponseCounts,
  saveAttendanceRecord,
  saveResponse,
  buildResponseLink,
  getPlayers,
  generateId,
} from '../store';
import type { Session, AttendanceStatus } from '../types';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string; border: string }> = {
  'on-time': { label: 'Yes', bg: 'rgba(5,150,105,0.10)', text: '#059669', border: 'rgba(5,150,105,0.2)' },
  late: { label: 'Late', bg: 'rgba(212,175,55,0.10)', text: '#B8942E', border: 'rgba(212,175,55,0.2)' },
  absent: { label: 'No', bg: 'rgba(220,38,38,0.10)', text: '#DC2626', border: 'rgba(220,38,38,0.2)' },
};

interface AttendancePageProps {
  onNavigateToLineup?: (date: string) => void;
}

export default function AttendancePage({ onNavigateToLineup }: AttendancePageProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setSessions(getUpcomingSessions());
  }, []);

  useEffect(() => {
    refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const overview = selectedSessionId ? getSessionAttendanceOverview(selectedSessionId) : [];
  const counts = selectedSessionId ? getResponseCounts(selectedSessionId) : null;
  const responseLink = selectedSessionId ? buildResponseLink(selectedSessionId) : '';

  function handleCopyLink() {
    if (!responseLink) return;
    navigator.clipboard.writeText(responseLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleWhatsAppShare() {
    if (!selectedSession) return;
    const sessionType = selectedSession.type === 'match' ? '🏆 Match' : '🎯 Practice';
    const msg = encodeURIComponent(
      `[Captain Liting (Virtual)] ${sessionType} on ${selectedSession.date}${selectedSession.notes ? ` — ${selectedSession.notes}` : ''}\n\nPlease respond with your attendance:\n${responseLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  const [lateMinutes, setLateMinutes] = useState<Record<string, number>>({});

  function handleManualAttendance(playerId: string, status: AttendanceStatus) {
    if (!selectedSessionId) return;

    saveAttendanceRecord({
      id: generateId(),
      playerId,
      sessionId: selectedSessionId,
      status,
      lateMinutes: status === 'late' ? (lateMinutes[playerId] || 0) : undefined,
    });

    const player = getPlayers().find(p => p.id === playerId);
    if (player) {
      saveResponse({
        id: generateId(),
        playerId,
        playerName: player.name,
        sessionId: selectedSessionId,
        status,
        respondedAt: new Date().toISOString(),
        method: 'manual',
      });
    }

    setRefreshKey(k => k + 1);
  }

  function canPlay(status: AttendanceStatus | null): boolean {
    return status === 'on-time' || status === 'late';
  }

  const availableCount = overview.filter(p => canPlay(p.actualStatus)).length;
  const hasEnoughPlayers = availableCount >= 4;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display tracking-tight text-[#1E293B]">Attendance</h1>
          <p className="text-sm text-[#94A3B8] mt-1 font-body">Broadcast, capture responses, and plan the lineup</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-[#94A3B8] font-body text-lg mb-2">No upcoming sessions</p>
          <p className="text-[#94A3B8] text-sm font-body">Create a match or practice session first, then come back here to manage attendance.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors font-body"
                style={selectedSessionId === s.id ? {
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(232,200,114,0.08))',
                  color: '#B8942E',
                  border: '1px solid rgba(212,175,55,0.25)',
                } : {
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#94A3B8',
                }}
              >
                <span className="mr-1">{s.type === 'match' ? '🏆' : '🎯'}</span>
                {s.date}
                {s.notes && <span className="ml-1 opacity-70">· {s.notes.replace(/\(.*?\)/, '').trim()}</span>}
              </button>
            ))}
          </div>

          {selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Left column */}
              <div className="lg:col-span-1 space-y-4">
                {/* Session Card */}
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{selectedSession.type === 'match' ? '🏆' : '🎯'}</span>
                    <div>
                      <h2 className="font-semibold text-[#1E293B] font-body">{selectedSession.type === 'match' ? 'Match' : 'Practice'}</h2>
                      <p className="text-sm text-[#94A3B8] font-body">{selectedSession.date}</p>
                    </div>
                  </div>
                  {selectedSession.notes && (
                    <p className="text-sm text-[#64748B] font-body rounded-lg p-2 font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>{selectedSession.notes}</p>
                  )}
                </div>

                {/* Broadcast Card */}
                <div className="glass-card rounded-xl p-5">
                  <h3 className="font-semibold text-[#1E293B] mb-3 font-body">Broadcast</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg p-3 font-body" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <p className="text-xs text-[#94A3B8] mb-1 font-body">Response Link</p>
                      <p className="text-xs break-all font-body" style={{ color: '#B8942E' }}>{responseLink}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors font-body"
                        style={copied ? { background: 'rgba(5,150,105,0.10)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' } : { background: '#F8FAFC', color: '#B8942E', border: '1px solid #E2E8F0' }}
                      >
                        {copied ? '✓ Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={handleWhatsAppShare}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors font-body"
                        style={{ background: 'rgba(5,150,105,0.10)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}
                      >
                        Share via WhatsApp
                      </button>
                    </div>
                    <p className="text-xs text-[#94A3B8] font-body">
                      Share the link with players so they can confirm their attendance.
                    </p>
                  </div>
                </div>

                {/* Response Summary */}
                {counts && (
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="font-semibold text-[#1E293B] mb-3 font-body">Response Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#64748B] font-body">Responded</span>
                        <span className="text-sm font-semibold text-[#1E293B] font-body">{counts.responded} / {counts.total}</span>
                      </div>
                      <div className="w-full rounded-full h-2 font-body" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${counts.total > 0 ? (counts.responded / counts.total) * 100 : 0}%`, background: 'linear-gradient(90deg, rgba(212,175,55,0.5), #D4AF37)' }}
                        />
                      </div>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-xs font-body">
                          <span style={{ color: '#059669' }}>✓ On Time</span>
                          <span className="font-medium text-[#64748B] font-body">{counts.confirmedOnTime}</span>
                        </div>
                        <div className="flex justify-between text-xs font-body">
                          <span style={{ color: '#B8942E' }}>⏰ Late</span>
                          <span className="font-medium text-[#64748B] font-body">{counts.confirmedLate}</span>
                        </div>
                        <div className="flex justify-between text-xs font-body">
                          <span style={{ color: '#DC2626' }}>✗ Absent</span>
                          <span className="font-medium text-[#64748B] font-body">{counts.confirmedAbsent}</span>
                        </div>
                        </div>
                      <div className="pt-2 mt-2 font-body" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <div className="flex justify-between text-sm font-medium font-body">
                          <span style={{ color: '#B8942E' }}>Available to play</span>
                          <span className={hasEnoughPlayers ? 'text-[#059669]' : 'text-[#DC2626]'}>
                            {availableCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Plan Lineup */}
                {onNavigateToLineup && (
                  <button
                    onClick={() => onNavigateToLineup(selectedSession.date)}
                    className="btn-gold w-full"
                  >
                    Plan Lineup for {selectedSession.date}
                  </button>
                )}
              </div>

              {/* Right column */}
              <div className="lg:col-span-2">
                <div className="glass-card rounded-xl overflow-hidden">
                  <div className="p-5 font-body" style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <h3 className="font-semibold text-[#1E293B] font-body">Player Responses</h3>
                    <p className="text-xs text-[#94A3B8] mt-1 font-body">
                      Green = responded. Tap a status badge to manually override for a player.
                    </p>
                  </div>

                  {overview.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-[#94A3B8] font-body">No players in the roster</p>
                    </div>
                  ) : (
                    <div>
                      {overview.map(entry => {
                        const isConfirmed = !!entry.actualStatus;

                        return (
                          <div key={entry.player.id} className="p-4 transition-colors font-body" style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-body ${
                                  isConfirmed ? 'text-white' : ''
                                }`} style={{
                                  background: isConfirmed ? 'linear-gradient(135deg, #D4AF37, #E8C872)' : '#F1F5F9',
                                  color: isConfirmed ? '#FFFFFF' : '#94A3B8',
                                }}>
                                  {entry.player.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-[#1E293B] font-body">{entry.player.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {entry.response ? (
                                      <span className="text-xs font-body" style={{ color: '#059669' }}>Responded {new Date(entry.response.respondedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    ) : (
                                      <span className="text-xs text-[#94A3B8] font-body">
                                        Predicted: <PredictedBadge status={entry.predictedStatus} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {(['on-time', 'late', 'absent'] as AttendanceStatus[]).map(s => {
                                  const isActive = entry.actualStatus === s;
                                  const colors = STATUS_CONFIG[s];
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => handleManualAttendance(entry.player.id, s)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all font-body"
                                      style={isActive ? {
                                        background: colors.bg,
                                        color: colors.text,
                                        border: `1px solid ${colors.border}`,
                                      } : {
                                        color: '#94A3B8',
                                        border: '1px solid #E2E8F0',
                                        background: 'transparent',
                                      }}
                                    >
                                      {s === 'on-time' ? '✓' : s === 'late' ? '⏰' : '✗'}
                                      <span className="ml-1 hidden sm:inline">{STATUS_CONFIG[s].label}</span>
                                    </button>
                                  );
                                })}
                                {entry.actualStatus === 'late' && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      max={120}
                                      placeholder="min"
                                      value={lateMinutes[entry.player.id] || ''}
                                      onChange={e => setLateMinutes(prev => ({ ...prev, [entry.player.id]: parseInt(e.target.value) || 0 }))}
                                      className="w-14 text-xs px-1.5 py-1 rounded-lg text-center font-body"
                                      style={{ background: '#F8FAFC', border: '1px solid rgba(212,175,55,0.2)', color: '#B8942E' }}
                                    />
                                    <span className="text-[10px] text-[#94A3B8] font-body">min</span>
                                  </div>
                                )}

                                <span
                                  className="w-2 h-2 rounded-full ml-1"
                                  style={{
                                    background: entry.hasResponded || entry.actualStatus ? '#059669' : '#CBD5E1',
                                  }}
                                  title={entry.hasResponded || entry.actualStatus ? 'Responded' : 'Pending'}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Attendance Summary Bar */}
                <div className="mt-4 glass-card rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm font-body">
                    <span className="text-[#64748B] font-medium font-body">Lineup availability:</span>
                    {hasEnoughPlayers ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium font-body" style={{ background: 'rgba(5,150,105,0.10)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
                        {availableCount} players available — enough for a lineup
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium font-body" style={{ background: 'rgba(220,38,38,0.10)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                        Only {availableCount} available — need at least 4
                      </span>
                    )}
                                      </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PredictedBadge({ status }: { status: AttendanceStatus }) {
  const colors: Record<AttendanceStatus, string> = {
    'on-time': '#059669',
    late: '#B8942E',
    absent: '#DC2626',
  };
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-body" style={{
      background: `${colors[status]}15`,
      color: colors[status],
    }}>
      {status}
    </span>
  );
}