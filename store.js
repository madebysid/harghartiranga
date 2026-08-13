/* ============================================================================
   HoistStore — the shared hoist counter.

   Two operations, and neither of them involves a name:

     snapshot()   read the count, from a static file published by CI. This is
                  what every visitor does, and it costs no Firestore reads.
     hoist()      record one hoist, the moment the button is pressed.

   Names never come here. Somebody types a name to put on their own certificate
   and into their own share message, and it stays in their browser. Storing it
   would have meant a public wall of user-supplied text on the site, which is the
   one risk no security rule can defend against — a rule can refuse a link or a
   phone number, but not an offensive name. Dropping it also halves the writes.

   Talks to the Firestore REST API with plain fetch. That is deliberate: the
   Firebase JS SDK is ~300KB for what amounts to two HTTP calls, and pulling it
   in would force a bundler onto a project that otherwise has no build step.

   If config.js has no projectId, every method still resolves — the counter just
   falls back to this browser's own localStorage tally. Nothing here ever throws
   into the ceremony.
   ========================================================================== */

window.HoistStore = (() => {
  const CFG = (window.TIRANGA_CONFIG || {}).firebase || {};
  const PROJECT = (CFG.projectId || '').trim();
  const KEY = (CFG.apiKey || '').trim();
  const COLL = (CFG.collection || 'hoists').trim();
  const REMOTE = Boolean(PROJECT && KEY);

  const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const LS_LOCAL_COUNT = 'tiranga.localHoists';
  const LS_LAST_WRITE = 'tiranga.lastWrite';

  /* Only long enough to swallow a double-tap or a held key. A full ceremony
     takes about six seconds, so a real hoist never runs into this — earlier
     this was 60s, which silently dropped every hoist after the first and made
     the counter look frozen. */
  const WRITE_COOLDOWN_MS = 2500;

  /* --------------------------------------------------------------- helpers */

  const ls = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : v; }
      catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } },
  };

  async function post(path, body, timeoutMs = 6000) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}${path}?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`firestore ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const localCount = () => Number(ls.get(LS_LOCAL_COUNT, '0')) || 0;

  const cooling = () => Date.now() - (Number(ls.get(LS_LAST_WRITE, '0')) || 0) < WRITE_COOLDOWN_MS;

  /* ------------------------------------------------------------------- API */

  return {
    /** True when a shared counter is configured. The UI hides the global
     *  counter when this is false rather than showing a number that is only
     *  true for one browser. */
    remote: REMOTE,

    /**
     * The count as of the last CI snapshot — one static file from the CDN, and
     * no Firestore reads at all.
     *
     * This is the normal path. Reading Firestore from every browser cost about
     * 34 reads a visitor, and far more as the collection grew, because a count()
     * aggregation is billed per thousand documents matched: at a hundred
     * thousand records it was 232 a visitor and the free daily allowance was
     * gone after two hundred people. A snapshot costs one cached GET.
     *
     * @returns {Promise<{count:number, at:string}|null>}
     */
    async snapshot() {
      try {
        const url = (window.TIRANGA_CONFIG?.wallUrl || '').trim() || 'wall.json';
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data?.count !== 'number') return null;
        return { count: data.count, at: typeof data.at === 'string' ? data.at : '' };
      } catch {
        return null;
      }
    },

    /**
     * Total hoists ever, straight from Firestore. Only used when the snapshot is
     * unreachable, and by the CI job that writes the snapshot.
     */
    async count() {
      if (!REMOTE) return null;
      try {
        const data = await post('/:runAggregationQuery', {
          structuredAggregationQuery: {
            structuredQuery: { from: [{ collectionId: COLL }] },
            aggregations: [{ alias: 'total', count: {} }],
          },
        });
        const raw = data?.[0]?.result?.aggregateFields?.total?.integerValue;
        return raw == null ? null : Number(raw);
      } catch {
        return null;
      }
    },

    /**
     * Record one hoist, the moment the button is pressed — not when a name is
     * typed. Most people never type one, and they hoisted the flag all the same.
     *
     * Always bumps the local tally so the certificate has a number offline.
     */
    async hoist() {
      ls.set(LS_LOCAL_COUNT, localCount() + 1);

      if (!REMOTE) return { ok: false };
      if (cooling()) return { ok: false, throttled: true };

      try {
        const now = new Date().toISOString();
        await post(`/${COLL}`, {
          fields: {
            at: { timestampValue: now },
            day: { stringValue: now.slice(0, 10) },
          },
        });
        ls.set(LS_LAST_WRITE, Date.now());
        /* No count() afterwards. It was an extra aggregation read per hoist, and
           the caller already knows to add one locally — which is both cheaper and
           more responsive than waiting for a round trip to tell it what it just
           did. */
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
  };
})();
