import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MasterLeaderboard, LeaderboardEntry } from '../types';

interface LeaderboardStore {
  masterLeaderboard: MasterLeaderboard | null;
  setMasterLeaderboard: (lb: MasterLeaderboard) => void;
  getEntry: (userId: string) => LeaderboardEntry | undefined;
  reset: () => void;
}

export const useLeaderboardStore = create<LeaderboardStore>()(
  persist(
    (set, get) => ({
      masterLeaderboard: null,

      setMasterLeaderboard: (lb) => set({ masterLeaderboard: lb }),

      getEntry: (userId) =>
        get().masterLeaderboard?.entries.find((e) => e.userId === userId),

      reset: () => set({ masterLeaderboard: null }),
    }),
    { name: 'fatlock-leaderboard' }
  )
);
