// Simple obfuscation to avoid plain-text API keys sitting in localStorage.
// This is NOT encryption — true encryption is impossible when the decryption
// key must also live client-side. The purpose is only to prevent casual
// exposure (e.g. shoulder-surfing DevTools). Shared by every BYO-key provider.
const OBFUSCATION_PREFIX = 'egk_';

export function obfuscateKey(key: string): string {
    return OBFUSCATION_PREFIX + btoa(key);
}

export function deobfuscateKey(stored: string): string {
    if (!stored.startsWith(OBFUSCATION_PREFIX)) return stored;
    return atob(stored.slice(OBFUSCATION_PREFIX.length));
}
