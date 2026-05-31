import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChallengeState } from '../store/useChallengeStore';
import { QRCodeSVG } from 'qrcode.react';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useChallengeStore } from '../store/useChallengeStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { DayType, UserProfile, ChallengeConfig, Intensity } from '../types';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { getDailyCode, getTodayStr } from '../lib/dailyCode';
import { clearAllPhotos, clearUserPhotos } from '../lib/db';
import { supabase } from '../lib/supabase';

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
  const { profile, challenge, entries, activeId, switchEntry, updateProfile, updateChallenge, reset: resetProfile, resetAll } = useProfileStore();
  const { removeUserData, reset: resetLogs } = useLogStore();
  const { reset: resetChallenge } = useChallengeStore();
  const { reset: resetLeaderboard } = useLeaderboardStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const durationWeeks = challenge?.durationWeeks ?? challenge?.customSettings?.durationWeeks ?? 8;
  const challengeState = challenge ? getChallengeState(challenge.startDate, durationWeeks) : 'pending';
  const isLocked = challengeState !== 'pending';

  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [intensity, setIntensity] = useState<Intensity>(profile?.intensity ?? 'standard');
  const [apiKey, setApiKey] = useState(challenge?.anthropicApiKey ?? '');
  const [supabaseUrl, setSupabaseUrl] = useState(challenge?.supabaseUrl ?? '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(challenge?.supabaseAnonKey ?? '');
  const [trainingDays, setTrainingDays] = useState(profile?.trainingDays ?? {
    monday: null, tuesday: null, wednesday: null, thursday: null,
    friday: null, saturday: null, sunday: null,
  });
  const [showReset, setShowReset] = useState(false);
  const [showResetAll, setShowResetAll] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<{ user_id: string; user_name: string; joined_at: string }[]>([]);
  const [excludedMembers, setExcludedMembers] = useState<{ user_id: string; user_name: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (profile?.isAdmin && supabase()) fetchMembers();
  }, [challenge?.supabaseUrl, challenge?.supabaseAnonKey]);

  if (!profile || !challenge) return null;

  async function fetchMembers() {
    const sb = supabase();
    if (!sb) return;
    setLoadingMembers(true);
    const [{ data: mData }, { data: eData }] = await Promise.all([
      sb.from('group_members').select('user_id, user_name, joined_at').eq('challenge_id', challenge!.id).order('joined_at'),
      sb.from('excluded_members').select('user_id, user_name').eq('challenge_id', challenge!.id),
    ]);
    setMembers(mData ?? []);
    setExcludedMembers(eData ?? []);
    setLoadingMembers(false);
  }

  async function handleRemoveMember(userId: string, userName: string) {
    const sb = supabase();
    if (!sb) return;
    await Promise.all([
      sb.from('group_members').delete().eq('challenge_id', challenge!.id).eq('user_id', userId),
      sb.from('excluded_members').upsert({ challenge_id: challenge!.id, user_id: userId, user_name: userName }, { onConflict: 'challenge_id,user_id' }),
    ]);
    setMembers((prev: { user_id: string; user_name: string; joined_at: string }[]) => prev.filter((x) => x.user_id !== userId));
    setExcludedMembers((prev: { user_id: string; user_name: string }[]) => [...prev.filter((x) => x.user_id !== userId), { user_id: userId, user_name: userName }]);
    showToast(`${userName} exclu du challenge`, 'success');
  }

  async function handleReinstateMember(userId: string, userName: string) {
    const sb = supabase();
    if (!sb) return;
    await sb.from('excluded_members').delete().eq('challenge_id', challenge!.id).eq('user_id', userId);
    setExcludedMembers((prev: { user_id: string; user_name: string }[]) => prev.filter((x) => x.user_id !== userId));
    showToast(`${userName} réintégré`, 'success');
  }

  const todayCode = getDailyCode(challenge.groupSecret, getTodayStr());

  function buildInviteLink(): string {
    const c = challenge!;
    const base = window.location.origin + import.meta.env.BASE_URL;
    const dw = c.durationWeeks ?? c.customSettings?.durationWeeks ?? 8;
    let link = `${base}?join=${c.groupCode}&gname=${encodeURIComponent(c.groupName)}&cid=${c.id}&sd=${c.startDate}&dw=${dw}&stake=${c.stakeAmount}&aid=${c.adminId}`;
    if (c.challengeType === 'custom' && c.customSettings) {
      link += `&ct=custom&cs=${encodeURIComponent(JSON.stringify(c.customSettings))}`;
    }
    if (c.supabaseUrl) link += `&sb_url=${encodeURIComponent(c.supabaseUrl)}`;
    if (c.supabaseAnonKey) link += `&sb_key=${encodeURIComponent(c.supabaseAnonKey)}`;
    return link;
  }

  function handleSaveProfile() {
    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge < 10 || parsedAge > 100) {
      showToast('Âge invalide', 'error');
      return;
    }
    const updates: Partial<UserProfile> = { age: parsedAge };
    if (!isLocked) updates.intensity = intensity;
    updateProfile(updates);
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
    const profileState = useProfileStore.getState();
    const data = {
      _version: 2,
      _exportedAt: new Date().toISOString(),
      _note: 'Les photos ne sont pas incluses dans ce backup (stockage local uniquement). Exportez-les manuellement si nécessaire.',
      // v2 : tous les groupes sont sauvegardés
      activeId: profileState.activeId,
      entries: profileState.entries,
      // Rétro-compatibilité v1
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
    localStorage.setItem(`fatlock-backup-${challenge!.id}`, new Date().toISOString());
    showToast('Backup complet exporté', 'success');
  }

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const isV2 = parsed._version === 2 && Array.isArray(parsed.entries) && parsed.activeId && parsed.logs;
        const isV1 = !parsed._version && parsed.profile && parsed.challenge && parsed.logs;
        if (!isV1 && !isV2) {
          showToast('Fichier invalide ou format inconnu', 'error');
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
    const { logs, challengeStore, masterLeaderboard } = pendingRestore as Record<string, unknown>;
    const version = (pendingRestore._version as number) ?? 1;

    if (version >= 2) {
      const { entries: restoredEntries, activeId: restoredActiveId } = pendingRestore as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedEntries = restoredEntries as any[];
      const activeEntry = typedEntries.find((e: any) => e.profile.id === restoredActiveId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useProfileStore as any).setState({
        entries: typedEntries,
        activeId: restoredActiveId,
        profile: activeEntry?.profile ?? null,
        challenge: activeEntry?.challenge ?? null,
      });
    } else {
      const { profile: p, challenge: c } = pendingRestore as Record<string, unknown>;
      const profileStore = useProfileStore.getState();
      profileStore.reset();
      const restoredProfile = p as UserProfile;
      const restoredChallenge = c as ChallengeConfig;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useProfileStore as any).setState((s: typeof profileStore) => {
        const newEntry = { profile: restoredProfile, challenge: restoredChallenge };
        const existingIdx = s.entries.findIndex((e) => e.profile.id === restoredProfile.id);
        const newEntries = existingIdx >= 0
          ? s.entries.map((e, i) => i === existingIdx ? newEntry : e)
          : [...s.entries, newEntry];
        return { entries: newEntries, activeId: restoredProfile.id, profile: restoredProfile, challenge: restoredChallenge };
      });
    }

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
      const rawDates = csTyped.codeConfirmedDates;
      const codeConfirmedDates = Array.isArray(rawDates) ? {} : (rawDates ?? {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useChallengeStore as any).setState({ codeConfirmedDates });
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

  function handleResetAll() {
    resetAll();
    resetLogs();
    resetChallenge();
    resetLeaderboard();
    clearAllPhotos().catch(() => undefined);
    navigate('/');
  }

  function handleReset() {
    const userId = profile!.id;
    const isLastEntry = entries.length <= 1;
    resetProfile();
    removeUserData(userId);
    if (isLastEntry) {
      resetLogs();
      resetChallenge();
      resetLeaderboard();
      clearAllPhotos().catch(() => undefined);
    } else {
      clearUserPhotos(userId).catch(() => undefined);
    }
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
        {/* Intensité — modifiable avant le J1 seulement */}
        <div className="mb-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <label className="mb-0">Rythme d'intensité</label>
            {isLocked && (
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(255,200,0,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,200,0,0.3)' }}>
                🔒 Figé au J1
              </span>
            )}
          </div>
          {isLocked ? (
            <div
              className="w-full p-3 rounded-lg font-display text-lg uppercase tracking-wider font-bold"
              style={{
                background: 'var(--panel2)', border: '1px solid var(--border)', opacity: 0.6, cursor: 'not-allowed',
                color: intensity === 'safe' ? 'var(--safe)' : intensity === 'standard' ? 'var(--standard)' : 'var(--flow)',
              }}
            >
              {intensity === 'safe' ? 'SÛRE' : intensity === 'standard' ? 'STANDARD' : 'FLOW'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'safe'    as Intensity, label: 'SÛRE',     color: 'var(--safe)',     mult: '×1.0' },
                { value: 'standard'as Intensity, label: 'STANDARD', color: 'var(--standard)', mult: '×1.4' },
                { value: 'flow'    as Intensity, label: 'FLOW',     color: 'var(--flow)',     mult: '×2.0' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIntensity(opt.value)}
                  className="p-2 rounded-lg text-center transition-all"
                  style={{
                    background: intensity === opt.value ? `color-mix(in srgb, ${opt.color} 15%, transparent)` : 'var(--panel2)',
                    border: `2px solid ${intensity === opt.value ? opt.color : 'var(--border)'}`,
                  }}
                >
                  <div className="font-display text-xs uppercase font-bold" style={{ color: opt.color }}>{opt.label}</div>
                  <div className="font-mono text-xs" style={{ color: opt.color }}>{opt.mult}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={handleSaveProfile}>Enregistrer</Button>
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Code de récupération</div>
          <p className="text-xs text-[var(--muted2)] mb-2">
            Permet de récupérer ton compte via le lien d'invitation si tu perds tes données.
          </p>
          <button
            className="w-full font-mono text-xs p-2 rounded-lg text-left break-all transition-all hover:opacity-80"
            style={{ background: 'var(--panel2)', color: 'var(--blue-bright)', border: '1px solid var(--border)' }}
            onClick={() => navigator.clipboard.writeText(profile.id).then(() => showToast('Code copié !', 'success'))}
          >
            {profile.id}
          </button>
          <p className="text-xs text-[var(--muted2)] mt-1">Clique pour copier.</p>
        </div>
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
        {profile.isAdmin && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-[var(--muted)]">Lien d'invitation</div>
            <button
              onClick={() => setShowQR((v) => !v)}
              className="text-xs px-2 py-1 rounded transition-all hover:opacity-80"
              style={{ background: showQR ? 'var(--blue)' : 'var(--panel2)', color: showQR ? 'white' : 'var(--muted)', border: '1px solid var(--border)' }}
            >
              {showQR ? 'Masquer QR' : 'QR Code'}
            </button>
          </div>
          <button
            className="w-full text-left font-mono text-xs p-2 rounded break-all transition-all hover:opacity-80"
            style={{ background: 'var(--panel2)', color: 'var(--blue-bright)', border: '1px solid var(--border)' }}
            onClick={() => navigator.clipboard.writeText(buildInviteLink()).then(() => showToast('Lien copié !', 'success'))}
          >
            ?join={challenge.groupCode}&gname={encodeURIComponent(challenge.groupName)}{challenge.supabaseUrl ? ' +supabase' : ''}
          </button>
          <p className="text-xs text-[var(--muted2)] mt-1">Clique pour copier. Partage ce lien aux participants.</p>
          {showQR && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="p-3 rounded-xl" style={{ background: 'white' }}>
                <QRCodeSVG value={buildInviteLink()} size={200} />
              </div>
              <p className="text-xs text-[var(--muted2)] text-center">Scanne ce QR code pour rejoindre le challenge sans copier le lien.</p>
            </div>
          )}
          {challenge.supabaseAnonKey && (
            <div className="mt-2 px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(255,200,0,0.07)', border: '1px solid rgba(255,200,0,0.2)', color: 'var(--muted)' }}>
              <span style={{ color: 'var(--gold)' }}>⚠</span> Ce lien contient ta clé Supabase anon. Elle est publique par nature mais ne la partage qu'avec les participants de confiance.
            </div>
          )}
        </div>
        )}
      </div>

      {/* Membres du groupe (admin only) */}
      {profile.isAdmin && (
        <div className="panel p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Membres inscrits</div>
            <button
              onClick={fetchMembers}
              disabled={loadingMembers}
              className="text-xs px-2 py-1 rounded transition-all"
              style={{ background: 'var(--panel2)', color: 'var(--muted)', border: '1px solid var(--border)', opacity: loadingMembers ? 0.5 : 1 }}
            >
              {loadingMembers ? '…' : '↻ Rafraîchir'}
            </button>
          </div>
          {!supabase() ? (
            <p className="text-xs text-[var(--muted2)]">Configure Supabase ci-dessous pour voir les membres.</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-[var(--muted2)]">{loadingMembers ? 'Chargement…' : 'Aucun membre inscrit pour l\'instant.'}</p>
          ) : (
            <>
              <div className="space-y-2">
                {members.map((m: { user_id: string; user_name: string; joined_at: string }) => (
                  <div key={m.user_id} className="flex items-center justify-between panel2 px-3 py-2 rounded-lg gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[var(--ink)] truncate">{m.user_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {new Date(m.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.user_id, m.user_name)}
                      className="text-xs px-2 py-1 rounded flex-shrink-0 transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,77,94,0.1)', color: 'var(--red)', border: '1px solid rgba(255,77,94,0.3)' }}
                    >
                      Exclure
                    </button>
                  </div>
                ))}
                <p className="text-xs text-[var(--muted2)] pt-1">{members.length} participant{members.length > 1 ? 's' : ''} · Toi non inclus</p>
              </div>
              {excludedMembers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--red)' }}>Exclus du challenge</div>
                  <div className="space-y-2">
                    {excludedMembers.map((m: { user_id: string; user_name: string }) => (
                      <div key={m.user_id} className="flex items-center justify-between panel2 px-3 py-2 rounded-lg gap-2" style={{ opacity: 0.6 }}>
                        <span className="text-sm text-[var(--muted)] truncate">{m.user_name}</span>
                        <button
                          onClick={() => handleReinstateMember(m.user_id, m.user_name)}
                          className="text-xs px-2 py-1 rounded flex-shrink-0 transition-all hover:opacity-80"
                          style={{ background: 'rgba(47,227,154,0.1)', color: 'var(--green)', border: '1px solid rgba(47,227,154,0.3)' }}
                        >
                          Réintégrer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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

      {/* Rappel backup */}
      {(() => {
        const lastBackupStr = localStorage.getItem(`fatlock-backup-${challenge.id}`);
        const daysSince = lastBackupStr ? (Date.now() - new Date(lastBackupStr).getTime()) / 86400000 : null;
        if (lastBackupStr && daysSince !== null && daysSince <= 7) return null;
        return (
          <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3" style={{ background: 'rgba(255,200,0,0.07)', border: '1px solid rgba(255,200,0,0.25)' }}>
            <span style={{ color: 'var(--gold)', fontSize: '1.1rem', flexShrink: 0 }}>⚠</span>
            <div>
              <div className="text-xs font-bold mb-0.5" style={{ color: 'var(--gold)' }}>
                {lastBackupStr ? `Dernier backup il y a ${Math.floor(daysSince!)} jours` : 'Aucun backup effectué'}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Fais un backup régulièrement pour pouvoir récupérer tes données en cas de problème.
              </p>
            </div>
          </div>
        );
      })()}

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
        <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(255,77,94,0.06)', border: '1px solid rgba(255,77,94,0.2)' }}>
          <div className="font-bold mb-1.5" style={{ color: 'var(--red)' }}>Actions qui effacent définitivement tes données</div>
          <ul className="text-[var(--muted)] space-y-1 list-disc list-inside">
            <li>Supprimer ce groupe ou "Tout supprimer" ci-dessous</li>
            <li>Vider le cache / les données du navigateur</li>
            <li>Désinstaller l'app (PWA) ou changer de navigateur</li>
            <li>Changer d'appareil sans avoir fait de backup</li>
          </ul>
          <p className="mt-2 font-bold" style={{ color: 'var(--gold)' }}>Exporte un backup avant toute action irréversible.</p>
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          Supprime les données de ce groupe sur cet appareil. Tes autres groupes ne sont pas affectés.
        </p>
        <Button variant="danger" className="w-full mb-2" onClick={() => setShowReset(true)}>
          Supprimer ce groupe
        </Button>
        <Button variant="danger" className="w-full opacity-70" onClick={() => setShowResetAll(true)}>
          Tout supprimer — tous les groupes
        </Button>
      </div>

      <Modal open={showReset} onClose={() => setShowReset(false)} title="Supprimer ce groupe ?">
        <p className="text-sm text-[var(--muted)] mb-1">
          Groupe : <span className="font-bold text-[var(--ink)]">{challenge.groupName}</span>
        </p>
        <p className="text-sm text-[var(--muted)] mb-4">
          Logs, pesées, photos et scores pour <span className="font-bold text-[var(--ink)]">{challenge.groupName}</span> seront supprimés de cet appareil.{entries.length > 1 ? ' Tes autres groupes ne sont pas affectés.' : ' C\'est ton seul groupe — tout sera effacé.'}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowReset(false)}>Annuler</Button>
          <Button variant="danger" className="flex-1" onClick={handleReset}>Supprimer définitivement</Button>
        </div>
      </Modal>

      <Modal open={showResetAll} onClose={() => setShowResetAll(false)} title="Tout supprimer ?">
        <p className="text-sm text-[var(--muted)] mb-4">
          Tous tes groupes et l'intégralité de tes données locales seront effacés définitivement — logs, pesées, photos, scores, paramètres.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setShowResetAll(false)}>Annuler</Button>
          <Button variant="danger" className="flex-1" onClick={handleResetAll}>Tout supprimer</Button>
        </div>
      </Modal>

      <Modal open={showRestoreConfirm} onClose={() => { setShowRestoreConfirm(false); setPendingRestore(null); }} title="Restaurer ce backup ?">
        {pendingRestore?._version === 2 ? (
          <p className="text-sm text-[var(--muted)] mb-2">
            Ce backup contient <span className="font-bold text-[var(--ink)]">{(pendingRestore.entries as unknown[])?.length ?? '?'} groupe(s)</span>. Tous tes groupes actuels seront remplacés.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)] mb-2">
            Les données actuelles du profil <span className="font-bold text-[var(--ink)]">{profile.name}</span> seront écrasées par le backup.
          </p>
        )}
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