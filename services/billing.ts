import { getAccessToken } from './supabaseClient';

async function callBillingEndpoint(path: string, body?: unknown): Promise<{ url?: string; error?: string }> {
    const token = await getAccessToken();
    if (!token) return { error: 'Please sign in first.' };

    try {
        const res = await fetch(path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = await res.json().catch(() => null) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) {
            return { error: data?.error || 'Something went wrong. Please try again.' };
        }
        return { url: data.url };
    } catch {
        return { error: 'Could not reach the server. Check your connection and try again.' };
    }
}

/** Start a Polar checkout for the Supporter plan. Returns the checkout URL. */
export function startCheckout(interval: 'month' | 'year') {
    return callBillingEndpoint('/api/checkout', { interval });
}

/** Open the Polar customer portal (manage / cancel subscription, invoices). */
export function openBillingPortal() {
    return callBillingEndpoint('/api/portal');
}

/**
 * Permanently delete the signed-in user's account and all cloud data (cancels
 * any active subscription first). Returns {} on success, or { error }.
 */
export async function deleteAccount(): Promise<{ error?: string }> {
    const token = await getAccessToken();
    if (!token) return { error: 'Please sign in first.' };
    try {
        const res = await fetch('/api/delete-account', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null) as { deleted?: boolean; error?: string } | null;
        if (!res.ok || !data?.deleted) {
            return { error: data?.error || 'Could not delete your account. Please try again.' };
        }
        return {};
    } catch {
        return { error: 'Could not reach the server. Check your connection and try again.' };
    }
}
