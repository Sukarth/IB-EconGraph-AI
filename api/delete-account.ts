import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getUserFromRequest, getProfile } from './_lib/supabaseAdmin';
import { getPolar } from './_lib/polar';
import { ENTITLED_POLAR_STATUSES } from '../services/entitlement';

/**
 * Permanently deletes the signed-in user's account and all cloud data.
 *
 * Order matters: we cancel any active Polar subscription FIRST so a deleted
 * account can't keep being charged (and if we can't cancel it, we abort rather
 * than orphan a paid subscription). Then we delete the auth user, which cascades
 * to every table via `on delete cascade` — profiles, projects, graphs,
 * graph_versions, templates, shares, ai_usage.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let user;
    try {
        user = await getUserFromRequest(req);
    } catch (err) {
        console.error('delete-account: auth backend error', err);
        return res.status(503).json({ error: 'Account service is not configured on this deployment.' });
    }
    if (!user) {
        return res.status(401).json({ error: 'Please sign in first.' });
    }

    const admin = getSupabaseAdmin();

    // Cancel billing before deleting, so the card is never charged for an
    // account that no longer exists. If we can't even read the profile, abort
    // rather than delete blind and risk orphaning a paid subscription.
    let profile;
    try {
        profile = await getProfile(user.id);
    } catch (err) {
        console.error('delete-account: profile lookup failed', err);
        return res.status(503).json({
            error: 'Could not verify your billing status right now. Please try again in a moment.',
        });
    }

    // Ask Polar what this user actually has, rather than trusting our own row.
    // A profile can be missing entirely, or its subscription id can be stale
    // because a webhook was never delivered; in either case gating on our copy
    // would skip cancellation and leave a live subscription billing a deleted
    // account. Polar is the authority, so query it by external customer id.
    let liveSubscriptionIds: string[];
    try {
        const page = await getPolar().subscriptions.list({ externalCustomerId: user.id, active: true });
        const ids = new Set<string>();
        for await (const chunk of page) {
            for (const sub of chunk.result.items) {
                if (ENTITLED_POLAR_STATUSES.has(sub.status ?? '')) ids.add(sub.id);
            }
        }
        // Belt and braces: cancel anything our own row knows about too, in case
        // Polar's active filter and our status set ever disagree.
        if (profile?.polar_subscription_id) ids.add(profile.polar_subscription_id);
        liveSubscriptionIds = [...ids];
    } catch (err) {
        // Includes "Polar isn't configured on this deployment", which is a
        // server problem: don't tell the user to go cancel something manually.
        console.error('delete-account: could not list subscriptions', err);
        return res.status(503).json({
            error: 'Could not verify your billing status right now. Please try again in a moment.',
        });
    }

    for (const subId of liveSubscriptionIds) {
        try {
            await getPolar().subscriptions.revoke({ id: subId });
        } catch (err) {
            // The revoke can fail simply because the subscription is already
            // inactive on Polar (our pro_status was stale) — in that case there's
            // nothing left to cancel, so re-check Polar and only trap the user if
            // it's genuinely still active.
            let stillActive = true;
            try {
                const sub = await getPolar().subscriptions.get({ id: subId });
                stillActive = ENTITLED_POLAR_STATUSES.has(sub.status ?? '');
            } catch (lookupErr) {
                // Only a definite "not found" proves the subscription is gone.
                // Treating any failure as gone would delete the account during a
                // Polar outage and orphan a subscription that keeps charging.
                const status = (lookupErr as { statusCode?: number; status?: number } | null)?.statusCode
                    ?? (lookupErr as { status?: number } | null)?.status;
                stillActive = status !== 404;
            }
            if (stillActive) {
                console.error('delete-account: subscription cancel failed', err);
                return res.status(409).json({
                    error: 'We couldn\'t cancel your active subscription automatically. Please cancel it in "Manage billing" first, then delete your account.',
                    code: 'cancel_failed',
                });
            }
            console.warn('delete-account: revoke failed but subscription is no longer active; proceeding with deletion', err);
        }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
        console.error('delete-account: deleteUser failed', error);
        return res.status(500).json({ error: 'Could not delete your account. Please try again in a moment.' });
    }

    return res.status(200).json({ deleted: true });
}
