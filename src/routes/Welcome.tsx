import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { calculateTargets, ACTIVITY_LEVELS } from '../lib/nutrition';
import { UserProfile, ChallengeConfig, Sex, Intensity, DayType } from '../types';
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

  const [step, setStep] = useState<'landing' | 'profile' | 'confirm-nutrition' | 'challenge'>('landing');
  const [mode, setMode] = useState<'create' | 'join'>('create');

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
  const [groupName, setGroupName] = useState('');
  const [stake, setStake] = useState('20');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [joinCode, setJoinCode] = useState('');

  function handleProfileSave() {
    if (!name || !age || !height || !weight) return;
    setStep('confirm-nutrition');
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
    // groupSecret = groupCode so all devices derive the same daily code from the same value
    const groupSecret = groupCode;

    const challenge: ChallengeConfig = {
      id: crypto.randomUUID(),
      groupName: groupName.trim() || `FATLOCK ${name} ${new Date().toLocaleString('fr-FR', { month: 'long' })}`,
      groupCode,
      groupSecret,
      startDate,
      stakeAmount: parseFloat(stake),
      adminId: profileId,
      participantIds: [profileId],
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
          <Button size="lg" onClick={() => { setMode('create'); setStep('profile'); }}>
            Créer un challenge
          </Button>
          <Button size="lg" variant="ghost" onClick={() => { setMode('join'); setStep('profile'); }}>
            Rejoindre un challenge
          </Button>
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

  // Challenge setup
  if (step === 'challenge') {
    return (
      <div className="min-h-screen px-4 py-10 max-w-lg mx-auto animate-fade-in">
        <div className="mb-8">
          <button onClick={() => setStep('confirm-nutrition')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-4 block">← Retour</button>
          <h1 className="font-display text-3xl uppercase tracking-wider">
            {mode === 'create' ? 'Créer le challenge' : 'Rejoindre le challenge'}
          </h1>
        </div>

        <div className="space-y-4">
          {mode === 'join' ? (
            <div>
              <label>Code du groupe (6 caractères)</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="text-center font-mono text-xl uppercase tracking-widest"
              />
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