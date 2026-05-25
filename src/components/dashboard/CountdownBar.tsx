import { useProfileStore } from '../../store/useProfileStore';
import { getDaysRemaining, getCurrentWeek } from '../../store/useChallengeStore';

export default function CountdownBar() {
  const challenge = useProfileStore((s) => s.challenge)!;
  const daysLeft = getDaysRemaining(challenge.startDate);
  const currentWeek = getCurrentWeek(challenge.startDate);
  const daysElapsed = 56 - daysLeft;
  const pct = Math.min(100, Math.round((daysElapsed / 56) * 100));

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Challenge en cours
        </div>
        <div className="font-mono text-xs text-[var(--muted)]">
          Semaine <span className="text-[var(--ink)] font-bold">{currentWeek}</span>/8
        </div>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--panel2)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(to right, var(--blue), var(--cyan))',
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-[var(--muted)]">{daysElapsed} jours écoulés</div>
        <div className="text-xs font-bold" style={{ color: daysLeft <= 7 ? 'var(--red)' : 'var(--ink)' }}>
          {daysLeft} jours restants
        </div>
      </div>
    </div>
  );
}