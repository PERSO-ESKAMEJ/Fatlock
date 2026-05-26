import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useChallengeStore } from '../store/useChallengeStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { DayType, UserProfile, ChallengeConfig } from '../types';
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
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Record<string, unknown> | null>(null);

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

  function handleFullBackup() {
    const logState = useLogStore.getState();
    const challengeState = useChallengeStore.getState();
    const { masterLeaderboard } = useLeaderboardStore.getState();
    const data = {
      _version: 1,
      _exportedAt: new Date().toISOString(),
      _note: 'Les photos ne sont pas incluses dans ce backup (stockage local uniquement). Exportez-les manuellement si nécessaire.',
      profile,
      challenge,
      logs: {
        dailyLogs: logState.dailyLogs,
        bodyCompositions: logState.bodyCompositions,
        weeklyScores: logState.weeklyScores,
        aiResults: logState.aiResults,
      },
      challengeStore: {
        codeConfirmedDates: challengeState.codeConfirmedDates,
      },
      masterLeaderboard,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatlock-backup-${profile!.name.toLowerCase().replace(/\s+/g, '-')}-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup complet exporté', 'success');
  }

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.profile || !parsed.challenge || !parsed.logs) {
          showToast('Fichier invalide', 'error');
          return;
        }
        setPendingRestore(parsed);
        setShowRestoreConfirm(true);
      } catch {
        showToast('Fichier JSON invalide', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleConfirmRestore() {
    if (!pendingRestore) return;
    const { profile: p, challenge: c, logs, challengeStore, masterLeaderboard } = pendingRestore as Record<string, unknown>;

    const profileStore = useProfileStore.getState();
    profileStore.reset();
    const restoredProfile = p as UserProfile;
    const restoredChallenge = c as ChallengeConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useProfileStore as any).setState((s: typeof profileStore) => {
      const newEntry = { profile: restoredProfile, challenge: restoredChallenge };
      const existingIdx = s.entries.findIndex((e) => e.profile.id === restoredProfile.id);
      const entries = existingIdx >= 0
        ? s.entries.map((e, i) => i === existingIdx ? newEntry : e)
        : [...s.entries, newEntry];
      return { entries, activeId: restoredProfile.id, profile: restoredProfile, challenge: restoredChallenge };
    });

    const logTyped = logs as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useLogStore as any).setState({
      dailyLogs: logTyped.dailyLogs ?? [],
      bodyCompositions: logTyped.bodyCompositions ?? [],
      weeklyScores: logTyped.weeklyScores ?? [],
      aiResults: logTyped.aiResults ?? [],
    });

    if (challengeStore) {
      const csTyped = challengeStore as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useChallengeStore as any).setState({ codeConfirmedDates: csTyped.codeConfirmedDates ?? [] });
    }

    if (masterLeaderboard) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useLeaderboardStore.getState().setMasterLeaderboard(masterLeaderboard as any);
    }

    showToast('Données restaurées — rechargement…', 'success');
    setShowRestoreConfirm(false);
    setPendingRestore(null);
    setTimeout(() => window.location.reload(), 1200);
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
              let link = `${base}?join=${challenge.groupCode}&gname=${encodeURIComponent(challenge.groupName)}&cid=${challenge.id}&sd=${challenge.startDate}&dw=${challenge.durationWeeks ?? 8}&stake=${challenge.stakeAmount}&aid=${challenge.adminId}`;
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

      {/* Backup / Restore */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Sauvegarde & Restauration</div>
        <p className="text-xs text-[var(--muted2)] mb-3">
          Le backup inclut profil, challenge, logs, classement et rituels confirmés. Les photos (IndexedDB) ne sont pas incluses.
        </p>
        <Button variant="ghost" className="w-full mb-2" onClick={handleFullBackup}>
          Exporter le backup complet
        </Button>
        <label
          className="block w-full text-center text-sm font-medium py-2 px-4 rounded-lg cursor-pointer transition-all hover:opacity-80"
          style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          Restaurer depuis un backup
          <input type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
        </label>
      </div>

      {/* Danger zone */}
      <div className="panel p-4" style={{ borderColor: 'rgba(255,77,94,0.3)' }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--red)' }}>
          Zone Danger
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          Supprime toutes les données de ce groupe sur cet appareil. Irréversible.
        </p>
        <Button variant="danger" className="w-full" onClick={() => setShowReset(true)}>
          Supprimer ce groupe
        </Button>
      </div>

      <Modal open={showReset} onClose={() => setShowReset(false)} title="Supprimer ce groupe ?">
        <p className="text-sm text-[var(--muted)] mb-1">
          Groupe : <span className="font-bold text-[var(--ink)]">{challenge.groupName}</span>
        </p>
        <p className="text-sm text-[var(--muted)] mb-4">
          Toutes tes données locales pour ce groupe seront effacées définitivement — logs, pesées, photos, scores.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowReset(false)}>Annuler</Button>
          <Button variant="danger" className="flex-1" onClick={handleReset}>Supprimer définitivement</Button>
        </div>
      </Modal>

      <Modal open={showRestoreConfirm} onClose={() => { setShowRestoreConfirm(false); setPendingRestore(null); }} title="Restaurer ce backup ?">
        <p className="text-sm text-[var(--muted)] mb-2">
          Les données actuelles du profil <span className="font-bold text-[var(--ink)]">{profile.name}</span> seront écrasées par le backup.
        </p>
        <p className="text-xs text-[var(--muted2)] mb-4">
          L'app rechargera automatiquement après la restauration.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => { setShowRestoreConfirm(false); setPendingRestore(null); }}>Annuler</Button>
          <Button variant="danger" className="flex-1" onClick={handleConfirmRestore}>Restaurer</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}