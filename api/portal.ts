import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/supabaseAdmin';
import { getPolar } from './_lib/polar';

/**
 * Creates a Polar customer-portal session (manage / cancel subscription,
 * download invoices) and returns its URL.
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
        console.error('portal: auth backend error', err);
        return res.status(503).json({ error: 'Account service is not configured on this deployment.' });
    }
    if (!user) {
        return res.status(401).json({ error: 'Please sign in first.' });
    }

    // Resolve the client outside the try: a missing POLAR_ACCESS_TOKEN is a
    // deployment problem, not "you have no billing account", and telling the
    // user to wait and retry would send them in circles.
    let polar;
    try {
        polar = getPolar();
    } catch (err) {
        console.error('portal: Polar is not configured', err);
        return res.status(503).json({ error: 'Billing is not configured on this deployment.' });
    }

    try {
        const session = await polar.customerSessions.create({
            externalCustomerId: user.id,
        });
        return res.status(200).json({ url: session.customerPortalUrl });
    } catch (err) {
        console.error('portal: failed to create customer session', err);
        return res.status(404).json({
            error: 'No billing account found. If you just subscribed, wait a few seconds and try again.',
        });
    }
}
