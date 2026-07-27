import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import {
    getSupabaseAdmin,
    getUserFromRequest,
    getProfile,
    isProfilePro,
    currentUsageMonth,
    hostedMonthlyLimit as monthlyLimit,
} from './_lib/supabaseAdmin';
import {
    DIAGRAM_SYSTEM_INSTRUCTION,
    GEMINI_DIAGRAM_SCHEMA,
    buildHistoryContext,
} from '../services/diagramPrompt';

const MAX_PROMPT_CHARS = 4000;
const MAX_HISTORY_ENTRIES = 40;
const MAX_HISTORY_CHARS = 24000;

type AiConfig = { ai: GoogleGenAI; model: string; mode: string };

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
 */
function resolveAiClient(): AiConfig | null {
    const model = process.env.HOSTED_AI_MODEL || 'gemini-2.5-flash';

    const vertexApiKey = process.env.VERTEX_API_KEY;
    if (vertexApiKey) {
        return { ai: new GoogleGenAI({ vertexai: true, apiKey: vertexApiKey }), model, mode: 'vertex-express' };
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
        return { ai: new GoogleGenAI(opts), model, mode: 'vertex' };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        return { ai: new GoogleGenAI({ apiKey: geminiKey }), model, mode: 'ai-studio' };
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

    const profile = await getProfile(user.id).catch((err) => {
        console.error('generate: profile lookup failed', err);
        return null;
    });
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
    if (typeof newCount === 'number' && newCount < 0) {
        return res.status(429).json({
            error: `You've used all ${limit} hosted generations for this month. They reset at the start of next month, or add your own free API key in Settings for unlimited generations.`,
            code: 'quota_exceeded',
            usage: { used: limit, limit },
        });
    }

    let responseText: string;
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
            },
        });
        responseText = response.text || '{}';
    } catch (err) {
        // The upstream call itself failed, no generation was produced (and we
        // weren't billed), so it's fair to refund the metered credit. This is
        // the ONLY refund path: a response that comes back but fails to parse
        // below still counts as a used generation, so it can't be farmed to
        // burn the hosted key for free.
        console.error('generate: Gemini call failed', err);
        await admin
            .rpc('refund_ai_usage', { p_user: user.id, p_month: month })
            .then(({ error }) => {
                if (error) console.error('generate: refund failed', error);
            });
        return res.status(502).json({ error: 'The AI generation failed. Please try again.' });
    }

    try {
        const diagram = JSON.parse(responseText);
        // An empty/whitespace model response becomes '{}' (line above), which
        // parses to {}. A diagram without axes would crash the renderer, so
        // reject anything missing the required shape. Not refunded (a produced
        // response counts as used), same rationale as the parse-failure path.
        if (!diagram || typeof diagram !== 'object' || !diagram.xAxis || !diagram.yAxis) {
            console.error('generate: model returned an empty/invalid diagram');
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
