import { getAIProvider } from './aiProvider';
import { generateDiagramData as generateDiagramDataGemini, hasApiKey as hasGeminiApiKey } from './gemini';
import { generateDiagramDataOpenRouter, hasOpenRouterApiKey } from './openrouter';
import { generateDiagramDataHosted } from './hostedAi';
import { DiagramData } from '../types';

/**
 * Whether the current BYOK provider has a key configured. For the hosted
 * provider this is always true — availability is decided by auth/entitlement
 * state, which callers check via `useAuth()` (see aiIsReady in App).
 */
export function hasApiKey(): boolean {
    const provider = getAIProvider();
    if (provider === 'hosted') return true;
    return provider === 'openrouter' ? hasOpenRouterApiKey() : hasGeminiApiKey();
}

export async function generateDiagramData(prompt: string, history: string[] = []): Promise<DiagramData> {
    const provider = getAIProvider();
    if (provider === 'hosted') return generateDiagramDataHosted(prompt, history);
    return provider === 'openrouter'
        ? generateDiagramDataOpenRouter(prompt, history)
        : generateDiagramDataGemini(prompt, history);
}
