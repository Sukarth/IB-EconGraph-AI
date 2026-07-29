/**
 * The declarative diagram spec renderer, shared by the SEO pages and the social
 * preview cards so both draw the same diagram from the same source.
 *
 * Lives apart from generate-seo-pages.mjs because that file is a script: it
 * writes dist/ as a side effect of being imported, so nothing else can pull a
 * function out of it without triggering a build.
 */

export const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Render label text with _x subscripts / ^x superscripts as SVG tspans. */
export function svgLabel(text) {
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
export function renderDiagramSvg(page) {
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
