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
  'on-time': { label: 'On Time', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  late: { label: 'Late', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  absent: { label: 'Absent', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  excused: { label: 'Excused', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
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

  // Auto-select the nearest upcoming session
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
      `[Darts S1 Manager] ${sessionType} on ${selectedSession.date}${selectedSession.notes ? ` — ${selectedSession.notes}` : ''}\n\nPlease respond with your attendance:\n${responseLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function handleManualAttendance(playerId: string, status: AttendanceStatus) {
    if (!selectedSessionId) return;

    // Save as an attendance record
    saveAttendanceRecord({
      id: generateId(),
      playerId,
      sessionId: selectedSessionId,
      status,
    });

    // Also create a manual response entry
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Broadcast, capture responses, and plan the lineup</p>
        </div>
      </div>

      {/* Session Selector */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-lg mb-2">No upcoming sessions</p>
          <p className="text-gray-400 text-sm">Create a match or practice session first, then come back here to manage attendance.</p>
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
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
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
              {/* Left column: Session info + Broadcast */}
              <div className="lg:col-span-1 space-y-4">
                {/* Session Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{selectedSession.type === 'match' ? '🏆' : '🎯'}</span>
                    <div>
                      <h2 className="font-semibold text-gray-800">{selectedSession.type === 'match' ? 'Match' : 'Practice'}</h2>
                      <p className="text-sm text-gray-500">{selectedSession.date}</p>
                    </div>
                  </div>
                  {selectedSession.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{selectedSession.notes}</p>
                  )}
                </div>

                {/* Broadcast Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Broadcast</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Response Link</p>
                      <p className="text-xs text-indigo-600 break-all">{responseLink}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copied
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {copied ? '✓ Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={handleWhatsAppShare}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                      >
                        Share via WhatsApp
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      Share the link with players so they can confirm their attendance.
                    </p>
                  </div>
                </div>

                {/* Response Summary */}
                {counts && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-3">Response Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Responded</span>
                        <span className="text-sm font-semibold text-gray-800">{counts.responded} / {counts.total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${counts.total > 0 ? (counts.responded / counts.total) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600">✓ On Time</span>
                          <span className="font-medium">{counts.confirmedOnTime}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-600">⏰ Late</span>
                          <span className="font-medium">{counts.confirmedLate}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-red-600">✗ Absent</span>
                          <span className="font-medium">{counts.confirmedAbsent}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">🙏 Excused</span>
                          <span className="font-medium">{counts.confirmedExcused}</span>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-2 mt-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-indigo-700">Available to play</span>
                          <span className={hasEnoughPlayers ? 'text-green-600' : 'text-red-600'}>
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
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold text-sm"
                  >
                    Plan Lineup for {selectedSession.date}
                  </button>
                )}
              </div>

              {/* Right column: Player Response Table */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">Player Responses</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Green = responded. Tap a status badge to manually override for a player.
                    </p>
                  </div>

                  {overview.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <p>No players in the roster</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {overview.map(entry => {
                        const isConfirmed = !!entry.actualStatus;

                        return (
                          <div key={entry.player.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                  isConfirmed ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {entry.player.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800">{entry.player.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {entry.response ? (
                                      <span className="text-xs text-green-600">Responded {new Date(entry.response.respondedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        Predicted: <PredictedBadge status={entry.predictedStatus} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Quick status override buttons */}
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
                                          : 'text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                      }`}
                                    >
                                      {s === 'on-time' ? '✓' : s === 'late' ? '⏰' : s === 'absent' ? '✗' : '🙏'}
                                      <span className="ml-1 hidden sm:inline">{s === 'on-time' ? 'On Time' : s.charAt(0).toUpperCase() + s.slice(1)}</span>
                                    </button>
                                  );
                                })}

                                <span
                                  className={`w-2 h-2 rounded-full ml-1 ${
                                    entry.hasResponded || entry.actualStatus ? 'bg-green-400' : 'bg-gray-300'
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
                <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-gray-600 font-medium">Lineup availability:</span>
                    {hasEnoughPlayers ? (
                      <span className="text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-medium">
                        {availableCount} players available — enough for a lineup
                      </span>
                    ) : (
                      <span className="text-red-700 bg-red-50 px-3 py-1 rounded-full text-xs font-medium">
                        Only {availableCount} available — need at least 4
                      </span>
                    )}
                    {counts && !hasEnoughPlayers && counts.confirmedExcused > 0 && (
                      <span className="text-gray-500 text-xs">
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
    'on-time': 'text-green-600 bg-green-50',
    late: 'text-amber-600 bg-amber-50',
    absent: 'text-red-600 bg-red-50',
    excused: 'text-gray-500 bg-gray-50',
  };
  return <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status]}`}>{status}</span>;
}