import { useProfileStore } from '../store/useProfileStore';
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
  const currentWeek = getCurrentWeek(challenge.startDate);

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