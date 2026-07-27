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

export function getAppUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
    const clean = (u: string) => u.replace(/\/$/, '');

    // On Vercel (production or preview), prefer the configured canonical domain
    // so checkout redirects land on the primary URL rather than a *.vercel.app
    // alias. VERCEL is set automatically in every Vercel deployment.
    if (process.env.VERCEL && process.env.APP_URL) {
        return clean(process.env.APP_URL);
    }

    // Locally — including when the app is reached through a public dev tunnel
    // (devtunnels.ms, ngrok, cloudflared…) — send the user back to the exact
    // origin their browser is on. The same-origin POST to /api/checkout carries
    // that origin, which is reliable even when a tunnel rewrites the Host header.
    const origin = req.headers['origin'];
    if (typeof origin === 'string' && origin) return clean(origin);

    // Fallbacks: forwarded/host header, then the configured/canonical URL.
    const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
    if (host) {
        const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
        const proto = (req.headers['x-forwarded-proto'] as string | undefined) || (isLocal ? 'http' : 'https');
        return `${proto}://${host}`;
    }
    return clean(process.env.APP_URL || 'https://ib-econgraph-ai.vercel.app');
}
