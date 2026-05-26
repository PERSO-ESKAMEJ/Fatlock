import { useProfileStore } from '../../store/useProfileStore';
import { getDaysRemaining, getCurrentWeek } from '../../store/useChallengeStore';

export default function CountdownBar() {
  const challenge = useProfileStore((s) => s.challenge)!;
  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const totalDays = durationWeeks * 7;
  const daysLeft = getDaysRemaining(challenge.startDate, durationWeeks);
  const currentWeek = getCurrentWeek(challenge.startDate, durationWeeks);
  const daysElapsed = Math.max(0, totalDays - daysLeft);
  const pct = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Challenge en cours
        </div>
        <div className="font-mono text-xs text-[var(--muted)]">
          Semaine <span className="text-[var(--ink)] font-bold">{currentWeek}</span>/{durationWeeks}
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