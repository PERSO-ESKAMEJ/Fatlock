import { useState, useRef, useEffect } from 'react';
import { useProfileStore } from '../../store/useProfileStore';
import { useLogStore } from '../../store/useLogStore';
import { useLeaderboardStore } from '../../store/useLeaderboardStore';
import { RecapFile, MasterLeaderboard, LeaderboardEntry, WeeklyPhoto, AIAnalysisResult } from '../../types';
import { calcCurrentStreak, calcDayRitualPoints, calcRegularityScore, getTier, calcCompositeScore, calcTotalStreakBonuses } from '../../lib/scoring';
import { getCurrentWeek, getChallengeEndDate } from '../../store/useChallengeStore';
import { runAIAnalysis } from '../../lib/aiAnalysis';
import { generateRecapFile } from '../../lib/recap';
import { getPhotosByWeek } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import DramaReveal from './DramaReveal';

interface RecapStatus {
  userId: string;
  userName: string;
  exportedAt: string;
}

export default function AdminSync() {
  const challenge = useProfileStore((s) => s.challenge)!;
  const profile = useProfileStore((s) => s.profile)!;
  const { addAIResult, dailyLogs, bodyCompositions, weeklyScores } = useLogStore();
  const setMasterLeaderboard = useLeaderboardStore((s) => s.setMasterLeaderboard);
  const masterLeaderboard = useLeaderboardStore((s) => s.masterLeaderboard);
  const { showToast } = useToast();

  const [recaps, setRecaps] = useState<RecapFile[]>([]);
  const [processedRecaps, setProcessedRecaps] = useState<RecapFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [participantStatus, setParticipantStatus] = useState<RecapStatus[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const currentWeek = getCurrentWeek(challenge.startDate, durationWeeks);
  const sb = supabase();

  async function fetchStatus() {
    if (!sb) return;
    setStatusLoading(true);
    try {
      const { data, error } = await sb
        .from('recaps')
        .select('user_id, exported_at, data->>userName')
        .eq('challenge_id', challenge.id)
        .eq('week_number', currentWeek);
      if (error || !data) return;
      setParticipantStatus(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((row: any) => ({
          userId: row.user_id as string,
          userName: (row.userName as string) ?? row.user_id,
          exportedAt: row.exported_at as string,
        }))
      );
    } catch {
      // silencieux
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek]);

  async function buildAdminRecap(): Promise<RecapFile> {
    const adminPhotos: WeeklyPhoto[] = [];
    for (let w = 0; w <= currentWeek; w++) {
      const p = await getPhotosByWeek(profile.id, w);
      if (p) adminPhotos.push(p);
    }
    // Filtre les logs sur la période du challenge uniquement
    const challengeEnd = getChallengeEndDate(challenge.startDate, durationWeeks);
    return generateRecapFile(
      profile,
      challenge.id,
      currentWeek,
      dailyLogs.filter((l) => l.userId === profile.id && l.date >= challenge.startDate && l.date <= challengeEnd),
      bodyCompositions.filter((c) => c.userId === profile.id && c.weekNumber <= currentWeek),
      adminPhotos,
      weeklyScores.filter((s) => s.userId === profile.id && s.weekNumber <= currentWeek),
    );
  }

  // ── Étape 1 : Agrégation des scores (sans IA) ──────────────────────────────
  async function handleAggregate(recapsToProcess: RecapFile[]) {
    setLoading(true);
    try {
      let effectiveRecaps = [...recapsToProcess];

      // Auto-inclure les données locales de l'admin s'il n'a pas poussé de récap
      if (!effectiveRecaps.some((r) => r.userId === profile.id)) {
        const adminRecap = await buildAdminRecap();
        effectiveRecaps = [adminRecap, ...effectiveRecaps];
      }

      const entries: LeaderboardEntry[] = [];
      const customRituals = challenge.challengeType === 'custom' ? challenge.customSettings?.rituals : undefined;
      const challengeStart = new Date(challenge.startDate + 'T12:00:00');

      function weekRange(w: number): { start: string; end: string } {
        const s = new Date(challengeStart);
        s.setDate(challengeStart.getDate() + (w - 1) * 7);
        const e = new Date(challengeStart);
        e.setDate(challengeStart.getDate() + w * 7);
        return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
      }

      for (const recap of effectiveRecaps) {
        const { profile: rProfile, dailyLogs: rLogs, weeklyScores: rScores } = recap;

        // Ego from all confirmed daily logs — covers weeks where check-in was skipped
        const confirmedLogs = rLogs.filter((l) => l.codeConfirmed);
        const liveDailyEgo = confirmedLogs.reduce(
          (sum, l) => sum + calcDayRitualPoints(l, rProfile.intensity, customRituals),
          0
        );

        // Cumulative streak bonuses for all weeks that have logs (cross-week streaks)
        const allWeeksWithLogs: number[] = [];
        for (let w = 1; w <= currentWeek; w++) {
          const { start, end } = weekRange(w);
          if (rLogs.some((l) => l.date >= start && l.date < end)) {
            allWeeksWithLogs.push(w);
          }
        }
        const totalStreakBonuses = calcTotalStreakBonuses(
          rLogs, challenge.startDate, allWeeksWithLogs, rProfile.intensity, customRituals
        );
        const aiOnlyBonuses = rScores.reduce((sum, s) => sum + s.aiBonus, 0);

        const totalEgo = liveDailyEgo + totalStreakBonuses + aiOnlyBonuses;

        // Composite score for ranking: use current week's check-in if available, else synthesize from daily logs
        const currentWeekScore = rScores.find((s) => s.weekNumber === currentWeek);
        let composite: number;
        let weekRegularity: number;
        let weekTransformation: number;

        if (currentWeekScore) {
          composite = calcCompositeScore(
            currentWeekScore.egoPoints + currentWeekScore.streakBonus + currentWeekScore.aiBonus,
            currentWeekScore.transformationScore,
            currentWeekScore.regularityScore
          );
          weekRegularity = currentWeekScore.regularityScore;
          weekTransformation = currentWeekScore.transformationScore;
        } else {
          const { start, end } = weekRange(currentWeek);
          const cwLogs = rLogs.filter((l) => l.date >= start && l.date < end);
          const cwEgo = cwLogs.reduce(
            (sum, l) => sum + calcDayRitualPoints(l, rProfile.intensity, customRituals),
            0
          );
          weekRegularity = calcRegularityScore(cwLogs, 7);
          weekTransformation = rScores[rScores.length - 1]?.transformationScore ?? 0;
          composite = calcCompositeScore(cwEgo, weekTransformation, weekRegularity);
        }

        entries.push({
          userId: rProfile.id,
          name: rProfile.name,
          sex: rProfile.sex,
          intensity: rProfile.intensity,
          currentRank: 0,
          previousRank: masterLeaderboard?.entries.find((e) => e.userId === rProfile.id)?.currentRank ?? 0,
          tier: getTier(totalEgo),
          cumulativeEgoPoints: totalEgo,
          regularityPercent: weekRegularity,
          transformationPercent: weekTransformation,
          compositeScore: composite,
          currentStreak: calcCurrentStreak(rLogs, rProfile.intensity, customRituals),
          weeklyCredibilityScore: undefined,
        });
      }

      entries.sort((a, b) => b.compositeScore - a.compositeScore);
      entries.forEach((e, i) => { e.currentRank = i + 1; });

      const biggestMover = [...entries].sort((a, b) => (b.previousRank - b.currentRank) - (a.previousRank - a.currentRank))[0];
      const topStreak = [...entries].sort((a, b) => b.currentStreak - a.currentStreak)[0];

      const lb: MasterLeaderboard = {
        challengeId: challenge.id,
        updatedAt: new Date().toISOString(),
        weekNumber: currentWeek,
        entries,
        weeklyHighlights: {
          biggestMover: biggestMover?.userId ?? '',
          topStreak: topStreak?.userId ?? '',
          topCredibility: '',
        },
      };

      setMasterLeaderboard(lb);
      setProcessedRecaps(effectiveRecaps);

      if (sb) {
        await sb.from('master_leaderboards').upsert(
          { challenge_id: challenge.id, updated_at: lb.updatedAt, data: lb },
          { onConflict: 'challenge_id' }
        );
      }

      showToast(`Classement généré — ${entries.length} participant(s)`, 'success');
    } catch (err) {
      showToast('Erreur lors de la génération', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 2 : Analyse IA (optionnelle, sur classement déjà généré) ─────────
  async function handleRunAI() {
    if (!masterLeaderboard || !challenge.anthropicApiKey) return;
    setAiLoading(true);
    setAiProgress('');
    try {
      const updatedEntries = masterLeaderboard.entries.map((e) => ({ ...e }));
      const collectedAiResults: AIAnalysisResult[] = [];

      for (const recap of processedRecaps) {
        const photos = recap.weeklyPhotos?.find((p) => p.weekNumber === currentWeek) ?? null;
        if (!photos) continue;

        const rComps = recap.bodyCompositions;
        const latestComp = rComps[rComps.length - 1];
        if (!latestComp) continue;

        const prevComp = rComps.length > 1 ? rComps[rComps.length - 2] : null;
        const prevPhotos = recap.weeklyPhotos?.find((p) => p.weekNumber === currentWeek - 1) ?? undefined;

        setAiProgress(recap.profile.name);
        try {
          const result = await runAIAnalysis({
            userId: recap.profile.id,
            weekNumber: currentWeek,
            prevCompo: prevComp,
            currCompo: latestComp,
            photo: photos,
            prevPhoto: prevPhotos,
            apiKey: challenge.anthropicApiKey,
            durationWeeks,
          });
          addAIResult(result);
          collectedAiResults.push(result);
          const entry = updatedEntries.find((e) => e.userId === recap.profile.id);
          if (entry) entry.weeklyCredibilityScore = result.credibilityScore;
        } catch (err) {
          console.warn('AI skipped for', recap.profile.name, err);
        }
      }

      const topCred = [...updatedEntries].sort(
        (a, b) => (b.weeklyCredibilityScore ?? 0) - (a.weeklyCredibilityScore ?? 0)
      )[0];

      const updatedLb: MasterLeaderboard = {
        ...masterLeaderboard,
        updatedAt: new Date().toISOString(),
        entries: updatedEntries,
        aiAnalyses: collectedAiResults,
        weeklyHighlights: {
          ...masterLeaderboard.weeklyHighlights,
          topCredibility: topCred?.userId ?? '',
        },
      };

      setMasterLeaderboard(updatedLb);

      if (sb) {
        await sb.from('master_leaderboards').upsert(
          { challenge_id: challenge.id, updated_at: updatedLb.updatedAt, data: updatedLb },
          { onConflict: 'challenge_id' }
        );
      }

      showToast('Analyses IA terminées !', 'success');
    } catch (err) {
      showToast('Erreur analyse IA', 'error');
      console.error(err);
    } finally {
      setAiLoading(false);
      setAiProgress('');
    }
  }

  async function handleFetchAndAggregate() {
    if (!sb) { showToast('Supabase non configuré', 'error'); return; }
    setLoading(true);
    try {
      const { data, error } = await sb
        .from('recaps')
        .select('data')
        .eq('challenge_id', challenge.id)
        .eq('week_number', currentWeek);
      if (error) { showToast('Erreur Supabase', 'error'); return; }
      const parsed: RecapFile[] = (data ?? []).map((row: { data: RecapFile }) => row.data);
      setRecaps(parsed);
      await handleAggregate(parsed);
    } catch {
      showToast('Erreur Supabase', 'error');
      setLoading(false);
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const parsed: RecapFile[] = [];
    for (const f of files) {
      try {
        const text = await f.text();
        const data = JSON.parse(text) as RecapFile;
        parsed.push(data);
      } catch {
        showToast(`Fichier invalide : ${f.name}`, 'error');
      }
    }
    setRecaps(parsed);
    showToast(`${parsed.length} récap(s) chargé(s)`, 'success');
  }

  const othersCount = participantStatus.filter((p) => p.userId !== profile.id).length;
  const totalCount = othersCount + 1;
  const canRunAI = !!challenge.anthropicApiKey && processedRecaps.length > 0 && !!masterLeaderboard;
  const participantsWithPhotos = processedRecaps.filter(
    (r) => r.weeklyPhotos?.some((p) => p.weekNumber === currentWeek)
  ).length;

  return (
    <div className="space-y-4">

      {/* ── Étape 1 : Classement ── */}
      <div className="panel2 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
            Étape 1 — Récaps S{currentWeek}
          </div>
          {sb && (
            <button
              onClick={fetchStatus}
              disabled={statusLoading}
              className="text-xs text-[var(--blue-bright)] hover:opacity-70 transition-opacity"
            >
              {statusLoading ? '...' : '↻ Rafraîchir'}
            </button>
          )}
        </div>

        {/* Admin */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--blue-bright)' }}>★</span>
            <span className="text-sm font-bold text-[var(--ink)]">{profile.name} (toi)</span>
          </div>
          <span className="text-xs text-[var(--muted)]">données locales</span>
        </div>

        {/* Autres participants */}
        {participantStatus.filter((p) => p.userId !== profile.id).length === 0 ? (
          <p className="text-xs text-[var(--muted2)] mt-2">
            {sb ? 'En attente des récaps des participants.' : 'Configure Supabase ou utilise le chargement manuel.'}
          </p>
        ) : (
          <div className="space-y-1 mt-1">
            {participantStatus
              .filter((p) => p.userId !== profile.id)
              .map((p) => (
                <div key={p.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--green)' }}>✓</span>
                    <span className="text-sm font-bold text-[var(--ink)]">{p.userName}</span>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(p.exportedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          {sb ? (
            <Button className="w-full" onClick={handleFetchAndAggregate} disabled={loading} loading={loading}>
              Générer le classement — {totalCount} participant(s)
            </Button>
          ) : (
            <p className="text-xs text-[var(--muted2)]">
              Configure Supabase ou utilise le chargement manuel ci-dessous.
            </p>
          )}
        </div>
      </div>

      {/* ── Étape 2 : Analyse IA ── */}
      {canRunAI && (
        <div className="panel2 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">
            Étape 2 — Analyse IA (optionnelle)
          </div>
          <p className="text-xs text-[var(--muted2)] mb-3">
            {participantsWithPhotos > 0
              ? `${participantsWithPhotos} participant(s) ont des photos pour cette semaine.`
              : 'Aucun participant n\'a de photos pour cette semaine.'}
            {' '}L'IA évalue la cohérence entre les mesures déclarées et la transformation visible.
          </p>

          {aiLoading && aiProgress && (
            <div className="text-xs text-[var(--blue-bright)] mb-2 animate-pulse">
              Analyse en cours : {aiProgress}…
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleRunAI}
            disabled={aiLoading || participantsWithPhotos === 0}
            loading={aiLoading}
          >
            Lancer l'analyse IA
          </Button>
        </div>
      )}

      {/* ── Chargement manuel (collapsible) ── */}
      <div className="panel2 p-4">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          <span>Chargement manuel (sans Supabase)</span>
          <span>{showManual ? '▲' : '▼'}</span>
        </button>

        {showManual && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)]">Récaps des participants (.json)</label>
              <input ref={fileRef} type="file" accept=".json" multiple onChange={handleFiles} className="mt-1" />
            </div>

            {recaps.length > 0 && (
              <div className="text-sm" style={{ color: 'var(--green)' }}>
                {recaps.length} fichier(s) : {recaps.map((r) => r.userName).join(', ')}
              </div>
            )}

            <Button
              onClick={() => handleAggregate(recaps)}
              disabled={!recaps.length || loading}
              loading={loading}
              className="w-full"
            >
              Agréger
            </Button>
          </div>
        )}
      </div>

      {/* ── Révéler ── */}
      {masterLeaderboard && (
        <Button variant="danger" className="w-full" size="lg" onClick={() => setShowReveal(true)}>
          🔥 RÉVÉLER LE CLASSEMENT
        </Button>
      )}

      {showReveal && masterLeaderboard && (
        <DramaReveal leaderboard={masterLeaderboard} onClose={() => setShowReveal(false)} />
      )}
    </div>
  );
}