import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { calculateTargets, getMacroPercents } from '../lib/nutrition';
import PageWrapper from '../components/layout/PageWrapper';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export default function Nutrition() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const getLatest = useLogStore((s) => s.getLatestBodyComp);
  const bodyComps = useLogStore((s) => s.bodyCompositions).filter((c) => c.userId === profile.id);
  const dailyLogs = useLogStore((s) => s.dailyLogs).filter((l) => l.userId === profile.id);

  const nutritionEnabled = challenge.challengeType !== 'custom' || (challenge.customSettings?.nutritionEnabled ?? true);
  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  if (!nutritionEnabled) {
    return (
      <PageWrapper title="Nutrition">
        <div className="panel p-8 text-center">
          <div className="text-3xl mb-3">🥗</div>
          <div className="font-bold text-[var(--ink)] mb-2">Nutrition non activée</div>
          <p className="text-sm text-[var(--muted)]">L'organisateur de ce challenge n'a pas activé le suivi nutritionnel.</p>
        </div>
      </PageWrapper>
    );
  }

  const latest = getLatest(profile.id);
  const currentWeight = latest?.weightKg ?? profile.startWeight;
  const s0Comp = bodyComps.find((c) => c.weekNumber === 0);
  const s0Weight = s0Comp?.weightKg ?? profile.startWeight;
  const weightDirection = challenge.customSettings?.weightDirection ?? 'down';
  const targets = calculateTargets(profile, currentWeight, durationWeeks, weightDirection);
  const macroPercents = getMacroPercents(targets);

  // Projection à une date donnée depuis S0
  function projectedAt(dateStr: string): number {
    const [sy, sm, sd] = challenge.startDate.split('-').map(Number);
    const [dy, dm, dd] = dateStr.split('-').map(Number);
    const days = Math.max(0, (new Date(dy, dm - 1, dd).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000);
    return +(s0Weight - targets.weeklyLossKg * (days / 7)).toFixed(1);
  }

  // Mesures réelles : S0 + pesées quotidiennes
  const actualMeasurements = [
    ...(s0Comp ? [{ date: s0Comp.date, weight: s0Comp.weightKg }] : []),
    ...dailyLogs
      .filter((l) => l.weightKg != null)
      .map((l) => ({ date: l.date, weight: l.weightKg! })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let chartData: { label: string; weight: number | undefined; target: number }[];

  if (actualMeasurements.length >= 1) {
    // Données réelles + projection en parallèle
    // Points passés : poids réel seulement (pas de ligne verte sur le passé)
    const points: { label: string; weight: number | undefined; target: number | undefined }[] =
      actualMeasurements.map((p, i) => ({
        label: p.date.slice(5),
        weight: p.weight,
        target: i === actualMeasurements.length - 1 ? p.weight : undefined, // jonction sur le dernier point
      }));

    // Points futurs : projection depuis le dernier poids réel
    const lastMeasurement = actualMeasurements[actualMeasurements.length - 1];
    const lastWeight = lastMeasurement.weight;
    const lastDate = lastMeasurement.date;
    const [ly, lm, ld] = lastDate.split('-').map(Number);
    const lastDateObj = new Date(ly, lm - 1, ld);

    for (let w = 1; w <= durationWeeks; w++) {
      const [sy, sm, sd] = challenge.startDate.split('-').map(Number);
      const future = new Date(sy, sm - 1, sd);
      future.setDate(future.getDate() + w * 7);
      const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      if (futureStr > lastDate) {
        const weeksSinceLast = (future.getTime() - lastDateObj.getTime()) / (7 * 86400000);
        const projected = +(lastWeight - targets.weeklyLossKg * weeksSinceLast).toFixed(1);
        points.push({ label: `S${w}`, weight: undefined, target: projected });
      }
    }
    chartData = points as { label: string; weight: number | undefined; target: number }[];
  } else {
    // Aucune mesure réelle → trajectoire cible seule S0→S8
    chartData = [
      { label: 'S0', weight: s0Weight, target: s0Weight },
      ...Array.from({ length: durationWeeks }, (_, i) => {
        const w = i + 1;
        const comp = bodyComps.find((c) => c.weekNumber === w);
        return { label: `S${w}`, weight: comp?.weightKg ?? undefined, target: +(s0Weight - targets.weeklyLossKg * w).toFixed(1) };
      }),
    ];
  }

  const macros = [
    { label: 'Protéines', g: targets.protein, kcal: targets.protein * 4, pct: macroPercents.proteinPct, color: 'var(--blue-bright)' },
    { label: 'Glucides', g: targets.carbs, kcal: targets.carbs * 4, pct: macroPercents.carbsPct, color: 'var(--cyan)' },
    { label: 'Lipides', g: targets.fat, kcal: targets.fat * 9, pct: macroPercents.fatPct, color: 'var(--gold)' },
  ];

  return (
    <PageWrapper title="Nutrition">
      {/* Main target */}
      <div className="panel p-5 mb-4 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Objectif calorique</div>
        <div className="font-display text-6xl" style={{ color: 'var(--cyan)' }}>{targets.targetKcal}</div>
        <div className="text-sm text-[var(--muted)]">kcal / jour</div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-[var(--muted)]">
          <span>BMR: <span className="text-[var(--ink)] font-mono">{targets.bmr}</span></span>
          <span>TDEE: <span className="text-[var(--ink)] font-mono">{targets.effectiveTdee}</span></span>
          <span>
            {weightDirection === 'up' ? 'Surplus' : weightDirection === 'stable' ? 'Équilibre' : 'Déficit'}:{' '}
            <span className="text-[var(--ink)] font-mono">{Math.abs(targets.effectiveTdee - targets.targetKcal)}</span>
          </span>
        </div>
      </div>

      {/* Macros */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Répartition des macros</div>
        <div className="space-y-3">
          {macros.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold" style={{ color: m.color }}>{m.label}</span>
                <div className="text-right">
                  <span className="font-mono text-sm text-[var(--ink)]">{m.g}g</span>
                  <span className="text-xs text-[var(--muted)] ml-2">{m.kcal} kcal ({m.pct}%)</span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--panel2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${m.pct}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projection */}
      <div className="panel p-4 mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Projection {durationWeeks} semaines</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--muted)]">Poids actuel</div>
            <div className="font-mono text-xl font-bold text-[var(--ink)]">{currentWeight} kg</div>
          </div>
          <div className="text-2xl text-[var(--muted)]">→</div>
          <div className="text-right">
            <div className="text-xs text-[var(--muted)]">Poids S{durationWeeks} projeté</div>
            <div className="font-mono text-xl font-bold" style={{ color: 'var(--green)' }}>{targets.projectedWeight} kg</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-[var(--muted)] text-center">
          {weightDirection === 'stable'
            ? 'Maintien du poids cible'
            : weightDirection === 'up'
              ? `Prise cible : ${Math.abs(targets.weeklyLossKg)} kg/semaine (${(Math.abs(targets.weeklyLossKg) * durationWeeks).toFixed(1)} kg total)`
              : `Perte cible : ${targets.weeklyLossKg} kg/semaine (${(targets.weeklyLossKg * durationWeeks).toFixed(1)} kg total)`}
        </div>
        {targets.safetyFloorApplied && profile.intensity === 'flow' && (
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            Déficit de {targets.tdee - targets.targetKcal} kcal/jour. Mode Flow assumé.
          </p>
        )}
        {targets.safetyFloorApplied && profile.intensity !== 'flow' && (
          <p className="text-xs text-[var(--gold)] mt-2 text-center">
            Plancher de sécurité appliqué pour préserver ta masse musculaire.
          </p>
        )}
      </div>

      {/* Weight chart */}
      {chartData.length > 1 && (
        <div className="panel p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Courbe de poids</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid stroke="rgba(27,41,74,0.5)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--muted)', fontSize: 11 }}
                itemStyle={{ color: 'var(--ink)', fontSize: 12 }}
              />
              <Line
                type="monotone" dataKey="weight" name="Poids réel"
                stroke="var(--blue-bright)" strokeWidth={2} dot={{ fill: 'var(--blue-bright)', r: 4 }}
                connectNulls={false}
              />
              <Line
                type="monotone" dataKey="target" name="Trajectoire cible"
                stroke="var(--green)" strokeWidth={1.5} strokeDasharray="5 3" dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </PageWrapper>
  );
}