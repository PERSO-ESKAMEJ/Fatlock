export type Sex = 'M' | 'F';
export type Intensity = 'safe' | 'standard' | 'flow';
export type DayType = 'muscu_j1' | 'muscu_j2' | 'muscu_j3' | 'cardio' | 'repos';
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
}

export interface DailyLog {
  userId: string;
  date: string;
  codeConfirmed: boolean;
  dayType: DayType;
  rituals: Record<string, boolean>;
  weightKg?: number;
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