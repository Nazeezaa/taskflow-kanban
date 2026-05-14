/**
 * Supabase admin client — server-side ONLY.
 * Uses service-role key to bypass RLS for trusted server endpoints (e.g. /api/kpi).
 *
 * Never import this in client/components. Never expose service-role key in frontend.
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY (set in Vercel, never commit)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}
