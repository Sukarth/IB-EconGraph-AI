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

/**
 * Polar subscription statuses that count as a live subscription: the user is
 * either paying, in a trial, or behind on payment but not yet cancelled. Used
 * to decide whether to offer a second checkout, whether an account deletion
 * must revoke first, and whether a webhook grants entitlement.
 *
 * Shared so those three answers cannot drift apart. `past_due` is included on
 * purpose: Polar is still retrying the charge, and dropping access mid-retry
 * would punish a user whose card simply needs updating.
 */
export const ENTITLED_POLAR_STATUSES: ReadonlySet<string> = new Set([
    'active',
    'trialing',
    'past_due',
]);
