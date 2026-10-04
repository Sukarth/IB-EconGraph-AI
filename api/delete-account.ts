import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getUserFromRequest, getProfile } from './_lib/supabaseAdmin.js';
import type { models } from '@polar-sh/sdk/2026-10';
import { getPolar } from './_lib/polar.js';

/**
 * Every status Polar can report, and whether a subscription in it can still
 * charge the card. Deletion must cancel all of those, which is a different set
 * from the ones that grant access: a paused subscription grants nothing, but
 * resumes and bills on its own at `resumes_at`.
 *
 * A Record over the SDK's own union rather than a list, so a status Polar adds
 * later is a compile error here instead of one that deletion silently skips.
 * When unsure, true: cancelling something already finished costs nothing,
 * while missing something live bills a deleted account.
 */
const CAN_STILL_CHARGE: Record<models.SubscriptionStatus, boolean> = {
    active: true,
    trialing: true,
    past_due: true,
    unpaid: true,
    paused: true,
    incomplete: true,
    canceled: false,
    incomplete_expired: false,
};

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
    // account. Polar is the authority.
    //
    // The external customer id alone is not enough to find everything. Polar
    // matches a checkout to an existing customer by email and never changes a
    // customer's external id, so someone who deleted an account and signed up
    // again with the same email pays as the old customer, under the old account's
    // id. Their subscriptions are found by the checkout's `supabase_user_id`
    // metadata (set by api/checkout.ts) and by the customer id the webhook stored.
    const queries: { external_customer_id?: string; customer_id?: string; metadata?: Record<string, string> }[] = [
        { external_customer_id: user.id },
        { metadata: { supabase_user_id: user.id } },
    ];
    if (profile?.polar_customer_id) queries.push({ customer_id: profile.polar_customer_id });

    // Whether deleting this account should cancel `sub`. A shared Polar customer
    // can hold another account's subscription too: if account A changes its
    // email and a new account B signs up with A's old one, B's checkout lands on
    // A's customer. Never cancel a subscription the checkout says belongs to
    // someone else. One with no owner recorded (made before the metadata
    // existed) is still cancelled, because a missed one keeps charging.
    const shouldCancel = (sub: Pick<models.Subscription, 'status' | 'metadata'>) => {
        const owner = sub.metadata?.supabase_user_id;
        if (typeof owner === 'string' && owner && owner !== user.id) return false;
        return CAN_STILL_CHARGE[sub.status] ?? true;
    };

    let liveSubscriptionIds: string[];
    try {
        const ids = new Set<string>();
        const seen = new Set<string>();
        // Every subscription found, deliberately unfiltered by status. Polar's
        // deprecated `active` flag might leave out past_due or paused, and even a
        // status filter built from our own table would drop a status Polar adds
        // later before the `?? true` above could treat it as chargeable. A
        // customer has a handful of subscriptions at most, so filtering here
        // costs nothing.
        for (const query of queries) {
            for await (const sub of getPolar().subscriptions.iterList(query)) {
                seen.add(sub.id);
                if (shouldCancel(sub)) ids.add(sub.id);
            }
        }
        // Belt and braces: the subscription our own row knows about, in case the
        // lookups above somehow missed it. It goes through the same check, not
        // straight into the cancel list: before the webhook identified users by
        // checkout metadata, a shared customer could write account B's
        // subscription onto account A's row.
        const onFile = profile?.polar_subscription_id;
        if (onFile && !seen.has(onFile)) {
            try {
                if (shouldCancel(await getPolar().subscriptions.get(onFile))) ids.add(onFile);
            } catch (err) {
                // Gone is fine; anything else means we can't tell, so abort below.
                const status = (err as { statusCode?: number; status?: number } | null)?.statusCode
                    ?? (err as { status?: number } | null)?.status;
                if (status !== 404) throw err;
            }
        }
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
            await getPolar().subscriptions.revoke(subId);
        } catch (err) {
            // The revoke can fail simply because the subscription is already
            // inactive on Polar (our pro_status was stale) — in that case there's
            // nothing left to cancel, so re-check Polar and only trap the user if
            // it's genuinely still active.
            let stillActive = true;
            try {
                const sub = await getPolar().subscriptions.get(subId);
                // `?? true` because a status this code has never heard of must
                // not count as safely finished.
                stillActive = CAN_STILL_CHARGE[sub.status] ?? true;
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
