import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DailyLog, BodyComposition, WeeklyScore, AIAnalysisResult } from '../types';
import { supabase } from '../lib/supabase';
import { useProfileStore } from './useProfileStore';

interface LogStore {
  dailyLogs: DailyLog[];
  bodyCompositions: BodyComposition[];
  weeklyScores: WeeklyScore[];
  aiResults: AIAnalysisResult[];

  upsertDailyLog: (log: DailyLog) => void;
  getDailyLog: (userId: string, date: string) => DailyLog | undefined;
  addBodyComposition: (comp: BodyComposition) => void;
  getLatestBodyComp: (userId: string) => BodyComposition | undefined;
  addWeeklyScore: (score: WeeklyScore) => void;
  addAIResult: (result: AIAnalysisResult) => void;
  getAIResult: (userId: string, week: number) => AIAnalysisResult | undefined;
  removeUserData: (userId: string) => void;
  reset: () => void;
}

export const useLogStore = create<LogStore>()(
  persist(
    (set, get) => ({
      dailyLogs: [],
      bodyCompositions: [],
      weeklyScores: [],
      aiResults: [],

      upsertDailyLog: (log) => {
        set((s) => {
          const idx = s.dailyLogs.findIndex(
            (l) => l.userId === log.userId && l.date === log.date
          );
          if (idx >= 0) {
            const updated = [...s.dailyLogs];
            updated[idx] = log;
            return { dailyLogs: updated };
          }
          return { dailyLogs: [...s.dailyLogs, log] };
        });
        // Fire-and-forget sync vers Supabase pour la récupération de compte
        const sb = supabase();
        const challenge = useProfileStore.getState().challenge;
        if (sb && challenge) {
          (async () => {
            try {
              await sb.from('daily_logs').upsert(
                { challenge_id: challenge.id, user_id: log.userId, log_date: log.date, data: log, updated_at: new Date().toISOString() },
                { onConflict: 'challenge_id,user_id,log_date' }
              );
            } catch { /* silencieux */ }
          })();
        }
      },

      getDailyLog: (userId, date) =>
        get().dailyLogs.find((l) => l.userId === userId && l.date === date),

      addBodyComposition: (comp) =>
        set((s) => {
          const idx = s.bodyCompositions.findIndex(
            (c) => c.userId === comp.userId && c.weekNumber === comp.weekNumber
          );
          if (idx >= 0) {
            const updated = [...s.bodyCompositions];
            updated[idx] = comp;
            return { bodyCompositions: updated };
          }
          return { bodyCompositions: [...s.bodyCompositions, comp] };
        }),

      getLatestBodyComp: (userId) => {
        const comps = get()
          .bodyCompositions.filter((c) => c.userId === userId)
          .sort((a, b) => b.weekNumber - a.weekNumber);
        return comps[0];
      },

      addWeeklyScore: (score) =>
        set((s) => {
          const idx = s.weeklyScores.findIndex(
            (ws) => ws.userId === score.userId && ws.weekNumber === score.weekNumber
          );
          if (idx >= 0) {
            const updated = [...s.weeklyScores];
            updated[idx] = score;
            return { weeklyScores: updated };
          }
          return { weeklyScores: [...s.weeklyScores, score] };
        }),

      addAIResult: (result) =>
        set((s) => {
          const idx = s.aiResults.findIndex(
            (r) => r.userId === result.userId && r.weekNumber === result.weekNumber
          );
          if (idx >= 0) {
            const updated = [...s.aiResults];
            updated[idx] = result;
            return { aiResults: updated };
          }
          return { aiResults: [...s.aiResults, result] };
        }),

      getAIResult: (userId, week) =>
        get().aiResults.find((r) => r.userId === userId && r.weekNumber === week),

      removeUserData: (userId) =>
        set((s) => ({
          dailyLogs: s.dailyLogs.filter((l) => l.userId !== userId),
          bodyCompositions: s.bodyCompositions.filter((c) => c.userId !== userId),
          weeklyScores: s.weeklyScores.filter((ws) => ws.userId !== userId),
          aiResults: s.aiResults.filter((r) => r.userId !== userId),
        })),

      reset: () =>
        set({ dailyLogs: [], bodyCompositions: [], weeklyScores: [], aiResults: [] }),
    }),
    { name: 'fatlock-logs' }
  )
);
