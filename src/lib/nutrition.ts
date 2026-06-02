import { UserProfile, Intensity, WeightDirection } from '../types';

export interface NutritionTargets {
  bmr: number;
  tdee: number;         // TDEE lifestyle seul (affiché)
  effectiveTdee: number; // TDEE + bonus séances FATLOCK (base du calcul)
  targetKcal: number;
  protein: number;
  fat: number;
  carbs: number;
  weeklyLossKg: number;
  projectedWeight: number;
  safetyFloorApplied: boolean;
}

// Déficit exprimé en % du TDEE effectif — garantit un lissage par niveau d'activité
const DEFICIT_RATE: Record<Intensity, number> = {
  safe: 0.23,
  standard: 0.33,
  flow: 0.43,
};

// Dépense calorique estimée par type de séance FATLOCK
const KCAL_PER_MUSCU  = 350; // séance muscu ~60 min
const KCAL_PER_CARDIO = 450; // séance cardio ~50 min

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
  const { sex, height, age, activityLevel, intensity, trainingDays } = profile;
  const w = currentWeightKg;

  // BMR Mifflin-St Jeor
  const bmr =
    sex === 'M'
      ? 10 * w + 6.25 * height - 5 * age + 5
      : 10 * w + 6.25 * height - 5 * age - 161;

  // TDEE de base (activité quotidienne hors FATLOCK)
  const tdee = bmr * activityLevel;

  // Bonus calorique des séances FATLOCK (depuis le planning personnel)
  const days = Object.values(trainingDays);
  const muscuCount  = days.filter(d => d && (d as string).startsWith('muscu')).length;
  const cardioCount = days.filter(d => d === 'cardio').length;
  const dailyTrainingBonus = Math.round((muscuCount * KCAL_PER_MUSCU + cardioCount * KCAL_PER_CARDIO) / 7);
  const effectiveTdee = Math.round(tdee + dailyTrainingBonus);

  let targetKcal: number;
  let actualWeeklyLossKg: number;
  let safetyFloorApplied = false;

  if (weightDirection === 'stable') {
    targetKcal = effectiveTdee;
    actualWeeklyLossKg = 0;
  } else if (weightDirection === 'up') {
    // Lean bulk : surplus ~0.4% du poids/semaine
    const weeklyGainKg = w * 0.004;
    const dailySurplus = (weeklyGainKg * 7700) / 7;
    targetKcal = Math.round(effectiveTdee + dailySurplus);
    actualWeeklyLossKg = +(-(weeklyGainKg).toFixed(2));
  } else {
    // Déficit = % du TDEE effectif → lissage automatique par niveau d'activité
    const dailyDeficit = Math.round(effectiveTdee * DEFICIT_RATE[intensity]);
    targetKcal = effectiveTdee - dailyDeficit;

    // Planchers absolus de sécurité (filet pour profils très légers)
    const floor =
      intensity === 'flow'
        ? (sex === 'M' ? 1200 : 1000)
        : intensity === 'standard'
          ? (sex === 'M' ? 1400 : 1200)
          : (sex === 'M' ? 1500 : 1300);

    safetyFloorApplied = targetKcal < floor;
    if (safetyFloorApplied) targetKcal = floor;

    const actualDailyDeficit = effectiveTdee - targetKcal;
    actualWeeklyLossKg = +((actualDailyDeficit * 7) / 7700).toFixed(2);
  }

  // Protéines adaptatives selon intensité + sexe + activité
  const proteinBase: Record<Intensity, number> = { safe: 1.8, standard: 2.0, flow: 2.2 };
  const sexAdj = sex === 'F' ? -0.1 : 0;
  const activityAdj =
    activityLevel <= 1.2   ? -0.1 :
    activityLevel <= 1.375 ?  0   :
    activityLevel <= 1.55  ?  0.1 :
    activityLevel <= 1.725 ?  0.2 : 0.3;
  const proteinPerKg = proteinBase[intensity] + sexAdj + activityAdj;
  const maxProteinKcal = targetKcal * 0.45;
  const protein = Math.min(Math.round(proteinPerKg * w), Math.floor(maxProteinKcal / 4));

  // Reste des calories : 37% glucides / 63% lipides
  const remainingKcal = Math.max(0, targetKcal - protein * 4);
  const carbs = Math.max(20, Math.round((remainingKcal * 0.37) / 4));
  const fat   = Math.max(20, Math.round((remainingKcal * 0.63) / 9));

  const projectedWeight = +(w - actualWeeklyLossKg * durationWeeks).toFixed(1);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    effectiveTdee,
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
    fatPct:     Math.round((targets.fat     * 9 * 100) / totalKcal),
    carbsPct:   Math.round((targets.carbs   * 4 * 100) / totalKcal),
  };
}

export const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Sédentaire (bureau, peu de mouvement)' },
  { value: 1.375, label: 'Légèrement actif (sport 1–2x/sem)' },
  { value: 1.55,  label: 'Modérément actif (sport 3–4x/sem)' },
  { value: 1.725, label: 'Très actif (sport 5–6x/sem)' },
  { value: 1.9,   label: 'Extrêmement actif (athlète, travail physique)' },
];
