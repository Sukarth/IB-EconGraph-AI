export type AIProvider = 'gemini' | 'openrouter';

const PROVIDER_STORAGE_KEY = 'econgraph_ai_provider';

export function getAIProvider(): AIProvider {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    return stored === 'openrouter' ? 'openrouter' : 'gemini';
}

export function setAIProvider(provider: AIProvider): void {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
}

export function getAIProviderDisplayName(provider: AIProvider = getAIProvider()): string {
    return provider === 'openrouter' ? 'OpenRouter' : 'Google AI Studio';
}
