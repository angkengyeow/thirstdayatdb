import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import AwardsPage from './pages/AwardsPage';
import AttendancePage from './pages/AttendancePage';
import LineupPage from './pages/LineupPage';
import LiveScoringSheet from './pages/LiveScoringSheet';
import RespondPage from './pages/RespondPage';
import { syncFromServer } from './store';

type Page = 'dashboard' | 'analysis' | 'awards' | 'attendance' | 'lineup' | 'scoring';

function isRespondMode(): boolean {
  return window.location.hash.startsWith('#respond');
}

function clearRespondHash() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
      <div className="min-h-screen bg-[#06060f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#f59e0b] border-t-transparent animate-spin" />
          <p className="text-[#9e9eb4] text-sm">Loading data...</p>
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
      {page === 'dashboard' && <DashboardPage />}
      {page === 'analysis' && <AnalysisPage />}
      {page === 'awards' && <AwardsPage />}
      {page === 'attendance' && <AttendancePage onNavigateToLineup={handleNavigateToLineup} />}
      {page === 'lineup' && <LineupPage preselectDate={lineupPreselectDate} />}
      {page === 'scoring' && <LiveScoringSheet />}
    </div>
  );
}