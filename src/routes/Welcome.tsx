import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { calculateTargets, ACTIVITY_LEVELS } from '../lib/nutrition';
import {
  UserProfile, ChallengeConfig, Sex, Intensity, DayType,
  ChallengeType, CustomRitual, CustomChallengeSettings,
  FATLOCK_DEFAULT_CUSTOM_RITUALS,
} from '../types';
import Button from '../components/ui/Button';

function generateId(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const INTENSITY_OPTIONS: { value: Intensity; label: string; sub: string; mult: string }[] = [
  { value: 'safe', label: 'SÛRE', sub: 'Progressif et tenable. L\'IA valide ta constance.', mult: '×1.0 pts' },
  { value: 'standard', label: 'STANDARD', sub: 'Le protocole complet. L\'IA surveille ta transformation chaque semaine.', mult: '×1.4 pts' },
  { value: 'flow', label: 'FLOW', sub: 'Points doublés — mais l\'IA est sans pitié. Une crédibilité faible te coûte plus que tu ne gagnes.', mult: '×2.0 pts' },
];

const INTENSITY_COLORS: Record<Intensity, string> = {
  safe: 'var(--safe)',
  standard: 'var(--standard)',
  flow: 'var(--flow)',
};

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: 'muscu_j1', label: 'Muscu J1' },
  { value: 'muscu_j2', label: 'Muscu J2' },
  { value: 'muscu_j3', label: 'Muscu J3' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'repos', label: 'Repos' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
type TrainingDays = UserProfile['trainingDays'];

export default function Welcome() {
  const { profile, entries, addEntry } = useProfileStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdding = searchParams.get('add') === '1';
  const joinParam = (searchParams.get('join') ?? '').toUpperCase();
  const gnameParam = decodeURIComponent(searchParams.get('gname') ?? '');
  const cidParam = searchParams.get('cid') ?? '';
  const sdParam = searchParams.get('sd') ?? '';
  const stakeParam = searchParams.get('stake') ?? '';
  const aidParam = searchParams.get('aid') ?? '';
  const sbUrlParam = decodeURIComponent(searchParams.get('sb_url') ?? '');
  const sbKeyParam = decodeURIComponent(searchParams.get('sb_key') ?? '');
  const dwParam = searchParams.get('dw') ?? '';
  const ctParam = searchParams.get('ct') ?? '';
  const csParam = searchParams.get('cs') ?? '';
  const hasJoinLink = joinParam.length === 6;

  const [step, setStep] = useState<'landing' | 'type-select' | 'profile' | 'confirm-nutrition' | 'custom-setup' | 'challenge'>(hasJoinLink ? 'profile' : 'landing');
  const [profileStep, setProfileStep] = useState(1);
  const PROFILE_STEPS = 6;
  const [mode, setMode] = useState<'create' | 'join'>(hasJoinLink ? 'join' : 'create');
  const [challengeType, setChallengeType] = useState<ChallengeType>(ctParam === 'custom' ? 'custom' : 'fatlock');
  const [customSettings, setCustomSettings] = useState<CustomChallengeSettings>(() => {
    if (csParam) {
      try { return JSON.parse(decodeURIComponent(csParam)) as CustomChallengeSettings; } catch { /* fall through */ }
    }
    return {
      description: '',
      durationWeeks: 8,
      trackWeight: true,
      weightDirection: 'down',
      trackBodyFat: true,
      trackPhotos: 'required',
      nutritionEnabled: true,
      caloricDirection: 'deficit',
      rituals: FATLOCK_DEFAULT_CUSTOM_RITUALS.map((r) => ({ ...r })),
      aiAnalysisEnabled: true,
    };
  });

  // Profile fields
  const [sex, setSex] = useState<Sex>('M');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState(1.55);
  const [intensity, setIntensity] = useState<Intensity>('standard');
  const [trainingDays, setTrainingDays] = useState<TrainingDays>({
    monday: 'muscu_j1', tuesday: null, wednesday: 'muscu_j2',
    thursday: null, friday: 'muscu_j3', saturday: 'cardio', sunday: 'repos',
  });

  const [hintOpen, setHintOpen] = useState(true);
  const [joinError, setJoinError] = useState('');

  // Challenge fields
  const [durationWeeks, setDurationWeeks] = useState(dwParam ? parseInt(dwParam) : 8);
  const [stake, setStake] = useState(stakeParam || '20');
  const [startDate, setStartDate] = useState(() => {
    if (sdParam) return sdParam;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [joinCode, setJoinCode] = useState(joinParam);
  const [groupName, setGroupName] = useState(gnameParam);

  function handleProfileSave() {
    if (!name || !age || !height || !weight) return;
    if (challengeType === 'custom') {
      setStep('custom-setup');
    } else {
      setStep('confirm-nutrition');
    }
  }

  function updateRitual(index: number, updates: Partial<CustomRitual>) {
    setCustomSettings((s) => {
      const rituals = [...s.rituals];
      rituals[index] = { ...rituals[index], ...updates };
      return { ...s, rituals };
    });
  }

  function removeRitual(index: number) {
    setCustomSettings((s) => ({ ...s, rituals: s.rituals.filter((_, i) => i !== index) }));
  }

  function addRitual() {
    if (customSettings.rituals.length >= 15) return;
    setCustomSettings((s) => ({
      ...s,
      rituals: [...s.rituals, { id: `custom_${Date.now()}`, label: '', points: 1 as const, required: false }],
    }));
  }

  function handleCreateChallenge() {
    if (!name || !age || !height || !weight) return;

    if (mode === 'join') {
      const upperCode = joinCode.toUpperCase().trim();
      if (entries.some((e) => e.challenge.groupCode === upperCode)) {
        setJoinError('Tu es déjà inscrit dans ce groupe sur cet appareil.');
        return;
      }
    }
    setJoinError('');

    const profileId = crypto.randomUUID();
    const newProfile: UserProfile = {
      id: profileId,
      name: name.trim(),
      sex,
      age: parseInt(age),
      height: parseFloat(height),
      startWeight: parseFloat(weight),
      activityLevel,
      intensity,
      trainingDays,
      groupCode: generateId(6),
      isAdmin: mode === 'create',
      createdAt: new Date().toISOString(),
    };

    const groupCode = mode === 'create' ? generateId(6) : joinCode.toUpperCase().trim();
    const groupSecret = groupCode;
    const defaultName = challengeType === 'fatlock'
      ? `FATLOCK ${name} ${new Date().toLocaleString('fr-FR', { month: 'long' })}`
      : `CUSTOMLOCK ${name} ${new Date().toLocaleString('fr-FR', { month: 'long' })}`;

    const challenge: ChallengeConfig = {
      // Sans lien d'invitation, on dérive l'ID du code groupe pour la cohérence entre participants
      id: mode === 'join' && cidParam ? cidParam : (mode === 'join' ? `grp-${groupCode}` : crypto.randomUUID()),
      groupName: groupName.trim() || defaultName,
      groupCode,
      groupSecret,
      startDate,
      durationWeeks: challengeType === 'custom' ? (customSettings.durationWeeks ?? 8) : durationWeeks,
      stakeAmount: parseFloat(stake),
      adminId: mode === 'join' && aidParam ? aidParam : profileId,
      participantIds: [profileId],
      challengeType,
      customSettings: challengeType === 'custom' ? customSettings : undefined,
      supabaseUrl: sbUrlParam || undefined,
      supabaseAnonKey: sbKeyParam || undefined,
    };

    addEntry(newProfile, challenge);
    navigate('/dashboard');
  }

  const tempProfile = name && age && height && weight
    ? { sex, height: parseFloat(height), age: parseInt(age), activityLevel, intensity } as UserProfile
    : null;
  const targets = tempProfile && weight
    ? calculateTargets({ ...tempProfile, id: '', name, startWeight: parseFloat(weight), trainingDays, groupCode: '', isAdmin: false, createdAt: '' }, parseFloat(weight), durationWeeks)
    : null;

  if (profile && !isAdding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl uppercase tracking-widest mb-2" style={{ color: 'var(--blue-bright)' }}>
            FAT<span style={{ color: 'var(--cyan)' }}>LOCK</span>
          </h1>
          <p className="text-[var(--muted)]">Réveillez et sublimez votre Ego Abdominal</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" onClick={() => navigate('/dashboard')}>
            Reprendre → {profile.name}
          </Button>
          <Button size="lg" variant="ghost" onClick={() => navigate('/?add=1')}>
            + Rejoindre un autre groupe
          </Button>
        </div>
      </div>
    );
  }

  // Landing
  if (step === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
        <div className="text-center mb-12">
          <h1 className="font-display text-6xl md:text-8xl uppercase tracking-widest mb-3" style={{ color: 'var(--ink)' }}>
            FAT<span style={{ background: 'linear-gradient(to right, var(--blue), var(--cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>LOCK</span>
          </h1>
          <p className="text-[var(--muted)] text-lg">Réveillez et sublimez votre Ego Abdominal</p>
          <p className="text-xs text-[var(--muted2)] mt-2">Challenge de transformation 4–24 semaines — groupe — mise en jeu</p>
          <p className="text-xs mt-3 font-bold uppercase tracking-wider" style={{ color: 'var(--red)' }}>
            L'IA analyse ta transformation chaque semaine. Les tricheurs n'ont qu'à bien se tenir.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" onClick={() => { setMode('create'); setStep('type-select'); }}>
            Créer un challenge
          </Button>
          <Button size="lg" variant="ghost" onClick={() => { setMode('join'); setStep('profile'); setProfileStep(1); }}>
            Rejoindre un challenge
          </Button>
        </div>
      </div>
    );
  }

  // Type selector (create mode only)
  if (step === 'type-select') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
        <button onClick={() => setStep('landing')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-8 self-start ml-4">← Retour</button>
        <div className="text-center mb-10 w-full max-w-sm">
          <h1 className="font-display text-3xl uppercase tracking-wider mb-2">Type de challenge</h1>
          <p className="text-sm text-[var(--muted)]">Choisis le format de ton challenge.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => { setChallengeType('fatlock'); setStep('profile'); setProfileStep(1); }}
            className="panel p-5 text-left rounded-xl transition-all hover:border-[var(--blue)]"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="font-display text-xl uppercase tracking-wider mb-1" style={{ color: 'var(--blue-bright)' }}>
              FAT<span style={{ color: 'var(--cyan)' }}>LOCK</span>
            </div>
            <div className="text-sm text-[var(--ink)] font-bold mb-1">Transformation corporelle</div>
            <div className="text-xs text-[var(--muted)]">Objectif perte de gras — durée configurable. Rituels, nutrition et suivi de composition corporelle pré-configurés.</div>
          </button>
          <button
            onClick={() => { setChallengeType('custom'); setStep('profile'); setProfileStep(1); }}
            className="panel p-5 text-left rounded-xl transition-all hover:border-[var(--cyan)]"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="font-display text-xl uppercase tracking-wider mb-1" style={{ color: 'var(--cyan)' }}>
              CUSTOM<span style={{ color: 'var(--blue-bright)' }}>LOCK</span>
            </div>
            <div className="text-sm text-[var(--ink)] font-bold mb-1">Challenge sur mesure</div>
            <div className="text-xs text-[var(--muted)]">Définis toi-même les rituels, les métriques et les règles. Démarre depuis le template FATLOCK ou repart de zéro.</div>
          </button>
        </div>
      </div>
    );
  }

  // Profile setup — multi-step onboarding
  if (step === 'profile') {
    const canNext = [
      true,                              // 1 sexe
      name.trim().length > 0,            // 2 prénom
      !!age && !!height && !!weight,     // 3 corps
      true,                              // 4 activité
      true,                              // 5 intensité
      true,                              // 6 planning
    ][profileStep - 1];

    function goBack() {
      setHintOpen(false);
      if (profileStep === 1) setStep(mode === 'join' ? 'landing' : 'type-select');
      else setProfileStep((p: number) => p - 1);
    }
    function goNext() {
      setHintOpen(false);
      if (profileStep < PROFILE_STEPS) setProfileStep((p: number) => p + 1);
      else handleProfileSave();
    }

    const ACTIVITY_CARDS = [
      { value: 1.2,   emoji: '🪑', label: 'Sédentaire',          sub: 'Bureau, peu de mouvement' },
      { value: 1.375, emoji: '🚶', label: 'Légèrement actif',    sub: 'Sport 1–2×/semaine' },
      { value: 1.55,  emoji: '🏃', label: 'Modérément actif',    sub: 'Sport 3–4×/semaine' },
      { value: 1.725, emoji: '💪', label: 'Très actif',          sub: 'Sport 5–6×/semaine' },
      { value: 1.9,   emoji: '🏆', label: 'Extrêmement actif',   sub: 'Athlète / travail physique' },
    ];

    const HINTS: Record<number, string> = {
      1: 'Hommes et femmes ont des formules de métabolisme de base différentes (Mifflin-St Jeor). Ce choix influence ton objectif calorique quotidien.',
      2: 'Ce nom apparaîtra dans le classement du groupe. Tu peux utiliser un pseudo — il ne sera pas modifiable facilement après.',
      3: 'Ces trois données calculent ton BMR (calories brûlées au repos) et ton TDEE (dépense totale journalière). Plus c\'est précis, plus ton plan nutritionnel sera juste.',
      4: 'Ton niveau d\'activité hors entraînements FATLOCK. Il multiplie ton BMR pour obtenir ton TDEE réel. Une erreur ici sous- ou sur-estime tes besoins caloriques.',
      5: 'Définit la vitesse de ta transformation et ton multiplicateur de points. SAFE = progression douce. STANDARD = protocole complet. FLOW = mode extrême, l\'IA est plus sévère et un écart te coûte plus cher en points.',
      6: 'Sert à déterminer quels rituels s\'appliquent chaque jour (séance muscu vs cardio vs repos). Modifiable à tout moment dans Paramètres.',
    };

    return (
      <div className="min-h-screen flex flex-col px-4 pt-8 pb-10 max-w-lg mx-auto animate-fade-in">

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-8" style={{ background: 'var(--panel2)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(profileStep / PROFILE_STEPS) * 100}%`, background: 'var(--blue)' }}
          />
        </div>

        {/* Step content — centré verticalement */}
        <div className="flex-1 flex flex-col justify-center">

          {/* Étape 1 — Sexe */}
          {profileStep === 1 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{profileStep} / {PROFILE_STEPS}</p>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">Tu es…</h2>
                <button onClick={() => setHintOpen((h: boolean) => !h)} className="w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-1" style={{ background: hintOpen ? 'var(--blue)' : 'var(--panel2)', border: '1px solid var(--border)', color: hintOpen ? 'white' : 'var(--muted)' }}>?</button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">Pour calibrer ton métabolisme de base.</p>
              {hintOpen && <div className="mb-6 p-3 rounded-lg text-sm text-[var(--ink)]" style={{ background: 'rgba(47,123,255,0.08)', border: '1px solid rgba(47,123,255,0.25)' }}>{HINTS[1]}</div>}
              {!hintOpen && <div className="mb-5" />}
              <div className="grid grid-cols-2 gap-3">
                {(['M', 'F'] as Sex[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSex(s); setTimeout(() => setProfileStep(2), 200); }}
                    className="py-8 rounded-xl font-display text-2xl uppercase tracking-widest transition-all"
                    style={{
                      background: sex === s ? 'var(--blue)' : 'var(--panel)',
                      border: `2px solid ${sex === s ? 'var(--blue)' : 'var(--border)'}`,
                      color: sex === s ? 'white' : 'var(--muted)',
                    }}
                  >
                    {s === 'M' ? 'Homme' : 'Femme'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 2 — Prénom */}
          {profileStep === 2 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{profileStep} / {PROFILE_STEPS}</p>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">Ton nom</h2>
                <button onClick={() => setHintOpen((h: boolean) => !h)} className="w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-1" style={{ background: hintOpen ? 'var(--blue)' : 'var(--panel2)', border: '1px solid var(--border)', color: hintOpen ? 'white' : 'var(--muted)' }}>?</button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">Prénom ou pseudo — ce que le classement affichera.</p>
              {hintOpen && <div className="mb-5 p-3 rounded-lg text-sm text-[var(--ink)]" style={{ background: 'rgba(47,123,255,0.08)', border: '1px solid rgba(47,123,255,0.25)' }}>{HINTS[2]}</div>}
              {!hintOpen && <div className="mb-5" />}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && goNext()}
                placeholder="Ton nom de compétiteur"
                maxLength={30}
                autoFocus
                className="text-lg"
              />
            </div>
          )}

          {/* Étape 3 — Corps */}
          {profileStep === 3 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{profileStep} / {PROFILE_STEPS}</p>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">Ton corps</h2>
                <button onClick={() => setHintOpen((h: boolean) => !h)} className="w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-1" style={{ background: hintOpen ? 'var(--blue)' : 'var(--panel2)', border: '1px solid var(--border)', color: hintOpen ? 'white' : 'var(--muted)' }}>?</button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">Sert à calculer ton BMR et tes objectifs caloriques.</p>
              {hintOpen && <div className="mb-4 p-3 rounded-lg text-sm text-[var(--ink)]" style={{ background: 'rgba(47,123,255,0.08)', border: '1px solid rgba(47,123,255,0.25)' }}>{HINTS[3]}</div>}
              {!hintOpen && <div className="mb-5" />}
              <div className="space-y-4">
                <div>
                  <label>Âge</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" min="16" max="70" autoFocus />
                </div>
                <div>
                  <label>Taille (cm)</label>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" min="140" max="220" />
                </div>
                <div>
                  <label>Poids de départ (kg)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" min="40" max="200" step="0.1" />
                </div>
              </div>
            </div>
          )}

          {/* Étape 4 — Activité */}
          {profileStep === 4 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{profileStep} / {PROFILE_STEPS}</p>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">Ton activité</h2>
                <button onClick={() => setHintOpen((h: boolean) => !h)} className="w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-1" style={{ background: hintOpen ? 'var(--blue)' : 'var(--panel2)', border: '1px solid var(--border)', color: hintOpen ? 'white' : 'var(--muted)' }}>?</button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">Hors séances FATLOCK — ton quotidien général.</p>
              {hintOpen && <div className="mb-4 p-3 rounded-lg text-sm text-[var(--ink)]" style={{ background: 'rgba(47,123,255,0.08)', border: '1px solid rgba(47,123,255,0.25)' }}>{HINTS[4]}</div>}
              {!hintOpen && <div className="mb-3" />}
              <div className="space-y-2">
                {ACTIVITY_CARDS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => { setActivityLevel(a.value); setTimeout(() => setProfileStep(5), 200); }}
                    className="w-full p-4 rounded-xl text-left flex items-center gap-4 transition-all"
                    style={{
                      background: activityLevel === a.value ? 'rgba(47,123,255,0.12)' : 'var(--panel)',
                      border: `1px solid ${activityLevel === a.value ? 'var(--blue)' : 'var(--border)'}`,
                    }}
                  >
                    <span className="text-2xl">{a.emoji}</span>
                    <div>
                      <div className="font-bold text-sm" style={{ color: activityLevel === a.value ? 'var(--blue-bright)' : 'var(--ink)' }}>{a.label}</div>
                      <div className="text-xs text-[var(--muted)]">{a.sub}</div>
                    </div>
                    {activityLevel === a.value && <span className="ml-auto text-[var(--blue-bright)]">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 5 — Intensité */}
          {profileStep === 5 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{profileStep} / {PROFILE_STEPS}</p>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">Ton mode</h2>
                <button onClick={() => setHintOpen((h: boolean) => !h)} className="w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-1" style={{ background: hintOpen ? 'var(--blue)' : 'var(--panel2)', border: '1px solid var(--border)', color: hintOpen ? 'white' : 'var(--muted)' }}>?</button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">Définit ton déficit calorique et le multiplicateur de points.</p>
              {hintOpen && <div className="mb-4 p-3 rounded-lg text-sm text-[var(--ink)]" style={{ background: 'rgba(47,123,255,0.08)', border: '1px solid rgba(47,123,255,0.25)' }}>{HINTS[5]}</div>}
              {!hintOpen && <div className="mb-3" />}
              <div className="space-y-3">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIntensity(opt.value)}
                    className="w-full p-4 rounded-xl text-left transition-all"
                    style={{
                      background: intensity === opt.value ? `${INTENSITY_COLORS[opt.value]}15` : 'var(--panel)',
                      border: `2px solid ${intensity === opt.value ? INTENSITY_COLORS[opt.value] : 'var(--border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-display text-lg" style={{ color: INTENSITY_COLORS[opt.value] }}>{opt.label}</span>
                      <span className="text-xs font-mono font-bold" style={{ color: INTENSITY_COLORS[opt.value] }}>{opt.mult}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{opt.sub}</div>
                    {opt.value === 'standard' && (
                      <div className="text-xs font-bold mt-1" style={{ color: 'var(--blue-bright)' }}>★ Recommandé</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 6 — Planning */}
          {profileStep === 6 && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{profileStep} / {PROFILE_STEPS}</p>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-3xl uppercase tracking-wider text-[var(--ink)]">Ton planning</h2>
                <button onClick={() => setHintOpen((h: boolean) => !h)} className="w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-1" style={{ background: hintOpen ? 'var(--blue)' : 'var(--panel2)', border: '1px solid var(--border)', color: hintOpen ? 'white' : 'var(--muted)' }}>?</button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-3">Personnalisable dans Paramètres à tout moment.</p>
              {hintOpen && <div className="mb-4 p-3 rounded-lg text-sm text-[var(--ink)]" style={{ background: 'rgba(47,123,255,0.08)', border: '1px solid rgba(47,123,255,0.25)' }}>{HINTS[6]}</div>}
              {!hintOpen && <div className="mb-3" />}
              <div className="space-y-2">
                {DAYS.map((day, i) => (
                  <div key={day} className="flex items-center gap-3">
                    <div className="w-10 text-xs font-bold text-[var(--muted)] uppercase">{DAY_LABELS[i]}</div>
                    <select
                      className="flex-1"
                      value={trainingDays[day] ?? ''}
                      onChange={(e) => setTrainingDays((td) => ({ ...td, [day]: (e.target.value as DayType) || null }))}
                    >
                      <option value="">— Repos</option>
                      {DAY_TYPES.map((dt) => (
                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation — fixe en bas */}
        <div className="flex gap-3 mt-10">
          <button
            onClick={goBack}
            className="px-5 py-3 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            ← Retour
          </button>
          {/* Étape 1 et 4 : auto-avancement au clic — bouton Suivant masqué */}
          {profileStep !== 1 && profileStep !== 4 && (
            <Button
              className="flex-1"
              onClick={goNext}
              disabled={!canNext}
            >
              {profileStep === PROFILE_STEPS ? 'Voir mes objectifs →' : 'Suivant →'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Nutrition confirmation
  if (step === 'confirm-nutrition' && targets) {
    return (
      <div className="min-h-screen px-4 py-10 max-w-lg mx-auto animate-fade-in">
        <div className="mb-8">
          <button onClick={() => setStep('profile')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-4 block">← Modifier le profil</button>
          <h1 className="font-display text-3xl uppercase tracking-wider">Tes objectifs</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Calculés selon ton profil. Recalculés automatiquement à chaque pesée.</p>
        </div>

        <div className="panel p-5 space-y-4 mb-6">
          <div className="text-center">
            <div className="font-display text-5xl" style={{ color: 'var(--cyan)' }}>{targets.targetKcal}</div>
            <div className="text-sm text-[var(--muted)]">kcal / jour</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Protéines', value: targets.protein, unit: 'g', color: 'var(--blue-bright)' },
              { label: 'Glucides', value: targets.carbs, unit: 'g', color: 'var(--cyan)' },
              { label: 'Lipides', value: targets.fat, unit: 'g', color: 'var(--gold)' },
            ].map((m) => (
              <div key={m.label} className="panel2 p-3 text-center rounded-lg">
                <div className="font-mono text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                <div className="text-xs text-[var(--muted)]">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[var(--border)] space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Perte hebdomadaire cible</span>
              <span className="font-mono text-[var(--ink)]">{targets.weeklyLossKg} kg/sem</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Poids projeté S{durationWeeks}</span>
              <span className="font-mono text-[var(--green)]">{targets.projectedWeight} kg</span>
            </div>
          </div>

          {targets.safetyFloorApplied && (
            <p className="text-xs text-[var(--gold)]">
              Plancher de sécurité appliqué pour préserver ta masse musculaire.
            </p>
          )}
        </div>

        <Button className="w-full" onClick={() => setStep('challenge')}>
          Configurer le challenge →
        </Button>
      </div>
    );
  }

  // Custom challenge setup
  if (step === 'custom-setup') {
    return (
      <div className="min-h-screen px-4 py-10 max-w-lg mx-auto animate-fade-in">
        <div className="mb-6">
          <button onClick={() => setStep('profile')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-4 block">← Retour</button>
          <h1 className="font-display text-3xl uppercase tracking-wider">Ton CUSTOMLOCK</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Configure les règles de ton challenge. Pré-rempli avec le template FATLOCK.</p>
        </div>

        <div className="space-y-5">
          {/* Description */}
          <div>
            <label>Description du challenge</label>
            <input type="text" value={customSettings.description} onChange={(e) => setCustomSettings((s) => ({ ...s, description: e.target.value }))} placeholder="Ex: Running — 100km en 8 semaines" />
          </div>

          {/* Duration */}
          <div>
            <label>Durée : <span className="font-mono font-bold text-[var(--cyan)]">{customSettings.durationWeeks} semaines</span></label>
            <input type="range" min={4} max={24} step={1} value={customSettings.durationWeeks}
              onChange={(e) => setCustomSettings((s) => ({ ...s, durationWeeks: parseInt(e.target.value) }))}
              className="w-full mt-1" />
            <div className="flex justify-between text-xs text-[var(--muted)] mt-1"><span>4 sem.</span><span>24 sem.</span></div>
          </div>

          {/* Metrics */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Métriques</div>
            <div className="space-y-2">
              {[
                { key: 'trackWeight', label: 'Suivi du poids' },
                { key: 'trackBodyFat', label: 'Suivi % masse grasse' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={customSettings[key as keyof typeof customSettings] as boolean}
                    onChange={(e) => setCustomSettings((s) => ({ ...s, [key]: e.target.checked }))} />
                  <span className="text-sm text-[var(--ink)]">{label}</span>
                </label>
              ))}
              {customSettings.trackWeight && (
                <div className="pl-6">
                  <label className="text-xs text-[var(--muted)]">Direction du poids</label>
                  <div className="flex gap-2 mt-1">
                    {([['down','↓ Perdre'], ['up','↑ Prendre'], ['stable','→ Maintenir']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setCustomSettings((s) => ({ ...s, weightDirection: v }))}
                        className="px-3 py-1 rounded text-xs font-bold transition-all"
                        style={{ background: customSettings.weightDirection === v ? 'var(--blue)' : 'var(--panel)', color: customSettings.weightDirection === v ? 'white' : 'var(--muted)', border: '1px solid var(--border)' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[var(--muted)]">Métrique personnalisée (optionnel)</label>
                <input type="text" value={customSettings.customMetricLabel ?? ''} placeholder="Ex: km courus, kg soulevés..."
                  onChange={(e) => setCustomSettings((s) => ({ ...s, customMetricLabel: e.target.value || undefined }))} />
              </div>
            </div>
          </div>

          {/* Nutrition */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Nutrition</div>
            <label className="flex items-center gap-3 cursor-pointer mb-2">
              <input type="checkbox" checked={customSettings.nutritionEnabled}
                onChange={(e) => setCustomSettings((s) => ({ ...s, nutritionEnabled: e.target.checked }))} />
              <span className="text-sm text-[var(--ink)]">Activer le suivi nutritionnel</span>
            </label>
            {customSettings.nutritionEnabled && (
              <div className="flex gap-2 pl-6">
                {([['deficit','Déficit'], ['surplus','Surplus'], ['manual','Manuel']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setCustomSettings((s) => ({ ...s, caloricDirection: v }))}
                    className="px-3 py-1 rounded text-xs font-bold transition-all"
                    style={{ background: customSettings.caloricDirection === v ? 'var(--blue)' : 'var(--panel)', color: customSettings.caloricDirection === v ? 'white' : 'var(--muted)', border: '1px solid var(--border)' }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ritual builder */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-1">Rituels quotidiens</div>
            <p className="text-xs text-[var(--muted2)] mb-3">
              <span style={{ color: 'var(--gold)' }}>★</span> = requis · pts : intensité du rituel (1–3) · max 15 rituels
            </p>
            <div className="space-y-2">
              {customSettings.rituals.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input type="text" value={r.label} placeholder="Nom du rituel"
                    onChange={(e) => updateRitual(i, { label: e.target.value })}
                    className="flex-1 text-sm" style={{ padding: '6px 10px' }} />
                  <div className="flex gap-1">
                    {([1, 2, 3] as const).map((p) => (
                      <button key={p} onClick={() => updateRitual(i, { points: p })}
                        className="w-7 h-7 rounded text-xs font-bold transition-all"
                        style={{ background: r.points === p ? 'var(--blue)' : 'var(--panel2)', color: r.points === p ? 'white' : 'var(--muted)', border: '1px solid var(--border)' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => updateRitual(i, { required: !r.required })}
                    className="w-7 h-7 rounded text-xs font-bold transition-all"
                    style={{ background: r.required ? 'rgba(255,200,0,0.15)' : 'var(--panel2)', color: r.required ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${r.required ? 'var(--gold)' : 'var(--border)'}` }}>
                    ★
                  </button>
                  <button onClick={() => removeRitual(i)} className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center"
                    style={{ color: 'var(--red)', background: 'var(--panel2)', border: '1px solid var(--border)' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            {customSettings.rituals.length < 15 && (
              <button onClick={addRitual} className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--blue-bright)' }}>
                + Ajouter un rituel
              </button>
            )}
          </div>

          <Button className="w-full" onClick={() => setStep('challenge')}
            disabled={customSettings.rituals.filter((r) => r.label.trim()).length === 0}>
            Configurer le challenge →
          </Button>
        </div>
      </div>
    );
  }

  // Challenge setup
  if (step === 'challenge') {
    return (
      <div className="min-h-screen px-4 py-10 max-w-lg mx-auto animate-fade-in">
        <div className="mb-8">
          <button
            onClick={() => setStep(mode === 'join' ? 'profile' : challengeType === 'custom' ? 'custom-setup' : 'confirm-nutrition')}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-4 block"
          >← Retour</button>
          <h1 className="font-display text-3xl uppercase tracking-wider">
            {mode === 'create' ? 'Créer le challenge' : 'Rejoindre le challenge'}
          </h1>
        </div>

        <div className="space-y-4">
          {mode === 'join' ? (
            <div className="space-y-4">
              {/* Avertissement si rejoindre sans lien d'invitation */}
              {!hasJoinLink && (
                <div
                  className="p-3 rounded-lg text-xs"
                  style={{ background: 'rgba(255,200,0,0.07)', border: '1px solid rgba(255,200,0,0.3)', color: 'var(--muted)' }}
                >
                  <div className="font-bold mb-1" style={{ color: 'var(--gold)' }}>⚠ Tu rejoins sans lien d'invitation</div>
                  Sans le lien officiel, certaines informations (date de début, durée, sync Supabase) doivent être renseignées manuellement. Demande le lien à l'admin pour une configuration automatique.
                </div>
              )}

              {gnameParam ? (
                <div>
                  <label>Groupe</label>
                  <div
                    className="w-full p-3 rounded-lg font-bold text-[var(--ink)]"
                    style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                  >
                    {groupName}
                  </div>
                </div>
              ) : (
                <div>
                  <label>Nom du groupe</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: FATLOCK Juillet"
                  />
                </div>
              )}

              <div>
                <label>Code du groupe (6 caractères)</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => !hasJoinLink && setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  readOnly={hasJoinLink}
                  className={`text-center font-mono text-xl uppercase tracking-widest${hasJoinLink ? ' opacity-70 cursor-not-allowed' : ''}`}
                />
                {hasJoinLink && (
                  <p className="text-xs text-[var(--muted)] mt-1">Code récupéré depuis le lien d'invitation.</p>
                )}
              </div>

              {sdParam ? (
                <div>
                  <label>Date de début</label>
                  <div
                    className="w-full p-3 rounded-lg font-mono text-[var(--ink)]"
                    style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                  >
                    {new Date(sdParam + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              ) : (
                <div>
                  <label>Date de début du challenge</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">Demande cette date à l'admin du groupe.</p>
                </div>
              )}

              {dwParam ? (
                <div>
                  <label>Durée du challenge</label>
                  <div
                    className="w-full p-3 rounded-lg font-mono text-[var(--ink)]"
                    style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                  >
                    {durationWeeks} semaines
                  </div>
                </div>
              ) : (
                <div>
                  <label>Durée : <span className="font-mono font-bold text-[var(--cyan)]">{durationWeeks} semaines</span></label>
                  <input
                    type="range" min={4} max={24} step={1} value={durationWeeks}
                    onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                    className="w-full mt-1"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-1"><span>4 sem.</span><span>24 sem.</span></div>
                </div>
              )}

              {stakeParam ? (
                <div>
                  <label>Mise en jeu</label>
                  <div
                    className="w-full p-3 rounded-lg font-mono text-[var(--ink)]"
                    style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                  >
                    {stakeParam} €
                  </div>
                </div>
              ) : (
                <div>
                  <label>Mise en jeu (€)</label>
                  <input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    min="0" step="5" placeholder="20"
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label>Nom du groupe</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={`FATLOCK ${name} ${new Date().toLocaleString('fr-FR', { month: 'long' })}`}
                />
              </div>
              <div>
                <label>Mise en jeu (€ par personne)</label>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  min="0" step="5"
                  placeholder="20"
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Min. 4 participants pour qu'il y ait un gain financier.
                </p>
              </div>
              <div>
                <label>Date de début</label>
                <input
                  type="date"
                  value={startDate}
                  min={(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })()}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              {challengeType === 'fatlock' && (
                <div>
                  <label>Durée : <span className="font-mono font-bold text-[var(--cyan)]">{durationWeeks} semaines</span></label>
                  <input
                    type="range" min={4} max={24} step={1} value={durationWeeks}
                    onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                    className="w-full mt-1"
                  />
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
                    <span>4 sem.</span><span>24 sem.</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div
            className="p-3 rounded-lg text-xs text-center"
            style={{ background: 'rgba(255,77,94,0.07)', border: '1px solid rgba(255,77,94,0.2)', color: 'var(--muted)' }}
          >
            En participant, tu t'engages sur l'honneur à respecter ton rythme.
            <span className="font-bold" style={{ color: 'var(--ink)' }}> L'IA analyse ta transformation chaque semaine </span>
            et pénalise les scores qui ne collent pas avec les déclarations.
            Les tricheurs n'ont qu'à bien se tenir.
          </div>

          {joinError && (
            <p className="text-xs text-center font-bold" style={{ color: 'var(--red)' }}>{joinError}</p>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={handleCreateChallenge}
            disabled={mode === 'join' ? joinCode.length < 6 : !groupName && !stake}
          >
            {mode === 'create' ? 'Lancer le challenge' : 'Je m\'engage — Rejoindre'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}