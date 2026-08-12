/* ============================================================================
   HoistStore — the shared hoist counter and wall of names.

   Talks to the Firestore REST API with plain fetch. That is deliberate: the
   Firebase JS SDK is ~300KB for what amounts to three HTTP calls, and pulling
   it in would force a bundler onto a project that otherwise has no build step.

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

  const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const LS_LOCAL_COUNT = 'tiranga.localHoists';
  const LS_LAST_WRITE = 'tiranga.lastWrite';
  const WRITE_COOLDOWN_MS = 60_000; // one recorded hoist per browser per minute

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
      const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}key=${KEY}`, {
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

  /* ------------------------------------------------------------------- API */

  return {
    /** True when a shared counter is configured. The UI hides the global
     *  counter when this is false rather than showing a number that is only
     *  true for one browser. */
    remote: REMOTE,

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

    /** The most recent names, newest first. Empty array on any failure. */
    async recent(limit = 8) {
      if (!REMOTE) return [];
      try {
        const data = await post('/:runQuery', {
          structuredQuery: {
            from: [{ collectionId: COLL }],
            orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }],
            limit,
          },
        });
        return (Array.isArray(data) ? data : [])
          .map((row) => row?.document?.fields?.name?.stringValue)
          .filter((n) => typeof n === 'string' && n.length);
      } catch {
        return [];
      }
    },

    /**
     * Record one hoist. Always bumps the local tally so the certificate has a
     * number even offline. Returns the new global total when known.
     */
    async record(name) {
      ls.set(LS_LOCAL_COUNT, localCount() + 1);

      if (!REMOTE) return { ok: false, total: null };

      const last = Number(ls.get(LS_LAST_WRITE, '0')) || 0;
      if (Date.now() - last < WRITE_COOLDOWN_MS) {
        return { ok: false, total: await this.count(), throttled: true };
      }

      try {
        const now = new Date();
        await post(`/${COLL}`, {
          fields: {
            name: { stringValue: name.slice(0, 28) },
            at: { timestampValue: now.toISOString() },
            day: { stringValue: now.toISOString().slice(0, 10) },
          },
        });
        ls.set(LS_LAST_WRITE, Date.now());
        return { ok: true, total: await this.count() };
      } catch {
        return { ok: false, total: null };
      }
    },
  };
})();
