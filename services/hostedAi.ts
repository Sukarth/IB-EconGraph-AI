import { DiagramData } from '../types';
import { getAccessToken } from './supabaseClient';
import { diagramShapeError } from './diagramPrompt';
import { fetchWithTimeout, GENERATE_TIMEOUT_MS, RequestTimeoutError } from './httpTimeout';

export interface HostedUsage {
    used: number;
    limit: number;
    month: string;
    isPro: boolean;
}

/**
 * Generate a diagram through the hosted (server-side) AI endpoint.
 * Requires a signed-in Supporter, the server enforces both.
 */
export async function generateDiagramDataHosted(prompt: string, history: string[] = []): Promise<DiagramData> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Please sign in (Settings > Account) to use hosted AI, or switch to your own API key.');
    }

    let res: Response;
    try {
        res = await fetchWithTimeout('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ prompt, history }),
        }, GENERATE_TIMEOUT_MS);
    } catch (err) {
        if (err instanceof RequestTimeoutError) throw err;
        throw new Error('Could not reach the server. Check your connection and try again.');
    }

    const body = await res.json().catch(() => null) as
        | { diagram?: DiagramData; error?: string }
        | null;

    if (!res.ok || !body?.diagram) {
        throw new Error(body?.error || 'Hosted AI generation failed. Please try again.');
    }
    // Guard the shape too. The server checks it as well, but this is the last
    // point before the renderer, which reads curve points and axis bounds
    // without guarding and turns anything malformed into NaN geometry.
    const shapeError = diagramShapeError(body.diagram);
    if (shapeError) {
        console.error(`hosted AI: unusable diagram (${shapeError})`);
        throw new Error('The AI returned an unexpected result. Please try again.');
    }
    return body.diagram;
}

/** Fetch the signed-in user's hosted AI usage. Returns null when unavailable. */
export async function fetchHostedUsage(): Promise<HostedUsage | null> {
    try {
        // Inside the try: a failed session restore should read as "no usage to
        // show", not reject and leave callers with an unhandled rejection.
        const token = await getAccessToken();
        if (!token) return null;
        const res = await fetchWithTimeout('/api/usage', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        return await res.json() as HostedUsage;
    } catch {
        return null;
    }
}
