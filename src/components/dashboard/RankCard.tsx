import { useProfileStore } from '../../store/useProfileStore';
import { useLogStore } from '../../store/useLogStore';
import { useLeaderboardStore } from '../../store/useLeaderboardStore';
import { getTier, displayTier, calcCurrentStreak, calcDayRitualPoints, calcTotalStreakBonuses } from '../../lib/scoring';
import { getTierColor } from '../../constants/ranks';

export default function RankCard() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const logs = useLogStore((s) => s.dailyLogs).filter((l) => l.userId === profile.id);
  const weeklyScores = useLogStore((s) => s.weeklyScores).filter((s) => s.userId === profile.id);
  const entry = useLeaderboardStore((s) => s.getEntry(profile.id));
  const lbEntries = useLeaderboardStore((s) => s.masterLeaderboard?.entries.length ?? 1);

  const customRituals = challenge.challengeType === 'custom' ? challenge.customSettings?.rituals : undefined;

  // Only count logs from the challenge start date to avoid pre-challenge ritual points
  const challengeLogs = logs.filter((l) => l.date >= challenge.startDate);
  const confirmedLogs = challengeLogs.filter((l) => l.codeConfirmed);
  const liveDailyPts = confirmedLogs.reduce((sum, l) => sum + calcDayRitualPoints(l, profile.intensity, customRituals), 0);

  // Cumulative streak bonuses using all challenge logs (cross-week streaks)
  const scoredWeeks = weeklyScores.map((s) => s.weekNumber);
  const streakBonuses = scoredWeeks.length > 0
    ? calcTotalStreakBonuses(challengeLogs, challenge.startDate, scoredWeeks, profile.intensity, customRituals)
    : 0;
  const aiOnlyBonuses = weeklyScores.reduce((sum, s) => sum + s.aiBonus, 0);
  const totalEgo = liveDailyPts + streakBonuses + aiOnlyBonuses;

  const tier = getTier(totalEgo);
  const tierName = displayTier(tier, profile.sex);
  const tierColor = getTierColor(tier);
  const streak = calcCurrentStreak(logs, profile.intensity, customRituals);
  const rank = entry?.currentRank ?? '—';

  const adherencePct = logs.length > 0
    ? Math.round((confirmedLogs.length / Math.max(1, logs.length)) * 100)
    : 0;

  const motivationM: Record<string, string> = {
    top: 'Tu domines. Continue.',
    mid: 'Reste dans le top. Ils rattrapent.',
    low: 'Le mur FATLOCK approche. Réagis.',
  };
  const motivationF: Record<string, string> = {
    top: 'Tu te révèles. Impressionnant.',
    mid: 'Continue à te transformer.',
    low: 'Tu es plus forte que ça. Réagis.',
  };

  const rankNum = typeof rank === 'number' ? rank : null;
  const position = rankNum === null ? 'none' : rankNum <= 2 ? 'top' : rankNum >= lbEntries - 1 ? 'low' : 'mid';

  const motivationNone = profile.sex === 'M'
    ? 'Le challenge commence. Pose les bases.'
    : 'Le challenge commence. Pose les bases.';
  const motivation = position === 'none'
    ? motivationNone
    : profile.sex === 'M' ? motivationM[position] : motivationF[position];

  return (
    <div
      className="panel p-5 relative overflow-hidden"
      style={{ borderColor: tierColor + '44' }}
    >
      <div
        className="absolute inset-0 opacity-5"
        style={{ background: `radial-gradient(ellipse at top right, ${tierColor}, transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
              Ton rang
            </div>
            <div
              className="font-display leading-none"
              style={{ fontSize: 72, color: 'var(--ink)', lineHeight: 1 }}
            >
              #{rank}
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-display text-lg uppercase tracking-wide"
              style={{ color: tierColor }}
            >
              {tierName}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">{motivation}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--gold)' }}>🔥</span>
            <span className="font-mono text-sm font-bold" style={{ color: 'var(--gold)' }}>{streak}</span>
            <span className="text-xs text-[var(--muted)]">jours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-[var(--cyan)]">{totalEgo}</span>
            <span className="text-xs text-[var(--muted)]">ego pts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-[var(--green)]">{adherencePct}%</span>
            <span className="text-xs text-[var(--muted)]">assiduité</span>
          </div>
        </div>
      </div>
    </div>
  );
}