import { isCloudConfigured } from './supabaseClient';

export type AIProvider = 'gemini' | 'openrouter' | 'hosted';

const PROVIDER_STORAGE_KEY = 'econgraph_ai_provider';

export function getAIProvider(): AIProvider {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    // 'hosted' needs a cloud backend. If a deployment drops its Supabase
    // configuration (or a user's storage is carried to a fork that has none),
    // the stored choice would point at a provider the UI no longer offers and
    // generation would fail with no way to change it: fall back to BYOK.
    if (stored === 'hosted') return isCloudConfigured ? 'hosted' : 'gemini';
    if (stored === 'openrouter') return 'openrouter';
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
