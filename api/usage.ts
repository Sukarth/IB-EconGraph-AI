import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    getSupabaseAdmin,
    getUserFromRequest,
    getProfile,
    isProfilePro,
    currentUsageMonth,
    hostedMonthlyLimit as monthlyLimit,
} from './_lib/supabaseAdmin';

/** Returns the signed-in user's hosted AI usage for the current month. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let user;
    try {
        user = await getUserFromRequest(req);
    } catch (err) {
        console.error('usage: auth backend error', err);
        return res.status(503).json({ error: 'Account service is not configured on this deployment.' });
    }
    if (!user) {
        return res.status(401).json({ error: 'Not signed in.' });
    }

    // A lookup failure must not read as "not a Supporter": the caller would show
    // a lapsed plan to someone whose plan is fine. Distinguish it from a genuine
    // null profile by capturing the error.
    let profileFailed = false;
    const [profile, usageResult] = await Promise.all([
        getProfile(user.id).catch((err) => {
            console.error('usage: profile lookup failed', err);
            profileFailed = true;
            return null;
        }),
        getSupabaseAdmin()
            .from('ai_usage')
            .select('count')
            .eq('user_id', user.id)
            .eq('month', currentUsageMonth())
            .maybeSingle(),
    ]);

    // A failed lookup must not masquerade as "0 used" — that would show a
    // full quota to someone who has already spent it.
    if (usageResult.error) {
        console.error('usage: failed to read ai_usage', usageResult.error);
        return res.status(503).json({ error: 'Usage service is temporarily unavailable.' });
    }
    if (profileFailed) {
        return res.status(503).json({ error: 'Could not confirm your plan right now. Please try again in a moment.' });
    }

    const used = usageResult.data?.count ?? 0;
    return res.status(200).json({
        used,
        limit: monthlyLimit(),
        month: currentUsageMonth(),
        isPro: isProfilePro(profile),
    });
}
