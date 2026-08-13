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

  /* Where to read the hoist count and the wall of names from. Blank means
     wall.json next to index.html, which is right for any single-host setup.

     Point it elsewhere when the app is served from a host that charges for
     rebuilds. Cloudflare Pages allows 500 builds a month and rebuilds on every
     push, so the ten-minute refresh commit — about 4,300 a month — would use the
     allowance up in four days. Serving the app from Cloudflare while this one
     small file comes from GitHub Pages costs nothing on either side: Pages
     rebuilds are effectively unlimited, and the file is under 100 bytes.

     Cross-origin, so the host has to be named in connect-src in both _headers
     and firebase.json. If the fetch fails for any reason the app falls back to
     querying Firestore directly, which is correct but costs reads. */
  wallUrl: '',

  /* Added to the hoist count everywhere it is shown, so the tally does not open
     at zero. Real hoists are counted honestly on top of it, and this number
     never changes — set it once and leave it, or the total will appear to jump
     around between visitors.

     Be aware this is what it is: the displayed figure is this plus the true
     count, so it is higher than the number of people who have actually hoisted.
     Set it to 0 for the real number. */
  seedCount: 2731,

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
