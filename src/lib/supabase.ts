import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 *
 * All data access in this app is server-side (API route handlers, server
 * components, and services), and authorization is enforced in application code
 * (see src/lib/permissions.ts and the ownership checks in the rental service),
 * so we use the service-role client which bypasses row-level security.
 *
 * NEVER import this into a client component — the service key must stay on the
 * server. (A future hardening pass can add RLS policies + a per-request
 * anon/authenticated client.)
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Narrow a PostgREST error into a thrown Error (fail loud on unexpected DB errors). */
export function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(`Supabase error: ${result.error.message}`);
  }
  return result.data;
}
