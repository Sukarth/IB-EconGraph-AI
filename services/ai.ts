import { getAIProvider } from './aiProvider';
import { generateDiagramData as generateDiagramDataGemini, hasApiKey as hasGeminiApiKey } from './gemini';
import { generateDiagramDataOpenRouter, hasOpenRouterApiKey } from './openrouter';
import { DiagramData } from '../types';

export function hasApiKey(): boolean {
    const provider = getAIProvider();
    return provider === 'openrouter' ? hasOpenRouterApiKey() : hasGeminiApiKey();
}

export async function generateDiagramData(prompt: string, history: string[] = []): Promise<DiagramData> {
    const provider = getAIProvider();
    return provider === 'openrouter'
        ? generateDiagramDataOpenRouter(prompt, history)
        : generateDiagramDataGemini(prompt, history);
}
