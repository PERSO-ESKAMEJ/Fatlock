import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { calculateTargets } from '../lib/nutrition';
import { getRitualsForDay } from '../constants/rituals';
import { calcDayRitualPoints, calcCurrentStreak, getTier, displayTier, calcCompositeScore } from '../lib/scoring';
import { DayType, Intensity, Sex, LeaderboardEntry, MasterLeaderboard } from '../types';
import PageWrapper from '../components/layout/PageWrapper';

// ── helpers ──────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) { return min + Math.random() * (max - min); }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)); }

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Weekly training schedule (lun→dim)
const SCHEDULE: DayType[] = ['muscu_j1', 'repos', 'muscu_j2', 'cardio', 'muscu_j3', 'cardio', 'repos'];

// Compliance rates per intensity (% of rituals done per day)
const COMPLIANCE: Record<Intensity, number> = { safe: 0.88, standard: 0.78, flow: 0.68 };

// ── fake competitors ──────────────────────────────────────────────────────────

const FAKE_COMPETITORS: {
  id: string; name: string; sex: Sex; intensity: Intensity;
  startWeight: number; egoBase: number; streak: number; credibility: number;
}[] = [
  { id: 'fake-1', name: 'Thomas', sex: 'M', intensity: 'standard', startWeight: 88, egoBase: 1240, streak: 12, credibility: 81 },
  { id: 'fake-2', name: 'Léa',    sex: 'F', intensity: 'flow',     startWeight: 68, egoBase: 1820, streak: 18, credibility: 74 },
  { id: 'fake-3', name: 'Karim',  sex: 'M', intensity: 'safe',     startWeight: 95, egoBase: 780,  streak: 7,  credibility: 92 },
  { id: 'fake-4', name: 'Sofia',  sex: 'F', intensity: 'standard', startWeight: 72, egoBase: 1050, streak: 9,  credibility: 85 },
];

// ── main component ────────────────────────────────────────────────────────────

export default function DevSeed() {
  const profile = useProfileStore((s) => s.profile);
  const challenge = useProfileStore((s) => s.challenge);
  const { upsertDailyLog, addBodyComposition, addWeeklyScore } = useLogStore();
  const { setMasterLeaderboard } = useLeaderboardStore();
  const navigate = useNavigate();

  const [weeks, setWeeks] = useState(3);
  const [seeded, setSeeded] = useState(false);

  if (!profile || !challenge) {
    return (
      <PageWrapper title="Dev Seed">
        <p className="text-[var(--muted)]">Crée un profil d'abord.</p>
      </PageWrapper>
    );
  }

  const targets = calculateTargets(profile, profile.startWeight);

  function seedCurrentUser() {
    const totalDays = weeks * 7;
    const compliance = COMPLIANCE[profile!.intensity];

    for (let daysAgo = totalDays; daysAgo >= 1; daysAgo--) {
      const date = dateNDaysAgo(daysAgo);
      const dow = new Date(date + 'T12:00:00').getDay(); // 0=dim
      const scheduleIdx = dow === 0 ? 6 : dow - 1;
      const dayType = SCHEDULE[scheduleIdx];

      const rituals = getRitualsForDay(dayType, profile!.intensity);
      const ritualState: Record<string, boolean> = {};
      for (const r of rituals) {
        ritualState[r.id] = Math.random() < compliance;
      }

      // Poids : décroissant avec bruit
      const weekAgo = Math.floor(daysAgo / 7);
      const baseWeight = profile!.startWeight - targets.weeklyLossKg * (weeks - weekAgo);
      const weightKg = +(baseWeight + rnd(-0.4, 0.4)).toFixed(1);

      upsertDailyLog({
        userId: profile!.id,
        date,
        codeConfirmed: true,
        dayType,
        rituals: ritualState,
        weightKg,
      });
    }

    // Body compositions hebdomadaires
    for (let w = 1; w <= weeks; w++) {
      const fatMassStart = profile!.startWeight * (profile!.sex === 'F' ? 0.32 : 0.22);
      const fatLost = targets.weeklyLossKg * w * 0.85;
      const fatMassKg = +(fatMassStart - fatLost).toFixed(1);
      const muscleMassKg = +(profile!.startWeight * (profile!.sex === 'F' ? 0.36 : 0.44) + rnd(-0.2, 0.2)).toFixed(1);
      const weightKg = +(profile!.startWeight - targets.weeklyLossKg * w + rnd(-0.2, 0.2)).toFixed(1);

      addBodyComposition({
        userId: profile!.id,
        date: dateNDaysAgo((weeks - w) * 7),
        weekNumber: w,
        weightKg,
        fatMassKg,
        muscleMassKg,
        waterPercent: rnd(55, 62),
        boneMassKg: +(profile!.sex === 'F' ? rnd(2.2, 2.6) : rnd(2.8, 3.4)).toFixed(1),
      });
    }

    // Weekly scores
    const allLogs = useLogStore.getState().dailyLogs.filter((l) => l.userId === profile!.id);
    for (let w = 1; w <= weeks; w++) {
      const weekStart = dateNDaysAgo((weeks - w + 1) * 7);
      const weekEnd   = dateNDaysAgo((weeks - w) * 7);
      const weekLogs = allLogs.filter((l) => l.date >= weekStart && l.date < weekEnd);
      const egoPoints = weekLogs.reduce((s, l) => s + calcDayRitualPoints(l, profile!.intensity), 0);
      const streakBonus = Math.min(w * 3, 20);
      const aiBonus = rndInt(-10, 30);
      const transformationScore = rndInt(20, 60);
      const regularityScore = Math.round(weekLogs.filter((l) => l.codeConfirmed).length / 7 * 100);
      const totalComposite = calcCompositeScore(egoPoints + streakBonus + aiBonus, transformationScore, regularityScore);

      addWeeklyScore({ userId: profile!.id, weekNumber: w, egoPoints, streakBonus, aiBonus, transformationScore, regularityScore, totalComposite });
    }
  }

  function buildLeaderboard() {
    const currentUserLogs = useLogStore.getState().dailyLogs.filter((l) => l.userId === profile!.id);
    const currentUserScores = useLogStore.getState().weeklyScores.filter((s) => s.userId === profile!.id);

    const currentUserEgo = currentUserScores.reduce((s, ws) => s + ws.egoPoints + ws.streakBonus + ws.aiBonus, 0);
    const currentUserStreak = calcCurrentStreak(currentUserLogs, profile!.intensity);
    const currentUserRegularity = currentUserLogs.length > 0
      ? Math.round(currentUserLogs.filter((l) => l.codeConfirmed).length / currentUserLogs.length * 100)
      : 0;
    const currentUserTier = getTier(currentUserEgo);
    const currentUserComposite = currentUserScores.reduce((s, ws) => s + ws.totalComposite, 0);

    const entries: LeaderboardEntry[] = [
      {
        userId: profile!.id,
        name: profile!.name,
        sex: profile!.sex,
        intensity: profile!.intensity,
        currentRank: 0,
        previousRank: 0,
        tier: currentUserTier,
        cumulativeEgoPoints: currentUserEgo,
        regularityPercent: currentUserRegularity,
        transformationPercent: rndInt(40, 75),
        compositeScore: currentUserComposite,
        currentStreak: currentUserStreak,
        weeklyCredibilityScore: rndInt(60, 90),
      },
      ...FAKE_COMPETITORS.map((c) => {
        const aiMod = c.credibility >= 75 ? 30 : c.credibility >= 60 ? 15 : -15;
        const ego = c.egoBase + aiMod;
        const tier = getTier(ego);
        const composite = Math.round(ego * 0.5 + rnd(20, 60) * 10 * 0.25 + rnd(60, 95) * 20 * 0.25);
        return {
          userId: c.id,
          name: c.name,
          sex: c.sex,
          intensity: c.intensity,
          currentRank: 0,
          previousRank: 0,
          tier,
          cumulativeEgoPoints: ego,
          regularityPercent: rndInt(70, 96),
          transformationPercent: rndInt(35, 80),
          compositeScore: composite,
          currentStreak: c.streak,
          weeklyCredibilityScore: c.credibility,
        };
      }),
    ];

    // Trier par compositeScore et assigner les rangs
    entries.sort((a, b) => b.compositeScore - a.compositeScore);
    entries.forEach((e, i) => {
      e.currentRank = i + 1;
      e.previousRank = rndInt(1, entries.length);
    });

    const top = entries[0];
    const lb: MasterLeaderboard = {
      challengeId: challenge!.id,
      updatedAt: new Date().toISOString(),
      weekNumber: weeks,
      entries,
      weeklyHighlights: {
        biggestMover: entries[rndInt(0, entries.length - 1)].name,
        topStreak: entries.reduce((a, b) => a.currentStreak > b.currentStreak ? a : b).name,
        topCredibility: entries.reduce((a, b) => (a.weeklyCredibilityScore ?? 0) > (b.weeklyCredibilityScore ?? 0) ? a : b).name,
      },
    };

    setMasterLeaderboard(lb);
  }

  function handleSeed() {
    seedCurrentUser();
    buildLeaderboard();
    setSeeded(true);
  }

  function handleClear() {
    useLogStore.getState().reset();
    useLeaderboardStore.getState().reset();
    setSeeded(false);
  }

  return (
    <PageWrapper>
      <div
        className="mb-6 p-3 rounded-lg text-xs font-bold uppercase tracking-wider text-center"
        style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)', color: 'var(--red)' }}
      >
        ⚠ Zone développement — données fictives
      </div>

      <div className="panel p-5 space-y-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Profil actif</div>
          <div className="text-sm font-bold text-[var(--ink)]">{profile.name}</div>
          <div className="text-xs text-[var(--muted)]">
            {profile.intensity.toUpperCase()} · {profile.startWeight} kg · {challenge.groupName}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
            Semaines à générer : <span className="font-mono text-[var(--cyan)]">{weeks}</span>
          </label>
          <input
            type="range" min={1} max={6} step={1} value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value))}
            className="w-full mt-2"
          />
          <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
            <span>1 sem.</span><span>6 sem.</span>
          </div>
        </div>

        <div className="text-xs text-[var(--muted)] space-y-1">
          <div>· <span className="text-[var(--ink)]">{weeks * 7} jours</span> de logs quotidiens pour {profile.name}</div>
          <div>· <span className="text-[var(--ink)]">{weeks} compositions corporelles</span> hebdomadaires</div>
          <div>· <span className="text-[var(--ink)]">{weeks} scores hebdomadaires</span> calculés</div>
          <div>· <span className="text-[var(--ink)]">4 compétiteurs fictifs</span> : Thomas, Léa, Karim, Sofia</div>
        </div>

        <button
          onClick={handleSeed}
          className="w-full py-3 rounded-lg font-bold uppercase tracking-wider text-sm transition-all"
          style={{ background: 'var(--blue)', color: 'white' }}
        >
          Générer les données
        </button>

        {seeded && (
          <>
            <div
              className="p-3 rounded-lg text-sm text-center font-bold"
              style={{ background: 'rgba(47,227,154,0.08)', border: '1px solid rgba(47,227,154,0.25)', color: 'var(--green)' }}
            >
              ✓ Données générées — navigue dans l'app pour voir le résultat
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
                style={{ background: 'var(--panel2)', color: 'var(--blue-bright)', border: '1px solid var(--border)' }}
              >
                → Dashboard
              </button>
              <button
                onClick={() => navigate('/classement')}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
                style={{ background: 'var(--panel2)', color: 'var(--cyan)', border: '1px solid var(--border)' }}
              >
                → Classement
              </button>
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button
            onClick={handleClear}
            className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{ color: 'var(--red)', border: '1px solid rgba(255,77,94,0.3)', background: 'transparent' }}
          >
            Effacer toutes les données générées
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}