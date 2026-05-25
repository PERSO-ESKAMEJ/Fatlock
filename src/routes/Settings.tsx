import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useChallengeStore } from '../store/useChallengeStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { DayType } from '../types';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { getDailyCode, getTodayStr } from '../lib/dailyCode';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_TYPES: { value: DayType | ''; label: string }[] = [
  { value: '', label: 'Repos / Non défini' },
  { value: 'muscu_j1', label: 'Muscu J1' },
  { value: 'muscu_j2', label: 'Muscu J2' },
  { value: 'muscu_j3', label: 'Muscu J3' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'repos', label: 'Repos actif' },
];

export default function Settings() {
  const { profile, challenge, updateProfile, updateChallenge, reset: resetProfile } = useProfileStore();
  const { reset: resetLogs } = useLogStore();
  const { reset: resetChallenge } = useChallengeStore();
  const { reset: resetLeaderboard } = useLeaderboardStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [weight, setWeight] = useState('');
  const [apiKey, setApiKey] = useState(challenge?.anthropicApiKey ?? '');
  const [trainingDays, setTrainingDays] = useState(profile?.trainingDays ?? {
    monday: null, tuesday: null, wednesday: null, thursday: null,
    friday: null, saturday: null, sunday: null,
  });
  const [showReset, setShowReset] = useState(false);

  if (!profile || !challenge) return null;

  const todayCode = getDailyCode(challenge.groupSecret, getTodayStr());

  function handleSaveProfile() {
    updateProfile({ age: parseInt(age) });
    showToast('Profil mis à jour', 'success');
  }

  function handleSaveTraining() {
    updateProfile({ trainingDays });
    showToast('Planning mis à jour', 'success');
  }

  function handleSaveApiKey() {
    updateChallenge({ anthropicApiKey: apiKey.trim() || undefined });
    showToast('Clé API sauvegardée', 'success');
  }

  function handleExportData() {
    const { dailyLogs, bodyCompositions, weeklyScores, aiResults } = useLogStore.getState();
    const data = { profile, challenge, dailyLogs, bodyCompositions, weeklyScores, aiResults };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatlock-backup-${profile.name.toLowerCase()}-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Données exportées', 'success');
  }

  function handleReset() {
    resetProfile();
    resetLogs();
    resetChallenge();
    resetLeaderboard();
    navigate('/');
  }

  return (
    <PageWrapper title="Paramètres">
      {/* Profile */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Profil</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label>Âge</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)} min="16" max="70" />
          </div>
          <div>
            <label>Nom</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              maxLength={30}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label>Taille (cm) — immutable</label>
            <input type="number" value={profile.height} disabled className="opacity-40 cursor-not-allowed" />
          </div>
          <div>
            <label>Sexe — immutable</label>
            <input type="text" value={profile.sex === 'M' ? 'Homme' : 'Femme'} disabled className="opacity-40 cursor-not-allowed" />
          </div>
        </div>
        <Button size="sm" onClick={handleSaveProfile}>Enregistrer</Button>
      </div>

      {/* Training schedule */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Planning hebdomadaire</div>
        <div className="space-y-2 mb-3">
          {DAYS.map((day, i) => (
            <div key={day} className="flex items-center gap-3">
              <div className="w-16 text-xs text-[var(--muted)]">{DAY_LABELS[i]}</div>
              <select
                value={trainingDays[day] ?? ''}
                onChange={(e) =>
                  setTrainingDays((td) => ({ ...td, [day]: (e.target.value as DayType) || null }))
                }
                className="flex-1"
              >
                {DAY_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <Button size="sm" onClick={handleSaveTraining}>Enregistrer le planning</Button>
      </div>

      {/* Challenge info */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Challenge</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Groupe</span>
            <span className="font-bold">{challenge.groupName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Code du groupe</span>
            <span className="font-mono font-bold" style={{ color: 'var(--blue-bright)' }}>{challenge.groupCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Mise en jeu</span>
            <span className="font-mono">{challenge.stakeAmount} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Début</span>
            <span className="font-mono">{challenge.startDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Code du jour</span>
            <span className="font-mono font-bold" style={{ color: 'var(--cyan)' }}>{todayCode}</span>
          </div>
        </div>
      </div>

      {/* API Key (admin only) */}
      {profile.isAdmin && (
        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Clé API Anthropic</div>
          <p className="text-xs text-[var(--muted2)] mb-3">
            Utilisée pour l'analyse IA lors du sync hebdomadaire. Stockée localement, jamais transmise sauf vers l'API Anthropic.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="mb-2"
          />
          <Button size="sm" onClick={handleSaveApiKey}>Enregistrer la clé</Button>
        </div>
      )}

      {/* Export */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Export des données</div>
        <Button variant="ghost" className="w-full" onClick={handleExportData}>
          Exporter toutes mes données JSON
        </Button>
      </div>

      {/* Danger zone */}
      <div className="panel p-4" style={{ borderColor: 'rgba(255,77,94,0.3)' }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--red)' }}>
          Zone Danger
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          Supprime toutes les données locales. Cette action est irréversible.
        </p>
        <Button variant="danger" className="w-full" onClick={() => setShowReset(true)}>
          Réinitialiser les données
        </Button>
      </div>

      <Modal open={showReset} onClose={() => setShowReset(false)} title="Réinitialiser ?">
        <p className="text-sm text-[var(--muted)] mb-4">
          Toutes tes données FATLOCK seront supprimées de cet appareil. Cette action est définitive.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowReset(false)}>Annuler</Button>
          <Button variant="danger" className="flex-1" onClick={handleReset}>Confirmer la suppression</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}