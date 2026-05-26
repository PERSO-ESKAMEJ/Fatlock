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
  const { profile, challenge, entries, activeId, switchEntry, updateProfile, updateChallenge, reset: resetProfile } = useProfileStore();
  const { reset: resetLogs } = useLogStore();
  const { reset: resetChallenge } = useChallengeStore();
  const { reset: resetLeaderboard } = useLeaderboardStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [apiKey, setApiKey] = useState(challenge?.anthropicApiKey ?? '');
  const [supabaseUrl, setSupabaseUrl] = useState(challenge?.supabaseUrl ?? '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(challenge?.supabaseAnonKey ?? '');
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

  function handleSaveSupabase() {
    updateChallenge({
      supabaseUrl: supabaseUrl.trim() || undefined,
      supabaseAnonKey: supabaseAnonKey.trim() || undefined,
    });
    showToast('Supabase configuré', 'success');
  }

  function handleExportData() {
    const { dailyLogs, bodyCompositions, weeklyScores, aiResults } = useLogStore.getState();
    const data = { profile, challenge, dailyLogs, bodyCompositions, weeklyScores, aiResults };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatlock-backup-${profile?.name.toLowerCase()}-${getTodayStr()}.json`;
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
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--muted)] mb-1">Lien d'invitation</div>
          <button
            className="w-full text-left font-mono text-xs p-2 rounded break-all transition-all hover:opacity-80"
            style={{ background: 'var(--panel2)', color: 'var(--blue-bright)', border: '1px solid var(--border)' }}
            onClick={() => {
              const base = window.location.origin + import.meta.env.BASE_URL;
              let link = `${base}?join=${challenge.groupCode}&gname=${encodeURIComponent(challenge.groupName)}&cid=${challenge.id}`;
              if (challenge.supabaseUrl) link += `&sb_url=${encodeURIComponent(challenge.supabaseUrl)}`;
              if (challenge.supabaseAnonKey) link += `&sb_key=${encodeURIComponent(challenge.supabaseAnonKey)}`;
              navigator.clipboard.writeText(link).then(() => showToast('Lien copié !', 'success'));
            }}
          >
            ?join={challenge.groupCode}&gname={encodeURIComponent(challenge.groupName)}{challenge.supabaseUrl ? ' +supabase' : ''}
          </button>
          <p className="text-xs text-[var(--muted2)] mt-1">Clique pour copier. Partage ce lien aux participants.</p>
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

      {/* Supabase (admin only) */}
      {profile.isAdmin && (
        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Supabase — Sync photos & classement</div>
          <p className="text-xs text-[var(--muted2)] mb-3">
            Permet le partage automatique des photos et du classement entre participants. URL + clé anon disponibles dans ton projet Supabase → Settings → API.
          </p>
          <div className="space-y-2 mb-2">
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
            />
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGci... (anon key)"
            />
          </div>
          <Button size="sm" onClick={handleSaveSupabase}>Enregistrer</Button>
        </div>
      )}

      {/* Groups */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Mes groupes</div>
        <div className="space-y-2 mb-3">
          {entries.map((entry) => (
            <div
              key={entry.profile.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--panel2)', border: `1px solid ${entry.profile.id === activeId ? 'var(--blue)' : 'var(--border)'}` }}
            >
              <div>
                <div className="text-sm font-bold text-[var(--ink)]">{entry.profile.name}</div>
                <div className="text-xs text-[var(--muted)]">{entry.challenge.groupName}</div>
              </div>
              {entry.profile.id === activeId ? (
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'var(--blue)', color: 'white' }}>Actif</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => { switchEntry(entry.profile.id); navigate('/dashboard'); }}>
                  Basculer
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" className="w-full" onClick={() => navigate('/?add=1')}>
          + Rejoindre / Créer un groupe
        </Button>
      </div>

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
          Quitte le groupe actif et supprime ses données locales. Si c'est ton seul groupe, toutes les données sont effacées.
        </p>
        <Button variant="danger" className="w-full" onClick={() => setShowReset(true)}>
          Quitter ce groupe
        </Button>
      </div>

      <Modal open={showReset} onClose={() => setShowReset(false)} title="Quitter ce groupe ?">
        <p className="text-sm text-[var(--muted)] mb-1">
          Groupe : <span className="font-bold text-[var(--ink)]">{challenge.groupName}</span>
        </p>
        <p className="text-sm text-[var(--muted)] mb-4">
          Tes données pour ce groupe seront supprimées de cet appareil. Cette action est définitive.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowReset(false)}>Annuler</Button>
          <Button variant="danger" className="flex-1" onClick={handleReset}>Confirmer</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}