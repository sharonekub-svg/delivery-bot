import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

let client: SupabaseClient | null = null;

/** Server-side Supabase client (service role). Never expose to the browser. */
export function db(): SupabaseClient {
  if (client) return client;
  client = createClient(config.supabase.url(), config.supabase.serviceRoleKey(), {
    auth: { persistSession: false },
  });
  return client;
}
