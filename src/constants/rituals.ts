import { DayType, Intensity } from '../types';

export interface RitualDef {
  id: string;
  labelM: string;
  labelF: string;
  points: number;
  applicableDays: DayType[] | 'all';
  minIntensity: Intensity;
}

const INTENSITY_ORDER: Record<Intensity, number> = { safe: 0, standard: 1, flow: 2 };

export const RITUALS: RitualDef[] = [
  // ── SAFE ────────────────────────────────────────────────────────────────
  {
    id: 'no_refined_sugar',
    labelM: 'Aucun sucre raffiné',
    labelF: 'Aucun sucre raffiné',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'safe',
  },
  {
    id: 'hydration_2L',
    labelM: 'Hydratation 2L minimum',
    labelF: 'Hydratation 2L minimum',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'safe',
  },
  {
    id: 'sleep_7h',
    labelM: 'Sommeil 7h minimum',
    labelF: 'Sommeil 7h minimum',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'safe',
  },
  {
    id: 'training_done',
    labelM: "Séance d'entraînement effectuée",
    labelF: "Séance d'entraînement effectuée",
    points: 20,
    applicableDays: ['muscu_j1', 'muscu_j2', 'muscu_j3', 'cardio'],
    minIntensity: 'safe',
  },
  {
    id: 'repos_active',
    labelM: 'Repos actif : marche ou mobilité 30 min',
    labelF: 'Repos actif : marche ou mobilité 30 min',
    points: 10,
    applicableDays: ['repos'],
    minIntensity: 'safe',
  },

  // ── STANDARD ────────────────────────────────────────────────────────────
  {
    id: 'veggies_daily',
    labelM: 'Légumes au moins une fois dans la journée',
    labelF: 'Légumes au moins une fois dans la journée',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'standard',
  },
  {
    id: 'protein_target_met',
    labelM: 'Objectif protéines atteint',
    labelF: 'Objectif protéines atteint',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'standard',
  },
  {
    id: 'no_snacking',
    labelM: 'Aucun grignotage',
    labelF: 'Aucun grignotage',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'standard',
  },
  {
    id: 'no_alcohol',
    labelM: 'Aucun alcool',
    labelF: 'Aucun alcool',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'standard',
  },
  {
    id: 'no_lapse',
    labelM: 'Aucun écart alimentaire',
    labelF: 'Aucun écart alimentaire',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'standard',
  },

  // ── FLOW ────────────────────────────────────────────────────────────────
  {
    id: 'intermittent_fasting',
    labelM: 'Jeûne intermittent 16h respecté',
    labelF: 'Jeûne intermittent 16h respecté',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'no_simple_carbs_after_18',
    labelM: 'Pas de glucides simples après 18h',
    labelF: 'Pas de glucides simples après 18h',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'steps_10k',
    labelM: '10 000 pas atteints',
    labelF: '10 000 pas atteints',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'last_meal_before_20',
    labelM: 'Dernier repas avant 20h',
    labelF: 'Dernier repas avant 20h',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'cardio_extra',
    labelM: 'Cardio additionnel 20 min',
    labelF: 'Cardio additionnel 20 min',
    points: 15,
    applicableDays: ['repos'],
    minIntensity: 'flow',
  },
];

export function getRitualsForDay(dayType: DayType, intensity: Intensity = 'standard'): RitualDef[] {
  return RITUALS.filter(
    (r) =>
      (r.applicableDays === 'all' || r.applicableDays.includes(dayType)) &&
      INTENSITY_ORDER[r.minIntensity] <= INTENSITY_ORDER[intensity]
  );
}

export function getMaxPointsForDay(dayType: DayType, intensity: Intensity = 'standard'): number {
  return getRitualsForDay(dayType, intensity).reduce((sum, r) => sum + r.points, 0);
}