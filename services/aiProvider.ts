export type AIProvider = 'gemini' | 'openrouter' | 'hosted';

const PROVIDER_STORAGE_KEY = 'econgraph_ai_provider';

export function getAIProvider(): AIProvider {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (stored === 'openrouter' || stored === 'hosted') return stored;
    return 'gemini';
}

export function setAIProvider(provider: AIProvider): void {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
}

export function getAIProviderDisplayName(provider: AIProvider = getAIProvider()): string {
    switch (provider) {
        case 'openrouter': return 'OpenRouter';
        case 'hosted': return 'EconGraph Cloud';
        default: return 'Google AI Studio';
    }
}
