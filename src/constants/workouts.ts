export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  homeAlternative?: string;
}

export interface WorkoutDay {
  id: 'muscu_j1' | 'muscu_j2' | 'muscu_j3';
  label: string;
  focus: string;
  exercises: Exercise[];
  femaleNote?: string;
}

export const WORKOUTS: WorkoutDay[] = [
  {
    id: 'muscu_j1',
    label: 'JOUR 1',
    focus: 'Poitrine / Épaules / Dos / Jambes / Abdos',
    femaleNote: 'Ajoutez 2 séries de Hip Thrust (3×15) et Glute Kickback (3×15) après les squats.',
    exercises: [
      {
        name: 'Développé couché serré haltères',
        sets: 4,
        reps: '10–12',
        rest: '90s',
        notes: 'Pauses 1s en bas pour activer la poitrine interne',
        homeAlternative: 'Pompes rapprochées (mains à 20cm) — 4×15',
      },
      {
        name: 'Élévations latérales debout',
        sets: 3,
        reps: '12–15',
        rest: '60s',
        notes: 'Coudes légèrement fléchis, monter à hauteur d\'épaule',
        homeAlternative: 'Élévations latérales avec bouteilles d\'eau — 3×20',
      },
      {
        name: 'Pull-up (tractions)',
        sets: 4,
        reps: 'Max',
        rest: '90s',
        notes: 'Prise pronation largeur épaules, descente contrôlée',
        homeAlternative: 'Rowing avec table (Australian pull-up) — 4×12',
      },
      {
        name: 'Arnold press assis',
        sets: 3,
        reps: '10–12',
        rest: '75s',
        notes: 'Rotation complète paumes dedans → dehors',
        homeAlternative: 'Shoulder press avec bouteilles — 3×15',
      },
      {
        name: 'Squats',
        sets: 4,
        reps: '12–15',
        rest: '90s',
        notes: 'Descente cuisses parallèles au sol, genoux dans l\'axe des pieds',
        homeAlternative: 'Squats au poids du corps — 4×20',
      },
      {
        name: 'Soulevé de terre roumain',
        sets: 3,
        reps: '10–12',
        rest: '90s',
        notes: 'Dos plat, sensation d\'étirement ischio-jambiers',
        homeAlternative: 'Good morning sans charge — 3×15',
      },
      {
        name: 'Leg Raises + Crunchs (superset)',
        sets: 3,
        reps: '15 + 20',
        rest: '60s',
        notes: 'Enchaîner sans pause entre les deux exercices',
      },
      {
        name: 'Relevé de jambes suspendu',
        sets: 3,
        reps: '12–15',
        rest: '60s',
        notes: 'Contracter les abdos en haut du mouvement',
        homeAlternative: 'Relevé de jambes au sol — 3×15',
      },
      {
        name: 'Planche',
        sets: 3,
        reps: '45–60s',
        rest: '45s',
        notes: 'Corps aligné tête-talons, ventre contracté',
      },
      {
        name: 'Bicycle crunch',
        sets: 3,
        reps: '20 (×2)',
        rest: '45s',
        notes: 'Rotation lente et contrôlée, ne pas tirer la nuque',
      },
    ],
  },
  {
    id: 'muscu_j2',
    label: 'JOUR 2',
    focus: 'Poitrine large / Épaules arrière / Dos / Jambes / Abdos',
    femaleNote: 'Ajoutez 2 séries de Sumo Squat (3×15) et Donkey Kick (3×15) pour cibler fessiers et adducteurs.',
    exercises: [
      {
        name: 'Développé couché normal haltères',
        sets: 4,
        reps: '10–12',
        rest: '90s',
        notes: 'Prise large, coudes à 45° du corps',
        homeAlternative: 'Pompes standard — 4×15',
      },
      {
        name: 'Élévations latérales buste penché',
        sets: 3,
        reps: '12–15',
        rest: '60s',
        notes: 'Buste à 45°, cible les deltoïdes postérieurs',
        homeAlternative: 'Élévations penchées avec bouteilles — 3×15',
      },
      {
        name: 'Pull-up dips (tractions + dips)',
        sets: 4,
        reps: '8–10 + 10',
        rest: '90s',
        notes: 'Tractions d\'abord, puis dips enchaînés',
        homeAlternative: 'Dips entre deux chaises + rowing table — 4×10+10',
      },
      {
        name: 'Rowing debout barre menton',
        sets: 3,
        reps: '10–12',
        rest: '75s',
        notes: 'Tirer les coudes vers le plafond, barre proche du corps',
        homeAlternative: 'Upright row avec sac à dos lesté — 3×12',
      },
      {
        name: 'Fentes',
        sets: 4,
        reps: '12 (×2 jambes)',
        rest: '90s',
        notes: 'Genou avant à 90°, genou arrière effleure le sol',
        homeAlternative: 'Fentes statiques au poids du corps — 4×15',
      },
      {
        name: 'Deadlift (soulevé de terre)',
        sets: 3,
        reps: '8–10',
        rest: '120s',
        notes: 'Barre proche des jambes, dos plat, poussée des jambes',
        homeAlternative: 'Deadlift avec sac à dos lesté — 3×10',
      },
      {
        name: 'Mountain Climber + Battements de jambes (superset)',
        sets: 3,
        reps: '30s + 20',
        rest: '60s',
        notes: 'Enchaîner directement les deux exercices',
      },
      {
        name: 'Relevé de jambes suspendu',
        sets: 3,
        reps: '12–15',
        rest: '60s',
        notes: 'Amplitude complète, contrôle la descente',
        homeAlternative: 'Relevé de jambes couché — 3×15',
      },
      {
        name: 'Planche',
        sets: 3,
        reps: '45–60s',
        rest: '45s',
        notes: 'Variante: planche latérale en alternance',
      },
      {
        name: 'Rotation buste assis + Relevé oblique (superset)',
        sets: 3,
        reps: '20 + 15',
        rest: '45s',
        notes: 'Rotation avec haltère léger, relevé oblique en contrôle',
      },
    ],
  },
  {
    id: 'muscu_j3',
    label: 'JOUR 3',
    focus: 'Poitrine barre / Épaules avant / Tractions / Jambes / Abdos',
    femaleNote: 'Ajoutez 2 séries de Bulgarian Split Squat (3×12) et Cable Kickback (3×15) pour maximiser le travail fessier.',
    exercises: [
      {
        name: 'Développé couché barre',
        sets: 4,
        reps: '8–10',
        rest: '120s',
        notes: 'Mouvement de base, prise légèrement plus large que les épaules',
        homeAlternative: 'Pompes lestées (sac à dos) — 4×12',
      },
      {
        name: 'Élévations frontales supination',
        sets: 3,
        reps: '10–12',
        rest: '60s',
        notes: 'Paumes vers le haut au sommet, contrôle la descente',
        homeAlternative: 'Élévations frontales avec bouteilles — 3×15',
      },
      {
        name: 'Tractions (prise neutre ou supination)',
        sets: 4,
        reps: 'Max',
        rest: '90s',
        notes: 'Amplitude complète, retour bras tendus',
        homeAlternative: 'Rowing table prise supination — 4×12',
      },
      {
        name: 'Rowing haltères penché',
        sets: 4,
        reps: '10–12',
        rest: '75s',
        notes: 'Un bras à la fois, coude serré le long du corps',
        homeAlternative: 'Rowing avec sac à dos — 4×12',
      },
      {
        name: 'Squats',
        sets: 4,
        reps: '15',
        rest: '90s',
        notes: 'Version volume, tempo 2–0–2',
        homeAlternative: 'Jump squats — 4×15',
      },
      {
        name: 'Deadlift',
        sets: 4,
        reps: '8',
        rest: '120s',
        notes: 'Séance lourde, concentration maximale sur la technique',
        homeAlternative: 'Single-leg deadlift au poids du corps — 4×10',
      },
      {
        name: 'Battements + Crunchs (superset)',
        sets: 3,
        reps: '20 + 20',
        rest: '60s',
        notes: 'Battements horizontaux, crunchs lents et contrôlés',
      },
      {
        name: 'Relevé de jambes suspendu',
        sets: 3,
        reps: '12–15',
        rest: '60s',
        notes: 'Torsion légère en haut pour cibler les obliques',
        homeAlternative: 'V-ups au sol — 3×12',
      },
      {
        name: 'Planche',
        sets: 4,
        reps: '30–45s',
        rest: '30s',
        notes: 'Séries plus courtes, focus sur la contraction',
      },
      {
        name: 'Bicycle + Rotation buste (superset)',
        sets: 3,
        reps: '20 + 15',
        rest: '45s',
        notes: 'Bicycle rapide, puis rotation lente avec haltère',
      },
    ],
  },
];

export const CARDIO_GUIDANCE = {
  label: 'CARDIO',
  description: 'Séance cardio dédiée à la combustion des graisses',
  options: [
    {
      name: 'HIIT (Haute Intensité)',
      duration: '20–25 min',
      protocol: '30s effort max / 30s récupération × 20 cycles',
      calories: '250–350 kcal',
    },
    {
      name: 'LISS (Basse Intensité)',
      duration: '45–60 min',
      protocol: 'Marche rapide, vélo, natation à 60–65% FCmax',
      calories: '300–400 kcal',
    },
    {
      name: 'Circuit Training',
      duration: '30–35 min',
      protocol: 'Burpees / Jumping Jacks / Mountain Climber / Box Jump — 4 tours',
      calories: '300–450 kcal',
    },
  ],
};