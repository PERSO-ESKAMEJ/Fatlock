import { DailyLog, BodyComposition, WeeklyScore, Intensity, RankTier, Sex, CustomRitual } from '../types';
import { INTENSITY_MULTIPLIER } from './nutrition';
import { RANK_TIERS } from '../constants/ranks';
import { getRitualsForDay, getMaxPointsForDay } from '../constants/rituals';

const INTENSITY_RITUAL_THRESHOLD: Record<Intensity, number> = {
  flow: 1.0,
  standard: 0.8,
  safe: 0.6,
};

const RITUAL_POINTS: Record<string, number> = {
  // Safe
  no_refined_sugar: 10,
  hydration_2L: 10,
  sleep_7h: 10,
  training_done: 20,
  repos_active: 10,
  // Standard
  veggies_daily: 10,
  protein_target_met: 15,
  no_snacking: 10,
  no_alcohol: 15,
  no_lapse: 15,
  // Flow
  intermittent_fasting: 15,
  no_simple_carbs_after_18: 15,
  steps_10k: 10,
  last_meal_before_20: 10,
  cardio_extra: 15,
};

// Plafond ego normalisé par intensité dans le score composite.
// Dérivé du breakeven FLOW/SAFE à 85% : 0.85 × 1000 = 850.
// STANDARD interpolé à 40% du chemin SAFE→FLOW (position du multiplicateur 1.4 dans [1.0, 2.0]).
export const INTENSITY_CEILING: Record<Intensity, number> = {
  safe: 850,
  standard: 910,
  flow: 1000,
};

export function calcDayRitualPoints(log: DailyLog, intensity: Intensity, customRituals?: CustomRitual[]): number {
  if (customRituals && customRituals.length > 0) {
    let raw = 0;
    for (const ritual of customRituals) {
      if (log.rituals[ritual.id]) raw += ritual.points * 10;
    }
    return Math.round(raw * INTENSITY_MULTIPLIER[intensity]);
  }
  const availableRituals = getRitualsForDay(log.dayType ?? 'repos', intensity);
  let raw = 0;
  for (const ritual of availableRituals) {
    if (log.rituals[ritual.id]) raw += ritual.points;
  }
  return Math.round(raw * INTENSITY_MULTIPLIER[intensity]);
}

function isDayValid(log: DailyLog, intensity: Intensity, customRituals?: CustomRitual[]): boolean {
  if (customRituals && customRituals.length > 0) {
    const required = customRituals.filter((r) => r.required);
    const pool = required.length > 0 ? required : customRituals;
    const done = pool.filter((r) => log.rituals[r.id]).length;
    return done / pool.length >= INTENSITY_RITUAL_THRESHOLD[intensity];
  }
  const maxPossible = getMaxPointsForDay(log.dayType ?? 'repos', intensity);
  const rawPoints = Object.entries(log.rituals)
    .filter(([, v]) => v)
    .reduce((sum, [k]) => sum + (RITUAL_POINTS[k] ?? 0), 0);
  return rawPoints >= maxPossible * 0.6;
}

export function calcCurrentStreak(logs: DailyLog[], intensity: Intensity, customRituals?: CustomRitual[]): number {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let prevDate: string | null = null;
  for (const log of sorted) {
    if (prevDate !== null) {
      const prev: Date = new Date(prevDate + 'T12:00:00');
      prev.setDate(prev.getDate() - 1);
      const expected: string = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
      if (log.date !== expected) break;
    }
    if (!isDayValid(log, intensity, customRituals)) break;
    streak++;
    prevDate = log.date;
  }
  return streak;
}

export function calcAIBonus(credibilityScore: number | null, intensity: Intensity = 'standard'): number {
  if (credibilityScore === null) return 0;
  if (intensity === 'flow') {
    if (credibilityScore >= 85) return 20;
    if (credibilityScore >= 65) return 10;
    if (credibilityScore >= 45) return 0;
    if (credibilityScore >= 25) return -20;
    return -35;
  }
  if (intensity === 'standard') {
    if (credibilityScore >= 85) return 15;
    if (credibilityScore >= 65) return 8;
    if (credibilityScore >= 45) return 0;
    if (credibilityScore >= 25) return -15;
    return -25;
  }
  if (credibilityScore >= 85) return 10;
  if (credibilityScore >= 65) return 5;
  if (credibilityScore >= 45) return 0;
  if (credibilityScore >= 25) return -10;
  return -15;
}

export function calcTransformationScore(
  startCompo: BodyComposition | null,
  currentCompo: BodyComposition | null,
  durationWeeks = 8
): number {
  if (!startCompo || !currentCompo) return 0;
  const fatLostKg = startCompo.fatMassKg - currentCompo.fatMassKg;
  const muscleGainedKg = currentCompo.muscleMassKg - startCompo.muscleMassKg;
  const fatCapKg = startCompo.weightKg * 0.015 * durationWeeks;
  const fatLostCapped = Math.min(Math.max(0, fatLostKg), fatCapKg);
  const muscleGainedCapped = Math.min(Math.max(0, muscleGainedKg), 0.1875 * durationWeeks);
  const fatScore = Math.round((fatLostCapped / 0.5) * 10);
  const muscleScore = Math.round((muscleGainedCapped / 0.5) * 15);
  return fatScore + muscleScore;
}

export function calcRegularityScore(logs: DailyLog[], totalDays: number): number {
  if (totalDays === 0) return 0;
  const confirmedDays = logs.filter((l) => l.codeConfirmed).length;
  return Math.round((confirmedDays / totalDays) * 100);
}

// Somme des points ego maximaux atteignables pour un ensemble de logs.
// Sert à normaliser le score composite par rapport au potentiel réel du joueur.
export function calcMaxEgoPoints(
  logs: DailyLog[],
  intensity: Intensity,
  customRituals?: CustomRitual[]
): number {
  if (customRituals && customRituals.length > 0) {
    const maxRawPerDay = customRituals.reduce((sum, r) => sum + r.points * 10, 0);
    const maxPerDay = Math.round(maxRawPerDay * INTENSITY_MULTIPLIER[intensity]);
    return maxPerDay * logs.length;
  }
  return logs.reduce((sum, log) => {
    const maxRaw = getMaxPointsForDay(log.dayType ?? 'repos', intensity);
    return sum + Math.round(maxRaw * INTENSITY_MULTIPLIER[intensity]);
  }, 0);
}

export function calcCompositeScore(
  egoPoints: number,
  transformationScore: number,
  regularityPercent: number,
  maxEgoPoints?: number,
  intensity?: Intensity
): number {
  // Avec maxEgoPoints + intensity : normalisation par rapport au potentiel × plafond d'intensité.
  // Sans : fallback absolu (rétro-compatibilité).
  let egoNorm: number;
  if (maxEgoPoints != null && maxEgoPoints > 0 && intensity != null) {
    egoNorm = Math.min(egoPoints / maxEgoPoints, 1) * INTENSITY_CEILING[intensity];
  } else {
    egoNorm = Math.min(egoPoints, 5000) / 5;
  }
  const transNorm = Math.min(transformationScore, 150) * (1000 / 150);
  const regNorm   = regularityPercent * 10;
  return Math.round(egoNorm * 0.5 + transNorm * 0.25 + regNorm * 0.25);
}

export function getTier(points: number): RankTier {
  let tier = RANK_TIERS[0].tier;
  for (const t of RANK_TIERS) {
    if (points >= t.minPoints) {
      tier = t.tier;
    }
  }
  return tier;
}

export function displayTier(tier: RankTier, sex: Sex): string {
  if (sex === 'F') {
    if (tier === 'Affûté') return 'Affûtée';
    if (tier === 'Élite') return 'Élite';
    if (tier === 'Ego Manifeste') return 'Ego Manifeste';
    if (tier === 'Challenger') return 'Challenger';
    if (tier === 'En Construction') return 'En Construction';
    if (tier === 'Corps Brut') return 'Corps Brut';
    if (tier === 'Apex') return 'Apex';
  }
  return tier;
}

export function calcTotalStreakBonuses(
  allLogs: DailyLog[],
  challengeStartDate: string,
  weekNumbers: number[],
  intensity: Intensity,
  customRituals?: CustomRitual[]
): number {
  const [y, m, d] = challengeStartDate.split('-').map(Number);
  const startMs = new Date(y, m - 1, d).getTime();
  let total = 0;
  for (const w of weekNumbers) {
    const weekEndMs = startMs + w * 7 * 86400000 - 86400000;
    const we = new Date(weekEndMs);
    const weekEndStr = `${we.getFullYear()}-${String(we.getMonth() + 1).padStart(2, '0')}-${String(we.getDate()).padStart(2, '0')}`;
    const logsUpToEnd = allLogs.filter((l) => l.date <= weekEndStr);
    total += calcCurrentStreak(logsUpToEnd, intensity, customRituals) * 5;
  }
  return total;
}

export function buildWeeklyScore(
  userId: string,
  weekNumber: number,
  logs: DailyLog[],
  intensity: Intensity,
  startCompo: BodyComposition | null,
  currentCompo: BodyComposition | null,
  credibilityScore: number | null,
  totalDays: number,
  customRituals?: CustomRitual[],
  durationWeeks = 8,
  allLogs?: DailyLog[]
): WeeklyScore {
  const egoPoints = logs.reduce(
    (sum, log) => sum + calcDayRitualPoints(log, intensity, customRituals),
    0
  );
  const streakLogs = allLogs ?? logs;
  const streakBonus = calcCurrentStreak(streakLogs, intensity, customRituals) * 5;
  const aiBonus = calcAIBonus(credibilityScore, intensity);
  const transformationScore = calcTransformationScore(startCompo, currentCompo, durationWeeks);
  const regularityScore = calcRegularityScore(logs, totalDays);
  const maxEgoPoints = calcMaxEgoPoints(logs, intensity, customRituals);
  const totalComposite = calcCompositeScore(
    egoPoints + streakBonus + aiBonus,
    transformationScore,
    regularityScore,
    maxEgoPoints,
    intensity
  );

  return {
    userId,
    weekNumber,
    egoPoints,
    streakBonus,
    aiBonus,
    transformationScore,
    regularityScore,
    totalComposite,
  };
}
