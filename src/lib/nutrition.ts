import { UserProfile, Intensity } from '../types';

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetKcal: number;
  protein: number;
  fat: number;
  carbs: number;
  weeklyLossKg: number;
  projectedWeightAt8Weeks: number;
  safetyFloorApplied: boolean;
}

const WEEKLY_LOSS_RATE: Record<Intensity, number> = {
  safe: 0.005,
  standard: 0.0075,
  flow: 0.01,
};

export const INTENSITY_MULTIPLIER: Record<Intensity, number> = {
  safe: 1.0,
  standard: 1.4,
  flow: 2.0,
};

export function calculateTargets(profile: UserProfile, currentWeightKg: number): NutritionTargets {
  const { sex, height, age, activityLevel, intensity } = profile;
  const w = currentWeightKg;

  const bmr =
    sex === 'M'
      ? 10 * w + 6.25 * height - 5 * age + 5
      : 10 * w + 6.25 * height - 5 * age - 161;

  const tdee = bmr * activityLevel;
  const weeklyLossKg = w * WEEKLY_LOSS_RATE[intensity];
  const dailyDeficit = (weeklyLossKg * 7700) / 7;

  let targetKcal = Math.round(tdee - dailyDeficit);

  // Flow has a lower absolute floor — the deficit is intentional and assumed
  const floor = intensity === 'flow'
    ? 1400
    : sex === 'M'
      ? Math.max(Math.round(bmr * 1.1), 1500)
      : Math.max(Math.round(bmr * 1.1), 1300);
  const safetyFloorApplied = targetKcal < floor;
  if (safetyFloorApplied) targetKcal = floor;

  // Recalculate actual weekly loss based on real deficit after floor
  const actualDailyDeficit = Math.round(tdee) - targetKcal;
  const actualWeeklyLossKg = +((actualDailyDeficit * 7) / 7700).toFixed(2);

  const protein = Math.round(2.0 * w);
  // Fat: ideally 0.8g/kg, but capped so protein+fat don't exceed targetKcal
  const idealFat = Math.max(Math.round(0.8 * w), Math.round((targetKcal * 0.22) / 9));
  const maxFat = Math.max(30, Math.floor((targetKcal - protein * 4) / 9));
  const fat = Math.min(idealFat, maxFat);
  const carbs = Math.max(20, Math.round((targetKcal - protein * 4 - fat * 9) / 4));
  const projectedWeightAt8Weeks = +(w - actualWeeklyLossKg * 8).toFixed(1);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetKcal,
    protein,
    fat,
    carbs,
    weeklyLossKg: actualWeeklyLossKg,
    projectedWeightAt8Weeks,
    safetyFloorApplied,
  };
}

export function getMacroPercents(targets: NutritionTargets): {
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
} {
  const totalKcal = targets.protein * 4 + targets.fat * 9 + targets.carbs * 4;
  return {
    proteinPct: Math.round((targets.protein * 4 * 100) / totalKcal),
    fatPct: Math.round((targets.fat * 9 * 100) / totalKcal),
    carbsPct: Math.round((targets.carbs * 4 * 100) / totalKcal),
  };
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sédentaire (bureau, peu de mouvement)' },
  { value: 1.375, label: 'Légèrement actif (sport 1–2x/sem)' },
  { value: 1.55, label: 'Modérément actif (sport 3–4x/sem)' },
  { value: 1.725, label: 'Très actif (sport 5–6x/sem)' },
  { value: 1.9, label: 'Extrêmement actif (athlète, travail physique)' },
];