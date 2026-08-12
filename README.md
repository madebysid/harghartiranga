# Hoist the Tiranga

A one-click flag hoisting for Indian Independence Day. The Union Jack comes down,
the Tiranga goes up furled, unfurls at the top and releases flower petals, the
sky turns from pre-dawn to sunrise. Then you sign it with your name and tweet it.

Live in one command. No build step, no dependencies, no framework.

```
index.html          markup and social-preview meta
styles.css          the whole visual system
app.js              ceremony sequencer, share flow
config.js           ← the only file you need to edit
store.js            optional shared hoist counter (Firestore over REST)
certificate.js      the 1080×1350 shareable PNG, drawn on a canvas
flags/*.svg         the two flags
og.png              social preview card
tools/              regenerates the flags, favicon and og.png
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

## Regenerating the artwork

```bash
node tools/build-assets.mjs
```

Rewrites `flags/tiranga.svg`, `flags/union-jack.svg`, `favicon.svg` and `og.png`.
The output is committed, so you only need this if you change the geometry. It has
no dependencies — the PNG encoder is built on `node:zlib`.

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

**The cloth is 40 vertical strips** of the same SVG, each offset so the slices
reassemble into a whole flag, each animating on a delay to make a travelling
wave. Amplitude ramps from zero at the hoist edge outward, because that edge is
clamped to the pole.

**Accessibility.** Full keyboard path, a live region that narrates each stage of
the ceremony, and a `prefers-reduced-motion` path that collapses the ceremony to
about a second with no petals and no waving.

**Sound is off by default** and synthesised with WebAudio when switched on — rope
through a pulley, the crack of cloth, a bell at the top. No audio files.
