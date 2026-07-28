// Maintainer script: refresh the Supporters section of README.md from the
// database. Requires the Supabase secret key — run locally, then commit the diff:
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/update-supporters.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
    process.exit(1);
}

const README = join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');
const START = '<!-- SUPPORTERS:START -->';
const END = '<!-- SUPPORTERS:END -->';

const supabase = createClient(url, key, { auth: { persistSession: false } });

// PostgREST caps a response at `db-max-rows` (1000 by default), so a single
// query silently drops everyone past the cap: the newest supporters would just
// stop appearing in the README once the list got long enough. Page until a
// short page comes back.
const PAGE_SIZE = 1000;
const now = new Date().toISOString();
const data = [];
for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error } = await supabase
        .from('profiles')
        .select('supporter_name, pro_until, created_at')
        .eq('show_in_supporters', true)
        .not('supporter_name', 'is', null)
        .gt('pro_until', now)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

    if (error) {
        console.error('Query failed:', error.message);
        process.exit(1);
    }
    data.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
}

const names = data
    .map((row) => row.supporter_name?.trim())
    .filter((name) => name && name.length <= 50)
    // Markdown-escape to keep the README safe from user-controlled input.
    .map((name) => name.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, (c) => `\\${c}`));

const block = names.length > 0
    ? names.map((n) => `**${n}**`).join(' · ')
    : '*Become the first. See the [Supporter plan](https://ib-econgraph-ai.vercel.app/pricing).*';

const readme = readFileSync(README, 'utf8');
const startIdx = readme.indexOf(START);
const endIdx = readme.indexOf(END);
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.error(`Markers ${START} / ${END} not found in README.md.`);
    process.exit(1);
}

const updated =
    readme.slice(0, startIdx + START.length) +
    '\n\n' + block + '\n\n' +
    readme.slice(endIdx);

writeFileSync(README, updated);
console.log(`Updated README with ${names.length} supporter(s).`);
