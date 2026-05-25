import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile, ChallengeConfig } from '../types';

interface ProfileStore {
  profile: UserProfile | null;
  challenge: ChallengeConfig | null;
  setProfile: (profile: UserProfile) => void;
  setChallenge: (challenge: ChallengeConfig) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateChallenge: (updates: Partial<ChallengeConfig>) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: null,
      challenge: null,
      setProfile: (profile) => set({ profile }),
      setChallenge: (challenge) => set({ challenge }),
      updateProfile: (updates) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, ...updates } : null })),
      updateChallenge: (updates) =>
        set((s) => ({ challenge: s.challenge ? { ...s.challenge, ...updates } : null })),
      reset: () => set({ profile: null, challenge: null }),
    }),
    { name: 'fatlock-profile' }
  )
);
