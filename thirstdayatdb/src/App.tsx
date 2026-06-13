import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import AwardsPage from './pages/AwardsPage';
import AttendancePage from './pages/AttendancePage';
import LineupPage from './pages/LineupPage';
import RespondPage from './pages/RespondPage';
import { syncFromServer, getUpcomingSessions, getResponseCounts, buildResponseLink } from './store';

type Page = 'dashboard' | 'analysis' | 'awards' | 'attendance' | 'lineup';

function isRespondMode(): boolean {
  return window.location.hash.startsWith('#respond');
}

function clearRespondHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** Returns the number of days between today and a target date string. */
function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

/**
 * Global attendance banner — shows on every page for matches within 3 days
 * that don't have full attendance yet. Not dismissable until 100% responded.
 */
function GlobalAttendanceBanner() {
  const [, setTick] = useState(0);

  // Refresh response data every 15 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const upcoming = getUpcomingSessions();

  // Find matches within 0-3 days that don't have full attendance
  const activeSessions = upcoming.filter(s => {
    const d = daysUntil(s.date);
    if (d < 0 || d > 3) return false;
    const counts = getResponseCounts(s.id);
    return counts.total > 0 && counts.responded < counts.total;
  });

  if (activeSessions.length === 0) return null;

  function handleCopy(sessionId: string) {
    navigator.clipboard.writeText(buildResponseLink(sessionId));
  }

  function handleWhatsApp(s: { date: string; notes?: string; id: string }) {
    const link = buildResponseLink(s.id);
    const msg = encodeURIComponent(
      `[Captain Liting (Virtual)] 🏆 Match on ${s.date}${s.notes ? ` — ${s.notes}` : ''}\n\nPlease respond with your attendance:\n${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  return (
    <div className="space-y-2 px-4 pt-2">
      {activeSessions.map(s => {
        const counts = getResponseCounts(s.id);
        const d = daysUntil(s.date);
        const noteMatch = s.notes?.match(/(?:vs|@)\s+(.+?)$/);
        const opponent = noteMatch?.[1] || 'Unknown';
        const urgencyColor = d <= 1 ? '#DC2626' : '#B8942E';

        return (
          <div
            key={s.id}
            className="rounded-xl px-5 py-3 animate-fade-in"
            style={{
              background: d <= 1
                ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.06), rgba(220, 38, 38, 0.02))'
                : 'linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(232, 200, 114, 0.04))',
              border: `1px solid ${d <= 1 ? 'rgba(220, 38, 38, 0.2)' : 'rgba(212, 175, 55, 0.25)'}`,
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              {/* Badge */}
              <span className="shrink-0 text-xs font-semibold font-body tracking-wider uppercase" style={{ color: urgencyColor }}>
                {d === 0 ? 'Match Day!' : d === 1 ? 'Tomorrow!' : `In ${d} Days`}
              </span>

              {/* Opponent */}
              <span className="text-xs text-[#64748B] font-body">vs {opponent} · {s.date}</span>

              {/* Progress bar */}
              <div className="flex-1 min-w-[120px]">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${counts.total > 0 ? (counts.responded / counts.total) * 100 : 0}%`,
                      background: counts.responded === counts.total
                        ? 'linear-gradient(90deg, #059669, #10B981)'
                        : 'linear-gradient(90deg, rgba(212, 175, 55, 0.4), #D4AF37)',
                    }}
                  />
                </div>
              </div>

              {/* Response count */}
              <span className="shrink-0 text-xs font-medium font-body" style={{ color: counts.responded === counts.total ? '#059669' : urgencyColor }}>
                {counts.responded}/{counts.total}
              </span>

              {/* Actions */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleCopy(s.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: 'rgba(212, 175, 55, 0.08)',
                    color: '#B8942E',
                    border: '1px solid rgba(212, 175, 55, 0.2)',
                  }}
                >
                  Copy Link
                </button>
                <button
                  onClick={() => handleWhatsApp(s)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: '#25D366',
                    color: '#FFF',
                  }}
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [lineupPreselectDate, setLineupPreselectDate] = useState<string | null>(null);
  const [respondMode, setRespondMode] = useState(isRespondMode);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    const handler = () => {
      setRespondMode(isRespondMode());
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    syncFromServer().finally(() => setSyncing(false));
  }, []);

  if (syncing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-full animate-spin"
            style={{
              border: '2px solid rgba(212, 175, 55, 0.2)',
              borderTopColor: '#D4AF37',
            }}
          />
          <p className="text-[#94A3B8] text-sm font-body">Loading data...</p>
        </div>
      </div>
    );
  }

  function handleExitRespond() {
    clearRespondHash();
    setRespondMode(false);
  }

  function handleNavigateToLineup(date: string) {
    setLineupPreselectDate(date);
    setPage('lineup');
  }

  if (respondMode) {
    return <RespondPage onBackToApp={handleExitRespond} />;
  }

  return (
    <div className="min-h-screen">
      <Navbar currentPage={page} onNavigate={(p) => {
        setPage(p as Page);
        if (p !== 'lineup') setLineupPreselectDate(null);
      }} />
      <GlobalAttendanceBanner />
      {page === 'dashboard' && <DashboardPage />}
      {page === 'analysis' && <AnalysisPage />}
      {page === 'awards' && <AwardsPage />}
      {page === 'attendance' && <AttendancePage onNavigateToLineup={handleNavigateToLineup} />}
      {page === 'lineup' && <LineupPage preselectDate={lineupPreselectDate} />}
          </div>
  );
}