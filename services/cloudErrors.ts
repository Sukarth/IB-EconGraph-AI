/**
 * A row-level-security denial is how Supabase reports a write blocked by a
 * Supporter-gated RLS policy. Detecting it lets each cloud feature show a
 * friendly "this is part of the Supporter plan" message instead of a raw
 * Postgres error. Shared so the (fragile) detection string lives in one place.
 */
export function isRlsDenied(message: string): boolean {
    return /row-level security/i.test(message);
}
