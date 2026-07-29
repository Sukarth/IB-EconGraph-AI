/**
 * Rasterise the social preview cards to public/og/*.png.
 *
 *   node scripts/og-render.mjs
 *
 * Deliberately NOT part of `npm run build`. The cards are set in Inter, which
 * is installed on the machine these were designed and approved on but not on
 * Vercel's build image, so rendering during the build would quietly ship a
 * different typeface. The PNGs are committed instead, and this script is only
 * re-run when a card changes.
 *
 * Headless Chrome does the rendering because it is already a dependency of
 * nobody: no npm package to install, and it resolves system fonts the same way
 * the browser preview does, so what was approved is what gets written.
 */

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { OG_CARDS } from './og-pages.mjs';
import { renderOgSvg, OG_SIZE } from './og-template.mjs';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'og');

const CHROME_CANDIDATES = [
    join(process.env.ProgramFiles ?? '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
];

function findChrome() {
    const found = CHROME_CANDIDATES.find((p) => p && existsSync(p));
    if (!found) {
        console.error(
            'og-render: could not find Chrome. Set CHROME_PATH, or render the cards by hand ' +
            'from the preview sheet (node scripts/og-preview.mjs out.html).',
        );
        process.exit(1);
    }
    return found;
}

const chrome = process.env.CHROME_PATH ?? findChrome();

// Chrome refuses to share a profile with a running instance, and this must not
// disturb the user's own browser, so give it a scratch profile of its own.
const profile = join(tmpdir(), `og-render-${process.pid}`);
const staging = join(tmpdir(), `og-cards-${process.pid}`);
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(staging, { recursive: true });

/** The card, alone on a page at exactly its own size, so the shot needs no crop. */
function pageFor(svg) {
    return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#fff}
  svg{display:block;width:${OG_SIZE.width}px;height:${OG_SIZE.height}px}
</style>
${svg}`;
}

let written = 0;
const failures = [];

for (const card of OG_CARDS) {
    const htmlPath = join(staging, `${card.name}.html`);
    const pngPath = join(OUT_DIR, `${card.name}.png`);
    writeFileSync(htmlPath, pageFor(renderOgSvg(card.spec)));

    try {
        await execFileAsync(chrome, [
            '--headless',
            '--disable-gpu',
            '--hide-scrollbars',
            // Anything other than 1 silently doubles the pixel dimensions.
            '--force-device-scale-factor=1',
            `--window-size=${OG_SIZE.width},${OG_SIZE.height}`,
            `--user-data-dir=${profile}`,
            '--virtual-time-budget=3000',
            `--screenshot=${pngPath}`,
            pathToFileURL(htmlPath).href,
        ]);
    } catch (err) {
        failures.push(`${card.name}: chrome exited with ${err.code ?? err.message}`);
        continue;
    }

    // Chrome reports success even when it has written nothing useful, so check
    // the file rather than the exit code.
    if (!existsSync(pngPath) || statSync(pngPath).size < 1024) {
        failures.push(`${card.name}: no usable PNG written`);
        continue;
    }
    written += 1;
    console.log(`  ${card.name}.png  ${(statSync(pngPath).size / 1024).toFixed(0)} kB`);
}

rmSync(staging, { recursive: true, force: true });
rmSync(profile, { recursive: true, force: true });

if (failures.length > 0) {
    console.error(`\nog-render: ${failures.length} card(s) failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
}

console.log(`\nWrote ${written} cards to public/og/ at ${OG_SIZE.width}x${OG_SIZE.height}.`);
