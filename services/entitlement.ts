/**
 * Single source of truth for the "active Supporter" entitlement rule, shared by
 * the client (services/auth.tsx) and the serverless API (api/_lib/supabaseAdmin).
 * A profile is entitled when its paid-through timestamp is set and still in the
 * future. Pure (no imports) so it's safe to use in both runtimes.
 *
 * NOTE: the Postgres `is_pro()` function in supabase/schema.sql enforces the same
 * rule inside RLS policies — keep the two in sync if this ever changes.
 */
export function isProUntilActive(proUntil: string | null | undefined): boolean {
    if (!proUntil) return false;
    return Date.parse(proUntil) > Date.now();
}
