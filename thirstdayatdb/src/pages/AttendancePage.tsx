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
  'on-time': { label: 'On Time', bg: 'bg-dart-green/20', text: 'text-dart-green', border: 'border-dart-green/30' },
  late: { label: 'Late', bg: 'bg-gold-400/15', text: 'text-gold-400', border: 'border-gold-400/30' },
  absent: { label: 'Absent', bg: 'bg-dart-red/15', text: 'text-dart-red', border: 'border-dart-red/30' },
  excused: { label: 'Excused', bg: 'bg-[#6b6b8a]/15', text: 'text-[#6b6b8a]', border: 'border-[#6b6b8a]/30' },
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

  function handleManualAttendance(playerId: string, status: AttendanceStatus) {
    if (!selectedSessionId) return;

    saveAttendanceRecord({
      id: generateId(),
      playerId,
      sessionId: selectedSessionId,
      status,
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
          <h1 className="text-2xl font-bold text-[#eeeef4]">Attendance</h1>
          <p className="text-sm text-[#6b6b8a] mt-1">Broadcast, capture responses, and plan the lineup</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1c1c34] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#6b6b8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[#6b6b8a] text-lg mb-2">No upcoming sessions</p>
          <p className="text-[#6b6b8a] text-sm">Create a match or practice session first, then come back here to manage attendance.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedSessionId === s.id
                    ? 'bg-gold-400 text-[#0d0d1a] shadow-lg shadow-gold-400/20'
                    : 'bg-[#111122] border border-[#1c1c34] text-[#9e9eb4] hover:border-gold-400/50 hover:text-gold-400'
                }`}
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
                <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-5 hover:border-[#252544] transition-colors duration-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{selectedSession.type === 'match' ? '🏆' : '🎯'}</span>
                    <div>
                      <h2 className="font-semibold text-[#eeeef4]">{selectedSession.type === 'match' ? 'Match' : 'Practice'}</h2>
                      <p className="text-sm text-[#6b6b8a]">{selectedSession.date}</p>
                    </div>
                  </div>
                  {selectedSession.notes && (
                    <p className="text-sm text-[#9e9eb4] bg-[#0d0d1a] rounded-lg p-2 border border-[#1c1c34]">{selectedSession.notes}</p>
                  )}
                </div>

                {/* Broadcast Card */}
                <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-5 hover:border-[#252544] transition-colors duration-200">
                  <h3 className="font-semibold text-[#eeeef4] mb-3">Broadcast</h3>
                  <div className="space-y-3">
                    <div className="bg-[#0d0d1a] rounded-lg p-3 border border-[#1c1c34]">
                      <p className="text-xs text-[#6b6b8a] mb-1">Response Link</p>
                      <p className="text-xs text-gold-400 break-all">{responseLink}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copied
                            ? 'bg-dart-green/20 text-dart-green border border-dart-green/30'
                            : 'bg-[#0d0d1a] text-gold-400 border border-[#2e2e52] hover:bg-[#1c1c34]'
                        }`}
                      >
                        {copied ? '✓ Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={handleWhatsAppShare}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-dart-green/15 text-dart-green border border-dart-green/30 hover:bg-dart-green/25 transition-colors"
                      >
                        Share via WhatsApp
                      </button>
                    </div>
                    <p className="text-xs text-[#6b6b8a]">
                      Share the link with players so they can confirm their attendance.
                    </p>
                  </div>
                </div>

                {/* Response Summary */}
                {counts && (
                  <div className="bg-[#111122] rounded-xl border border-[#1c1c34] p-5 hover:border-[#252544] transition-colors duration-200">
                    <h3 className="font-semibold text-[#eeeef4] mb-3">Response Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-[#9e9eb4]">Responded</span>
                        <span className="text-sm font-semibold text-[#eeeef4]">{counts.responded} / {counts.total}</span>
                      </div>
                      <div className="w-full bg-[#0d0d1a] rounded-full h-2 border border-[#1c1c34]">
                        <div
                          className="bg-gold-400 h-2 rounded-full transition-all"
                          style={{ width: `${counts.total > 0 ? (counts.responded / counts.total) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-dart-green">✓ On Time</span>
                          <span className="font-medium text-[#c8c8d8]">{counts.confirmedOnTime}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gold-400">⏰ Late</span>
                          <span className="font-medium text-[#c8c8d8]">{counts.confirmedLate}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-dart-red">✗ Absent</span>
                          <span className="font-medium text-[#c8c8d8]">{counts.confirmedAbsent}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#6b6b8a]">🙏 Excused</span>
                          <span className="font-medium text-[#c8c8d8]">{counts.confirmedExcused}</span>
                        </div>
                      </div>
                      <div className="border-t border-[#1c1c34] pt-2 mt-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-gold-400">Available to play</span>
                          <span className={hasEnoughPlayers ? 'text-dart-green' : 'text-dart-red'}>
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
                    className="w-full px-4 py-3 bg-gold-400 text-[#0d0d1a] rounded-xl hover:bg-gold-300 transition-colors font-semibold text-sm shadow-lg shadow-gold-400/20"
                  >
                    Plan Lineup for {selectedSession.date}
                  </button>
                )}
              </div>

              {/* Right column */}
              <div className="lg:col-span-2">
                <div className="bg-[#111122] rounded-xl border border-[#1c1c34] overflow-hidden hover:border-[#252544] transition-colors duration-200">
                  <div className="p-5 border-b border-[#1c1c34]">
                    <h3 className="font-semibold text-[#eeeef4]">Player Responses</h3>
                    <p className="text-xs text-[#6b6b8a] mt-1">
                      Green = responded. Tap a status badge to manually override for a player.
                    </p>
                  </div>

                  {overview.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-[#6b6b8a]">No players in the roster</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1c1c34]">
                      {overview.map(entry => {
                        const isConfirmed = !!entry.actualStatus;

                        return (
                          <div key={entry.player.id} className="p-4 hover:bg-[#16162a] transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                  isConfirmed ? 'bg-gold-400/20 text-gold-400' : 'bg-[#1c1c34] text-[#6b6b8a]'
                                }`}>
                                  {entry.player.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-[#eeeef4]">{entry.player.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {entry.response ? (
                                      <span className="text-xs text-dart-green">Responded {new Date(entry.response.respondedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    ) : (
                                      <span className="text-xs text-[#6b6b8a]">
                                        Predicted: <PredictedBadge status={entry.predictedStatus} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {(['on-time', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(s => {
                                  const isActive = entry.actualStatus === s;
                                  const colors = STATUS_CONFIG[s];
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => handleManualAttendance(entry.player.id, s)}
                                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border ${
                                        isActive
                                          ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                                          : 'text-[#6b6b8a] border-[#1c1c34] hover:border-[#6b6b8a] hover:text-[#9e9eb4]'
                                      }`}
                                    >
                                      {s === 'on-time' ? '✓' : s === 'late' ? '⏰' : s === 'absent' ? '✗' : '🙏'}
                                      <span className="ml-1 hidden sm:inline">{s === 'on-time' ? 'On Time' : s.charAt(0).toUpperCase() + s.slice(1)}</span>
                                    </button>
                                  );
                                })}

                                <span
                                  className={`w-2 h-2 rounded-full ml-1 ${
                                    entry.hasResponded || entry.actualStatus ? 'bg-dart-green' : 'bg-[#2e2e52]'
                                  }`}
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
                <div className="mt-4 bg-[#111122] rounded-xl border border-[#1c1c34] p-4 hover:border-[#252544] transition-colors duration-200">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-[#9e9eb4] font-medium">Lineup availability:</span>
                    {hasEnoughPlayers ? (
                      <span className="text-dart-green bg-dart-green/15 px-3 py-1 rounded-full text-xs font-medium">
                        {availableCount} players available — enough for a lineup
                      </span>
                    ) : (
                      <span className="text-dart-red bg-dart-red/15 px-3 py-1 rounded-full text-xs font-medium">
                        Only {availableCount} available — need at least 4
                      </span>
                    )}
                    {counts && !hasEnoughPlayers && counts.confirmedExcused > 0 && (
                      <span className="text-[#6b6b8a] text-xs">
                        ({counts.confirmedExcused} excused)
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
    'on-time': 'text-dart-green bg-dart-green/15',
    late: 'text-gold-400 bg-gold-400/15',
    absent: 'text-dart-red bg-dart-red/15',
    excused: 'text-[#6b6b8a] bg-[#6b6b8a]/15',
  };
  return <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status]}`}>{status}</span>;
}