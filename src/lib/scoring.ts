import { DailyLog, BodyComposition, WeeklyScore, Intensity, RankTier, Sex } from '../types';
import { INTENSITY_MULTIPLIER } from './nutrition';
import { RANK_TIERS } from '../constants/ranks';
import { getRitualsForDay, getMaxPointsForDay } from '../constants/rituals';

export const RITUAL_POINTS: Record<string, number> = {
  no_refined_sugar: 10,
  whole_grains_only: 10,
  veggies_every_meal: 10,
  protein_target_met: 15,
  good_fats: 10,
  hydration_2L: 10,
  sleep_7h: 10,
  no_snacking: 10,
  training_done: 20,
  repos_active: 10,
  no_lapse: 15,
};

export function calcDayRitualPoints(log: DailyLog, intensity: Intensity): number {
  const availableRituals = getRitualsForDay(log.dayType);
  let raw = 0;
  for (const ritual of availableRituals) {
    if (log.rituals[ritual.id]) {
      raw += ritual.points;
    }
  }
  return Math.round(raw * INTENSITY_MULTIPLIER[intensity]);
}

export function calcStreak(logs: DailyLog[], intensity: Intensity): number {
  // 60% threshold of max possible daily points
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  let maxStreak = 0;

  for (const log of sorted) {
    const maxPossible = getMaxPointsForDay(log.dayType);
    const threshold = maxPossible * 0.6;
    const earned = calcDayRitualPoints(log, intensity) / INTENSITY_MULTIPLIER[intensity]; // raw points
    if (earned >= threshold) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
  }
  return streak;
}

export function calcCurrentStreak(logs: DailyLog[], intensity: Intensity): number {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date)); // newest first
  let streak = 0;
  for (const log of sorted) {
    const maxPossible = getMaxPointsForDay(log.dayType);
    const threshold = maxPossible * 0.6;
    const rawPoints = Object.entries(log.rituals)
      .filter(([, v]) => v)
      .reduce((sum, [k]) => sum + (RITUAL_POINTS[k] ?? 0), 0);
    if (rawPoints >= threshold) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function calcAIBonus(credibilityScore: number): number {
  // Additive only, never negative
  if (credibilityScore >= 90) return 50;
  if (credibilityScore >= 75) return 30;
  if (credibilityScore >= 60) return 15;
  if (credibilityScore >= 40) return 5;
  return 0;
}

export function calcTransformationScore(
  startCompo: BodyComposition | null,
  currentCompo: BodyComposition | null
): number {
  if (!startCompo || !currentCompo) return 0;
  const fatLostKg = startCompo.fatMassKg - currentCompo.fatMassKg;
  const muscleGainedKg = currentCompo.muscleMassKg - startCompo.muscleMassKg;
  // 10 pts per 0.5kg fat lost, 15 pts per 0.5kg muscle gained
  const fatScore = Math.max(0, Math.round((fatLostKg / 0.5) * 10));
  const muscleScore = Math.max(0, Math.round((muscleGainedKg / 0.5) * 15));
  return fatScore + muscleScore;
}

export function calcRegularityScore(logs: DailyLog[], totalDays: number): number {
  if (totalDays === 0) return 0;
  const confirmedDays = logs.filter((l) => l.codeConfirmed).length;
  return Math.round((confirmedDays / totalDays) * 100);
}

export function calcCompositeScore(
  egoPoints: number,
  transformationScore: number,
  regularityPercent: number
): number {
  // 50% ego + 25% transformation + 25% regularity (normalized)
  const egoNorm = egoPoints;
  const transNorm = transformationScore * 10; // scale to be comparable
  const regNorm = regularityPercent * 20; // scale 100% -> 2000
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

export function buildWeeklyScore(
  userId: string,
  weekNumber: number,
  logs: DailyLog[],
  intensity: Intensity,
  startCompo: BodyComposition | null,
  currentCompo: BodyComposition | null,
  credibilityScore: number,
  totalDays: number
): WeeklyScore {
  const egoPoints = logs.reduce(
    (sum, log) => sum + calcDayRitualPoints(log, intensity),
    0
  );
  const streakBonus = calcCurrentStreak(logs, intensity) * 5;
  const aiBonus = calcAIBonus(credibilityScore);
  const transformationScore = calcTransformationScore(startCompo, currentCompo);
  const regularityScore = calcRegularityScore(logs, totalDays);
  const totalComposite = calcCompositeScore(
    egoPoints + streakBonus + aiBonus,
    transformationScore,
    regularityScore
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