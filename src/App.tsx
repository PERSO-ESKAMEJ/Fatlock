import { Routes, Route, Navigate } from 'react-router-dom';
import { useProfileStore } from './store/useProfileStore';
import Welcome from './routes/Welcome';
import Dashboard from './routes/Dashboard';
import Rituals from './routes/Rituals';
import Nutrition from './routes/Nutrition';
import Training from './routes/Training';
import WeeklyCheckin from './routes/WeeklyCheckin';
import Progress from './routes/Progress';
import Leaderboard from './routes/Leaderboard';
import FinalVote from './routes/FinalVote';
import Settings from './routes/Settings';
import NavBar from './components/layout/NavBar';
import { ToastProvider } from './components/ui/Toast';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const profile = useProfileStore((s) => s.profile);
  const challenge = useProfileStore((s) => s.challenge);
  if (!profile || !challenge) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const profile = useProfileStore((s) => s.profile);
  const challenge = useProfileStore((s) => s.challenge);
  const isSetup = !!profile && !!challenge;

  return (
    <ToastProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        {isSetup && <NavBar />}
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/rituels" element={<ProtectedRoute><Rituals /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
          <Route path="/entrainement" element={<ProtectedRoute><Training /></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><WeeklyCheckin /></ProtectedRoute>} />
          <Route path="/progression" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/classement" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/vote-final" element={<ProtectedRoute><FinalVote /></ProtectedRoute>} />
          <Route path="/parametres" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to={isSetup ? '/dashboard' : '/'} replace />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
