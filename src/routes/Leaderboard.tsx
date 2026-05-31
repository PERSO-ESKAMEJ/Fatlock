import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { getCurrentWeek, getChallengeEndDate, getChallengeState, getDaysUntilStart } from '../store/useChallengeStore';
import { generateRecapFile, exportRecapAsFile } from '../lib/recap';
import { getPhotosByWeek } from '../lib/db';
import { supabase } from '../lib/supabase';
import RankingRow from '../components/leaderboard/RankingRow';
import AdminSync from '../components/leaderboard/AdminSync';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { MasterLeaderboard } from '../types';

export default function Leaderboard() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const { dailyLogs, bodyCompositions, weeklyScores, addAIResult } = useLogStore();
  const masterLeaderboard = useLeaderboardStore((s) => s.masterLeaderboard);
  const setMasterLeaderboard = useLeaderboardStore((s) => s.setMasterLeaderboard);
  const { showToast } = useToast();

  const [tab, setTab] = useState<'live' | 'sync'>('live');
  const [exportLoading, setExportLoading] = useState(false);
  const [lbLoading, setLbLoading] = useState(false);

  const navigate = useNavigate();
  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const currentWeek = getCurrentWeek(challenge.startDate, durationWeeks);
  const challengeState = getChallengeState(challenge.startDate, durationWeeks);

  if (challengeState === 'pending') {
    const daysLeft = getDaysUntilStart(challenge.startDate);
    return (
      <PageWrapper title="Classement">
        <div className="panel p-8 text-center mt-4">
          <div className="text-3xl mb-3">🔒</div>
          <div className="font-display text-xl uppercase tracking-wider text-[var(--ink)] mb-2">J-{daysLeft}</div>
          <div className="font-bold text-[var(--ink)] mb-1">Challenge pas encore commencé</div>
          <div className="text-sm text-[var(--muted)] mb-5">
            Le classement sera disponible dès le {new Date(challenge.startDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.
          </div>
          <button
            onClick={() => navigate('/checkin?week=0')}
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'var(--blue)', color: 'white' }}
          >
            Enregistrer mes mesures S0 →
          </button>
        </div>
      </PageWrapper>
    );
  }

  async function handleExportRecap() {
    setExportLoading(true);
    try {
      const allPhotos = [];
      for (let w = 0; w <= currentWeek; w++) {
        const p = await getPhotosByWeek(profile.id, w);
        if (p) allPhotos.push(p);
      }
      const challengeEnd = getChallengeEndDate(challenge.startDate, durationWeeks);
      const recap = await generateRecapFile(
        profile,
        challenge.id,
        currentWeek,
        dailyLogs.filter((l) => l.userId === profile.id && l.date >= challenge.startDate && l.date <= challengeEnd),
        bodyCompositions.filter((c) => c.userId === profile.id && c.weekNumber <= currentWeek),
        allPhotos,
        weeklyScores.filter((s) => s.userId === profile.id && s.weekNumber <= currentWeek),
      );
      exportRecapAsFile(recap);

      const sb = supabase();
      if (sb) {
        // Photos exclues du payload Postgres : elles sont dans Supabase Storage.
        // Ça évite de saturer le free tier Supabase avec des lignes JSONB > 1 Mo.
        const { weeklyPhotos: _photos, ...recapWithoutPhotos } = recap;
        const { error } = await sb.from('recaps').upsert({
          challenge_id: challenge.id,
          user_id: profile.id,
          week_number: currentWeek,
          exported_at: new Date().toISOString(),
          data: recapWithoutPhotos,
        }, { onConflict: 'challenge_id,user_id,week_number' });

        if (error) {
          console.error('Supabase recap push failed:', error);
          showToast('Récap exporté (⚠ sync Supabase échoué — partage le fichier manuellement)', 'error');
        } else {
          showToast('Récap envoyé à l\'admin !', 'success');
        }
      } else {
        showToast('Récap exporté — envoie le fichier à l\'admin', 'success');
      }
    } catch (err) {
      showToast('Erreur lors de l\'export', 'error');
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  }

  async function handleFetchMasterFromSupabase() {
    const sb = supabase();
    if (!sb) { showToast('Supabase non configuré', 'error'); return; }
    setLbLoading(true);
    try {
      const { data, error } = await sb
        .from('master_leaderboards')
        .select('data')
        .eq('challenge_id', challenge.id)
        .single();
      if (error || !data) { showToast('Aucun classement disponible', 'error'); return; }
      const lb = data.data as MasterLeaderboard;
      setMasterLeaderboard(lb);
      // Extraire et sauvegarder localement le résultat IA du participant courant
      const myAI = lb.aiAnalyses?.find((r) => r.userId === profile.id);
      if (myAI) addAIResult(myAI);
      showToast('Classement mis à jour !', 'success');
    } catch {
      showToast('Erreur Supabase', 'error');
    } finally {
      setLbLoading(false);
    }
  }

  async function handleImportMaster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as MasterLeaderboard;
      setMasterLeaderboard(data);
      showToast('Classement mis à jour !', 'success');
    } catch {
      showToast('Fichier invalide', 'error');
    }
  }

  const entries = masterLeaderboard?.entries ?? [];

  return (
    <PageWrapper title="Classement">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--panel)' }}>
        <button
          onClick={() => setTab('live')}
          className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
          style={{ background: tab === 'live' ? 'var(--blue)' : 'transparent', color: tab === 'live' ? 'white' : 'var(--muted)' }}
        >
          Classement en direct
        </button>
        <button
          onClick={() => setTab('sync')}
          className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
          style={{ background: tab === 'sync' ? 'var(--blue)' : 'transparent', color: tab === 'sync' ? 'white' : 'var(--muted)' }}
        >
          Sync hebdo
        </button>
      </div>

      {/* Live tab */}
      {tab === 'live' && (
        <div>
          {masterLeaderboard && (
            <div className="text-xs text-[var(--muted)] mb-3 flex items-center justify-between">
              <span>Semaine {masterLeaderboard.weekNumber} · {new Date(masterLeaderboard.updatedAt).toLocaleDateString('fr-FR')}</span>
            </div>
          )}

          {entries.length === 0 ? (
            <div className="panel p-6 text-center">
              <div className="text-3xl mb-3">🏆</div>
              <div className="font-bold text-[var(--ink)] mb-1">Classement non disponible</div>
              <p className="text-sm text-[var(--muted)]">
                {profile.isAdmin
                  ? 'Va dans "Sync hebdo" pour charger les récaps de l\'équipe et générer le classement.'
                  : 'L\'admin n\'a pas encore partagé le classement. Importe le fichier master ci-dessous.'}
              </p>
              {!profile.isAdmin && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  {supabase() && (
                    <Button size="sm" onClick={handleFetchMasterFromSupabase} loading={lbLoading}>
                      ↻ Récupérer le classement
                    </Button>
                  )}
                  <input type="file" accept=".json" onChange={handleImportMaster} className="hidden" id="import-master" />
                  <button
                    onClick={() => document.getElementById('import-master')?.click()}
                    className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    Importer un fichier master →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <RankingRow
                  key={entry.userId}
                  entry={entry}
                  isCurrentUser={entry.userId === profile.id}
                  animDelay={i * 50}
                />
              ))}
              {!profile.isAdmin && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {supabase() && (
                    <Button size="sm" variant="ghost" onClick={handleFetchMasterFromSupabase} loading={lbLoading}>
                      ↻ Sync Supabase
                    </Button>
                  )}
                  <input type="file" accept=".json" onChange={handleImportMaster} className="hidden" id="import-master-2" />
                  <button
                    onClick={() => document.getElementById('import-master-2')?.click()}
                    className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    Importer fichier master →
                  </button>
                </div>
              )}

              {/* Mur de la honte — visible si au moins un score IA existe */}
              {entries.some((e) => e.weeklyCredibilityScore != null) && (
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--red)' }}>
                    <span>⚠</span>
                    <span>Crédibilité IA — Semaine {masterLeaderboard?.weekNumber}</span>
                    <span className="text-[var(--muted2)] font-normal normal-case tracking-normal">· signal indicatif</span>
                  </div>
                  <div className="space-y-2">
                    {[...entries]
                      .filter((e) => e.weeklyCredibilityScore != null)
                      .sort((a, b) => (a.weeklyCredibilityScore ?? 0) - (b.weeklyCredibilityScore ?? 0))
                      .map((entry) => {
                        const score = entry.weeklyCredibilityScore!;
                        const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--gold)' : 'var(--red)';
                        const label = score >= 75 ? 'Crédible' : score >= 50 ? 'Douteux' : 'Suspect';
                        return (
                          <div key={entry.userId} className="panel2 p-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: `${color}22`, border: `1px solid ${color}`, color }}>
                              {score}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${entry.userId === profile.id ? 'text-[var(--blue-bright)]' : 'text-[var(--ink)]'}`}>
                                  {entry.name}{entry.userId === profile.id && <span className="text-xs text-[var(--muted)] ml-1">(toi)</span>}
                                </span>
                                <span className="text-xs font-bold" style={{ color }}>{label}</span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-xs text-[var(--muted2)] mt-2">
                    Classé du plus suspect au plus crédible. Impact limité sur le score final.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sync tab */}
      {tab === 'sync' && (
        <div className="space-y-4">
          {/* Export recap — visible pour les participants uniquement */}
          {!profile.isAdmin && (
            <div className="panel p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
                Mon récap
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">
                Envoie ton récap hebdomadaire à l'admin pour qu'il génère le classement.
              </p>
              <Button
                className="w-full"
                onClick={handleExportRecap}
                loading={exportLoading}
              >
                Envoyer mon récap S{currentWeek}
              </Button>
            </div>
          )}

          {/* Admin sync */}
          {profile.isAdmin && <AdminSync />}

          {!profile.isAdmin && (
            <div className="panel2 p-4 text-sm text-[var(--muted)]">
              <div className="font-bold text-[var(--ink)] mb-1">Tu n'es pas admin</div>
              Seul l'admin du groupe peut générer le classement officiel.
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}