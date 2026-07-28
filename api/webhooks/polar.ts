import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { ENTITLED_POLAR_STATUSES } from '../../services/entitlement';

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
    /** When Polar last changed this subscription. Used to order deliveries. */
    modifiedAt?: Date | null;
    createdAt?: Date | null;
    /** Set when the user has cancelled but keeps access to the end of the paid period. */
    cancelAtPeriodEnd?: boolean | null;
    /** The definitive end of access once cancellation is scheduled. */
    endsAt?: Date | null;
}

function toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/**
 * Ordering key for an event. Webhook deliveries are not ordered and are
 * retried, so "the event that arrived last" is not "the event that happened
 * last". Polar stamps every subscription change with `modifiedAt`; a freshly
 * created subscription has none yet, so `createdAt` stands in.
 *
 * Returns null when neither is usable, in which case the caller falls back to
 * applying the event unordered (better than dropping billing state entirely).
 */
function eventTimestamp(sub: SubscriptionLike): Date | null {
    for (const candidate of [sub.modifiedAt, sub.createdAt]) {
        if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) return candidate;
        // The SDK parses these into Dates, but a hand-built payload may carry strings.
        if (typeof candidate === 'string') {
            const parsed = new Date(candidate);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
    }
    return null;
}

/** What the profile row currently says about this user's billing. */
export interface CurrentBillingState {
    polar_subscription_id?: string | null;
    pro_until?: string | null;
    polar_event_at?: string | null;
}

export type EntitlementDecision =
    | { action: 'skip'; reason: string }
    | { action: 'apply'; proUntil: string; eventAt: string | null };

/**
 * Decide what an incoming subscription event should do to a profile. Pure, so
 * the ordering and entitlement rules below can be exercised directly instead of
 * only through a live webhook against real billing.
 *
 * `now` is injected for the same reason.
 */
export function decideEntitlement(
    sub: SubscriptionLike,
    current: CurrentBillingState | null,
    now: number = Date.now(),
): EntitlementDecision {
    const entitled = ENTITLED_POLAR_STATUSES.has(sub.status);
    const onFile = current?.polar_subscription_id;
    const differentSub = !!onFile && onFile !== sub.id;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const currentEnd = current?.pro_until ? Date.parse(current.pro_until) : 0;

    // Deliveries are neither ordered nor deduplicated. Checking only that the
    // subscription id matches (as this used to) left the worst case open: a
    // delayed `subscription.active` for the SAME subscription, arriving after a
    // cancellation, passed every guard and the `Math.max` below then restored
    // the future pro_until. Comparing the event's own timestamp against the
    // last one applied rejects it.
    const eventAt = eventTimestamp(sub);
    const appliedAt = current?.polar_event_at ? Date.parse(current.polar_event_at) : null;
    if (eventAt && appliedAt !== null && eventAt.getTime() < appliedAt) {
        return {
            action: 'skip',
            reason: `event for ${sub.id} is older (${eventAt.toISOString()}) than the last applied (${current!.polar_event_at})`,
        };
    }
    const eventAtIso = eventAt ? eventAt.toISOString() : null;

    let proUntil: string;
    if (entitled) {
        // Polar keeps a subscription `active` after the user schedules a
        // cancellation; it just stops renewing. Access through the period they
        // already paid for is correct and deliberate, but `endsAt` is then the
        // authoritative end date, and the renewal margin must not apply: that
        // margin exists to cover the gap before a *renewal* webhook lands, and
        // a subscription that will not renew has no such gap. Adding it would
        // hand out a day of access nobody paid for.
        const endsAt = toDate(sub.endsAt);
        const scheduledToEnd = sub.cancelAtPeriodEnd === true || !!endsAt;
        const periodEnd = endsAt ?? toDate(sub.currentPeriodEnd);

        // A malformed event with no usable period end must not lock out an
        // entitled user: fall back to a short provisional window (a later,
        // well-formed event corrects it) rather than "now", which reads as expired.
        const candidate = periodEnd
            ? periodEnd.getTime() + (scheduledToEnd ? 0 : ACTIVE_MARGIN_DAYS * DAY_MS)
            : now + 2 * DAY_MS;

        // A delayed/retried event from a different (older) subscription must not
        // shorten access the user has via the current one — only let a different
        // subscription take over if it actually extends access.
        if (differentSub && candidate <= currentEnd) {
            return {
                action: 'skip',
                reason: `stale entitled event for ${sub.id}; ${onFile} on file runs at least as long`,
            };
        }
        // Normally never move a still-entitled user's access backward. A
        // scheduled cancellation is the exception: it legitimately shortens
        // access (dropping the margin, or moving to an earlier endsAt), and the
        // event-ordering check above already rejects genuinely stale deliveries,
        // which is what this guard used to be protecting against.
        proUntil = new Date(scheduledToEnd ? candidate : Math.max(candidate, currentEnd)).toISOString();
    } else {
        // canceled / revoked / unpaid / incomplete → access ends now, but only
        // for the subscription currently on file (never for a stale old one).
        if (differentSub) {
            return {
                action: 'skip',
                reason: `${sub.status} for stale subscription ${sub.id} (current is ${onFile})`,
            };
        }
        proUntil = new Date(now).toISOString();
    }

    return { action: 'apply', proUntil, eventAt: eventAtIso };
}

async function applySubscriptionState(sub: SubscriptionLike): Promise<void> {
    const userId = sub.customer?.externalId;
    if (!userId) {
        // Checkout created outside the app (no external customer id) — nothing to map to.
        console.warn(`polar webhook: subscription ${sub.id} has no external customer id, skipping`);
        return;
    }

    const admin = getSupabaseAdmin();

    // Read what's currently on file so out-of-order or superseded events can't
    // clobber the state the user is actually in.
    const { data: current, error: currentError } = await admin
        .from('profiles')
        .select('polar_subscription_id, pro_until, polar_event_at')
        .eq('id', userId)
        .maybeSingle();
    if (currentError) {
        // Without the current row we can't tell a superseded event from a live
        // one. Throwing makes the handler answer 500 so Polar retries, which is
        // safer than guessing and possibly revoking an active subscription.
        throw new Error(`could not read profile ${userId}: ${currentError.message}`);
    }

    const decision = decideEntitlement(sub, current as CurrentBillingState | null);
    if (decision.action === 'skip') {
        console.log(`polar webhook: ignoring ${decision.reason}`);
        return;
    }
    const { proUntil, eventAt: eventAtIso } = decision;

    // The read above and this write are separate round trips, so two concurrent
    // deliveries for the same user can each compute from the same snapshot and
    // the slower write wins regardless of which event is newer. Repeating the
    // ordering test as a predicate on the UPDATE makes the decision atomic: a
    // handler whose event has been overtaken matches no row and writes nothing.
    // `lte` rather than `lt` so a retry of the very same event is idempotent.
    let query = admin
        .from('profiles')
        .update({
            pro_status: sub.status,
            pro_until: proUntil,
            plan_interval: sub.recurringInterval ?? null,
            polar_customer_id: sub.customer?.id ?? sub.customerId ?? null,
            polar_subscription_id: sub.id,
            polar_event_at: eventAtIso,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    if (eventAtIso) {
        query = query.or(`polar_event_at.is.null,polar_event_at.lte.${eventAtIso}`);
    }
    // `select` so a zero-row result is distinguishable from a successful write.
    const { data: updated, error } = await query.select('id');

    if (error) {
        // Throw so Polar retries the delivery.
        throw new Error(`Failed to update profile ${userId}: ${error.message}`);
    }
    if (!updated || updated.length === 0) {
        // Either the profile row is gone (deleted account) or a newer event won
        // the race. Neither is retryable, so ack rather than throwing.
        console.log(`polar webhook: no row updated for ${userId} (${sub.id}); a newer event or a deleted account`);
        return;
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
