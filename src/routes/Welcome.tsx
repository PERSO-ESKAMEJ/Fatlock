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
  { value: 'safe', label: 'SÛRE', sub: 'Progressif et tenable', mult: '×1.0 pts' },
  { value: 'standard', label: 'STANDARD', sub: 'Le sweet spot FATLOCK', mult: '×1.4 pts' },
  { value: 'flow', label: 'FLOW', sub: 'Les audacieux seulement. Résultats exceptionnels.', mult: '×2.0 pts' },
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
  const { profile, addEntry } = useProfileStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdding = searchParams.get('add') === '1';
  const joinParam = (searchParams.get('join') ?? '').toUpperCase();
  const gnameParam = decodeURIComponent(searchParams.get('gname') ?? '');
  const hasJoinLink = joinParam.length === 6;

  const [step, setStep] = useState<'landing' | 'type-select' | 'profile' | 'confirm-nutrition' | 'custom-setup' | 'challenge'>(hasJoinLink ? 'profile' : 'landing');
  const [mode, setMode] = useState<'create' | 'join'>(hasJoinLink ? 'join' : 'create');
  const [challengeType, setChallengeType] = useState<ChallengeType>('fatlock');
  const [customSettings, setCustomSettings] = useState<CustomChallengeSettings>({
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

  // Challenge fields
  const [stake, setStake] = useState('20');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
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
    if (customSettings.rituals.length >= 10) return;
    setCustomSettings((s) => ({
      ...s,
      rituals: [...s.rituals, { id: `custom_${Date.now()}`, label: '', points: 1 as const, required: false }],
    }));
  }

  function handleCreateChallenge() {
    if (!name || !age || !height || !weight) return;

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
      id: crypto.randomUUID(),
      groupName: groupName.trim() || defaultName,
      groupCode,
      groupSecret,
      startDate,
      stakeAmount: parseFloat(stake),
      adminId: profileId,
      participantIds: [profileId],
      challengeType,
      customSettings: challengeType === 'custom' ? customSettings : undefined,
    };

    addEntry(newProfile, challenge);
    navigate('/dashboard');
  }

  const tempProfile = name && age && height && weight
    ? { sex, height: parseFloat(height), age: parseInt(age), activityLevel, intensity } as UserProfile
    : null;
  const targets = tempProfile && weight
    ? calculateTargets({ ...tempProfile, id: '', name, startWeight: parseFloat(weight), trainingDays, groupCode: '', isAdmin: false, createdAt: '' }, parseFloat(weight))
    : null;

  if (profile && !isAdding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl uppercase tracking-widest mb-2" style={{ color: 'var(--blue-bright)' }}>
            FAT<span style={{ color: 'var(--cyan)' }}>LOCK</span>
          </h1>
          <p className="text-[var(--muted)]">Réveillez votre Ego Abdominal</p>
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
          <p className="text-[var(--muted)] text-lg">Réveillez votre Ego Abdominal</p>
          <p className="text-xs text-[var(--muted2)] mt-2">Challenge de transformation 8 semaines — groupe — mise en jeu</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" onClick={() => { setMode('create'); setStep('type-select'); }}>
            Créer un challenge
          </Button>
          <Button size="lg" variant="ghost" onClick={() => { setMode('join'); setStep('profile'); }}>
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
            onClick={() => { setChallengeType('fatlock'); setStep('profile'); }}
            className="panel p-5 text-left rounded-xl transition-all hover:border-[var(--blue)]"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="font-display text-xl uppercase tracking-wider mb-1" style={{ color: 'var(--blue-bright)' }}>
              FAT<span style={{ color: 'var(--cyan)' }}>LOCK</span>
            </div>
            <div className="text-sm text-[var(--ink)] font-bold mb-1">Transformation corporelle</div>
            <div className="text-xs text-[var(--muted)]">Objectif perte de gras sur 8 semaines. Rituels, nutrition et suivi de composition corporelle pré-configurés.</div>
          </button>
          <button
            onClick={() => { setChallengeType('custom'); setStep('profile'); }}
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

  // Profile setup
  if (step === 'profile') {
    return (
      <div className="min-h-screen px-4 py-10 max-w-lg mx-auto animate-fade-in">
        <div className="mb-8">
          <button onClick={() => setStep('landing')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-4 block">← Retour</button>
          <h1 className="font-display text-3xl uppercase tracking-wider">Ton profil</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Les données servent à calculer tes objectifs personnalisés.</p>
        </div>

        <div className="space-y-5">
          {/* Sex — FIRST */}
          <div>
            <label>Sexe</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(['M', 'F'] as Sex[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className="py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all"
                  style={{
                    background: sex === s ? 'var(--blue)' : 'var(--panel)',
                    border: `1px solid ${sex === s ? 'var(--blue)' : 'var(--border)'}`,
                    color: sex === s ? 'white' : 'var(--muted)',
                  }}
                >
                  {s === 'M' ? 'Homme' : 'Femme'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label>Prénom / Pseudo</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton nom de compétiteur" maxLength={30} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label>Âge</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" min="16" max="70" />
            </div>
            <div>
              <label>Taille (cm)</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" min="140" max="220" />
            </div>
            <div>
              <label>Poids (kg)</label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" min="40" max="200" step="0.1" />
            </div>
          </div>

          <div>
            <label>Niveau d'activité</label>
            <select value={activityLevel} onChange={(e) => setActivityLevel(parseFloat(e.target.value))}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Intensity */}
          <div>
            <label>Intensité FATLOCK</label>
            <div className="space-y-2 mt-1">
              {INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setIntensity(opt.value)}
                  className="w-full p-3 rounded-lg text-left transition-all"
                  style={{
                    background: intensity === opt.value ? `${INTENSITY_COLORS[opt.value]}15` : 'var(--panel)',
                    border: `1px solid ${intensity === opt.value ? INTENSITY_COLORS[opt.value] : 'var(--border)'}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: INTENSITY_COLORS[opt.value] }}>
                      {opt.label}
                    </span>
                    <span className="text-xs font-mono" style={{ color: INTENSITY_COLORS[opt.value] }}>
                      {opt.mult}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">{opt.sub}</div>
                  {opt.value === 'standard' && (
                    <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--blue-bright)' }}>★ Recommandé</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Training schedule */}
          <div>
            <label>Planning d'entraînement (par défaut)</label>
            <div className="grid grid-cols-7 gap-1 mt-1">
              {DAYS.map((day, i) => (
                <div key={day} className="text-center">
                  <div className="text-xs text-[var(--muted2)] mb-1">{DAY_LABELS[i]}</div>
                  <select
                    className="text-center"
                    style={{ fontSize: 10, padding: '4px 2px' }}
                    value={trainingDays[day] ?? ''}
                    onChange={(e) =>
                      setTrainingDays((td) => ({ ...td, [day]: (e.target.value as DayType) || null }))
                    }
                  >
                    <option value="">—</option>
                    {DAY_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleProfileSave}
            disabled={!name || !age || !height || !weight}
          >
            Voir mes objectifs →
          </Button>
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
              <span className="text-[var(--muted)]">Poids projeté S8</span>
              <span className="font-mono text-[var(--green)]">{targets.projectedWeightAt8Weeks} kg</span>
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
              <span style={{ color: 'var(--gold)' }}>★</span> = requis · pts : intensité du rituel (1–3) · max 10 rituels
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
            {customSettings.rituals.length < 10 && (
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
              ) : null}
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
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleCreateChallenge}
            disabled={mode === 'join' ? joinCode.length < 6 : !groupName && !stake}
          >
            {mode === 'create' ? 'Lancer le challenge' : 'Rejoindre'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}