# Hoist the Tiranga

A one-click flag hoisting for Indian Independence Day. The Union Jack comes down,
the Tiranga goes up furled, unfurls at the top and releases flower petals, the
sky turns from pre-dawn to sunrise. Then you sign it with your name and tweet it.

**Live: https://harghartiranga-2026.web.app**

Installable, works offline. No build step, no dependencies, no framework.

```
index.html            markup, social preview, PWA head
styles.css            the whole visual system
config.js             ← the only file you need to edit

app.js                ceremony sequencer, share flow, install prompt
anthem.js             Jana Gana Mana, two entry points from one file
ticker.js             one shared requestAnimationFrame loop
cloth.js              the waving flag, drawn per-column on a canvas
celebrate.js          confetti, streamers and flower petals
store.js              optional shared hoist counter (Firestore over REST)
certificate.js        the 1080×1350 shareable PNG, drawn on a canvas

manifest.webmanifest  installable-app metadata
sw.js                 service worker: offline, cache strategy

flags/*.svg           the two flags
fort-wall.svg         tiling Red Fort curtain wall
fort-gate.svg         the Lahori Gate
icons/                app icons (192, 512, maskable, apple-touch)
anthem.mp3            the anthem, ID3 artwork stripped
og.png                social preview card
tools/                regenerates every image above
```

---

## Run it locally

Any static server. It cannot be opened as a `file://` URL, because the browser
blocks the SVG background images and the canvas certificate under that origin.

```bash
npx http-server . -p 8123 -c-1
# → http://127.0.0.1:8123
```

---

## Put it on the internet

Pick one. All three serve the same files; there is nothing to compile.

### Option A — Firebase Hosting (fastest, free `*.web.app` domain + SSL + CDN)

**First, in this shell only,** clear the stray service-account credential — it is
set machine-wide to an `ainsta-1ef10` key, and the Firebase CLI silently prefers
it over your login, which deploys to the wrong project:

```bash
unset GOOGLE_APPLICATION_CREDENTIALS      # PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS=""
```

Then:

```bash
firebase login --reauth                   # the saved token has expired
firebase projects:create hoist-the-tiranga    # or reuse a project you already have
firebase use hoist-the-tiranga
firebase deploy --only hosting
```

Live at `https://hoist-the-tiranga.web.app`.

### Option B — GitHub Pages

`.github/workflows/deploy.yml` is already set up and needs no secrets.

```bash
gh repo create hoist-the-tiranga --public --source=. --push
```

Then **Settings → Pages → Source → GitHub Actions**. Every push to `main`
republishes. Live at `https://<your-username>.github.io/hoist-the-tiranga/`.

### Option C — Netlify

Drag this folder onto <https://app.netlify.com/drop>. Done, no account needed to
start.

---

## After you deploy: two one-line touch-ups

**1. Absolute social-preview URL.** WhatsApp, Twitter and iMessage previews are
more reliable with an absolute `og:image`. In `index.html`, change the two
relative `og.png` values to your real URL:

```html
<meta property="og:image" content="https://hoist-the-tiranga.web.app/og.png">
<meta name="twitter:image" content="https://hoist-the-tiranga.web.app/og.png">
```

**2. Nothing else.** `config.js` derives the share link from whatever address the
page is served from, so tweets and shared links are correct with it left blank.

---

## Turn on the live counter (optional)

Without this the app works completely; it just has no shared count and no wall of
names. With it you get "12,481 flags hoisted here so far", a hoist number on each
certificate, and the most recent names.

1. Firebase console → your project → **Firestore Database → Create database**,
   production mode, region `asia-south1` (Mumbai).
2. **Project settings → General → Web API Key.** Copy it.
3. Fill in `config.js`:

   ```js
   firebase: {
     projectId: 'hoist-the-tiranga',
     apiKey: 'AIza...',
     collection: 'hoists',
   },
   ```

4. Publish the rules, which are already written for this schema:

   ```bash
   firebase deploy --only firestore:rules,hosting
   ```

The API key in `config.js` is a public browser key and is safe to commit —
`firestore.rules` is what controls access, not the key.

**How it talks to Firestore.** Plain `fetch` against the Firestore REST API:
`:runAggregationQuery` for the count, `:runQuery` for recent names, a document
create per hoist. No Firebase SDK, which is why there is no build step. Writes
are throttled to one per browser per minute, and every call fails soft — if
Firestore is unreachable the ceremony and the share buttons carry on as normal.

**If it gets spammed.** Writes are open by design, since there is no sign-in.
Turn on **App Check** (Firebase console → App Check → reCAPTCHA v3) to reject
writes that do not come from your own page.

---

## Installing it as an app

It is a full PWA. On Android and desktop Chrome an "Add to home screen" button
appears in the page once the browser offers the install prompt; on iOS it is
Share → Add to Home Screen. Installed, it opens without browser chrome, keeps its
own icon, and respects the notch and home indicator via `env(safe-area-inset-*)`.

**It works with no connection.** The service worker precaches all 21 files, so
once the page has been opened a single time it opens again on a dead network —
the hoisting, the certificate and the saved image need nothing from a server.
Only the shared counter does.

**One thing to remember on every deploy: bump `VERSION` in `sw.js`.** That is
what drops the old cache. The strategy is split deliberately:

- **Markup, CSS and JS: network-first**, with a 1.8s timeout falling back to
  cache. This is a one-day event, and a cache-first worker would serve a visitor
  whatever they loaded last time — so a fix pushed on the 14th would never reach
  anyone who had already opened the page.
- **Art and fonts: stale-while-revalidate.** Large, rarely changed, and a frame
  of yesterday's flag costs nothing.
- **Firestore is never touched.** A cached hoist count would be a stale number,
  and a cached write would be actively wrong.

---

## The anthem

One file, `anthem.mp3`, played two ways:

- **The hoist** plays from **0:48** — the closing *"Jaya he"* passage, the last 14
  seconds — as the flag unfurls.
- **The button** below the ceremony plays the whole 62 seconds from the top, and
  asks the listener to stand, which is the expected courtesy in India.

Nothing is cut into a second file. The MP3 is CBR with a Xing header, so seeking
is accurate, and the browser range-requests from the seek point rather than
downloading the first 48 seconds only to skip them. The recording sings
continuously with no gap at 0:48, so the hoist fades in over 420ms — otherwise it
starts on an abrupt mid-word attack.

**Sound is on by default**, since the anthem playing as the flag rises is the
point of the thing. The speaker button in the corner mutes everything and the
choice is remembered, so anyone who mutes it stays muted.

The source `National Anthem.mp3` is left untouched on disk but is neither
committed nor deployed: 1.13MB of its 2.5MB was an embedded 1280×1280 cover image.
`anthem.mp3` is the same audio stream copied without it — decoded MD5s match
exactly — at 1.42MB. It is deliberately *not* precached by the service worker;
pushing 1.4MB at someone who may never press play is rude. It caches on first use.

---

## Regenerating the artwork

```bash
node tools/build-assets.mjs
```

Rewrites both flags, the Red Fort wall and gate, the favicon, `og.png` and all
four app icons. The output is committed, so you only need this if you change the
geometry. It has no dependencies — the PNG encoder is hand-rolled on `node:zlib`,
which is also why the app icons can be generated rather than exported by hand and
can never drift out of step with the flag.

---

## Notes on the details

**The ceremony follows the Flag Code of India.** A flag is *lowered slowly and
hoisted briskly*, so the Union Jack takes 3.2s down and the Tiranga 1.8s up. On
Independence Day the Tiranga goes up **furled** and is unfurled at the top,
releasing flower petals — that is the Red Fort sequence, and that is what is
animated. Neither flag is ever brought all the way down to the base, because a
flag must not touch the ground.

**The flags are geometrically correct.** The Tiranga is 3:2 with equal bands, a
24-spoke Ashoka Chakra whose diameter is ¾ of the white band, in BIS saffron
`#FF9933`, India green `#138808` and chakra navy `#000080`. The Union Flag is 1:2
with St Patrick's saltire properly counterchanged.

**The cloth is drawn per-column on a canvas.** The flag SVG is rasterised once,
then every frame it is redrawn as ~140 narrow vertical columns, each displaced,
stretched, compressed and shaded by where it sits in a travelling wave. Four
things happen per column, and it takes all four to read as cloth rather than as a
wobbling picture: displacement; twist, where the top and bottom edges follow the
wave slightly out of phase so the flag's edges undulate independently; horizontal
compression where a fold turns away from the viewer; and shading that tracks the
fold's slope. Costs about 0.2ms a frame — a bit over 1% of a 60fps budget.

This replaced a CSS version that sliced the flag into strips and animated each
one. Strips can only ever move by whole pixels, which showed as stair-stepping
along every diagonal in the Union Flag.

**Confetti has real physics** — gravity, drag, tumble — rather than CSS
keyframes, which cannot express either. Three kinds, because one reads as cheap:
stiff foil rectangles that flash edge-on as they spin, long wobbling streamers,
and the marigold and rose petals released from the furled flag. All on one canvas
sharing a single frame loop with the cloth, which pauses entirely when the scene
is scrolled off screen.

**Accessibility.** Full keyboard path, a live region that narrates each stage of
the ceremony, and a `prefers-reduced-motion` path that collapses the ceremony to
about a second, holds the cloth nearly still, and skips the confetti outright.

**Sound is off by default** and synthesised with WebAudio when switched on — rope
through a pulley, the crack of cloth, a bell at the top. No audio files.
