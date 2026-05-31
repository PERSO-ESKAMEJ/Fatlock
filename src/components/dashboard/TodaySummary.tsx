import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../../store/useProfileStore';
import { useLogStore } from '../../store/useLogStore';
import { useChallengeStore } from '../../store/useChallengeStore';
import { getTodayStr } from '../../lib/dailyCode';
import { getRitualsForDay, getMaxPointsForDay } from '../../constants/rituals';
import { calcDayRitualPoints } from '../../lib/scoring';
import { INTENSITY_MULTIPLIER } from '../../lib/nutrition';
import Button from '../ui/Button';

export default function TodaySummary() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const getDailyLog = useLogStore((s) => s.getDailyLog);
  const { isCodeConfirmed } = useChallengeStore();
  const navigate = useNavigate();

  const isCustom = challenge.challengeType === 'custom';
  const customRituals = isCustom ? (challenge.customSettings?.rituals ?? []) : null;

  const today = getTodayStr();
  const confirmed = isCodeConfirmed(challenge.groupCode, today);
  const log = getDailyLog(profile.id, today);
  const dayType = log?.dayType ?? 'repos';
  const rituals = isCustom && customRituals
    ? customRituals.map((r) => ({ id: r.id }))
    : getRitualsForDay(dayType, profile.intensity);
  const completedCount = log ? Object.values(log.rituals).filter(Boolean).length : 0;
  const totalCount = rituals.length;
  const earnedPts = log ? calcDayRitualPoints(log, profile.intensity, customRituals ?? undefined) : 0;
  const maxPts = isCustom && customRituals
    ? Math.round(customRituals.reduce((s, r) => s + r.points * 10, 0) * INTENSITY_MULTIPLIER[profile.intensity])
    : Math.round(getMaxPointsForDay(dayType, profile.intensity) * INTENSITY_MULTIPLIER[profile.intensity]);
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Rituels aujourd'hui
        </div>
        <div className="font-mono text-sm font-bold text-[var(--cyan)]">
          {earnedPts} <span className="text-[var(--muted)] text-xs">/ {maxPts} pts max</span>
        </div>
      </div>

      {!confirmed ? (
        <p className="text-xs text-[var(--muted)] mb-3">
          🔐 Confirme le code du jour pour accéder aux rituels.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="text-2xl font-display"
              style={{ color: completedCount === totalCount ? 'var(--green)' : 'var(--ink)' }}
            >
              {completedCount}/{totalCount}
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--panel2)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: completedCount === totalCount ? 'var(--green)' : 'var(--blue)',
                }}
              />
            </div>
          </div>
        </>
      )}

      <Button
        variant={confirmed ? 'primary' : 'ghost'}
        size="sm"
        className="w-full"
        onClick={() => navigate('/rituels')}
        disabled={!confirmed}
      >
        {confirmed ? 'Voir les rituels' : 'Rituels verrouillés'}
      </Button>
    </div>
  );
}