import { createClient, SupabaseClient } from '@supabase/supabase-js';

// The app is fully functional without Supabase — accounts, sync, sharing and
// hosted AI simply stay hidden. This keeps self-hosted/forked deployments
// zero-config.
const url = import.meta.env.VITE_SUPABASE_URL;
// Supabase publishable key (`sb_publishable_…`), the modern replacement for the
// legacy anon key. Low-privilege and safe to ship in the client bundle.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
    url && publishableKey
        ? createClient(url, publishableKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        })
        : null;

export const isCloudConfigured = supabase !== null;

export async function getAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}
