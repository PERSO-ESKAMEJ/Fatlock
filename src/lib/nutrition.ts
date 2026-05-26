import { UserProfile, Intensity, WeightDirection } from '../types';

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetKcal: number;
  protein: number;
  fat: number;
  carbs: number;
  weeklyLossKg: number;
  projectedWeight: number;
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

export function calculateTargets(
  profile: UserProfile,
  currentWeightKg: number,
  durationWeeks = 8,
  weightDirection: WeightDirection = 'down'
): NutritionTargets {
  const { sex, height, age, activityLevel, intensity } = profile;
  const w = currentWeightKg;

  const bmr =
    sex === 'M'
      ? 10 * w + 6.25 * height - 5 * age + 5
      : 10 * w + 6.25 * height - 5 * age - 161;

  const tdee = bmr * activityLevel;

  let targetKcal: number;
  let actualWeeklyLossKg: number;
  let safetyFloorApplied = false;

  if (weightDirection === 'stable') {
    targetKcal = Math.round(tdee);
    actualWeeklyLossKg = 0;
  } else if (weightDirection === 'up') {
    // Lean bulk: ~0.4% body weight/week surplus
    const weeklyGainKg = w * 0.004;
    const dailySurplus = (weeklyGainKg * 7700) / 7;
    targetKcal = Math.round(tdee + dailySurplus);
    // Negative value = weight gain (projected weight will increase)
    actualWeeklyLossKg = +(-(weeklyGainKg).toFixed(2));
  } else {
    // Deficit (default)
    const weeklyLossKg = w * WEEKLY_LOSS_RATE[intensity];
    const dailyDeficit = (weeklyLossKg * 7700) / 7;
    targetKcal = Math.round(tdee - dailyDeficit);

    // Flow has a lower absolute floor — the deficit is intentional and assumed
    const floor = intensity === 'flow'
      ? 1400
      : sex === 'M'
        ? Math.max(Math.round(bmr * 1.1), 1500)
        : Math.max(Math.round(bmr * 1.1), 1300);
    safetyFloorApplied = targetKcal < floor;
    if (safetyFloorApplied) targetKcal = floor;

    const actualDailyDeficit = Math.round(tdee) - targetKcal;
    actualWeeklyLossKg = +((actualDailyDeficit * 7) / 7700).toFixed(2);
  }

  // Adaptive protein: base by intensity + sex/activity adjustments
  const proteinBase: Record<Intensity, number> = { safe: 1.8, standard: 2.0, flow: 2.2 };
  const sexAdj = sex === 'F' ? -0.1 : 0;
  const activityAdj =
    activityLevel <= 1.2 ? -0.1 :
    activityLevel <= 1.375 ? 0 :
    activityLevel <= 1.55 ? 0.1 :
    activityLevel <= 1.725 ? 0.2 : 0.3;
  const proteinPerKg = proteinBase[intensity] + sexAdj + activityAdj;
  // Cap at 45% of targetKcal to avoid protein consuming the entire budget
  const maxProteinKcal = targetKcal * 0.45;
  const protein = Math.min(Math.round(proteinPerKg * w), Math.floor(maxProteinKcal / 4));

  // After protein, split remaining calories: 37% carbs / 63% fat
  const remainingKcal = Math.max(0, targetKcal - protein * 4);
  const carbs = Math.max(20, Math.round((remainingKcal * 0.37) / 4));
  const fat = Math.max(20, Math.round((remainingKcal * 0.63) / 9));
  const projectedWeight = +(w - actualWeeklyLossKg * durationWeeks).toFixed(1);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetKcal,
    protein,
    fat,
    carbs,
    weeklyLossKg: actualWeeklyLossKg,
    projectedWeight,
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