import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

export function clearSupabase(): void {
  _client = null;
}

export function supabase(): SupabaseClient | null {
  return _client;
}

export function isSupabaseReady(): boolean {
  return _client !== null;
}