import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import AwardsPage from './pages/AwardsPage';
import AttendancePage from './pages/AttendancePage';
import LineupPage from './pages/LineupPage';
import RespondPage from './pages/RespondPage';
import { syncFromServer } from './store';

type Page = 'dashboard' | 'analysis' | 'awards' | 'attendance' | 'lineup';

function isRespondMode(): boolean {
  return window.location.hash.startsWith('#respond');
}

function clearRespondHash() {
  // Remove the hash without triggering a full page reload
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500">Syncing data from server...</p>
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
    <div className="min-h-screen bg-gray-50">
      <Navbar currentPage={page} onNavigate={(p) => {
        setPage(p as Page);
        if (p !== 'lineup') setLineupPreselectDate(null);
      }} />
      {page === 'dashboard' && <DashboardPage />}
      {page === 'analysis' && <AnalysisPage />}
      {page === 'awards' && <AwardsPage />}
      {page === 'attendance' && <AttendancePage onNavigateToLineup={handleNavigateToLineup} />}
      {page === 'lineup' && <LineupPage preselectDate={lineupPreselectDate} />}
    </div>
  );
}