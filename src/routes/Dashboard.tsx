import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import PageWrapper from '../components/layout/PageWrapper';
import DailyCodeUnlock from '../components/dashboard/DailyCodeUnlock';
import RankCard from '../components/dashboard/RankCard';
import CountdownBar from '../components/dashboard/CountdownBar';
import NutritionSnapshot from '../components/dashboard/NutritionSnapshot';
import TodaySummary from '../components/dashboard/TodaySummary';
import { getChallengeState, getCurrentWeek, getDaysUntilStart } from '../store/useChallengeStore';

export default function Dashboard() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const bodyComps = useLogStore((s) => s.bodyCompositions).filter((c) => c.userId === profile.id);
  const navigate = useNavigate();
  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const state = getChallengeState(challenge.startDate, durationWeeks);
  const currentWeek = getCurrentWeek(challenge.startDate, durationWeeks);
  const s0Done = bodyComps.some((c) => c.weekNumber === 0);
  const checkinDue = state === 'active' && !bodyComps.some((c) => c.weekNumber === currentWeek);

  const greeting = profile.sex === 'M'
    ? `Prêt à dominer, ${profile.name} ?`
    : `Prête à te révéler, ${profile.name} ?`;

  // ── PENDING: challenge hasn't started yet ─────────────────────────────────
  if (state === 'pending') {
    const daysLeft = getDaysUntilStart(challenge.startDate);
    return (
      <PageWrapper>
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">
            Challenge à venir
          </div>
          <h1 className="font-display text-2xl uppercase tracking-wider text-[var(--ink)]">
            {profile.name} — Prépare-toi
          </h1>
        </div>

        {/* Countdown banner */}
        <div
          className="mb-4 p-5 rounded-xl text-center"
          style={{ background: 'linear-gradient(135deg, rgba(47,123,255,0.12), rgba(0,212,255,0.08))', border: '1px solid var(--blue)' }}
        >
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--blue-bright)' }}>
            Début du challenge
          </div>
          <div className="font-display text-4xl font-bold text-[var(--ink)] mb-1">
            J-{daysLeft}
          </div>
          <div className="text-sm text-[var(--muted)]">
            Commence le {new Date(challenge.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* S0 measurement — accessible before start */}
        <div
          className="mb-4 p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(47,227,154,0.12), rgba(0,212,255,0.08))', border: '1px solid var(--green)' }}
          onClick={() => navigate('/checkin?week=0')}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--green)' }}>
              Mesures de départ — S0
            </div>
            <div className="text-sm text-[var(--muted)]">
              {s0Done ? 'Mesures enregistrées ✓ — tu peux les modifier' : 'Photos + composition · À faire avant le J1'}
            </div>
          </div>
          <span className="text-2xl flex-shrink-0">{s0Done ? '✅' : '📏'}</span>
        </div>

        {/* Group info */}
        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Groupe</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Nom</span>
              <span className="font-bold">{challenge.groupName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Code</span>
              <span className="font-mono font-bold" style={{ color: 'var(--blue-bright)' }}>{challenge.groupCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Mise en jeu</span>
              <span className="font-mono">{challenge.stakeAmount} €</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg text-xs text-center text-[var(--muted)]"
          style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
          La saisie des rituels quotidiens sera débloquée dès le J1 du challenge.
        </div>
      </PageWrapper>
    );
  }

  // ── COMPLETED: challenge is over ──────────────────────────────────────────
  if (state === 'completed') {
    return (
      <PageWrapper>
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--gold, #FFD700)' }}>
            Challenge terminé
          </div>
          <h1 className="font-display text-2xl uppercase tracking-wider text-[var(--ink)]">
            {durationWeeks} semaines · {challenge.groupName}
          </h1>
        </div>

        {/* Final vote CTA */}
        <div
          className="mb-4 p-5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,77,94,0.08))', border: '1px solid rgba(255,215,0,0.4)' }}
          onClick={() => navigate('/vote-final')}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgb(255,215,0)' }}>
              Vote final
            </div>
            <div className="text-sm text-[var(--muted)]">
              Compare les transformations S0 → S{durationWeeks} et vote pour la plus marquante
            </div>
          </div>
          <span className="text-2xl flex-shrink-0">🏆</span>
        </div>

        {/* Rank card — read-only, shows final ranking */}
        <div className="mb-4">
          <RankCard />
        </div>

        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Récapitulatif</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Groupe</span>
              <span className="font-bold">{challenge.groupName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Durée</span>
              <span>{durationWeeks} semaines</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Check-ins réalisés</span>
              <span>{bodyComps.filter((c) => c.weekNumber > 0).length} / {durationWeeks}</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg text-xs text-center text-[var(--muted)]"
          style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
          Les données restent accessibles. Exporte-les depuis Paramètres avant de quitter le groupe.
        </div>
      </PageWrapper>
    );
  }

  // ── ACTIVE: normal challenge week ─────────────────────────────────────────
  return (
    <PageWrapper>
      {/* Header */}
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">
          Semaine {currentWeek} / {durationWeeks}
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