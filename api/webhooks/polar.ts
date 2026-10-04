import type { VercelRequest, VercelResponse } from '@vercel/node';
// Must agree with the webhook endpoint's api_version in the Polar dashboard,
// which decides the shape of the payloads Polar sends. See api/_lib/polar.ts.
import { webhooks, type models } from '@polar-sh/sdk/2026-10';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { ENTITLED_POLAR_STATUSES } from '../../services/entitlement.js';

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

/**
 * The fields entitlement depends on, picked from the SDK's own Subscription
 * type rather than declared here by hand.
 *
 * This used to be a hand-written interface, and the payload was cast to it with
 * `as unknown as`. That cast switched the compiler off for exactly the code that
 * grants access: when a field is renamed upstream, as every one of these was
 * between SDK 0.x (camelCase) and 1.x (snake_case), reads of the old names just
 * become undefined. The user then cannot be identified, the handler acks with
 * 202, and Polar never retries. Picking from the SDK type turns a rename into a
 * compile error here instead.
 *
 * Narrower than the full type so decideEntitlement can be exercised with only
 * the fields it reads. `cancel_at_period_end` marks a user who has cancelled but
 * keeps access until `ends_at`, the definitive end once cancellation is
 * scheduled. `modified_at` is when Polar last changed the subscription, and is
 * what orders deliveries.
 */
type SubscriptionLike = Pick<
    models.Subscription,
    | 'id'
    | 'status'
    | 'current_period_end'
    | 'recurring_interval'
    | 'customer_id'
    | 'modified_at'
    | 'created_at'
    | 'cancel_at_period_end'
    | 'ends_at'
    | 'metadata'
> & {
    customer?: Pick<models.Subscription['customer'], 'id' | 'external_id'> | null;
};

function toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/** Epoch millis, or null for anything absent or unparseable. Never NaN. */
function millis(value: unknown): number | null {
    return toDate(value)?.getTime() ?? null;
}

/**
 * Ordering key for an event. Webhook deliveries are not ordered and are
 * retried, so "the event that arrived last" is not "the event that happened
 * last". Polar stamps every subscription change with `modified_at`; a freshly
 * created subscription has none yet, so `created_at` stands in.
 *
 * Returns null when neither is usable, in which case the caller falls back to
 * applying the event unordered (better than dropping billing state entirely).
 */
function eventTimestamp(sub: SubscriptionLike): Date | null {
    // SDK 1.x hands these over as the ISO strings Polar sent; 0.x parsed them
    // into Dates. toDate takes either, and rejects anything unparseable.
    return toDate(sub.modified_at) ?? toDate(sub.created_at);
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
    // `CurrentBillingState` is a plain interface, so nothing guarantees these
    // two are parseable the way the timestamptz columns they normally come from
    // would. A NaN reaching `Math.max` below makes `new Date(...).toISOString()`
    // throw, and a webhook that throws is one Polar retries forever.
    const currentEnd = millis(current?.pro_until) ?? 0;

    // Deliveries are neither ordered nor deduplicated. Checking only that the
    // subscription id matches (as this used to) left the worst case open: a
    // delayed `subscription.active` for the SAME subscription, arriving after a
    // cancellation, passed every guard and the `Math.max` below then restored
    // the future pro_until. Comparing the event's own timestamp against the
    // last one applied rejects it.
    const eventAt = eventTimestamp(sub);
    const appliedAt = millis(current?.polar_event_at);
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
        // already paid for is correct and deliberate, but `ends_at` is then the
        // authoritative end date, and the renewal margin must not apply: that
        // margin exists to cover the gap before a *renewal* webhook lands, and
        // a subscription that will not renew has no such gap. Adding it would
        // hand out a day of access nobody paid for.
        const endsAt = toDate(sub.ends_at);
        const scheduledToEnd = sub.cancel_at_period_end === true || !!endsAt;
        const periodEnd = endsAt ?? toDate(sub.current_period_end);

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
        // access (dropping the margin, or moving to an earlier ends_at), and the
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

/**
 * The app user a subscription belongs to.
 *
 * The checkout's own `supabase_user_id` metadata comes first, and the customer's
 * external id is only the fallback. Polar matches a checkout to an existing
 * customer by email, and a customer's external id can never be changed once set.
 * So someone who deletes their account and signs up again with the same email
 * pays as the old customer, still carrying the deleted account's id: keyed on
 * that alone, the payment updated no row and the new account never got access.
 * The metadata is written server-side by api/checkout.ts for the user who
 * actually started the checkout. Subscriptions without it (any made before the
 * metadata existed, or outside the app) fall back to the external id.
 */
export function subscriptionOwner(sub: Pick<SubscriptionLike, 'metadata' | 'customer'>): string | null {
    const fromCheckout = sub.metadata?.supabase_user_id;
    if (typeof fromCheckout === 'string' && fromCheckout) return fromCheckout;
    return sub.customer?.external_id ?? null;
}

async function applySubscriptionState(sub: SubscriptionLike): Promise<void> {
    // The types are checked at compile time only: 1.x does not validate the
    // payload at runtime, it just parses it. So if the dashboard endpoint is ever
    // on a different API version from this code, the payload's real shape can
    // differ from SubscriptionLike with nothing to say so. A customer object
    // with no `external_id` key at all is that case, not a checkout made outside
    // the app (where the key is present and null). Fail loudly, so Polar retries
    // and the dashboard shows failed deliveries, instead of acking a silent drop.
    if (!sub.customer || !('external_id' in sub.customer)) {
        throw new Error(
            `subscription ${sub.id} payload has no customer.external_id field; ` +
            'is the Polar webhook endpoint on the same API version as the code (2026-10)?',
        );
    }
    const userId = subscriptionOwner(sub);
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
            plan_interval: sub.recurring_interval ?? null,
            polar_customer_id: sub.customer?.id ?? sub.customer_id ?? null,
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

    let event: webhooks.WebhookPayload;
    try {
        const raw = await readRawBody(req);
        // Awaited: in SDK 1.x this is async. Without the await, `event` is a
        // Promise, `event.type` matches no case below, and every delivery is
        // acked as an event we ignore, so no subscriber is ever granted access.
        event = await webhooks.validateEvent(raw, req.headers as Record<string, string>, secret);
    } catch (err) {
        if (err instanceof webhooks.PolarWebhookVerificationError) {
            return res.status(403).json({ error: 'Invalid signature' });
        }
        if (err instanceof webhooks.PolarWebhookUnknownTypeError) {
            // The signature was checked before the type, so this is genuinely
            // from Polar: an event type newer than this SDK. Nothing here would
            // handle it, so acknowledge rather than have Polar retry it forever.
            console.warn(`polar webhook: acking unknown event type ${err.eventType}`);
            return res.status(202).json({ received: true });
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
            // The production endpoint subscribes to paused and resumed, and these
            // used to fall through to "ignore". Resumed matters most: unless an
            // `updated` happened to accompany it, a user who started paying again
            // stayed locked out. Applying them is safe because the ordering
            // check makes a duplicate of the same change a no-op.
            case 'subscription.paused':
            case 'subscription.resumed':
            case 'subscription.cycled':
                // No cast: the compiler checks the payload against SubscriptionLike.
                await applySubscriptionState(event.data);
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
