import path from 'path';
import fs from 'node:fs';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-only shim: serve the Vercel serverless functions in `api/` directly from
 * the Vite dev server, so `npm run dev` exercises the real handlers (checkout,
 * usage, portal, webhooks…) without needing `vercel dev`. It maps `/api/<name>`
 * to `api/<name>.ts`, runs the module's default export, and adapts Node's
 * req/res to the small slice of the Vercel Node API the handlers use
 * (`req.query`, `req.body`, `res.status().json()`…). Production still runs on
 * the real Vercel runtime — this only exists for `command === 'serve'`.
 */
function devApiPlugin(root: string): Plugin {
    return {
        name: 'dev-api-functions',
        apply: 'serve',
        configureServer(server: ViteDevServer) {
            // Registering here (not in a returned callback) runs the middleware
            // before Vite's SPA history fallback, so /api isn't rewritten to index.html.
            server.middlewares.use(async (req: any, res: any, next: () => void) => {
                if (!req.url || !req.url.startsWith('/api/')) return next();

                const parsed = new URL(req.url, 'http://localhost');
                const rel = parsed.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
                const variants = [
                    { abs: path.join(root, 'api', `${rel}.ts`), id: `/api/${rel}.ts` },
                    { abs: path.join(root, 'api', rel, 'index.ts'), id: `/api/${rel}/index.ts` },
                ];
                const match = variants.find((v) => fs.existsSync(v.abs));
                if (!match) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: `No API route for ${parsed.pathname}` }));
                    return;
                }

                // Vercel-style request extras.
                req.query = Object.fromEntries(parsed.searchParams);
                // Webhook handlers read the raw body themselves (bodyParser is
                // disabled), so leave their stream untouched. Everything else
                // gets a parsed JSON body.
                if (!parsed.pathname.startsWith('/api/webhooks/')) {
                    req.body = await readJsonBody(req);
                }

                // Vercel-style response helpers.
                res.status = (code: number) => { res.statusCode = code; return res; };
                res.json = (obj: unknown) => {
                    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(obj));
                    return res;
                };
                res.send = (data: unknown) => {
                    res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
                    return res;
                };
                res.redirect = (url: string) => {
                    res.statusCode = 302;
                    res.setHeader('Location', url);
                    res.end();
                    return res;
                };

                try {
                    const mod = await server.ssrLoadModule(match.id);
                    const handler = mod.default as ((req: unknown, res: unknown) => unknown) | undefined;
                    if (typeof handler !== 'function') {
                        throw new Error(`API route ${rel} has no default export handler`);
                    }
                    await handler(req, res);
                } catch (err) {
                    server.config.logger.error(`[dev-api] ${rel} failed:\n${(err as Error).stack || err}`);
                    if (!res.writableEnded) {
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Dev API handler error (see terminal).' }));
                    }
                }
            });
        },
    };
}

function readJsonBody(req: any): Promise<unknown> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            if (chunks.length === 0) return resolve(undefined);
            const raw = Buffer.concat(chunks).toString('utf8');
            const ct = String(req.headers['content-type'] || '');
            if (ct.includes('application/json')) {
                try { resolve(JSON.parse(raw)); } catch { resolve(undefined); }
            } else {
                resolve(raw);
            }
        });
        req.on('error', () => resolve(undefined));
    });
}

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    if (command === 'serve') {
        // Expose server-side vars (SUPABASE_SECRET_KEY, POLAR_*, GEMINI_API_KEY…)
        // to the dev API handlers, which run in this Node process via ssrLoadModule.
        // Does not affect the client bundle — only VITE_-prefixed vars reach that.
        for (const [k, v] of Object.entries(env)) {
            if (process.env[k] === undefined) process.env[k] = v;
        }
    }
    return {
        server: {
            port: 4000,
            host: '0.0.0.0',
            // Allow access through public dev tunnels (used for testing the
            // Polar webhook/redirect against a real HTTPS origin). Vite otherwise
            // rejects non-localhost Host headers with "This host is not allowed".
            allowedHosts: ['.devtunnels.ms', '.ngrok-free.app', '.trycloudflare.com'],
        },
        plugins: [react(), devApiPlugin(__dirname)],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});
