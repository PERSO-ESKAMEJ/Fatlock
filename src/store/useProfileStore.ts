import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile, ChallengeConfig } from '../types';

export interface ProfileEntry {
  profile: UserProfile;
  challenge: ChallengeConfig;
}

interface ProfileStore {
  entries: ProfileEntry[];
  activeId: string | null;
  profile: UserProfile | null;
  challenge: ChallengeConfig | null;
  addEntry: (profile: UserProfile, challenge: ChallengeConfig) => void;
  switchEntry: (profileId: string) => void;
  setProfile: (profile: UserProfile) => void;
  setChallenge: (challenge: ChallengeConfig) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateChallenge: (updates: Partial<ChallengeConfig>) => void;
  reset: () => void;
  resetAll: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      entries: [],
      activeId: null,
      profile: null,
      challenge: null,

      addEntry: (profile, challenge) =>
        set((s) => ({
          entries: [...s.entries.filter((e) => e.profile.id !== profile.id), { profile, challenge }],
          activeId: profile.id,
          profile,
          challenge,
        })),

      switchEntry: (profileId) =>
        set((s) => {
          const entry = s.entries.find((e) => e.profile.id === profileId);
          if (!entry) return s;
          return { activeId: profileId, profile: entry.profile, challenge: entry.challenge };
        }),

      setProfile: (profile) =>
        set((s) => ({
          profile,
          activeId: s.activeId ?? profile.id,
          entries: s.entries.map((e) =>
            e.profile.id === (s.activeId ?? profile.id) ? { ...e, profile } : e
          ),
        })),

      setChallenge: (challenge) =>
        set((s) => ({
          challenge,
          entries: s.entries.map((e) =>
            e.profile.id === s.activeId ? { ...e, challenge } : e
          ),
        })),

      updateProfile: (updates) =>
        set((s) => {
          if (!s.profile) return s;
          const updated = { ...s.profile, ...updates };
          return {
            profile: updated,
            entries: s.entries.map((e) =>
              e.profile.id === s.activeId ? { ...e, profile: updated } : e
            ),
          };
        }),

      updateChallenge: (updates) =>
        set((s) => {
          if (!s.challenge) return s;
          const updated = { ...s.challenge, ...updates };
          return {
            challenge: updated,
            entries: s.entries.map((e) =>
              e.profile.id === s.activeId ? { ...e, challenge: updated } : e
            ),
          };
        }),

      reset: () =>
        set((s) => {
          const remaining = s.entries.filter((e) => e.profile.id !== s.activeId);
          if (remaining.length === 0) return { entries: [], activeId: null, profile: null, challenge: null };
          const next = remaining[remaining.length - 1];
          return { entries: remaining, activeId: next.profile.id, profile: next.profile, challenge: next.challenge };
        }),

      resetAll: () => set({ entries: [], activeId: null, profile: null, challenge: null }),
    }),
    {
      name: 'fatlock-profile',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          if (
            persistedState.profile &&
            persistedState.challenge &&
            (!persistedState.entries || persistedState.entries.length === 0)
          ) {
            return {
              ...persistedState,
              entries: [{ profile: persistedState.profile, challenge: persistedState.challenge }],
              activeId: persistedState.profile.id,
            };
          }
        }
        return persistedState;
      },
    }
  )
);