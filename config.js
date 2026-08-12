/* ============================================================================
   Edit this file — it is the only file you need to touch.
   ========================================================================== */

window.TIRANGA_CONFIG = {

  /* Live URL, used in the tweet and the share sheet. Set explicitly rather than
     left blank so a link shared from a Firebase preview channel, or from
     localhost, still points people at production. */
  siteUrl: 'https://harghartiranga-2026.web.app',

  /* Credited in the tweet as "Made by @handle". Without the @. */
  twitterHandle: 'sidtweeted',

  /* ── The shared, live hoist counter and wall of names ──────────────────────
     This talks to the Firestore REST API — no SDK, no build step. The apiKey is
     a public browser key and is safe to commit: access is controlled by
     firestore.rules, not by the key.

     Leave projectId blank and the app still works completely; it just keeps the
     count on each visitor's own device instead of sharing one.               */
  firebase: {
    projectId: 'harghartiranga-2026',
    apiKey: 'AIzaSyCSfttVYUVMA4kqiHftq4gZ7cQkYVsBnJQ',
    collection: 'hoists',
  },
};
