/* ============================================================================
   Hoist the Tiranga — ceremony sequencer and share flow.

   Phases, in order, driven by data-phase on .stage:
     idle → lower → detach → raise → unfurl → flying
   CSS owns every visual consequence of a phase; this file only advances it and
   moves the carriage.
   ========================================================================== */

(() => {
  'use strict';

  const CFG = window.TIRANGA_CONFIG || {};
  const INDEPENDENCE = 1947;

  const $ = (id) => document.getElementById(id);
  const el = {
    stage: $('stage'), rig: $('rig'), carriage: $('carriage'),
    flagUk: $('flag-uk'), flagIn: $('flag-in'),
    stars: $('stars'), petals: $('petals'),
    sound: $('sound'), skip: $('skip'),
    invite: $('invite'), ordinal: $('ordinal'), yearsAgo: $('years-ago'),
    hoist: $('hoist'), counter: $('counter'),
    stepHoist: $('step-hoist'), stepName: $('step-name'), stepShare: $('step-share'),
    namer: $('namer'), name: $('name'), nameHint: $('name-hint'),
    certName: $('cert-name'), certMeta: $('cert-meta'), certSeal: $('cert-seal'),
    tweet: $('tweet'), share: $('share'), save: $('save'),
    copy: $('copy'), copyLabel: $('copy-label'),
    wall: $('wall'), restart: $('restart'), announce: $('announce'),
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* Matches .carriage { top: 18px } and the gap kept above the pole base. */
  const CARRIAGE_TOP = 18;
  const BASE_GAP = 10;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const timings = () => (reduced.matches
    ? { lower: 420, detach: 160, raise: 380, unfurl: 260 }
    : { lower: 3200, detach: 620, raise: 1800, unfurl: 760 });

  /* ══════════════════════════════════════════════════════════════ the date */

  const now = new Date();
  /* The anniversary that falls in the current calendar year: 2026 → 79 years
     of freedom, which is the 80th Independence Day (1947 was the 1st). */
  const yearsFree = Math.max(1, now.getFullYear() - INDEPENDENCE);

  function ordinalise(n) {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
  }

  el.ordinal.textContent = `${ordinalise(yearsFree + 1)} Independence Day`;
  el.yearsAgo.textContent = `${yearsFree} years`;

  /* ═══════════════════════════════════════════════════════════════ the sky */

  (function seedStars() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span');
      s.style.cssText =
        `left:${(Math.random() * 100).toFixed(2)}%;` +
        `top:${(Math.random() * 88).toFixed(2)}%;` +
        `--s:${(Math.random() * 1.6 + 0.9).toFixed(2)}px;` +
        `--o:${(Math.random() * 0.55 + 0.25).toFixed(2)};` +
        `--d:${(Math.random() * 2600 + 1700).toFixed(0)}ms;` +
        `--dl:${(Math.random() * 2600).toFixed(0)}ms`;
      frag.appendChild(s);
    }
    el.stars.appendChild(frag);
  })();

  /* ══════════════════════════════════════════════════════════ flag fabric */

  /* Peak vertical travel of the free edge, as a fraction of flag height. Strip
     count is what controls how smooth the wave reads: too few and the offsets
     between neighbours show up as stair-steps along the flag edge. */
  const WAVE_AMPLITUDE = 0.075;
  const stripCount = () => (innerWidth < 480 ? 24 : 40);

  function buildFlag(flag, flagW, flagH) {
    const n = stripCount();
    flag.textContent = '';
    flag.style.setProperty('--strip-w', `${(flagW / n).toFixed(3)}px`);

    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      /* The hoist edge is clamped to the pole, so amplitude has to start at
         zero there and grow toward the free edge. */
      const ramp = Math.pow(i / (n - 1), 1.22);
      const strip = document.createElement('span');
      strip.className = 'flag__strip';
      strip.style.setProperty('--i', String(i));
      strip.style.setProperty('--amp', `${(flagH * WAVE_AMPLITUDE * ramp).toFixed(2)}px`);
      strip.style.setProperty('--sh', (0.16 * ramp).toFixed(3));
      frag.appendChild(strip);
    }
    flag.appendChild(frag);
  }

  function geometry() {
    const flagW = el.flagUk.getBoundingClientRect().width;
    return { flagW, ukH: flagW / 2, inH: flagW / 1.5, rigH: el.rig.clientHeight };
  }

  function layout() {
    const g = geometry();
    if (!g.flagW) return;
    buildFlag(el.flagUk, g.flagW, g.ukH);
    buildFlag(el.flagIn, g.flagW, g.inH);
  }

  /* ═════════════════════════════════════════════════════════════ carriage */

  /* One low position for both flags, sized off the taller of the two. The
     shorter Union Flag therefore stops a little further above the base — which
     is also what the Flag Code wants: a flag must never touch the ground. It
     also means nothing has to jump when the flags are swapped over. */
  const loweredY = () => {
    const { inH, rigH } = geometry();
    return Math.max(0, rigH - CARRIAGE_TOP - inH - BASE_GAP);
  };

  function glideCarriage(y, ms, easing) {
    el.carriage.style.transition = `transform ${ms}ms ${easing}`;
    el.carriage.style.setProperty('--carriage-y', `${y.toFixed(1)}px`);
  }

  function snapCarriage(y) {
    el.carriage.style.transition = 'none';
    el.carriage.style.setProperty('--carriage-y', `${y.toFixed(1)}px`);
    void el.carriage.offsetHeight; // flush, so the next transition starts here
  }

  const setPhase = (p) => { el.stage.dataset.phase = p; };
  const say = (msg) => { el.announce.textContent = msg; };

  /* ═══════════════════════════════════════════════════════════════ petals */

  const PETAL_COLOURS = ['#f2a73b', '#e4841f', '#e8577d', '#f7c9d6', '#fff6e8', '#ffbf5e', '#3d8b4a'];

  function releasePetals() {
    if (reduced.matches) return;
    const stage = el.stage.getBoundingClientRect();
    const flag = el.flagIn.getBoundingClientRect();
    const spread = Math.max(flag.width, 200);
    const originX = flag.left - stage.left;
    const originY = flag.top - stage.top;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < 54; i++) {
      const p = document.createElement('span');
      const w = 5 + Math.random() * 8;
      p.style.cssText =
        `--x0:${(originX - spread * 0.12 + Math.random() * spread * 1.24).toFixed(1)}px;` +
        `--y0:${(originY + Math.random() * flag.height * 0.55).toFixed(1)}px;` +
        `--w:${w.toFixed(1)}px;` +
        `--c:${PETAL_COLOURS[(Math.random() * PETAL_COLOURS.length) | 0]};` +
        `--dx:${(Math.random() * 220 - 110).toFixed(0)}px;` +
        `--dy:${(stage.height - originY + 60).toFixed(0)}px;` +
        `--rot:${(Math.random() * 760 + 180).toFixed(0)}deg;` +
        `--dur:${(2600 + Math.random() * 2600).toFixed(0)}ms;` +
        `--dl:${(Math.random() * 1100).toFixed(0)}ms`;
      frag.appendChild(p);
    }
    el.petals.appendChild(frag);
    setTimeout(() => { el.petals.textContent = ''; }, 7200);
  }

  /* ════════════════════════════════════════════════════════════════ sound */

  const Sound = {
    on: false,
    ctx: null,

    ready() {
      if (!this.on) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    noise(ctx, seconds) {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      return src;
    },

    /** Rope running through a pulley: filtered noise with a rising sweep. */
    rope(seconds) {
      const ctx = this.ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = this.noise(ctx, seconds);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.5;
      band.frequency.setValueAtTime(240, t);
      band.frequency.linearRampToValueAtTime(880, t + seconds);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.35);
      gain.gain.setValueAtTime(0.05, t + seconds - 0.4);
      gain.gain.linearRampToValueAtTime(0.0001, t + seconds);
      src.connect(band).connect(gain).connect(ctx.destination);
      src.start(t);
      src.stop(t + seconds);
    },

    /** The crack of cloth catching the wind. */
    snap() {
      const ctx = this.ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = this.noise(ctx, 0.16);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 950;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(hp).connect(gain).connect(ctx.destination);
      src.start(t);
    },

    /** A bell on the flag reaching the top. */
    bell() {
      const ctx = this.ready();
      if (!ctx) return;
      const t = ctx.currentTime;
      [[392, 0.09], [587.33, 0.07], [783.99, 0.035]].forEach(([hz, peak], i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = hz;
        const gain = ctx.createGain();
        const at = t + i * 0.06;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(peak, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 2.9);
      });
    },
  };

  el.sound.addEventListener('click', () => {
    Sound.on = !Sound.on;
    el.sound.setAttribute('aria-pressed', String(Sound.on));
    if (Sound.on) Sound.bell(); // confirm, and unlock the context on this gesture
  });

  /* ═══════════════════════════════════════════════════════════ the ceremony */

  let generation = 0;
  let skipped = false;

  async function ceremony() {
    const mine = ++generation;
    const alive = () => mine === generation && !skipped;

    const T = timings();
    el.hoist.disabled = true;
    el.skip.hidden = reduced.matches;
    say('Lowering the Union Flag.');
    Sound.rope(T.lower / 1000 + 0.2);

    setPhase('lower');
    glideCarriage(loweredY(), T.lower, 'cubic-bezier(0.36, 0.02, 0.5, 1)');
    await wait(T.lower);
    if (!alive()) return;

    /* The Union Flag is unclipped and carried off; the Tiranga is tied on in
       its place, still furled. The carriage does not move during this. */
    setPhase('detach');
    say('The Tiranga is tied on, furled.');
    await wait(T.detach);
    if (!alive()) return;

    setPhase('raise');
    Sound.rope(T.raise / 1000);
    glideCarriage(0, T.raise, 'cubic-bezier(0.22, 0.66, 0.3, 1)');
    await wait(T.raise);
    if (!alive()) return;

    setPhase('unfurl');
    el.stage.classList.add('is-dawn');
    Sound.snap();
    releasePetals();
    await wait(T.unfurl + 240);
    if (!alive()) return;

    Sound.bell();
    setPhase('flying');
    settle();
  }

  function settle() {
    el.skip.hidden = true;
    el.invite.hidden = true; // whoever invited them has served their purpose
    el.stepHoist.hidden = true;
    el.stepName.hidden = false;
    say('The Tiranga is flying. Enter your name to sign the hoisting.');
    if (!matchMedia('(hover: none)').matches) el.name.focus({ preventScroll: true });
  }

  function skipCeremony() {
    skipped = true;
    el.stage.classList.add('is-dawn');
    snapCarriage(0);
    setPhase('flying');
    settle();
  }

  function reset() {
    generation++;
    skipped = false;
    el.stage.classList.remove('is-dawn');
    setPhase('idle');
    snapCarriage(0);
    el.petals.textContent = '';
    el.hoist.disabled = false;
    el.skip.hidden = true;
    el.stepShare.hidden = true;
    el.stepName.hidden = true;
    el.stepHoist.hidden = false;
    el.namer.reset();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  el.hoist.addEventListener('click', ceremony);
  el.skip.addEventListener('click', skipCeremony);
  el.restart.addEventListener('click', reset);

  /* ══════════════════════════════════════════════════════════ name → share */

  /* Strips control characters plus the bidi and zero-width run that can be used
     to scramble how a name renders, then collapses whitespace. Letters are left
     alone, so Devanagari and other scripts work. */
  const cleanName = (raw) => String(raw || '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);

  const siteBase = () => {
    const configured = (CFG.siteUrl || '').trim().replace(/\/+$/, '');
    if (configured) return configured;
    return location.origin + location.pathname.replace(/index\.html$/, '');
  };

  let signed = null; // { name, at, shareUrl, hoistNumber }

  function tweetHref({ name, shareUrl }) {
    const lines = [
      'I just hoisted the Tiranga 🇮🇳',
      '',
      `— ${name}`,
      '',
      `${yearsFree} years of freedom. Jai Hind!`,
      '',
      '#IndependenceDay #HarGharTiranga',
    ];
    const params = new URLSearchParams({ text: lines.join('\n'), url: shareUrl });
    const via = (CFG.twitterHandle || '').replace(/^@/, '').trim();
    if (via) params.set('via', via);
    return `https://twitter.com/intent/tweet?${params}`;
  }

  el.namer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = cleanName(el.name.value);

    if (!name) {
      el.nameHint.textContent = 'Please enter a name first.';
      el.nameHint.dataset.error = '';
      el.name.focus();
      return;
    }
    delete el.nameHint.dataset.error;
    el.nameHint.textContent = 'Your name goes on the certificate and in the tweet.';

    const at = new Date();
    const shareUrl = `${siteBase()}?by=${encodeURIComponent(name)}`;
    signed = { name, at, shareUrl, hoistNumber: null };

    const dateText = at.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const timeText = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    el.certName.textContent = name;
    el.certMeta.textContent = `${dateText} · ${timeText}`;
    el.certSeal.textContent = 'Har Ghar Tiranga';
    el.tweet.href = tweetHref(signed);

    el.stepName.hidden = true;
    el.stepShare.hidden = false;
    say(`Signed by ${name}. Share it, or save the image.`);
    el.stepShare.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    /* Recording is best-effort and never blocks the share buttons. */
    const result = await window.HoistStore.record(name);
    if (typeof result.total === 'number') {
      signed.hoistNumber = result.total;
      el.certSeal.textContent = `Hoist #${result.total.toLocaleString('en-IN')} · Har Ghar Tiranga`;
      renderCounter(result.total);
    }
    loadWall();
  });

  /* -------------------------------------------------------------- actions */

  if (navigator.share) el.share.hidden = false;

  el.share.addEventListener('click', async () => {
    if (!signed) return;
    try {
      await navigator.share({
        title: 'Hoist the Tiranga',
        text: `I just hoisted the Tiranga 🇮🇳 — ${signed.name}. ${yearsFree} years of freedom. Jai Hind!`,
        url: signed.shareUrl,
      });
    } catch { /* the user dismissed the sheet */ }
  });

  el.copy.addEventListener('click', async () => {
    if (!signed) return;
    try {
      await navigator.clipboard.writeText(signed.shareUrl);
      el.copyLabel.textContent = 'Copied!';
    } catch {
      el.copyLabel.textContent = signed.shareUrl;
    }
    setTimeout(() => { el.copyLabel.textContent = 'Copy link'; }, 2200);
  });

  el.save.addEventListener('click', async () => {
    if (!signed) return;
    const label = el.save.querySelector('span');
    const original = label.textContent;
    label.textContent = 'Drawing…';
    el.save.disabled = true;

    try {
      const canvas = await window.Certificate.render({
        name: signed.name,
        meta: el.certMeta.textContent,
        seal: signed.hoistNumber
          ? `Hoist #${signed.hoistNumber.toLocaleString('en-IN')}`
          : 'Har Ghar Tiranga',
        url: siteBase().replace(/^https?:\/\//, ''),
      });

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'tiranga.png', { type: 'image/png' });

      /* Sharing the file directly is what people actually want on a phone
         (WhatsApp status, Instagram story). Desktop gets a download. */
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Hoist the Tiranga' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiranga-${signed.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch { /* dismissed, or canvas unavailable */ }

    label.textContent = original;
    el.save.disabled = false;
  });

  (function labelSaveButton() {
    try {
      const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [probe] })) {
        el.save.querySelector('span').textContent = 'Share image';
      }
    } catch { /* no File constructor: the button stays "Save image" */ }
  })();

  /* ══════════════════════════════════════════════════ counter & wall of names */

  function renderCounter(total) {
    if (typeof total !== 'number') return;
    el.counter.hidden = false;
    el.counter.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = total.toLocaleString('en-IN');
    el.counter.append(b, document.createTextNode(
      total === 1 ? ' flag hoisted here so far.' : ' flags hoisted here so far.'));
  }

  async function loadWall() {
    const names = await window.HoistStore.recent(8);
    if (!names.length) return;
    el.wall.hidden = false;
    el.wall.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = names.join(' · ');
    el.wall.append(document.createTextNode('Hoisted just now by '), b);
  }

  if (window.HoistStore.remote) {
    window.HoistStore.count().then(renderCounter);
  }

  /* ═══════════════════════════════════════════════ arriving from a shared link */

  (function greetInviter() {
    const by = cleanName(new URLSearchParams(location.search).get('by'));
    if (!by) return;
    el.invite.hidden = false;
    el.invite.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = by;
    el.invite.append(b, document.createTextNode(' hoisted the Tiranga here. Your turn.'));
  })();

  /* ═════════════════════════════════════════════════════════════════ boot */

  layout();
  snapCarriage(0);

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layout();
      const phase = el.stage.dataset.phase;
      const atTop = phase === 'idle' || phase === 'unfurl' || phase === 'flying';
      snapCarriage(atTop ? 0 : loweredY());
    }, 180);
  });

  /* Fonts landing late change the flag box width, so re-slice once they do. */
  document.fonts?.ready.then(layout);
})();
