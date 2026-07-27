// Build-time generator for the static SEO landing pages (/diagrams/*) and
// sitemap.xml. Runs after `vite build` and writes directly into dist/.
//
// The pages are plain, dependency-free HTML (inline CSS, inline SVG) so they
// are fast, fully crawlable, and independent of the SPA bundle. Vercel serves
// them via cleanUrls (dist/diagrams/foo.html → /diagrams/foo) ahead of the
// SPA rewrite, which only applies when no file matches.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIAGRAM_PAGES, SITE_URL } from './seo-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

if (!existsSync(DIST)) {
    console.error('dist/ not found, run `vite build` first.');
    process.exit(1);
}

const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Inline right-arrow used on call-to-action links (in place of a literal arrow
// character). Inherits the link's color; small left margin for spacing.
const ARROW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-left:.4em"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>';

// ── helpers ──────────────────────────────────────────────────────────────────

const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Render label text with _x subscripts / ^x superscripts as SVG tspans. */
function svgLabel(text) {
    let out = '';
    let i = 0;
    // After a sub/superscript, the baseline reset is carried onto the next
    // plain-text run (dy on real characters) rather than an empty whitespace
    // tspan, which would render a stray space inside the label.
    let pendingReset = null;
    while (i < text.length) {
        const ch = text[i];
        if ((ch === '_' || ch === '^') && i + 1 < text.length) {
            let token = text[i + 1];
            let consumed = 2;
            if (text[i + 1] === '{') {
                const close = text.indexOf('}', i + 2);
                if (close !== -1) {
                    token = text.slice(i + 2, close);
                    consumed = close - i + 1;
                }
            }
            const dy = ch === '_' ? '3' : '-4';
            out += `<tspan dy="${dy}" font-size="9">${esc(token)}</tspan>`;
            pendingReset = ch === '_' ? '-3' : '4';
            i += consumed;
        } else {
            // Gather the whole plain-text run and emit it once, applying any
            // pending baseline reset to it. A trailing '_' or '^' has nothing
            // to mark up and lands here, so always consume the character at i
            // to guarantee the outer loop makes progress.
            let j = i + 1;
            while (j < text.length && text[j] !== '_' && text[j] !== '^') j += 1;
            const run = text.slice(i, j);
            out += pendingReset !== null
                ? `<tspan dy="${pendingReset}">${esc(run)}</tspan>`
                : esc(run);
            pendingReset = null;
            i = j;
            continue;
        }
    }
    return out;
}

/** Render the declarative diagram spec into an inline SVG. */
function renderDiagramSvg(page) {
    const { diagram, axes } = page;
    if (!diagram) return '';
    const W = 520, H = 360, PAD = 52;
    const sx = (x) => PAD + (x / 100) * (W - PAD - 24);
    const sy = (y) => H - PAD - (y / 100) * (H - PAD - 28);

    let body = '';

    for (const line of diagram.lines ?? []) {
        const [x1, y1, x2, y2, color, label, dashed] = line;
        body += `<line x1="${sx(x1)}" y1="${sy(y1)}" x2="${sx(x2)}" y2="${sy(y2)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"${dashed ? ' stroke-dasharray="6,5"' : ''}/>`;
        if (label) {
            body += `<text x="${sx(x2) + 6}" y="${sy(y2) + 4}" fill="${color}" font-size="13" font-weight="700">${svgLabel(label)}</text>`;
        }
    }

    for (const curve of diagram.curves ?? []) {
        const [x1, y1, cx, cy, x2, y2, color, label] = curve;
        body += `<path d="M ${sx(x1)} ${sy(y1)} Q ${sx(cx)} ${sy(cy)} ${sx(x2)} ${sy(y2)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
        if (label) {
            body += `<text x="${sx(x2) + 6}" y="${sy(y2) + 4}" fill="${color}" font-size="13" font-weight="700">${svgLabel(label)}</text>`;
        }
    }

    for (const point of diagram.points ?? []) {
        const [x, y, label] = point;
        body += `<line x1="${sx(x)}" y1="${sy(y)}" x2="${sx(x)}" y2="${sy(0)}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,4"/>`;
        body += `<line x1="${sx(0)}" y1="${sy(y)}" x2="${sx(x)}" y2="${sy(y)}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,4"/>`;
        body += `<circle cx="${sx(x)}" cy="${sy(y)}" r="5" fill="#111827" stroke="#fff" stroke-width="2"/>`;
        body += `<text x="${sx(x) + 8}" y="${sy(y) - 8}" fill="#111827" font-size="12.5" font-weight="700">${svgLabel(label)}</text>`;
    }

    return `
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(page.keyword)} illustration" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="ah" markerWidth="6" markerHeight="7" refX="2.5" refY="3" orient="auto"><polygon points="0 0, 6 3, 0 6" fill="#374151"/></marker>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff" rx="12"/>
  <line x1="${sx(0)}" y1="${sy(0)}" x2="${W - 12}" y2="${sy(0)}" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>
  <line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(0)}" y2="14" stroke="#374151" stroke-width="2" marker-end="url(#ah)"/>
  <text x="${W - 16}" y="${sy(0) + 26}" fill="#374151" font-size="12.5" font-weight="600" text-anchor="end">${esc(axes[0])}</text>
  <text x="${sx(0) + 10}" y="22" fill="#374151" font-size="12.5" font-weight="600">${esc(axes[1])}</text>
  ${body}
</svg>`;
}

const CSS = `
:root{color-scheme:light}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;background:#fff;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:820px;margin:0 auto;padding:0 24px}
header.site{position:sticky;top:0;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid #f1f5f9;z-index:10}
header.site .inner{max-width:1080px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;color:#111827}
.brand:hover{text-decoration:none}
.brand .logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#4f46e5);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(37,99,235,.25)}
nav.top{display:flex;align-items:center;gap:18px;font-size:14px}
nav.top a{color:#6b7280;font-weight:500}
nav.top a:hover{color:#111827;text-decoration:none}
.btn{display:inline-flex;align-items:center;gap:8px;background:#111827;color:#fff!important;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px}
.btn:hover{background:#1f2937;text-decoration:none!important}
.btn.primary{background:linear-gradient(90deg,#2563eb,#4f46e5);box-shadow:0 8px 22px rgba(37,99,235,.28);font-size:16px;padding:14px 26px;border-radius:12px}
.btn.primary:hover{filter:brightness(1.05)}
.btn.ghost{background:#fff;color:#374151!important;border:1px solid #e5e7eb}
.btn.ghost:hover{background:#f9fafb}
.crumbs{font-size:13px;color:#9ca3af;padding:26px 0 0}
.crumbs a{color:#9ca3af}
h1{font-size:clamp(30px,5vw,44px);line-height:1.12;letter-spacing:-.02em;margin:14px 0 18px;font-weight:800}
.lede{font-size:18px;color:#4b5563}
.cta-row{display:flex;flex-wrap:wrap;gap:14px;margin:28px 0 8px;align-items:center}
.free-note{font-size:13px;color:#6b7280}
.figure{margin:38px 0;padding:20px;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 14px 40px -18px rgba(15,23,42,.14);background:linear-gradient(180deg,#f8fafc60,#fff)}
.figure svg{width:100%;height:auto;display:block}
h2{font-size:24px;letter-spacing:-.01em;margin:44px 0 14px;font-weight:700}
p{margin:12px 0;color:#374151}
ul.what{list-style:none;margin:16px 0}
ul.what li{padding:10px 0 10px 30px;position:relative;color:#374151;border-bottom:1px solid #f8fafc}
ul.what li::before{content:"";position:absolute;left:4px;top:17px;width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#2563eb,#4f46e5)}
ul.what b{color:#111827}
ol.steps{margin:16px 0 16px 0;counter-reset:step;list-style:none}
ol.steps li{counter-increment:step;position:relative;padding:10px 0 10px 44px;color:#374151}
ol.steps li::before{content:counter(step);position:absolute;left:0;top:10px;width:28px;height:28px;border-radius:9px;background:#eff6ff;color:#2563eb;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}
.tips{background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:18px 22px;margin:18px 0}
.tips li{margin:8px 0 8px 18px;color:#78350f}
.faq details{border-bottom:1px solid #f1f5f9;padding:4px 0}
.faq summary{cursor:pointer;font-weight:600;padding:12px 0;color:#111827}
.faq p{padding:0 0 14px;color:#4b5563}
.related{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.related a{border:1px solid #e5e7eb;padding:8px 16px;border-radius:999px;font-size:14px;color:#374151;font-weight:500}
.related a:hover{border-color:#93c5fd;color:#2563eb;text-decoration:none}
.guarantee{margin:52px 0;background:linear-gradient(135deg,#ecfdf5,#f0fdfa);border:1px solid #a7f3d0;border-radius:18px;padding:28px;text-align:center}
.guarantee h2{margin:0 0 8px;font-size:22px}
.guarantee p{color:#065f46;max-width:560px;margin:8px auto 18px}
footer.site{border-top:1px solid #f1f5f9;margin-top:64px;padding:34px 0 44px;font-size:14px;color:#9ca3af}
footer.site .inner{max-width:1080px;margin:0 auto;padding:0 24px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}
footer.site a{color:#6b7280}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin:30px 0}
.cards a{border:1px solid #e5e7eb;border-radius:14px;padding:18px;color:#111827;display:block}
.cards a:hover{border-color:#93c5fd;box-shadow:0 10px 26px -14px rgba(37,99,235,.35);text-decoration:none}
.cards .k{font-weight:700;margin-bottom:4px}
.cards .d{font-size:13.5px;color:#6b7280}
@media(max-width:640px){nav.top a.hide-sm{display:none}}
`;

const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

function pageShell({ title, description, canonicalPath, jsonLd, bodyHtml }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${SITE_URL}${canonicalPath}"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<meta name="theme-color" content="#2563eb"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${SITE_URL}${canonicalPath}"/>
<meta property="og:site_name" content="IB EconGraph AI"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
${jsonLd.map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join('\n')}
<style>${CSS}</style>
</head>
<body>
<header class="site">
  <div class="inner">
    <a class="brand" href="/"><span class="logo">${LOGO_SVG}</span>IB EconGraph AI</a>
    <nav class="top">
      <a href="/diagrams" class="hide-sm">Diagrams</a>
      <a href="/pricing" class="hide-sm">Pricing</a>
      <a href="/compare" class="hide-sm">Compare</a>
      <a href="https://github.com/sukarth/IB-EconGraph-AI" rel="noopener" class="hide-sm">GitHub</a>
      <a class="btn" href="/editor">Open Editor</a>
    </nav>
  </div>
</header>
${bodyHtml}
<footer class="site">
  <div class="inner">
    <span>© ${new Date().getFullYear()} IB EconGraph AI, free &amp; open source (AGPL-3.0). Built for IB Economics students and educators.</span>
    <span>
      <a href="/diagrams">All diagrams</a> ·
      <a href="/pricing">Pricing</a> ·
      <a href="/compare">Compare</a> ·
      <a href="https://github.com/sukarth/IB-EconGraph-AI" rel="noopener">GitHub</a> ·
      <a href="https://ko-fi.com/sukarth" rel="noopener">Support</a>
    </span>
  </div>
</footer>
</body>
</html>`;
}

const softwareAppLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'IB EconGraph AI',
    description: 'Free, open-source AI-powered economics diagram editor for IB students and educators.',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    author: { '@type': 'Person', name: 'Sukarth Acharya' },
};

function renderDiagramPage(page) {
    const path = `/diagrams/${page.slug}`;
    const jsonLd = [
        softwareAppLd,
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
                { '@type': 'ListItem', position: 2, name: 'Diagrams', item: SITE_URL + '/diagrams' },
                { '@type': 'ListItem', position: 3, name: page.navTitle, item: SITE_URL + path },
            ],
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: page.faq.map(([q, a]) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a },
            })),
        },
    ];

    const related = page.related
        .map((slug) => {
            const target = DIAGRAM_PAGES.find((p) => p.slug === slug);
            return target ? `<a href="/diagrams/${target.slug}">${esc(target.navTitle)}</a>` : '';
        })
        .join('');

    const bodyHtml = `
<main class="wrap">
  <div class="crumbs"><a href="/">Home</a> › <a href="/diagrams">Diagrams</a> › ${esc(page.navTitle)}</div>
  <h1>${esc(page.h1)}</h1>
  <p class="lede">${esc(page.intro[0])}</p>
  <div class="cta-row">
    <a class="btn primary" href="/editor">Open the free editor${ARROW}</a>
    <a class="btn ghost" href="/editor">Generate it with AI</a>
  </div>
  <p class="free-note">Free forever · no account needed · no watermark · exports as SVG, PNG &amp; JPEG</p>

  <div class="figure">${renderDiagramSvg(page)}</div>

  <p>${esc(page.intro[1])}</p>

  <h2>What the ${esc(page.keyword)} shows</h2>
  <p>${esc(page.whatItShows.text)}</p>
  <ul class="what">
    ${page.whatItShows.bullets.map(([term, def]) => `<li><b>${esc(term)}</b>: ${esc(def)}</li>`).join('\n    ')}
  </ul>

  <h2>How to draw it in IB EconGraph AI</h2>
  <ol class="steps">
    ${page.howToDraw.map((step) => `<li>${esc(step)}</li>`).join('\n    ')}
  </ol>

  <h2>IA &amp; exam tips</h2>
  <div class="tips">
    <ul>
      ${page.iaTips.map((tip) => `<li>${esc(tip)}</li>`).join('\n      ')}
    </ul>
  </div>

  <h2>Frequently asked questions</h2>
  <div class="faq">
    ${page.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n    ')}
  </div>

  <h2>Related diagram makers</h2>
  <div class="related">${related}<a href="/diagrams">All diagram types${ARROW}</a></div>

  <div class="guarantee">
    <h2>Free, unlimited, forever.</h2>
    <p>Everything a student needs to finish their IA is free: unlimited diagrams, every tool, full-quality exports with no watermark, and unlimited AI generation with your own free API key.</p>
    <a class="btn primary" href="/editor">Start drawing, it's free</a>
  </div>
</main>`;

    return pageShell({
        title: page.title,
        description: page.metaDescription,
        canonicalPath: path,
        jsonLd,
        bodyHtml,
    });
}

function renderHubPage() {
    const jsonLd = [
        softwareAppLd,
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
                { '@type': 'ListItem', position: 2, name: 'Diagrams', item: SITE_URL + '/diagrams' },
            ],
        },
    ];

    const bodyHtml = `
<main class="wrap">
  <div class="crumbs"><a href="/">Home</a> › Diagrams</div>
  <h1>Every IB Economics diagram, drawable in seconds</h1>
  <p class="lede">Free, exam-ready diagram makers for the whole IB Economics syllabus, micro, macro, and international trade. Generate with AI or draw by hand, then export at full quality with no watermark.</p>
  <div class="cta-row">
    <a class="btn primary" href="/editor">Open the free editor${ARROW}</a>
  </div>
  <div class="cards">
    ${DIAGRAM_PAGES.map((p) => `<a href="/diagrams/${p.slug}"><div class="k">${esc(p.navTitle)}</div><div class="d">${esc(p.h1)}</div></a>`).join('\n    ')}
  </div>
  <div class="guarantee">
    <h2>Free, unlimited, forever.</h2>
    <p>Everything a student needs to finish their IA is free: unlimited diagrams, every tool, full-quality exports with no watermark, and unlimited AI generation with your own free API key.</p>
    <a class="btn primary" href="/editor">Start drawing, it's free</a>
  </div>
</main>`;

    return pageShell({
        title: 'IB Economics Diagram Makers: Free, AI-Powered, No Watermark | IB EconGraph AI',
        description:
            'Free diagram makers for every IB Economics diagram: supply & demand, monopoly, externalities, tariffs, AD-AS, PPC and more. Draw or AI-generate, export watermark-free.',
        canonicalPath: '/diagrams',
        jsonLd,
        bodyHtml,
    });
}

function renderSitemap() {
    // Only list URLs whose served HTML self-canonicalizes. /home, /editor and
    // /settings are app UI that serve index.html (canonical → "/"), so listing
    // them would submit homepage duplicates. /pricing and /compare are included
    // because the SPA sets a matching per-route canonical (see App.tsx).
    const urls = [
        { loc: '/', priority: '1.0', changefreq: 'weekly' },
        { loc: '/pricing', priority: '0.9', changefreq: 'monthly' },
        { loc: '/compare', priority: '0.8', changefreq: 'monthly' },
        { loc: '/diagrams', priority: '0.9', changefreq: 'weekly' },
        ...DIAGRAM_PAGES.map((p) => ({ loc: `/diagrams/${p.slug}`, priority: '0.8', changefreq: 'monthly' })),
        { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
        { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
            .map(
                (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
            )
            .join('\n')}
</urlset>
`;
}

// ── emit ─────────────────────────────────────────────────────────────────────

mkdirSync(join(DIST, 'diagrams'), { recursive: true });

for (const page of DIAGRAM_PAGES) {
    writeFileSync(join(DIST, 'diagrams', `${page.slug}.html`), renderDiagramPage(page));
}
writeFileSync(join(DIST, 'diagrams.html'), renderHubPage());
writeFileSync(join(DIST, 'sitemap.xml'), renderSitemap());

console.log(`Generated ${DIAGRAM_PAGES.length} diagram pages + hub + sitemap.xml into dist/`);
