import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DailyLog, BodyComposition, RecapFile } from '../types';

let _client: SupabaseClient | null = null;

export function setupSupabase(url: string, anonKey: string): void {
  _client = createClient(url, anonKey);
}

export async function registerGroupMember(
  supabaseUrl: string,
  anonKey: string,
  challengeId: string,
  userId: string,
  userName: string
): Promise<void> {
  const sb = createClient(supabaseUrl, anonKey);
  await sb.from('group_members').upsert(
    { challenge_id: challengeId, user_id: userId, user_name: userName, joined_at: new Date().toISOString() },
    { onConflict: 'challenge_id,user_id' }
  );
}

export async function recoverAccount(
  supabaseUrl: string,
  anonKey: string,
  challengeId: string,
  profileId: string
): Promise<{ recap: RecapFile | null; dailyLogs: DailyLog[]; bodyCompositions: BodyComposition[] }> {
  const sb = createClient(supabaseUrl, anonKey);

  const [{ data: recapRows }, { data: logRows }, { data: compRows }] = await Promise.all([
    sb.from('recaps')
      .select('data')
      .eq('challenge_id', challengeId)
      .eq('user_id', profileId)
      .order('week_number', { ascending: false })
      .limit(1),
    sb.from('daily_logs')
      .select('data')
      .eq('challenge_id', challengeId)
      .eq('user_id', profileId),
    sb.from('body_compositions')
      .select('data')
      .eq('challenge_id', challengeId)
      .eq('user_id', profileId),
  ]);

  const recap = (recapRows?.[0]?.data as RecapFile) ?? null;
  const dailyLogs = (logRows ?? []).map((r: { data: DailyLog }) => r.data);
  const bodyCompositions = (compRows ?? []).map((r: { data: BodyComposition }) => r.data);

  return { recap, dailyLogs, bodyCompositions };
}

export function clearSupabase(): void {
  _client = null;
}

export function supabase(): SupabaseClient | null {
  return _client;
}

export function isSupabaseReady(): boolean {
  return _client !== null;
}
