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

export function getCurrentWeek(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return Math.min(8, Math.max(1, Math.floor(diffDays / 7) + 1));
}

export function getDaysRemaining(startDate: string): number {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + 56 * 86400000);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}
