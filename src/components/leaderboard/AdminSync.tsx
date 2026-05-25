import { useState, useRef } from 'react';
import { useProfileStore } from '../../store/useProfileStore';
import { useLogStore } from '../../store/useLogStore';
import { useLeaderboardStore } from '../../store/useLeaderboardStore';
import { RecapFile, MasterLeaderboard, LeaderboardEntry } from '../../types';
import { calcCurrentStreak, getTier, calcCompositeScore } from '../../lib/scoring';
import { getCurrentWeek } from '../../store/useChallengeStore';
import { runAIAnalysis } from '../../lib/aiAnalysis';
import { getPhotosByWeek } from '../../lib/db';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import DramaReveal from './DramaReveal';

export default function AdminSync() {
  const challenge = useProfileStore((s) => s.challenge)!;
  const addAIResult = useLogStore((s) => s.addAIResult);
  const setMasterLeaderboard = useLeaderboardStore((s) => s.setMasterLeaderboard);
  const masterLeaderboard = useLeaderboardStore((s) => s.masterLeaderboard);
  const { showToast } = useToast();

  const [recaps, setRecaps] = useState<RecapFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentWeek = getCurrentWeek(challenge.startDate);

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
            const photos = await getPhotosByWeek(rProfile.id, currentWeek);
            if (photos) {
              const prevPhotos = [];
              for (let w = 1; w < currentWeek; w++) {
                const p = await getPhotosByWeek(rProfile.id, w);
                if (p) prevPhotos.push(p);
              }
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

      // Assign ranks by composite score descending
      entries.sort((a, b) => b.compositeScore - a.compositeScore);
      entries.forEach((e, i) => { e.currentRank = i + 1; });

      // Compute highlights
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

      // Export master file
      const blob = new Blob([JSON.stringify(lb)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatlock-master-S${currentWeek}.json`;
      a.click();
      URL.revokeObjectURL(url);

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
      <div className="panel2 p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
          Admin — Sync hebdomadaire
        </div>

        <div className="space-y-3">
          <div>
            <label>Charger les récaps de la team</label>
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
            <div className="text-sm text-[var(--green)]">
              {recaps.length} participant(s) chargé(s) : {recaps.map((r) => r.userName).join(', ')}
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