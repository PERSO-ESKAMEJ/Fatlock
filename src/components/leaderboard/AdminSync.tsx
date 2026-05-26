import { useState, useRef, useEffect } from 'react';
import { useProfileStore } from '../../store/useProfileStore';
import { useLogStore } from '../../store/useLogStore';
import { useLeaderboardStore } from '../../store/useLeaderboardStore';
import { RecapFile, MasterLeaderboard, LeaderboardEntry } from '../../types';
import { calcCurrentStreak, getTier, calcCompositeScore } from '../../lib/scoring';
import { getCurrentWeek } from '../../store/useChallengeStore';
import { runAIAnalysis } from '../../lib/aiAnalysis';
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
  const addAIResult = useLogStore((s) => s.addAIResult);
  const setMasterLeaderboard = useLeaderboardStore((s) => s.setMasterLeaderboard);
  const masterLeaderboard = useLeaderboardStore((s) => s.masterLeaderboard);
  const { showToast } = useToast();

  const [recaps, setRecaps] = useState<RecapFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [participantStatus, setParticipantStatus] = useState<RecapStatus[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentWeek = getCurrentWeek(challenge.startDate);
  const sb = supabase();

  async function fetchStatus() {
    if (!sb) return;
    setStatusLoading(true);
    try {
      const { data, error } = await sb
        .from('recaps')
        .select('user_id, exported_at, data->userName')
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
      // silencieux — pas de toast pour le refresh auto
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek]);

  async function handleFetchRecapsFromSupabase() {
    if (!sb) { showToast('Supabase non configuré', 'error'); return; }
    setLoading(true);
    try {
      const { data, error } = await sb
        .from('recaps')
        .select('data')
        .eq('challenge_id', challenge.id)
        .eq('week_number', currentWeek);
      if (error || !data?.length) { showToast('Aucun récap disponible sur Supabase', 'error'); return; }
      const parsed: RecapFile[] = data.map((row: { data: RecapFile }) => row.data);
      setRecaps(parsed);
      showToast(`${parsed.length} récap(s) chargé(s) depuis Supabase`, 'success');
    } catch {
      showToast('Erreur Supabase', 'error');
    } finally {
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

  async function handleAggregate() {
    if (!recaps.length) return;
    setLoading(true);
    try {
      const entries: LeaderboardEntry[] = [];

      for (const recap of recaps) {
        const { profile: rProfile, dailyLogs, weeklyScores, bodyCompositions } = recap;

        let credScore: number | undefined;
        if (challenge.anthropicApiKey) {
          try {
            const photos = recap.weeklyPhotos?.find((p) => p.weekNumber === currentWeek) ?? null;
            if (photos) {
              const latestComp = bodyCompositions[bodyCompositions.length - 1];
              const prevComp = bodyCompositions.length > 1 ? bodyCompositions[bodyCompositions.length - 2] : null;
              const result = await runAIAnalysis({
                userId: rProfile.id,
                weekNumber: currentWeek,
                prevCompo: prevComp,
                currCompo: latestComp,
                photo: photos,
                apiKey: challenge.anthropicApiKey,
              });
              addAIResult(result);
              credScore = result.credibilityScore;
            }
          } catch (err) {
            console.warn('AI analysis skipped for', rProfile.name, err);
          }
        }

        const totalEgo = weeklyScores.reduce((sum, s) => sum + s.egoPoints + s.streakBonus + s.aiBonus, 0);
        const latestScore = weeklyScores[weeklyScores.length - 1];
        const composite = latestScore
          ? calcCompositeScore(
              latestScore.egoPoints + latestScore.streakBonus + latestScore.aiBonus,
              latestScore.transformationScore,
              latestScore.regularityScore
            )
          : 0;

        entries.push({
          userId: rProfile.id,
          name: rProfile.name,
          sex: rProfile.sex,
          intensity: rProfile.intensity,
          currentRank: 0,
          previousRank: masterLeaderboard?.entries.find((e) => e.userId === rProfile.id)?.currentRank ?? 0,
          tier: getTier(totalEgo),
          cumulativeEgoPoints: totalEgo,
          regularityPercent: latestScore?.regularityScore ?? 0,
          transformationPercent: latestScore?.transformationScore ?? 0,
          compositeScore: composite,
          currentStreak: calcCurrentStreak(dailyLogs, rProfile.intensity),
          weeklyCredibilityScore: credScore,
        });
      }

      entries.sort((a, b) => b.compositeScore - a.compositeScore);
      entries.forEach((e, i) => { e.currentRank = i + 1; });

      const biggestMover = [...entries].sort((a, b) => (b.previousRank - b.currentRank) - (a.previousRank - a.currentRank))[0];
      const topStreak = [...entries].sort((a, b) => b.currentStreak - a.currentStreak)[0];
      const topCred = [...entries].sort((a, b) => (b.weeklyCredibilityScore ?? 0) - (a.weeklyCredibilityScore ?? 0))[0];

      const lb: MasterLeaderboard = {
        challengeId: challenge.id,
        updatedAt: new Date().toISOString(),
        weekNumber: currentWeek,
        entries,
        weeklyHighlights: {
          biggestMover: biggestMover?.userId ?? '',
          topStreak: topStreak?.userId ?? '',
          topCredibility: topCred?.userId ?? '',
        },
      };

      setMasterLeaderboard(lb);

      const blob = new Blob([JSON.stringify(lb)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatlock-master-S${currentWeek}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (sb) {
        await sb.from('master_leaderboards').upsert(
          { challenge_id: challenge.id, updated_at: lb.updatedAt, data: lb },
          { onConflict: 'challenge_id' }
        );
      }

      showToast('Classement généré et exporté !', 'success');
    } catch (err) {
      showToast('Erreur lors de la génération', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* Statut des récaps — visible uniquement si Supabase configuré */}
      {sb && (
        <div className="panel2 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              Récaps S{currentWeek} reçus
            </div>
            <button
              onClick={fetchStatus}
              disabled={statusLoading}
              className="text-xs text-[var(--blue-bright)] hover:opacity-70 transition-opacity"
            >
              {statusLoading ? '...' : '↻ Rafraîchir'}
            </button>
          </div>

          {participantStatus.length === 0 ? (
            <p className="text-xs text-[var(--muted2)]">
              Aucun récap reçu pour cette semaine. Les participants doivent cliquer sur "Générer mon récap".
            </p>
          ) : (
            <div className="space-y-2">
              {participantStatus.map((p) => (
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

          {participantStatus.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <Button
                className="w-full"
                onClick={handleFetchRecapsFromSupabase}
                disabled={loading}
                loading={loading}
              >
                Charger les {participantStatus.length} récap(s) et analyser →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Chargement manuel (fallback sans Supabase) */}
      <div className="panel2 p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
          {sb ? 'Chargement manuel (fallback)' : 'Admin — Sync hebdomadaire'}
        </div>

        <div className="space-y-3">
          <div>
            <label>Charger les récaps (.json)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              multiple
              onChange={handleFiles}
              className="mt-1"
            />
          </div>

          {recaps.length > 0 && (
            <div className="text-sm" style={{ color: 'var(--green)' }}>
              {recaps.length} participant(s) prêt(s) : {recaps.map((r) => r.userName).join(', ')}
            </div>
          )}

          <Button
            onClick={handleAggregate}
            disabled={!recaps.length}
            loading={loading}
            className="w-full"
          >
            Agréger et analyser
          </Button>
        </div>
      </div>

      {masterLeaderboard && (
        <Button
          variant="danger"
          className="w-full"
          size="lg"
          onClick={() => setShowReveal(true)}
        >
          🔥 RÉVÉLER LE CLASSEMENT
        </Button>
      )}

      {showReveal && masterLeaderboard && (
        <DramaReveal
          leaderboard={masterLeaderboard}
          onClose={() => setShowReveal(false)}
        />
      )}
    </div>
  );
}