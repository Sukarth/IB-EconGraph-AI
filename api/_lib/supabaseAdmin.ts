import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { isProUntilActive } from '../../services/entitlement';

let cached: SupabaseClient | null = null;

/**
 * Admin Supabase client (bypasses RLS). Server-side only — never expose the
 * SUPABASE_SECRET_KEY to the browser. Uses the Supabase secret key
 * (`sb_secret_…`), the modern replacement for the legacy service_role key.
 */
export function getSupabaseAdmin(): SupabaseClient {
    if (cached) return cached;
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
        throw new Error('Supabase server environment is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY).');
    }
    cached = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
}

/**
 * Validates the Bearer token from the request and returns the Supabase user,
 * or null when missing/invalid.
 */
export async function getUserFromRequest(req: VercelRequest): Promise<User | null> {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) return null;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
}

export interface BillingProfile {
    id: string;
    email: string | null;
    pro_status: string;
    pro_until: string | null;
    polar_customer_id: string | null;
    polar_subscription_id: string | null;
}

export async function getProfile(userId: string): Promise<BillingProfile | null> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
        .from('profiles')
        .select('id, email, pro_status, pro_until, polar_customer_id, polar_subscription_id')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return (data as BillingProfile) ?? null;
}

/** Monthly hosted-AI generation cap (HOSTED_AI_MONTHLY_LIMIT, default 150). */
export function hostedMonthlyLimit(): number {
    const parsed = Number.parseInt(process.env.HOSTED_AI_MONTHLY_LIMIT || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 150;
}

export function isProfilePro(profile: BillingProfile | null): boolean {
    return isProUntilActive(profile?.pro_until);
}

/** Current usage month in UTC, e.g. "2026-07". */
export function currentUsageMonth(): string {
    return new Date().toISOString().slice(0, 7);
}
