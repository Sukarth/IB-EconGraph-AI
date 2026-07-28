// Simple obfuscation to avoid plain-text API keys sitting in localStorage.
// This is NOT encryption — true encryption is impossible when the decryption
// key must also live client-side. The purpose is only to prevent casual
// exposure (e.g. shoulder-surfing DevTools). Shared by every BYO-key provider.
const OBFUSCATION_PREFIX = 'egk_';

// btoa/atob only handle Latin-1. A key pasted with any character above U+00FF
// (or a stray smart quote) would throw InvalidCharacterError out of the save
// path, so round-trip through UTF-8 bytes instead.
function toBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function fromBase64(encoded: string): string {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function obfuscateKey(key: string): string {
    return OBFUSCATION_PREFIX + toBase64(key);
}

export function deobfuscateKey(stored: string): string {
    if (!stored.startsWith(OBFUSCATION_PREFIX)) return stored;
    return fromBase64(stored.slice(OBFUSCATION_PREFIX.length));
}
