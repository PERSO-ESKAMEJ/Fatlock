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

  const nutritionEnabled = challenge.challengeType !== 'custom' || (challenge.customSettings?.nutritionEnabled ?? true);
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
  const bodyComps = useLogStore((s) => s.bodyCompositions).filter((c) => c.userId === profile.id);
  const dailyLogs = useLogStore((s) => s.dailyLogs).filter((l) => l.userId === profile.id);

  const latest = getLatest(profile.id);
  const currentWeight = latest?.weightKg ?? profile.startWeight;
  const targets = calculateTargets(profile, currentWeight);
  const macroPercents = getMacroPercents(targets);

  // Build weight chart data
  const weightPoints: { label: string; weight: number | undefined; target: number }[] = [
    { label: 'S0', weight: profile.startWeight, target: profile.startWeight },
  ];

  for (let w = 1; w <= 8; w++) {
    const comp = bodyComps.find((c) => c.weekNumber === w);
    const targetW = +(profile.startWeight - targets.weeklyLossKg * w).toFixed(1);
    weightPoints.push({
      label: `S${w}`,
      weight: comp?.weightKg ?? undefined,
      target: targetW,
    });
  }

  // Also add daily weigh-ins
  const dailyWeights = dailyLogs
    .filter((l) => l.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ label: l.date.slice(5), weight: l.weightKg!, target: null }));

  const chartData = dailyWeights.length > 0 ? dailyWeights : weightPoints.filter((p) => p.weight !== null || p.target !== null);

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
          <span>TDEE: <span className="text-[var(--ink)] font-mono">{targets.tdee}</span></span>
          <span>Déficit: <span className="text-[var(--ink)] font-mono">{targets.tdee - targets.targetKcal}</span></span>
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
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Projection 8 semaines</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--muted)]">Poids actuel</div>
            <div className="font-mono text-xl font-bold text-[var(--ink)]">{currentWeight} kg</div>
          </div>
          <div className="text-2xl text-[var(--muted)]">→</div>
          <div className="text-right">
            <div className="text-xs text-[var(--muted)]">Poids S8 projeté</div>
            <div className="font-mono text-xl font-bold" style={{ color: 'var(--green)' }}>{targets.projectedWeightAt8Weeks} kg</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-[var(--muted)] text-center">
          Perte cible : {targets.weeklyLossKg} kg/semaine ({(targets.weeklyLossKg * 8).toFixed(1)} kg total)
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