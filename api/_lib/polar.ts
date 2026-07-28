import { Polar } from '@polar-sh/sdk';

let cached: Polar | null = null;

export function getPolar(): Polar {
    if (cached) return cached;
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('Polar is not configured (POLAR_ACCESS_TOKEN).');
    }
    cached = new Polar({
        accessToken,
        server: process.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : 'production',
    });
    return cached;
}

const clean = (u: string) => u.replace(/\/$/, '');

const DEFAULT_APP_URL = 'https://ib-econgraph-ai.vercel.app';

/**
 * Public dev-tunnel providers, mirroring `server.allowedHosts` in
 * `vite.config.ts`. These are trusted only outside production (see
 * `isAllowedOrigin`), where they exist so Polar redirects and webhooks can be
 * tested against a real HTTPS origin.
 */
const DEV_TUNNEL_SUFFIXES = ['.devtunnels.ms', '.ngrok-free.app', '.ngrok.app', '.trycloudflare.com'];

/** Origins this deployment is willing to redirect a checkout back to. */
function configuredOrigins(): string[] {
    const list: string[] = [];
    if (process.env.APP_URL) list.push(clean(process.env.APP_URL));
    for (const extra of (process.env.ALLOWED_ORIGINS || '').split(',')) {
        const trimmed = extra.trim();
        if (trimmed) list.push(clean(trimmed));
    }
    return list;
}

/**
 * The checkout success/cancel URLs are handed to Polar, which redirects the
 * browser there after payment. Building them from a raw `Origin` (or `Host`)
 * header would let a caller point that redirect at any site they like, so every
 * candidate has to clear an allowlist first.
 */
function isAllowedOrigin(candidate: string): boolean {
    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (configuredOrigins().includes(clean(url.origin))) return true;

    // Development conveniences, deliberately unavailable in production: a
    // self-hosted production deployment must name its origins via APP_URL /
    // ALLOWED_ORIGINS.
    if (process.env.NODE_ENV === 'production') return false;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) return true;
    return DEV_TUNNEL_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export function getAppUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
    // On Vercel (production or preview), prefer the configured canonical domain
    // so checkout redirects land on the primary URL rather than a *.vercel.app
    // alias. VERCEL is set automatically in every Vercel deployment.
    if (process.env.VERCEL && process.env.APP_URL) {
        return clean(process.env.APP_URL);
    }

    // Otherwise send the user back to the exact origin their browser is on, as
    // long as it is one we recognise. The same-origin POST to /api/checkout
    // carries that origin, which stays correct even when a tunnel rewrites the
    // Host header.
    const origin = req.headers['origin'];
    if (typeof origin === 'string' && isAllowedOrigin(origin)) return clean(origin);

    // Fallback: the forwarded/host header, subject to the same allowlist.
    const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
    if (host) {
        const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
        const proto = (req.headers['x-forwarded-proto'] as string | undefined) || (isLocal ? 'http' : 'https');
        const fromHost = `${proto}://${host}`;
        if (isAllowedOrigin(fromHost)) return fromHost;
    }

    return clean(process.env.APP_URL || DEFAULT_APP_URL);
}
