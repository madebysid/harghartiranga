/* ============================================================================
   HoistStore — the shared hoist counter and wall of names.

   Talks to the Firestore REST API with plain fetch. That is deliberate: the
   Firebase JS SDK is ~300KB for what amounts to four HTTP calls, and pulling it
   in would force a bundler onto a project that otherwise has no build step.

   A hoist is recorded in two moves, because those are two different moments:

     hoist()      the button was pressed — write the record now, nameless.
     sign(name)   a name was typed afterwards — patch it onto that same record.

   Counting at the press is the whole point: most people never type a name, and
   a counter that only counts signatures undercounts the thing it claims to
   measure. Patching rather than writing a second document is what keeps one
   person from counting twice.

   If config.js has no projectId, every method still resolves — the counter just
   falls back to this browser's own localStorage tally and the wall stays empty.
   Nothing here ever throws into the ceremony.
   ========================================================================== */

window.HoistStore = (() => {
  const CFG = (window.TIRANGA_CONFIG || {}).firebase || {};
  const PROJECT = (CFG.projectId || '').trim();
  const KEY = (CFG.apiKey || '').trim();
  const COLL = (CFG.collection || 'hoists').trim();
  const REMOTE = Boolean(PROJECT && KEY);

  const ROOT = 'https://firestore.googleapis.com/v1';
  const BASE = `${ROOT}/projects/${PROJECT}/databases/(default)/documents`;
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

  async function send(method, url, body, timeoutMs = 6000) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${KEY}`, {
        method,
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

  const post = (path, body, timeoutMs) => send('POST', `${BASE}${path}`, body, timeoutMs);

  const localCount = () => Number(ls.get(LS_LOCAL_COUNT, '0')) || 0;

  const cooling = () => Date.now() - (Number(ls.get(LS_LAST_WRITE, '0')) || 0) < WRITE_COOLDOWN_MS;

  /** The document this browser is holding open for a name, if any. */
  let pending = null; // full resource name: projects/…/documents/hoists/ID

  /**
   * A record's fields. `signedAt` is present only once there is a name, which is
   * what makes the wall query cheap: an orderBy on a field skips every document
   * that does not have it, so asking for the last 12 signatures reads 12
   * documents instead of trawling the nameless hoists in front of them.
   */
  function fields(name) {
    const now = new Date().toISOString();
    const out = {
      name: { stringValue: String(name || '').slice(0, 28) },
      at: { timestampValue: now },
      day: { stringValue: now.slice(0, 10) },
    };
    if (out.name.stringValue) out.signedAt = { timestampValue: now };
    return { fields: out };
  }

  /* ------------------------------------------------------------------- API */

  return {
    /** True when a shared counter is configured. The UI hides the global
     *  counter when this is false rather than showing a number that is only
     *  true for one browser. */
    remote: REMOTE,

    /**
     * The count and the wall as of the last CI snapshot — one static file from
     * the CDN, and no Firestore reads at all.
     *
     * This is the normal path. Reading Firestore from every browser cost about
     * 34 reads a visitor, and far more as the collection grew, because a count()
     * aggregation is billed per thousand documents matched: at a hundred
     * thousand records it was 232 a visitor and the free daily allowance was
     * gone after two hundred people. A snapshot costs one cached GET.
     *
     * @returns {Promise<{count:number, names:string[], at:string}|null>}
     */
    async snapshot() {
      try {
        const url = (window.TIRANGA_CONFIG?.wallUrl || '').trim() || 'wall.json';
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data?.count !== 'number') return null;
        return {
          count: data.count,
          names: Array.isArray(data.names) ? data.names.filter((n) => typeof n === 'string' && n.trim()) : [],
          at: typeof data.at === 'string' ? data.at : '',
        };
      } catch {
        return null;
      }
    },

    /** Total hoists ever, or null if it cannot be determined. */
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
     * The most recent names, newest first. Empty array on any failure.
     *
     * Ordered by `signedAt`, which only signed records carry, so Firestore skips
     * the nameless hoists server-side. Ordering by `at` instead meant reading 80
     * documents to find ten names — 240 reads for one visitor across the three
     * times this runs — which is most of a day's free quota every few hundred
     * visitors. The small overshoot is only to survive de-duplication.
     */
    async recent(limit = 12) {
      if (!REMOTE) return [];
      try {
        const data = await post('/:runQuery', {
          structuredQuery: {
            from: [{ collectionId: COLL }],
            orderBy: [{ field: { fieldPath: 'signedAt' }, direction: 'DESCENDING' }],
            limit: limit + 6,
          },
        });
        const seen = new Set();
        const names = [];
        for (const row of Array.isArray(data) ? data : []) {
          const name = row?.document?.fields?.name?.stringValue;
          if (typeof name !== 'string' || !name.trim()) continue;
          const key = name.toLocaleLowerCase();
          if (seen.has(key)) continue; // one line per person, not per hoist
          seen.add(key);
          names.push(name);
          if (names.length >= limit) break;
        }
        return names;
      } catch {
        return [];
      }
    },

    /**
     * Record one hoist, the moment the button is pressed. Always bumps the
     * local tally so the certificate has a number even offline.
     *
     * @returns {Promise<{ok:boolean, total:number|null}>} the new global total
     *          when known.
     */
    async hoist() {
      ls.set(LS_LOCAL_COUNT, localCount() + 1);
      pending = null;

      if (!REMOTE) return { ok: false, total: null };
      if (cooling()) return { ok: false, total: await this.count(), throttled: true };

      try {
        const doc = await post(`/${COLL}`, fields(''));
        ls.set(LS_LAST_WRITE, Date.now());
        pending = doc?.name || null;
        /* No count() afterwards. It was an extra aggregation read per hoist, and
           the caller already knows to add one locally — which is both cheaper and
           more responsive than waiting for a round trip to tell it what it just
           did. */
        return { ok: true, total: null };
      } catch {
        return { ok: false, total: null };
      }
    },

    /**
     * Put a name on this browser's most recent hoist. Does not change the
     * total — the hoist itself was already counted.
     *
     * If the patch fails (rules not yet deployed, record never written because
     * the network was down at the time) it falls back to writing a fresh named
     * record, so a signature is never lost. That path can count one hoist
     * twice, which is the right way round: better a name recorded than a
     * perfectly clean tally.
     */
    async sign(name) {
      const clean = String(name || '').trim().slice(0, 28);
      if (!REMOTE || !clean) return { ok: false, total: null };

      if (pending) {
        try {
          const mask = 'updateMask.fieldPaths=name&updateMask.fieldPaths=signedAt';
          await send('PATCH', `${ROOT}/${pending}?${mask}`, fields(clean));
          pending = null;
          return { ok: true, total: null };
        } catch { /* fall through to writing a new record */ }
      }

      try {
        await post(`/${COLL}`, fields(clean));
        ls.set(LS_LAST_WRITE, Date.now());
        /* This path wrote a second record, so the true total is one higher than
           the caller thinks. It corrects itself at the next CI snapshot, which is
           the right trade for not spending an aggregation read on every
           signature. */
        return { ok: true, total: null, fresh: true };
      } catch {
        return { ok: false, total: null };
      }
    },
  };
})();
