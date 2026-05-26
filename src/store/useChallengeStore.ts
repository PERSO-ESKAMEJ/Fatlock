import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChallengeStore {
  codeConfirmedDates: string[];
  confirmCode: (date: string) => void;
  isCodeConfirmed: (date: string) => boolean;
  reset: () => void;
}

export const useChallengeStore = create<ChallengeStore>()(
  persist(
    (set, get) => ({
      codeConfirmedDates: [],

      confirmCode: (date) =>
        set((s) => ({
          codeConfirmedDates: s.codeConfirmedDates.includes(date)
            ? s.codeConfirmedDates
            : [...s.codeConfirmedDates, date],
        })),

      isCodeConfirmed: (date) => get().codeConfirmedDates.includes(date),

      reset: () => set({ codeConfirmedDates: [] }),
    }),
    { name: 'fatlock-challenge' }
  )
);

// Parse une date "YYYY-MM-DD" comme minuit heure locale (évite le décalage UTC)
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function localMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getChallengeState(startDate: string, durationWeeks = 8): 'pending' | 'active' | 'completed' {
  const start = parseLocalDate(startDate);
  const today = localMidnight();
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return 'pending';
  if (diffDays >= durationWeeks * 7) return 'completed';
  return 'active';
}

export function getDaysUntilStart(startDate: string): number {
  const start = parseLocalDate(startDate);
  const today = localMidnight();
  return Math.max(0, Math.ceil((start.getTime() - today.getTime()) / 86400000));
}

export function getCurrentWeek(startDate: string, durationWeeks = 8): number {
  const start = parseLocalDate(startDate);
  const today = localMidnight();
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return Math.min(durationWeeks, Math.max(1, Math.floor(diffDays / 7) + 1));
}

export function getDaysRemaining(startDate: string, durationWeeks = 8): number {
  const start = parseLocalDate(startDate);
  const end = new Date(start.getTime() + durationWeeks * 7 * 86400000);
  const today = localMidnight();
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}

export function getChallengeEndDate(startDate: string, durationWeeks = 8): string {
  const start = parseLocalDate(startDate);
  const end = new Date(start.getTime() + durationWeeks * 7 * 86400000);
  return end.toISOString().slice(0, 10);
}
