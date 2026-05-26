import { useState } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { getCurrentWeek } from '../store/useChallengeStore';
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
  const { dailyLogs, bodyCompositions, weeklyScores } = useLogStore();
  const masterLeaderboard = useLeaderboardStore((s) => s.masterLeaderboard);
  const setMasterLeaderboard = useLeaderboardStore((s) => s.setMasterLeaderboard);
  const { showToast } = useToast();

  const [tab, setTab] = useState<'live' | 'sync'>('live');
  const [exportLoading, setExportLoading] = useState(false);
  const [lbLoading, setLbLoading] = useState(false);

  const currentWeek = getCurrentWeek(challenge.startDate);

  async function handleExportRecap() {
    setExportLoading(true);
    try {
      const allPhotos = [];
      for (let w = 0; w <= currentWeek; w++) {
        const p = await getPhotosByWeek(profile.id, w);
        if (p) allPhotos.push(p);
      }
      const recap = await generateRecapFile(
        profile,
        challenge.id,
        currentWeek,
        dailyLogs.filter((l) => l.userId === profile.id),
        bodyCompositions.filter((c) => c.userId === profile.id),
        allPhotos,
        weeklyScores.filter((s) => s.userId === profile.id),
      );
      exportRecapAsFile(recap);

      // Also push to Supabase if configured (non-blocking)
      const sb = supabase();
      if (sb) {
        sb.from('recaps').upsert({
          challenge_id: challenge.id,
          user_id: profile.id,
          week_number: currentWeek,
          exported_at: new Date().toISOString(),
          data: recap,
        }, { onConflict: 'challenge_id,user_id,week_number' }).then(({ error }) => {
          if (error) console.warn('Supabase recap push failed:', error);
        });
      }

      showToast(sb ? 'Récap exporté et synchronisé !' : 'Récap exporté !', 'success');
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
      setMasterLeaderboard(data.data as MasterLeaderboard);
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
                <div className="mt-3">
                  <input type="file" accept=".json" onChange={handleImportMaster} className="hidden" id="import-master" />
                  <label htmlFor="import-master">
                    <Button variant="ghost" size="sm" onClick={() => document.getElementById('import-master')?.click()}>
                      Importer le classement master
                    </Button>
                  </label>
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