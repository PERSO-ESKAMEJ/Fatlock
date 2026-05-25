import { useProfileStore } from '../../store/useProfileStore';
import { useLogStore } from '../../store/useLogStore';
import { calculateTargets } from '../../lib/nutrition';
import { useNavigate } from 'react-router-dom';

export default function NutritionSnapshot() {
  const profile = useProfileStore((s) => s.profile)!;
  const getLatest = useLogStore((s) => s.getLatestBodyComp);
  const latest = getLatest(profile.id);
  const navigate = useNavigate();

  const weight = latest?.weightKg ?? profile.startWeight;
  const targets = calculateTargets(profile, weight);

  const macros = [
    { label: 'Protéines', g: targets.protein, kcal: targets.protein * 4, color: 'var(--blue-bright)' },
    { label: 'Glucides', g: targets.carbs, kcal: targets.carbs * 4, color: 'var(--cyan)' },
    { label: 'Lipides', g: targets.fat, kcal: targets.fat * 9, color: 'var(--gold)' },
  ];

  const totalKcal = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;

  return (
    <div className="panel p-4 cursor-pointer hover:border-[var(--blue)] transition-colors" onClick={() => navigate('/nutrition')}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Nutrition</div>
        <div className="font-display text-xl" style={{ color: 'var(--cyan)' }}>
          {targets.targetKcal} <span className="text-sm font-body text-[var(--muted)]">kcal</span>
        </div>
      </div>
      <div className="space-y-2">
        {macros.map((m) => {
          const pct = Math.round((m.kcal / totalKcal) * 100);
          return (
            <div key={m.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: m.color }}>{m.label}</span>
                <span className="font-mono text-[var(--muted)]">{m.g}g</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--panel2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}