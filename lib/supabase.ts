import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

let admin: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service role key.
 * NEVER import this from client components — the service key must not ship
 * to the browser. Returns null when Supabase is not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const env = getEnv();
  if (!env.hasSupabase) return null;
  if (!admin) {
    admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
