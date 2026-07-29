/**
 * Write a contact sheet of every social preview card, for eyeballing before
 * anything is rasterised. Not part of the build.
 *
 *   node scripts/og-preview.mjs [outfile.html]
 *
 * Cards are shown at half size with a toggle to view any one at full 1200x630,
 * since that is the size they are actually seen at.
 */

import { writeFileSync } from 'node:fs';
import { OG_CARDS } from './og-pages.mjs';
import { renderOgSvg } from './og-template.mjs';

const out = process.argv[2] ?? 'og-preview.html';

const cards = OG_CARDS.map(
    (card, i) => `
<figure class="card" id="card-${i}">
  <figcaption>
    <span class="n">${i + 1}. ${card.name}.png</span>
    <span class="p">${card.paths.join('  ')}</span>
  </figcaption>
  <div class="frame">${renderOgSvg(card.spec)}</div>
</figure>`,
).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<title>OG card previews (${OG_CARDS.length})</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>
  body{margin:0;padding:32px;background:#0f172a;color:#e2e8f0;
       font-family:Inter,'Segoe UI',system-ui,sans-serif}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#94a3b8;font-size:14px;margin-bottom:24px}
  .sub kbd{background:#1e293b;border:1px solid #334155;border-radius:5px;padding:1px 6px;font-size:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(600px,1fr));gap:28px}
  .card{margin:0}
  figcaption{display:flex;justify-content:space-between;align-items:baseline;
             gap:12px;margin-bottom:8px;font-size:13px}
  .n{font-weight:600}
  .p{color:#94a3b8;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
  .frame{border-radius:10px;overflow:hidden;border:1px solid #334155;
         box-shadow:0 10px 30px -12px rgba(0,0,0,.6);background:#fff;cursor:zoom-in}
  .frame svg{display:block;width:100%;height:auto}
  /* Full size, to judge whether the text actually reads at 1200x630. */
  body.actual .grid{grid-template-columns:1fr}
  body.actual .frame{cursor:zoom-out;width:1200px;max-width:100%}
</style>
<h1>Social preview cards: ${OG_CARDS.length} to approve</h1>
<p class="sub">
  Shown at half size. Click any card, or press <kbd>f</kbd>, to switch the sheet
  to actual 1200x630 size.
</p>
<div class="grid">${cards}</div>
<script>
  const t = () => document.body.classList.toggle('actual');
  addEventListener('click', (e) => { if (e.target.closest('.frame')) t(); });
  addEventListener('keydown', (e) => { if (e.key === 'f') t(); });
</script>
`;

writeFileSync(out, html);
console.log(`Wrote ${OG_CARDS.length} card previews to ${out}`);
