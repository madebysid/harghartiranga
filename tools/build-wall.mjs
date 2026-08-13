/* ============================================================================
   build-wall.mjs — snapshots the hoist count into wall.json, so that a visitor's
   page load costs no Firestore reads at all.

   It used to publish a list of names too. Names are no longer stored: they stay
   in the browser that typed them, so there is nothing to publish but the number.

   Run from CI on a schedule (.github/workflows/wall.yml). Every visitor used to
   query Firestore directly, which is fine until it isn't: a count() aggregation
   is billed one read per thousand documents matched, so at a hundred thousand
   records each visitor cost about 232 reads and the free 50,000-a-day allowance
   was gone after roughly two hundred people. Worse, the cost per visitor grew
   with the collection — the app got more expensive the better it did.

   Reading once per cron tick instead moves that cost from O(visitors) to O(1).
   The price is that the number is a few minutes stale, which nobody notices:
   app.js adds the visitor's own hoist to the displayed total the moment they
   press the button, so their own action is always reflected immediately.

   Deliberately fails without writing anything if Firestore cannot be reached.
   A stale wall.json is a working site; a truncated one is a broken counter.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);

/* config.js is a browser file, and it is the single source of truth for the
   project id. Running it against a stand-in window is how this reads it without
   a second copy of those values drifting out of step. */
async function config() {
  const src = await readFile(new URL('config.js', ROOT), 'utf8');
  const fake = {};
  new Function('window', src)(fake);
  const cfg = fake.TIRANGA_CONFIG?.firebase || {};
  if (!cfg.projectId || !cfg.apiKey) throw new Error('config.js has no Firebase project');
  return {
    project: cfg.projectId.trim(),
    key: cfg.apiKey.trim(),
    collection: (cfg.collection || 'hoists').trim(),
  };
}

async function query(cfg, endpoint, body) {
  const base = `https://firestore.googleapis.com/v1/projects/${cfg.project}/databases/(default)/documents`;
  const res = await fetch(`${base}${endpoint}?key=${cfg.key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${endpoint} returned ${res.status} ${await res.text()}`);
  return res.json();
}

async function count(cfg) {
  const data = await query(cfg, '/:runAggregationQuery', {
    structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: cfg.collection }] },
      aggregations: [{ alias: 'total', count: {} }],
    },
  });
  const raw = data?.[0]?.result?.aggregateFields?.total?.integerValue;
  if (raw == null) throw new Error('no count in the aggregation response');
  return Number(raw);
}

const cfg = await config();
const total = await count(cfg);

const target = new URL('wall.json', ROOT);

/* Leave the file alone when nothing has actually changed. The timestamp would
   differ on every run otherwise, and this runs every ten minutes — that is 144
   commits and 144 rebuilds a day to publish identical numbers. */
const previous = await readFile(target, 'utf8').then(JSON.parse).catch(() => null);
const same = previous && previous.count === total;

if (same) {
  console.log(`unchanged: count=${total} — not rewriting`);
} else {
  /* `count` is the raw number of records. The seed in config.js is a display
     concern and is added in the browser, so this file stays the honest figure. */
  const wall = { count: total, at: new Date().toISOString() };
  await writeFile(target, `${JSON.stringify(wall, null, 2)}\n`);
  console.log(`wall.json written: count=${total}`);
}
