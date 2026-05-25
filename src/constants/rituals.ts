import { DayType } from '../types';

export interface RitualDef {
  id: string;
  labelM: string;
  labelF: string;
  points: number;
  applicableDays: DayType[] | 'all';
}

export const RITUALS: RitualDef[] = [
  {
    id: 'no_refined_sugar',
    labelM: 'Aucun sucre raffiné',
    labelF: 'Aucun sucre raffiné',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'whole_grains_only',
    labelM: 'Céréales complètes uniquement',
    labelF: 'Céréales complètes uniquement',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'veggies_every_meal',
    labelM: 'Légumes à chaque repas',
    labelF: 'Légumes à chaque repas',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'protein_target_met',
    labelM: 'Objectif protéines atteint',
    labelF: 'Objectif protéines atteint',
    points: 15,
    applicableDays: 'all',
  },
  {
    id: 'good_fats',
    labelM: 'Bons lipides consommés',
    labelF: 'Bons lipides consommés',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'hydration_2L',
    labelM: 'Hydratation 2L minimum',
    labelF: 'Hydratation 2L minimum',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'sleep_7h',
    labelM: 'Sommeil 7h minimum',
    labelF: 'Sommeil 7h minimum',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'no_snacking',
    labelM: 'Aucun grignotage',
    labelF: 'Aucun grignotage',
    points: 10,
    applicableDays: 'all',
  },
  {
    id: 'training_done',
    labelM: 'Séance d\'entraînement effectuée',
    labelF: 'Séance d\'entraînement effectuée',
    points: 20,
    applicableDays: ['muscu_j1', 'muscu_j2', 'muscu_j3', 'cardio'],
  },
  {
    id: 'repos_active',
    labelM: 'Repos actif (marche, mobilité)',
    labelF: 'Repos actif (marche, mobilité)',
    points: 10,
    applicableDays: ['repos'],
  },
  {
    id: 'no_lapse',
    labelM: 'Aucun écart alimentaire',
    labelF: 'Aucune écart alimentaire',
    points: 15,
    applicableDays: 'all',
  },
];

export function getRitualsForDay(dayType: DayType): RitualDef[] {
  return RITUALS.filter(
    (r) => r.applicableDays === 'all' || r.applicableDays.includes(dayType)
  );
}

export function getMaxPointsForDay(dayType: DayType): number {
  return getRitualsForDay(dayType).reduce((sum, r) => sum + r.points, 0);
}