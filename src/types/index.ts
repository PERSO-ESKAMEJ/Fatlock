export type Sex = 'M' | 'F';
export type Intensity = 'safe' | 'standard' | 'flow';
export type DayType = 'muscu_j1' | 'muscu_j2' | 'muscu_j3' | 'cardio' | 'repos';
export type ChallengeType = 'fatlock' | 'custom';
export type WeightDirection = 'down' | 'up' | 'stable';
export type CaloricDirection = 'deficit' | 'surplus' | 'manual';
export type PhotoTracking = 'required' | 'optional' | 'disabled';

export interface CustomRitual {
  id: string;
  label: string;
  points: 1 | 2 | 3;
  required: boolean;
}

export interface CustomChallengeSettings {
  description: string;
  durationWeeks: number;
  trackWeight: boolean;
  weightDirection: WeightDirection;
  trackBodyFat: boolean;
  trackPhotos: PhotoTracking;
  customMetricLabel?: string;
  nutritionEnabled: boolean;
  caloricDirection: CaloricDirection;
  manualKcal?: number;
  rituals: CustomRitual[];
  aiAnalysisEnabled: boolean;
}

export const FATLOCK_DEFAULT_CUSTOM_RITUALS: CustomRitual[] = [
  { id: 'no_refined_sugar', label: 'Aucun sucre raffiné', points: 1, required: true },
  { id: 'whole_grains_only', label: 'Céréales complètes uniquement', points: 1, required: false },
  { id: 'veggies_every_meal', label: 'Légumes à chaque repas', points: 1, required: false },
  { id: 'protein_target_met', label: 'Objectif protéines atteint', points: 2, required: true },
  { id: 'good_fats', label: 'Bons lipides consommés', points: 1, required: false },
  { id: 'hydration_2L', label: 'Hydratation 2L minimum', points: 1, required: true },
  { id: 'sleep_7h', label: 'Sommeil 7h minimum', points: 1, required: true },
  { id: 'no_snacking', label: 'Aucun grignotage', points: 1, required: false },
  { id: 'training_done', label: "Séance d'entraînement effectuée", points: 2, required: true },
  { id: 'no_lapse', label: 'Aucun écart alimentaire', points: 2, required: false },
];
export type RankTier =
  | 'Corps Brut'
  | 'En Construction'
  | 'Challenger'
  | 'Affûté'
  | 'Élite'
  | 'Ego Manifeste'
  | 'Apex';

export interface UserProfile {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  height: number;
  startWeight: number;
  activityLevel: number;
  intensity: Intensity;
  trainingDays: {
    monday: DayType | null;
    tuesday: DayType | null;
    wednesday: DayType | null;
    thursday: DayType | null;
    friday: DayType | null;
    saturday: DayType | null;
    sunday: DayType | null;
  };
  groupCode: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface ChallengeConfig {
  id: string;
  groupName: string;
  groupCode: string;
  groupSecret: string;
  startDate: string;
  stakeAmount: number;
  adminId: string;
  participantIds: string[];
  anthropicApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  challengeType?: ChallengeType;
  customSettings?: CustomChallengeSettings;
}

export interface DailyLog {
  userId: string;
  date: string;
  codeConfirmed: boolean;
  dayType: DayType | null;
  rituals: Record<string, boolean>;
  weightKg?: number;
  customMetricValue?: number;
  notes?: string;
}

export interface BodyComposition {
  userId: string;
  date: string;
  weekNumber: number;
  weightKg: number;
  muscleMassKg: number;
  fatMassKg: number;
  waterPercent: number;
  boneMassKg: number;
}

export interface WeeklyPhoto {
  userId: string;
  weekNumber: number;
  capturedAt: string;
  frontBase64: string;
  sideBase64: string;
  backBase64?: string;
}

export interface AIAnalysisResult {
  userId: string;
  weekNumber: number;
  credibilityScore: number;
  analysis: string;
  generatedAt: string;
}

export interface WeeklyScore {
  userId: string;
  weekNumber: number;
  egoPoints: number;
  streakBonus: number;
  aiBonus: number;
  transformationScore: number;
  regularityScore: number;
  totalComposite: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  sex: Sex;
  intensity: Intensity;
  currentRank: number;
  previousRank: number;
  tier: RankTier;
  cumulativeEgoPoints: number;
  regularityPercent: number;
  transformationPercent: number;
  compositeScore: number;
  currentStreak: number;
  weeklyCredibilityScore?: number;
}

export interface RecapFile {
  version: '1.0';
  userId: string;
  userName: string;
  challengeId: string;
  weekNumber: number;
  exportedAt: string;
  profile: UserProfile;
  dailyLogs: DailyLog[];
  bodyCompositions: BodyComposition[];
  weeklyPhotos: WeeklyPhoto[];
  weeklyScores: WeeklyScore[];
  checksum: string;
}

export interface MasterLeaderboard {
  challengeId: string;
  updatedAt: string;
  weekNumber: number;
  entries: LeaderboardEntry[];
  weeklyHighlights: {
    biggestMover: string;
    topStreak: string;
    topCredibility: string;
  };
}