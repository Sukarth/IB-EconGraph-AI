import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

// Signature verification requires the raw request body.
export const config = {
    api: { bodyParser: false },
};

/**
 * Safety margin (in days) added to ACTIVE access so a paying subscriber isn't
 * locked out during the brief gap if Polar's renewal webhook lands slightly
 * after the period end.
 *
 * This is NOT post-cancellation grace: when a subscription is canceled/revoked,
 * the terminal event runs the non-entitled branch below and sets pro_until to
 * `now`, which overrides this margin — so it never grants access after a
 * cancellation. It only cushions the renewal boundary for continuing subscribers.
 */
const ACTIVE_MARGIN_DAYS = 1;

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

function readRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

interface SubscriptionLike {
    id: string;
    status: string;
    currentPeriodEnd?: Date | null;
    recurringInterval?: string | null;
    customerId?: string;
    customer?: { id?: string; externalId?: string | null } | null;
}

async function applySubscriptionState(sub: SubscriptionLike): Promise<void> {
    const userId = sub.customer?.externalId;
    if (!userId) {
        // Checkout created outside the app (no external customer id) — nothing to map to.
        console.warn(`polar webhook: subscription ${sub.id} has no external customer id, skipping`);
        return;
    }

    const admin = getSupabaseAdmin();
    const entitled = ENTITLED_STATUSES.has(sub.status);

    // Read what's currently on file so out-of-order or superseded events for a
    // DIFFERENT subscription can't clobber the one the user is actually on
    // (e.g. after cancel + resubscribe, a delayed event for the old sub).
    const { data: current } = await admin
        .from('profiles')
        .select('polar_subscription_id, pro_until')
        .eq('id', userId)
        .maybeSingle();
    const onFile = current?.polar_subscription_id;
    const differentSub = !!onFile && onFile !== sub.id;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const currentEnd = current?.pro_until ? Date.parse(current.pro_until) : 0;

    let proUntil: string;
    if (entitled) {
        const hasPeriodEnd = sub.currentPeriodEnd instanceof Date && !Number.isNaN(sub.currentPeriodEnd.getTime());
        // A malformed event with no usable period end must not lock out an
        // entitled user: fall back to a short provisional window (a later,
        // well-formed event corrects it) rather than "now", which reads as expired.
        const candidate = hasPeriodEnd
            ? sub.currentPeriodEnd!.getTime() + ACTIVE_MARGIN_DAYS * DAY_MS
            : Date.now() + 2 * DAY_MS;
        if (!hasPeriodEnd) {
            console.warn(`polar webhook: entitled event for ${sub.id} has no currentPeriodEnd; using provisional window`);
        }

        // A delayed/retried event from a different (older) subscription must not
        // shorten access the user has via the current one — only let a different
        // subscription take over if it actually extends access.
        if (differentSub && candidate <= currentEnd) {
            console.log(`polar webhook: ignoring stale entitled event for ${sub.id}; ${onFile} on file runs at least as long`);
            return;
        }
        // Never move a still-entitled user's access backward — a delayed or
        // retried event (even for the SAME subscription) can carry an older
        // period end than one already applied.
        proUntil = new Date(Math.max(candidate, currentEnd)).toISOString();
    } else {
        // canceled / revoked / unpaid / incomplete → access ends now, but only
        // for the subscription currently on file (never for a stale old one).
        if (differentSub) {
            console.log(`polar webhook: ignoring ${sub.status} for stale subscription ${sub.id} (current is ${onFile})`);
            return;
        }
        proUntil = new Date().toISOString();
    }

    const { error } = await admin
        .from('profiles')
        .update({
            pro_status: sub.status,
            pro_until: proUntil,
            plan_interval: sub.recurringInterval ?? null,
            polar_customer_id: sub.customer?.id ?? sub.customerId ?? null,
            polar_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) {
        // Throw so Polar retries the delivery.
        throw new Error(`Failed to update profile ${userId}: ${error.message}`);
    }
    console.log(`polar webhook: ${userId} → status=${sub.status} pro_until=${proUntil}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret) {
        console.error('polar webhook: POLAR_WEBHOOK_SECRET is not set');
        return res.status(503).json({ error: 'Webhook not configured' });
    }

    let event;
    try {
        const raw = await readRawBody(req);
        event = validateEvent(raw, req.headers as Record<string, string>, secret);
    } catch (err) {
        if (err instanceof WebhookVerificationError) {
            return res.status(403).json({ error: 'Invalid signature' });
        }
        console.error('polar webhook: failed to parse event', err);
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        switch (event.type) {
            case 'subscription.created':
            case 'subscription.active':
            case 'subscription.updated':
            case 'subscription.canceled':
            case 'subscription.uncanceled':
            case 'subscription.revoked':
            case 'subscription.past_due':
                await applySubscriptionState(event.data as unknown as SubscriptionLike);
                break;
            default:
                // Ack everything else (order.*, checkout.*, customer.*) — subscription
                // events carry all the entitlement state we need.
                break;
        }
        return res.status(202).json({ received: true });
    } catch (err) {
        console.error(`polar webhook: handler failed for ${event.type}`, err);
        // Non-2xx → Polar retries with backoff.
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
}
