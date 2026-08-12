/* ============================================================================
   Edit this file — it is the only file you need to touch.
   Everything here is optional: with all of it blank the app still works fully,
   it just keeps the hoist count on the visitor's own device instead of shared.
   ========================================================================== */

window.TIRANGA_CONFIG = {

  /* Your live URL, used in the tweet and the share sheet.
     Leave blank to use whatever address the page is being served from —
     which is correct in almost every case. */
  siteUrl: '',

  /* Optional Twitter/X handle to credit, without the @. */
  twitterHandle: '',

  /* ── Optional: a shared, live hoist counter and wall of names ──────────────
     Fill these in to turn on the shared counter. See README.md → "Turn on the
     live counter". No SDK, no build step: this talks to the Firestore REST API.
     The apiKey is a public browser key; it is safe to commit. Access is
     controlled by firestore.rules, not by the key.                          */
  firebase: {
    projectId: '',            // e.g. 'har-ghar-tiranga'
    apiKey: '',               // Firebase console → Project settings → Web API Key
    collection: 'hoists',
  },
};
