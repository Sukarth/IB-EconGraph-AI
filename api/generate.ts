import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import {
    getSupabaseAdmin,
    getUserFromRequest,
    getProfile,
    isProfilePro,
    currentUsageMonth,
    hostedMonthlyLimit as monthlyLimit,
} from './_lib/supabaseAdmin.js';
import {
    DIAGRAM_SYSTEM_INSTRUCTION,
    GEMINI_DIAGRAM_SCHEMA,
    buildHistoryContext,
    diagramShapeError,
} from '../services/diagramPrompt.js';

const MAX_PROMPT_CHARS = 4000;
const MAX_HISTORY_ENTRIES = 40;
const MAX_HISTORY_CHARS = 24000;

/**
 * Bound the upstream model call. Without this the only limit is the platform
 * function timeout, which kills the process outright, so the refund below never
 * runs and the user loses a credit for a generation they never received.
 * Must stay comfortably under the `maxDuration` set for this route in
 * `vercel.json`.
 */
const MODEL_TIMEOUT_MS = 30_000;

type AiConfig = { ai: GoogleGenAI; model: string };

/**
 * Resolve the hosted-AI client from environment. Three supported backends, in
 * priority order:
 *
 *   1. Vertex AI express mode  — VERTEX_API_KEY. An API key (no service
 *      account), so it works anywhere including serverless like Vercel.
 *   2. Vertex AI (full)        — GOOGLE_CLOUD_PROJECT [+ GOOGLE_CLOUD_LOCATION].
 *      Auth via Application Default Credentials locally (`gcloud auth
 *      application-default login`), or a service-account key placed in
 *      GOOGLE_SERVICE_ACCOUNT_JSON on hosts without gcloud (e.g. Vercel).
 *   3. Gemini Developer API    — GEMINI_API_KEY (Google AI Studio). Kept as a
 *      fallback so existing / fully-free deployments keep working unchanged.
 *
 * Returns null if none is configured. Note: "Vertex AI" was renamed
 * "Gemini Enterprise Agent Platform" in 2026; the SDK flag (vertexai: true)
 * is unchanged.
 *
 * The result is memoised at module scope: the config comes only from
 * environment variables, which cannot change within a warm serverless
 * container, so rebuilding the client (and re-parsing the service-account JSON)
 * on every request is pure overhead.
 */
let cachedAiConfig: AiConfig | null | undefined;

function resolveAiClient(): AiConfig | null {
    if (cachedAiConfig !== undefined) return cachedAiConfig;
    cachedAiConfig = buildAiClient();
    return cachedAiConfig;
}

function buildAiClient(): AiConfig | null {
    const model = process.env.HOSTED_AI_MODEL || 'gemini-2.5-flash';

    const vertexApiKey = process.env.VERTEX_API_KEY;
    if (vertexApiKey) {
        return { ai: new GoogleGenAI({ vertexai: true, apiKey: vertexApiKey }), model };
    }

    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
    if (project) {
        const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'global';
        const opts: ConstructorParameters<typeof GoogleGenAI>[0] = { vertexai: true, project, location };
        const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (saJson) {
            try {
                opts.googleAuthOptions = { credentials: JSON.parse(saJson) };
            } catch {
                // Malformed key: fall back to ADC rather than crash. If ADC is
                // also absent, the generateContent call will surface the auth
                // error and the request is refunded like any upstream failure.
                console.error('generate: GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON; falling back to ADC.');
            }
        }
        return { ai: new GoogleGenAI(opts), model };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        return { ai: new GoogleGenAI({ apiKey: geminiKey }), model };
    }

    return null;
}

/**
 * Hosted AI generation for Supporter (Pro) users. Authenticated via Supabase
 * JWT, entitlement-checked, and metered per month. The Gemini API key never
 * leaves the server.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const aiConfig = resolveAiClient();
    if (!aiConfig) {
        return res.status(503).json({ error: 'Hosted AI is not configured on this deployment.' });
    }

    let user;
    try {
        user = await getUserFromRequest(req);
    } catch (err) {
        console.error('generate: auth backend error', err);
        return res.status(503).json({ error: 'Account service is not configured on this deployment.' });
    }
    if (!user) {
        return res.status(401).json({ error: 'Please sign in to use hosted AI.' });
    }

    const body = (req.body ?? {}) as { prompt?: unknown; history?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
        return res.status(400).json({ error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).` });
    }

    let history: string[] = [];
    if (Array.isArray(body.history)) {
        history = body.history
            .filter((h): h is string => typeof h === 'string')
            // Cap each entry so a single huge string can't blow past the total
            // cap and reach the hosted Gemini key.
            .map((h) => h.slice(0, MAX_HISTORY_CHARS))
            .slice(-MAX_HISTORY_ENTRIES);
        // Drain to the total cap, including down to the final entry.
        while (history.join('\n').length > MAX_HISTORY_CHARS && history.length > 0) {
            history.shift();
        }
    }

    // A failed lookup is not the same as "not a Supporter" — answering 402 here
    // would tell a paying user their plan lapsed during a transient DB blip.
    let profile;
    try {
        profile = await getProfile(user.id);
    } catch (err) {
        console.error('generate: profile lookup failed', err);
        return res.status(503).json({
            error: 'Could not confirm your plan right now. Please try again in a moment.',
        });
    }
    if (!isProfilePro(profile)) {
        return res.status(402).json({
            error: 'Hosted AI is part of the Supporter plan. You can keep generating for free with your own API key (Settings > AI Provider).',
            code: 'not_pro',
        });
    }

    const admin = getSupabaseAdmin();
    const month = currentUsageMonth();
    const limit = monthlyLimit();

    const { data: newCount, error: usageError } = await admin.rpc('increment_ai_usage', {
        p_user: user.id,
        p_month: month,
        p_limit: limit,
    });
    if (usageError) {
        console.error('generate: usage metering failed', usageError);
        return res.status(500).json({ error: 'Usage metering failed. Please try again.' });
    }
    // Fail closed: an unexpected return type must not skip the quota check and
    // hand out unmetered generations on the hosted key.
    if (typeof newCount !== 'number') {
        console.error('generate: increment_ai_usage returned a non-numeric result', newCount);
        return res.status(500).json({ error: 'Usage metering failed. Please try again.' });
    }
    if (newCount < 0) {
        return res.status(429).json({
            error: `You've used all ${limit} hosted generations for this month. They reset at the start of next month, or add your own free API key in Settings for unlimited generations.`,
            code: 'quota_exceeded',
            usage: { used: limit, limit },
        });
    }

    let responseText: string;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), MODEL_TIMEOUT_MS);
    try {
        const { ai, model } = aiConfig;
        const response = await ai.models.generateContent({
            model,
            contents: `${buildHistoryContext(history)} ${prompt}`,
            config: {
                systemInstruction: DIAGRAM_SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: GEMINI_DIAGRAM_SCHEMA,
                temperature: 0.2,
                abortSignal: abort.signal,
            },
        });
        responseText = response.text || '{}';
    } catch (err) {
        // The upstream call failed or timed out, so no diagram reached the user
        // and the metered credit is refunded. This is the ONLY refund path: a
        // response that comes back but fails to parse below still counts as a
        // used generation, so it can't be farmed to burn the hosted key for
        // free. (On a timeout the provider may still bill us upstream, since
        // aborting is client-side only, but charging the user for nothing they
        // received would be worse.)
        console.error(
            abort.signal.aborted
                ? `generate: Gemini call exceeded ${MODEL_TIMEOUT_MS}ms and was aborted`
                : 'generate: Gemini call failed',
            err,
        );
        await admin
            .rpc('refund_ai_usage', { p_user: user.id, p_month: month })
            .then(({ error }) => {
                if (error) console.error('generate: refund failed', error);
            });
        return res.status(502).json({
            error: abort.signal.aborted
                ? 'The AI took too long to respond. Please try again.'
                : 'The AI generation failed. Please try again.',
        });
    } finally {
        clearTimeout(timer);
    }

    try {
        const diagram = JSON.parse(responseText);
        // An empty/whitespace model response becomes '{}' (line above), which
        // parses to {}. Anything the renderer cannot draw is rejected here: the
        // response schema makes a malformed object unlikely, not impossible, and
        // a partial one produces NaN geometry rather than a clear failure. Not
        // refunded (a produced response counts as used), same rationale as the
        // parse-failure path.
        const shapeError = diagramShapeError(diagram);
        if (shapeError) {
            console.error(`generate: model returned an unusable diagram (${shapeError})`);
            return res.status(502).json({ error: 'The AI returned an empty result. Please try again.' });
        }
        return res.status(200).json({
            diagram,
            usage: { used: newCount as number, limit },
        });
    } catch (err) {
        // Response was produced (and billed upstream) but wasn't valid JSON.
        // Not refunded, see above. Rare in practice given the response schema.
        console.error('generate: could not parse model output', err);
        return res.status(502).json({ error: 'The AI returned an unexpected format. Please try again.' });
    }
}
