import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function setupSupabase(url: string, anonKey: string): void {
  _client = createClient(url, anonKey);
}

export function supabase(): SupabaseClient | null {
  return _client;
}

export function isSupabaseReady(): boolean {
  return _client !== null;
}