import { useState } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { getCurrentWeek } from '../store/useChallengeStore';
import { generateRecapFile, exportRecapAsFile } from '../lib/recap';
import { getPhotosByWeek } from '../lib/db';
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
      showToast('Récap exporté !', 'success');
    } catch (err) {
      showToast('Erreur lors de l\'export', 'error');
      console.error(err);
    } finally {
      setExportLoading(false);
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
                <div className="mt-3">
                  <input type="file" accept=".json" onChange={handleImportMaster} className="hidden" id="import-master-2" />
                  <button
                    onClick={() => document.getElementById('import-master-2')?.click()}
                    className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    Mettre à jour avec un nouveau fichier master →
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
          {/* Export recap */}
          <div className="panel p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
              Mon récap
            </div>
            <p className="text-sm text-[var(--muted)] mb-3">
              Génère ton fichier récap hebdomadaire et envoie-le à l'admin du groupe.
            </p>
            <Button
              className="w-full"
              onClick={handleExportRecap}
              loading={exportLoading}
            >
              Générer mon récap S{currentWeek}
            </Button>
          </div>

          {/* Admin sync */}
          {profile.isAdmin && <AdminSync />}

          {!profile.isAdmin && (
            <div className="panel2 p-4 text-sm text-[var(--muted)]">
              <div className="font-bold text-[var(--ink)] mb-1">Tu n'es pas admin</div>
              Seul l'admin du groupe peut charger les récaps et générer le classement officiel.
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}