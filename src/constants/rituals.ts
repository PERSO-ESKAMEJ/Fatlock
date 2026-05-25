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
    id: 'veggies_every_meal',
    labelM: 'Légumes à chaque repas',
    labelF: 'Légumes à chaque repas',
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
    labelM: 'Repos actif (marche, mobilité)',
    labelF: 'Repos actif (marche, mobilité)',
    points: 10,
    applicableDays: ['repos'],
    minIntensity: 'safe',
  },

  // ── STANDARD ────────────────────────────────────────────────────────────
  {
    id: 'whole_grains_only',
    labelM: 'Céréales complètes uniquement',
    labelF: 'Céréales complètes uniquement',
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
    id: 'good_fats',
    labelM: 'Bons lipides consommés',
    labelF: 'Bons lipides consommés',
    points: 10,
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
    labelM: 'Jeûne intermittent respecté (16h min)',
    labelF: 'Jeûne intermittent respecté (16h min)',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'cold_shower',
    labelM: 'Douche froide matinale',
    labelF: 'Douche froide matinale',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'mindset_session',
    labelM: 'Session mentale : méditation ou visualisation (10 min)',
    labelF: 'Session mentale : méditation ou visualisation (10 min)',
    points: 10,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'no_alcohol',
    labelM: 'Aucun alcool',
    labelF: 'Aucun alcool',
    points: 15,
    applicableDays: 'all',
    minIntensity: 'flow',
  },
  {
    id: 'training_progression',
    labelM: 'Progression notée sur les charges',
    labelF: 'Progression notée sur les charges',
    points: 15,
    applicableDays: ['muscu_j1', 'muscu_j2', 'muscu_j3'],
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