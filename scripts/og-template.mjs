/**
 * Social preview cards (Open Graph / Twitter), 1200x630.
 *
 * Pure SVG with no external references, so the same source renders identically
 * in a browser preview and in whatever rasterises it. Nested <svg> is how the
 * per-page diagram gets embedded: the diagram renderer already emits a complete
 * 520x360 SVG, and nesting lets it keep its own coordinate space.
 *
 * SVG text does not wrap, so titles are broken into tspans here. Widths are
 * estimated from the font size rather than measured, which is fine for a fixed
 * set of known strings that can be eyeballed in the preview sheet.
 */

const W = 1200;
const H = 630;

const FONT = "Inter,'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Greedy wrap by estimated width. Inter's bold lowercase averages a little over
 * half the font size per character; 0.54 leaves enough slack that a line of
 * wide capitals still fits the column.
 */
function wrapText(text, fontSize, maxWidth) {
    const perChar = fontSize * 0.54;
    const maxChars = Math.max(8, Math.floor(maxWidth / perChar));
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function tspans(lines, x, startY, lineHeight) {
    return lines
        .map((l, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${esc(l)}</tspan>`)
        .join('');
}

/** The wordmark, matching the site header: gradient tile plus the name. */
function brandRow(x, y) {
    return `
  <g transform="translate(${x} ${y})">
    <rect width="44" height="44" rx="12" fill="url(#brand)"/>
    <path d="M12 30 L20 20 L26 25 L33 14" fill="none" stroke="#fff" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
    <text x="58" y="22" font-family="${FONT}" font-size="21" font-weight="700" fill="#111827">IB EconGraph AI</text>
    <text x="58" y="41" font-family="${FONT}" font-size="16" font-weight="500" fill="#64748b">ib-econgraph-ai.vercel.app</text>
  </g>`;
}

/** A pill, used for the free/no-watermark claims along the bottom. */
function badge(x, y, label) {
    const w = 22 + label.length * 9.1;
    return `
  <g transform="translate(${x} ${y})">
    <rect width="${w}" height="38" rx="19" fill="#eff6ff" stroke="#bfdbfe"/>
    <text x="${w / 2}" y="25" font-family="${FONT}" font-size="15" font-weight="600"
          fill="#1d4ed8" text-anchor="middle">${esc(label)}</text>
  </g>`;
}

/**
 * @param {object} o
 * @param {string} o.eyebrow      small uppercase kicker
 * @param {string} o.title        the headline
 * @param {string} [o.subtitle]   one supporting line
 * @param {string[]} [o.badges]   pills along the bottom
 * @param {string} [o.diagramSvg] a complete <svg> to nest on the right
 */
export function renderOgSvg({ eyebrow, title, subtitle, badges = [], diagramSvg = '' }) {
    // A diagram on the right narrows the text column. A checklist takes the same
    // space, so only a card with neither runs the full width.
    const hasArt = Boolean(diagramSvg);
    const textWidth = hasArt ? 560 : badges.length ? 600 : 900;
    const titleSize = hasArt ? 54 : 58;

    const titleLines = wrapText(title, titleSize, textWidth);
    const titleTop = 214 - (titleLines.length - 1) * (titleSize * 0.58);
    const subtitleLines = subtitle ? wrapText(subtitle, 25, textWidth) : [];
    const subtitleTop = titleTop + (titleLines.length - 1) * (titleSize * 1.16) + 62;

    // With a diagram on the right the claims sit along the bottom. Without one
    // they move into that space as a checklist, which fills the right half
    // instead of leaving a hole in the middle of the card.
    let claims = '';
    if (hasArt) {
        let bx = 72;
        for (const b of badges) {
            claims += badge(bx, 498, b);
            bx += 22 + b.length * 9.1 + 12;
        }
    } else {
        const top = 315 - ((badges.length - 1) * 64) / 2;
        claims = badges
            .map(
                (b, i) => `
  <g transform="translate(700 ${top + i * 64})">
    <circle cx="20" cy="20" r="20" fill="#eff6ff" stroke="#bfdbfe"/>
    <path d="M12 20.5 L17.5 26 L28 15" fill="none" stroke="#2563eb" stroke-width="3.2"
          stroke-linecap="round" stroke-linejoin="round"/>
    <text x="56" y="28" font-family="${FONT}" font-size="26" font-weight="600"
          fill="#334155">${esc(b)}</text>
  </g>`,
            )
            .join('');
    }

    const art = hasArt
        ? `
  <g transform="translate(672 132)">
    <rect x="-14" y="-14" width="484" height="362" rx="22" fill="#ffffff" stroke="#e2e8f0"/>
    <svg x="0" y="0" width="456" height="334" viewBox="0 0 520 360">${diagramSvg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>
  </g>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/><stop offset="0.55" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#eef2ff"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0 H0 V40" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.5"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#wash)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="10" fill="url(#brand)"/>

  <text x="72" y="${titleTop - 52}" font-family="${FONT}" font-size="19" font-weight="700"
        fill="#2563eb" letter-spacing="2.4">${esc(eyebrow.toUpperCase())}</text>

  <text font-family="${FONT}" font-size="${titleSize}" font-weight="800" fill="#0f172a"
        letter-spacing="-1">${tspans(titleLines, 72, titleTop, titleSize * 1.16)}</text>

  ${subtitle
        ? `<text font-family="${FONT}" font-size="25" font-weight="450" fill="#475569">${tspans(
              subtitleLines,
              72,
              subtitleTop,
              34,
          )}</text>`
        : ''}

  ${claims}
  ${art}
  ${brandRow(72, 556)}
</svg>`;
}

export const OG_SIZE = { width: W, height: H };
