import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useProfileStore } from './store/useProfileStore';
import { useLogStore } from './store/useLogStore';
import { useLeaderboardStore } from './store/useLeaderboardStore';
import { getChallengeState } from './store/useChallengeStore';
import { setupSupabase, clearSupabase, supabase } from './lib/supabase';
import { MasterLeaderboard } from './types';
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
import DevSeed from './routes/DevSeed';
import NavBar from './components/layout/NavBar';
import FireBackground from './components/layout/FireBackground';
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

  useEffect(() => {
    if (challenge?.supabaseUrl && challenge?.supabaseAnonKey) {
      setupSupabase(challenge.supabaseUrl, challenge.supabaseAnonKey);
    } else {
      clearSupabase();
    }
  }, [challenge?.supabaseUrl, challenge?.supabaseAnonKey]);

  useEffect(() => {
    // Évite l'éviction automatique du stockage sur iOS Safari (~7 jours d'inactivité)
    navigator.storage?.persist?.();
  }, []);

  // Récupération automatique du classement (et de l'analyse IA) au lancement de l'app
  useEffect(() => {
    if (!profile || !challenge || profile.isAdmin) return;
    const sb = supabase();
    if (!sb) return;
    const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
    if (getChallengeState(challenge.startDate, durationWeeks) === 'pending') return;

    (async () => {
      try {
        const { data, error } = await sb
          .from('master_leaderboards')
          .select('data')
          .eq('challenge_id', challenge.id)
          .single();
        if (error || !data) return;
        const lb = data.data as MasterLeaderboard;
        useLeaderboardStore.getState().setMasterLeaderboard(lb);
        const myAI = lb.aiAnalyses?.find((r) => r.userId === profile.id);
        if (myAI) useLogStore.getState().addAIResult(myAI);
      } catch {
        // silencieux — sync manuelle disponible dans l'onglet Classement
      }
    })();
  }, [profile?.id, challenge?.id, challenge?.supabaseUrl, profile?.isAdmin]);

  return (
    <ToastProvider>
      <FireBackground />
      <div className="min-h-screen">
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
          {import.meta.env.DEV && (
            <Route path="/dev" element={<ProtectedRoute><DevSeed /></ProtectedRoute>} />
          )}
          <Route path="*" element={<Navigate to={isSetup ? '/dashboard' : '/'} replace />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
