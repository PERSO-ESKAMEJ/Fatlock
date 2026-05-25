import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import PageWrapper from '../components/layout/PageWrapper';
import DailyCodeUnlock from '../components/dashboard/DailyCodeUnlock';
import RankCard from '../components/dashboard/RankCard';
import CountdownBar from '../components/dashboard/CountdownBar';
import NutritionSnapshot from '../components/dashboard/NutritionSnapshot';
import TodaySummary from '../components/dashboard/TodaySummary';
import { getCurrentWeek } from '../store/useChallengeStore';

export default function Dashboard() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const bodyComps = useLogStore((s) => s.bodyCompositions).filter((c) => c.userId === profile.id);
  const navigate = useNavigate();
  const currentWeek = getCurrentWeek(challenge.startDate);
  const s0Done = bodyComps.some((c) => c.weekNumber === 0);
  const checkinDue = currentWeek >= 1 && !bodyComps.some((c) => c.weekNumber === currentWeek);

  const greeting = profile.sex === 'M'
    ? `Prêt à dominer, ${profile.name} ?`
    : `Prête à te révéler, ${profile.name} ?`;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">
          Semaine {currentWeek} / 8
        </div>
        <h1 className="font-display text-2xl uppercase tracking-wider text-[var(--ink)]">
          {greeting}
        </h1>
      </div>

      {/* Daily code — top priority */}
      <div className="mb-4">
        <DailyCodeUnlock />
      </div>

      {/* Rank hero */}
      <div className="mb-4">
        <RankCard />
      </div>

      {/* Countdown */}
      <div className="mb-4">
        <CountdownBar />
      </div>

      {/* Baseline S0 */}
      {!s0Done && (
        <div
          className="mb-4 p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(47,227,154,0.12), rgba(0,212,255,0.08))', border: '1px solid var(--green)' }}
          onClick={() => navigate('/checkin?week=0')}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--green)' }}>
              Mesures de départ — S0
            </div>
            <div className="text-sm text-[var(--muted)]">Photos + composition avant le challenge · Référence pour le vote final</div>
          </div>
          <span className="text-2xl flex-shrink-0">📏</span>
        </div>
      )}

      {/* Check-in hebdomadaire */}
      {checkinDue && (
        <div
          className="mb-4 p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(47,123,255,0.15), rgba(0,212,255,0.1))', border: '1px solid var(--blue)' }}
          onClick={() => navigate('/checkin')}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--blue-bright)' }}>
              Check-in Semaine {currentWeek}
            </div>
            <div className="text-sm text-[var(--muted)]">Photos · Composition corporelle · Analyse IA</div>
          </div>
          <span className="text-2xl flex-shrink-0">📸</span>
        </div>
      )}

      {/* Grid: nutrition + rituals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NutritionSnapshot />
        <TodaySummary />
      </div>

      {/* Group code info */}
      {profile.isAdmin && (
        <div className="mt-4 panel2 p-3 text-xs text-[var(--muted)]">
          Code groupe : <span className="font-mono text-[var(--ink)] font-bold">{challenge.groupCode}</span>
          <span className="ml-2 text-[var(--muted2)]">Partage ce code pour que tes amis rejoignent.</span>
        </div>
      )}
    </PageWrapper>
  );
}