// server/supabase.js
// Creates a Supabase service role client for secure server-side operations.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './env.js';

let adminClient = null;

export function getAdminSupabase() {
  if (adminClient) return adminClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Supabase admin client missing env config.');
    return null;
  }
  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return adminClient;
}
