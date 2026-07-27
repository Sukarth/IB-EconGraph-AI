import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest, getProfile, isProfilePro } from './_lib/supabaseAdmin';
import { getPolar, getAppUrl } from './_lib/polar';

// Subscription is live (or in dunning), a new checkout would double-charge.
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

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
    if (profile?.polar_subscription_id && isProfilePro(profile) && ACTIVE_STATUSES.has(profile.pro_status)) {
        return res.status(409).json({
            error: 'You already have an active Supporter subscription. Manage it from Settings > Manage billing.',
            code: 'already_subscribed',
        });
    }

    try {
        const polar = getPolar();
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
