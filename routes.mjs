/**
 * The paths the client router understands, and the shape of a share link.
 *
 * Single source of truth, and deliberately plain JS: App.tsx routes with it,
 * and scripts/generate-seo-pages.mjs (which runs under bare node and cannot
 * import TypeScript) checks at build time that the deployment actually serves
 * every entry. A route added here without a prerendered shell or a vercel.json
 * rewrite fails the build rather than 404ing only in production.
 *
 * Anything not listed here, and not a share link, is a genuine 404.
 */
export const CLIENT_ROUTES = {
    '/home': 'home',
    '/editor': 'editor',
    '/settings': 'settings',
    '/pricing': 'pricing',
    '/compare': 'compare',
    '/privacy': 'privacy',
    '/terms': 'terms',
};

/**
 * A share link. The capture group is the slug.
 *
 * vercel.json needs the same character class so the edge and the client agree
 * on which URLs are share routes; the build checks the two match rather than
 * trusting a comment to keep them aligned.
 */
export const SHARE_PATH = /^\/s\/([A-Za-z0-9_-]{6,64})\/?$/;
