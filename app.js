/* ============================================================================
   Hoist the Tiranga — ceremony sequencer and share flow.

   Phases, in order, driven by data-phase on .stage:
     idle → lower → detach → raise → unfurl → flying

   CSS owns every visual consequence of a phase. This file only advances the
   phase, moves the carriage, and tells cloth.js and celebrate.js what to do.
   ========================================================================== */

(() => {
  'use strict';

  const CFG = window.TIRANGA_CONFIG || {};
  const INDEPENDENCE = 1947;

  const $ = (id) => document.getElementById(id);
  const el = {
    stage: $('stage'), rig: $('rig'), carriage: $('carriage'),
    flagUk: $('flag-uk'), flagIn: $('flag-in'),
    stars: $('stars'), birds: $('birds'), confetti: $('confetti'),
    sound: $('sound'), skip: $('skip'),
    invite: $('invite'), ordinal: $('ordinal'), yearsAgo: $('years-ago'),
    hoist: $('hoist'), counter: $('counter'),
    stepHoist: $('step-hoist'), stepName: $('step-name'), stepShare: $('step-share'),
    namer: $('namer'), name: $('name'), nameHint: $('name-hint'),
    certName: $('cert-name'), certMeta: $('cert-meta'), certSeal: $('cert-seal'),
    tweet: $('tweet'), share: $('share'), save: $('save'),
    copy: $('copy'), copyLabel: $('copy-label'),
    wall: $('wall'), restart: $('restart'), install: $('install'),
    announce: $('announce'),
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Matches .carriage { top: 18px } and the gap kept above the pole base. */
  const CARRIAGE_TOP = 18;
  const BASE_GAP = 10;

  const timings = () => (reduced.matches
    ? { lower: 420, detach: 160, raise: 380, unfurl: 300 }
    : { lower: 3200, detach: 620, raise: 1800, unfurl: 900 });

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

  /* ═════════════════════════════════════════════════════ sky decoration */

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

  (function seedBirds() {
    if (reduced.matches) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 6; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'bird');
      svg.setAttribute('viewBox', '0 0 22 10');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M1,7 Q5.5,0.8 11,6 Q16.5,0.8 21,7');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
      svg.style.cssText =
        `--y:${(8 + Math.random() * 48).toFixed(1)}%;` +
        `--size:${(13 + Math.random() * 13).toFixed(0)}px;` +
        `--cross:${(19 + Math.random() * 20).toFixed(0)}s;` +
        `--flap:${(360 + Math.random() * 340).toFixed(0)}ms;` +
        `--delay:${(Math.random() * -34).toFixed(1)}s`;
      frag.appendChild(svg);
    }
    el.birds.appendChild(frag);
  })();

  /* ═══════════════════════════════════════════════════════ cloth and canvas */

  const flags = {
    uk: new window.ClothFlag({ canvas: el.flagUk, src: 'flags/union-jack.svg', ratio: 2 }),
    in: new window.ClothFlag({ canvas: el.flagIn, src: 'flags/tiranga.svg', ratio: 1.5 }),
  };
  const party = new window.Celebration(el.confetti);

  let onPole = flags.uk;
  const drawCloth = (t) => onPole && onPole.draw(t);

  /* The cloth animates continuously, so its frame loop only runs while the
     scene is actually on screen — otherwise scrolling down to the share buttons
     leaves it burning battery on an invisible canvas. */
  let clothRunning = false;
  function runCloth(on) {
    if (on === clothRunning) return;
    clothRunning = on;
    if (on) window.Ticker.add(drawCloth);
    else window.Ticker.remove(drawCloth);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => runCloth(entry.isIntersecting),
      { threshold: 0 },
    ).observe(el.stage);
  } else {
    runCloth(true);
  }

  function layout() {
    const flagW = el.carriage.getBoundingClientRect().width;
    if (!flagW) return;
    for (const flag of Object.values(flags)) {
      flag.resize(flagW);
      /* The canvas is padded past the flag box on all sides; pull it back so the
         flag's own top-left corner lands on the carriage origin. */
      flag.canvas.style.marginTop = `${-flag.padY}px`;
    }
    party.resize();
  }

  function geometry() {
    const flagW = el.carriage.getBoundingClientRect().width;
    return { flagW, inH: flagW / 1.5, rigH: el.rig.clientHeight };
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

  const buzz = (pattern) => {
    if (reduced.matches) return;
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
  };

  /** The flag's box in confetti-canvas coordinates. */
  function flagBox() {
    const stage = el.stage.getBoundingClientRect();
    const c = el.carriage.getBoundingClientRect();
    const g = geometry();
    return { x: c.left - stage.left, y: c.top - stage.top, w: g.flagW, h: g.inH };
  }

  /* ═══════════════════════════════════════════════════════ the unfurl sweep */

  /* cloth.js draws only the first `reveal` share of its columns, so ramping that
     from 0 to 1 opens the flag out from the hoist edge — a real unfurl, rather
     than a scaled-up picture of one. */
  function sweepUnfurl(ms) {
    return new Promise((resolve) => {
      const flag = flags.in;
      if (reduced.matches) { flag.reveal = 1; resolve(); return; }
      let t0 = 0;
      const job = (t) => {
        if (!t0) t0 = t;
        const k = Math.min(1, (t - t0) / ms);
        flag.reveal = 1 - Math.pow(1 - k, 3);
        if (k >= 1) { window.Ticker.remove(job); resolve(); }
      };
      window.Ticker.add(job);
    });
  }

  /* ═══════════════════════════════════════════════════════ the ceremony */

  let generation = 0;
  let skipped = false;
  let driftTimer = 0;

  async function ceremony() {
    const mine = ++generation;
    const alive = () => mine === generation && !skipped;

    const T = timings();
    el.hoist.disabled = true;
    el.skip.hidden = reduced.matches;
    say('Lowering the Union Flag.');
    Sound.rope(T.lower / 1000 + 0.2);
    buzz(18);

    onPole = flags.uk;
    flags.uk.setMode('lowering');
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

    onPole = flags.in;
    flags.in.reveal = 0;
    flags.in.setMode('flying');
    setPhase('raise');
    Sound.rope(T.raise / 1000);
    glideCarriage(0, T.raise, 'cubic-bezier(0.22, 0.66, 0.3, 1)');
    await wait(T.raise);
    if (!alive()) return;

    setPhase('unfurl');
    el.stage.classList.add('is-dawn');
    Sound.snap();
    buzz([0, 45, 55, 30]);
    if (!reduced.matches) party.burst(flagBox(), burstScale());
    await sweepUnfurl(T.unfurl);
    if (!alive()) return;

    Sound.bell();
    setPhase('flying');
    startDrift();
    settle();
  }

  /* Thin the burst on small screens: the same particle count that looks
     celebratory at 1440px buries a phone's flag. */
  const burstScale = () => (innerWidth < 480 ? 0.55 : innerWidth < 900 ? 0.78 : 1);

  function startDrift() {
    if (reduced.matches || driftTimer) return;
    driftTimer = setInterval(() => {
      /* clothRunning tracks whether the scene is actually on screen, so
         scrolling down to the share buttons stops spawning petals nobody is
         looking at rather than keeping the frame loop alive for them. */
      if (el.stage.dataset.phase !== 'flying' || document.hidden || !clothRunning) return;
      party.drift(flagBox(), burstScale());
    }, 1500);
  }

  function stopDrift() {
    clearInterval(driftTimer);
    driftTimer = 0;
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
    onPole = flags.in;
    flags.in.reveal = 1;
    flags.in.setMode('flying');
    snapCarriage(0);
    setPhase('flying');
    startDrift();
    settle();
  }

  function reset() {
    generation++;
    skipped = false;
    stopDrift();
    party.clear();
    el.stage.classList.remove('is-dawn');
    onPole = flags.uk;
    flags.uk.setMode(reduced.matches ? 'still' : 'flying');
    flags.in.reveal = 0;
    setPhase('idle');
    snapCarriage(0);
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
      gain.gain.setValueAtTime(0.05, t + Math.max(0.4, seconds - 0.4));
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
    buzz(25);
    if (!reduced.matches) party.burst(flagBox(), burstScale() * 0.45);
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

  /* Counting up reads as a live number rather than a static one. Short enough
     not to delay anything, and it settles on the exact total. */
  function renderCounter(total) {
    if (typeof total !== 'number') return;
    el.counter.hidden = false;
    el.counter.innerHTML = '';
    const b = document.createElement('b');
    el.counter.append(b, document.createTextNode(
      total === 1 ? ' flag hoisted here so far.' : ' flags hoisted here so far.'));

    if (reduced.matches || total < 12) {
      b.textContent = total.toLocaleString('en-IN');
      return;
    }
    const from = Math.max(0, Math.floor(total * 0.82));
    let t0 = 0;
    const job = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / 900);
      const eased = 1 - Math.pow(1 - k, 3);
      b.textContent = Math.round(from + (total - from) * eased).toLocaleString('en-IN');
      if (k >= 1) window.Ticker.remove(job);
    };
    window.Ticker.add(job);
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

  /* ════════════════════════════════════════════════════════ installable app */

  (function installable() {
    let prompt = null;
    addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault(); // keep Chrome's own mini-infobar out of the scene
      prompt = event;
      el.install.hidden = false;
    });

    el.install.addEventListener('click', async () => {
      if (!prompt) return;
      el.install.hidden = true;
      prompt.prompt();
      await prompt.userChoice.catch(() => {});
      prompt = null;
    });

    addEventListener('appinstalled', () => { el.install.hidden = true; });

    /* Service workers need a real origin — registering from file:// throws. */
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus */ });
      });
    }
  })();

  /* ═════════════════════════════════════════════════════════════════ boot */

  if (reduced.matches) flags.uk.setMode('still');

  layout();
  snapCarriage(0);
  flags.in.reveal = 0;

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

  /* Fonts landing late can reflow the console and change the stage height, so
     re-measure once they do. */
  document.fonts?.ready.then(layout);
})();
