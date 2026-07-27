import { DiagramData } from '../types';
import { getAccessToken } from './supabaseClient';

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
        res = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ prompt, history }),
        });
    } catch {
        throw new Error('Could not reach the server. Check your connection and try again.');
    }

    const body = await res.json().catch(() => null) as
        | { diagram?: DiagramData; error?: string }
        | null;

    // Guard the shape too: an empty/degenerate diagram ({} with no axes) would
    // crash the renderer, so treat it as a failure rather than pass it through.
    if (!res.ok || !body?.diagram || !body.diagram.xAxis || !body.diagram.yAxis) {
        throw new Error(body?.error || 'Hosted AI generation failed. Please try again.');
    }
    return body.diagram;
}

/** Fetch the signed-in user's hosted AI usage. Returns null when unavailable. */
export async function fetchHostedUsage(): Promise<HostedUsage | null> {
    const token = await getAccessToken();
    if (!token) return null;
    try {
        const res = await fetch('/api/usage', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        return await res.json() as HostedUsage;
    } catch {
        return null;
    }
}
