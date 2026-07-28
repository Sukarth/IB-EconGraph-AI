import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest, getProfile, isProfilePro } from './_lib/supabaseAdmin';
import { getPolar, getAppUrl } from './_lib/polar';
// Subscription is live (or in dunning), a new checkout would double-charge.
import { ENTITLED_POLAR_STATUSES } from '../services/entitlement';

/**
 * Creates a Polar checkout session for the Supporter plan and returns its URL.
 * Body: { interval: 'month' | 'year' }
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
        console.error('checkout: auth backend error', err);
        return res.status(503).json({ error: 'Account service is not configured on this deployment.' });
    }
    if (!user) {
        return res.status(401).json({ error: 'Please sign in first.' });
    }

    const interval = (req.body as { interval?: string } | undefined)?.interval === 'year' ? 'year' : 'month';
    const productId = interval === 'year'
        ? process.env.POLAR_PRODUCT_ID_YEARLY
        : process.env.POLAR_PRODUCT_ID_MONTHLY;
    if (!productId) {
        return res.status(503).json({ error: 'Billing is not configured on this deployment.' });
    }

    // Don't let an already-subscribed user start a second checkout (Polar would
    // create a parallel subscription and double-charge them). A canceled-but-in-
    // grace user (pro_until still future, status no longer active) can resubscribe.
    let profile;
    try {
        profile = await getProfile(user.id);
    } catch (err) {
        console.error('checkout: profile lookup failed', err);
        return res.status(503).json({ error: 'Could not verify your account right now. Please try again in a moment.' });
    }
    if (profile?.polar_subscription_id && isProfilePro(profile) && ENTITLED_POLAR_STATUSES.has(profile.pro_status)) {
        return res.status(409).json({
            error: 'You already have an active Supporter subscription. Manage it from Settings > Manage billing.',
            code: 'already_subscribed',
        });
    }

    let polar;
    try {
        polar = getPolar();
    } catch (err) {
        console.error('checkout: Polar is not configured', err);
        return res.status(503).json({ error: 'Billing is not configured on this deployment.' });
    }

    // The profile check above is only as fresh as the last webhook we processed,
    // and the webhook lands seconds *after* payment succeeds. In that window a
    // user who double-clicks, or opens checkout in a second tab, passes the
    // check and can pay twice, ending up with two parallel subscriptions.
    // Polar knows about the first subscription as soon as it is paid, so ask it
    // rather than trusting our own copy. Same authority argument as
    // delete-account.
    try {
        const page = await polar.subscriptions.list({ externalCustomerId: user.id, active: true });
        for await (const chunk of page) {
            for (const sub of chunk.result.items) {
                if (ENTITLED_POLAR_STATUSES.has(sub.status ?? '')) {
                    return res.status(409).json({
                        error: 'You already have an active Supporter subscription. Manage it from Settings > Manage billing.',
                        code: 'already_subscribed',
                    });
                }
            }
        }
    } catch (err) {
        // Refuse rather than risk a duplicate charge: an unverifiable billing
        // state is exactly when a second checkout is most dangerous.
        console.error('checkout: could not list existing subscriptions', err);
        return res.status(503).json({
            error: 'Could not verify your billing status right now. Please try again in a moment.',
        });
    }

    try {
        const appUrl = getAppUrl(req);
        const checkout = await polar.checkouts.create({
            products: [productId],
            successUrl: `${appUrl}/settings?checkout=success`,
            externalCustomerId: user.id,
            customerEmail: user.email ?? undefined,
            metadata: { supabase_user_id: user.id },
        });
        return res.status(200).json({ url: checkout.url });
    } catch (err) {
        console.error('checkout: failed to create Polar checkout', err);
        return res.status(502).json({ error: 'Could not start checkout. Please try again in a moment.' });
    }
}
