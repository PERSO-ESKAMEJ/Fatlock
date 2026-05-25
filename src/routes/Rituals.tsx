import { useState } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useChallengeStore } from '../store/useChallengeStore';
import { getTodayStr } from '../lib/dailyCode';
import { getRitualsForDay, getMaxPointsForDay } from '../constants/rituals';
import { calcDayRitualPoints } from '../lib/scoring';
import { INTENSITY_MULTIPLIER } from '../lib/nutrition';
import { DayType } from '../types';
import PageWrapper from '../components/layout/PageWrapper';
import { useToast } from '../components/ui/Toast';

const DAY_TYPE_LABELS: Record<DayType, string> = {
  muscu_j1: 'Muscu J1',
  muscu_j2: 'Muscu J2',
  muscu_j3: 'Muscu J3',
  cardio: 'Cardio',
  repos: 'Repos',
};

export default function Rituals() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const { upsertDailyLog, getDailyLog } = useLogStore();
  const { isCodeConfirmed } = useChallengeStore();
  const { showToast } = useToast();

  const isCustom = challenge.challengeType === 'custom';
  const customRituals = isCustom ? (challenge.customSettings?.rituals ?? []) : null;

  const today = getTodayStr();
  const confirmed = isCodeConfirmed(today);
  const existingLog = getDailyLog(profile.id, today);

  const dow = new Date().getDay();
  const dowMap: Record<number, keyof typeof profile.trainingDays> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday',
  };
  const defaultDayType: DayType = profile.trainingDays[dowMap[dow]] ?? 'repos';
  const dayType: DayType = existingLog?.dayType ?? defaultDayType;

  const rituals = isCustom && customRituals
    ? customRituals.map((r) => ({ id: r.id, labelM: r.label, labelF: r.label, points: r.points * 10 }))
    : getRitualsForDay(dayType, profile.intensity);

  const ritualState: Record<string, boolean> = existingLog?.rituals ?? {};
  const [weight, setWeight] = useState(existingLog?.weightKg?.toString() ?? '');
  const [customMetric, setCustomMetric] = useState(existingLog?.customMetricValue?.toString() ?? '');

  const earnedPts = existingLog ? calcDayRitualPoints(existingLog, profile.intensity, customRituals ?? undefined) : 0;
  const maxPts = isCustom && customRituals
    ? Math.round(customRituals.reduce((s, r) => s + r.points * 10, 0) * INTENSITY_MULTIPLIER[profile.intensity])
    : Math.round(getMaxPointsForDay(dayType, profile.intensity) * INTENSITY_MULTIPLIER[profile.intensity]);
  const completedCount = Object.values(ritualState).filter(Boolean).length;

  function toggleRitual(key: string, currentValue: boolean) {
    if (!confirmed) return;
    const newRituals = { ...ritualState, [key]: !currentValue };
    const updatedLog = {
      userId: profile.id,
      date: today,
      codeConfirmed: true,
      dayType: isCustom ? null : dayType,
      rituals: newRituals,
      weightKg: weight ? parseFloat(weight) : undefined,
      customMetricValue: customMetric ? parseFloat(customMetric) : undefined,
    };
    upsertDailyLog(updatedLog);
    if (!currentValue) {
      const ritual = rituals.find((r) => r.id === key);
      const pts = Math.round((ritual?.points ?? 0) * INTENSITY_MULTIPLIER[profile.intensity]);
      showToast(`+${pts} pts — ${ritual?.labelM ?? ''}`, 'success');
    }
  }

  function handleSaveMetrics() {
    const updatedLog = {
      userId: profile.id,
      date: today,
      codeConfirmed: confirmed,
      dayType: isCustom ? null : dayType,
      rituals: ritualState,
      weightKg: weight ? parseFloat(weight) : undefined,
      customMetricValue: customMetric ? parseFloat(customMetric) : undefined,
    };
    upsertDailyLog(updatedLog);
    showToast('Enregistré', 'success');
  }

  const trackWeight = !isCustom || (challenge.customSettings?.trackWeight ?? true);
  const customMetricLabel = challenge.customSettings?.customMetricLabel;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wider">Rituels du jour</h1>
          <div className="text-xs text-[var(--muted)] mt-1">
            {today}
            {!isCustom && <> · <span className="text-[var(--ink)]">{DAY_TYPE_LABELS[dayType]}</span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold" style={{ color: 'var(--cyan)' }}>{earnedPts}</div>
          <div className="text-xs text-[var(--muted)]">/ {maxPts} pts</div>
        </div>
      </div>

      {!confirmed ? (
        <div className="panel p-4 text-center" style={{ borderColor: 'var(--red)' }}>
          <div className="text-2xl mb-2">🔐</div>
          <div className="font-bold text-[var(--ink)] mb-1">Rituels verrouillés</div>
          <p className="text-sm text-[var(--muted)]">Confirme le code du jour sur le Dashboard pour débloquer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rituals.map((ritual) => {
            const done = ritualState[ritual.id] ?? false;
            const label = profile.sex === 'F' ? ritual.labelF : ritual.labelM;
            const pts = Math.round(ritual.points * INTENSITY_MULTIPLIER[profile.intensity]);
            const isRequired = isCustom
              ? (customRituals?.find((r) => r.id === ritual.id)?.required ?? false)
              : false;

            return (
              <button
                key={ritual.id}
                onClick={() => toggleRitual(ritual.id, done)}
                className="w-full panel2 p-3 flex items-center gap-3 text-left transition-all hover:border-[var(--blue)]"
                style={{ borderColor: done ? 'var(--green)' : undefined, background: done ? 'rgba(47,227,154,0.06)' : undefined }}
              >
                <div
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: done ? 'var(--green)' : 'transparent',
                    border: `2px solid ${done ? 'var(--green)' : 'var(--border)'}`,
                  }}
                >
                  {done && <span className="text-xs font-bold" style={{ color: 'var(--bg)' }}>✓</span>}
                </div>
                <span className={`flex-1 text-sm ${done ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
                  {label}
                  {isRequired && !done && <span className="ml-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>★ requis</span>}
                </span>
                <span
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                  style={{
                    background: done ? 'rgba(47,227,154,0.15)' : 'var(--panel)',
                    color: done ? 'var(--green)' : 'var(--muted)',
                  }}
                >
                  +{pts}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Metrics */}
      <div className="mt-6 panel p-4 space-y-3">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Métriques du jour</div>
        {trackWeight && (
          <div className="flex gap-2">
            <input
              type="number" step="0.1" placeholder="Poids (kg)"
              value={weight} onChange={(e) => setWeight(e.target.value)}
              className="flex-1" min="30" max="250"
            />
          </div>
        )}
        {customMetricLabel && (
          <div className="flex gap-2">
            <input
              type="number" step="0.1"
              placeholder={customMetricLabel}
              value={customMetric} onChange={(e) => setCustomMetric(e.target.value)}
              className="flex-1"
            />
          </div>
        )}
        {(trackWeight || customMetricLabel) && (
          <button
            onClick={handleSaveMetrics}
            disabled={!weight && !customMetric}
            className="w-full px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{ background: 'var(--blue)', color: 'white' }}
          >
            Enregistrer
          </button>
        )}
      </div>

      {/* Progress bar */}
      {confirmed && rituals.length > 0 && (
        <div className="mt-4 panel2 p-3">
          <div className="flex justify-between text-xs text-[var(--muted)] mb-2">
            <span>{completedCount}/{rituals.length} rituels validés</span>
            <span className="font-mono">{Math.round((completedCount / rituals.length) * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--panel)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(completedCount / rituals.length) * 100}%`,
                background: completedCount === rituals.length ? 'var(--green)' : 'var(--blue)',
              }}
            />
          </div>
        </div>
      )}
    </PageWrapper>
  );
}