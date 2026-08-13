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
    hoist: $('hoist'), tally: $('tally'), tallyNum: $('tally-num'),
    rail: $('rail'),
    stepHoist: $('step-hoist'), stepName: $('step-name'), stepShare: $('step-share'),
    namer: $('namer'), name: $('name'), nameHint: $('name-hint'),
    certificate: $('certificate'),
    certName: $('cert-name'), certMeta: $('cert-meta'), certSeal: $('cert-seal'),
    whatsapp: $('whatsapp'), tweet: $('tweet'), share: $('share'), save: $('save'),
    copy: $('copy'), copyLabel: $('copy-label'),
    wall: $('wall'), roll: $('roll'), rollTrack: $('roll-track'),
    restart: $('restart'), install: $('install'),
    anthemPanel: $('anthem-panel'), anthemPlay: $('anthem-play'),
    anthemLabel: $('anthem-label'), anthemFill: $('anthem-fill'),
    anthemNote: $('anthem-note'),
    announce: $('announce'),
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* The hint as authored in index.html. Signing rewrites it, and "Hoist again"
     has to be able to put it back. */
  const DEFAULT_NAME_HINT = el.nameHint.textContent;

  /* ─────────────────────────────────────────────────────────── walkthrough ── */

  /* Three coach marks, one per step, each pointing at the single control that
     moves things along. `on` is what retires the bubble: pressing the button,
     or the first keystroke in the name box — so it clears the moment somebody
     starts doing the thing rather than sitting there being explained at. */
  const COACH = {
    hoist: () => window.Coach.point({
      target: el.hoist,
      chip: 'Step 1 of 3',
      text: 'Tap here to hoist the flag',
      sub: 'Nothing to fill in. Takes about six seconds.',
      place: 'below',
      on: 'click',
    }),
    name: () => window.Coach.point({
      target: el.name,
      chip: 'Step 2 of 3',
      text: 'Type your name here',
      sub: 'It goes on your certificate. Skip it if you like — sharing works either way.',
      place: 'below',
      on: 'input',
    }),
    share: () => window.Coach.point({
      target: el.whatsapp,
      chip: 'Step 3 of 3',
      text: 'Send it to someone',
      sub: 'WhatsApp opens straight on your contacts.',
      /* Below, so it does not cover the certificate that has just appeared above
         the buttons — that is the thing they earned. It lands over the second
         row of buttons instead, and the overlay lets clicks straight through. */
      place: 'below',
      on: 'click',
    }),
  };

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

  /* 48s in is the closing "Jaya he" passage — the last 14 seconds of the
     recording — which is what plays as the flag unfurls. The button plays the
     whole thing from the top. */
  const anthem = new window.Anthem({ src: 'anthem.mp3', hoistAt: 48 });

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

  /** Light up step `n` of three on the rail, and tick off the ones behind it. */
  function setStep(n) {
    [...el.rail.children].forEach((li, i) => {
      const step = i + 1;
      li.dataset.state = step < n ? 'done' : step === n ? 'now' : 'todo';
      if (step === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }

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
    /* Inside the click, which is the only place mobile lets a media element be
       primed for a later play() call. */
    anthem.unlock();
    el.hoist.disabled = true;
    window.Coach.hide(); // step 1 is happening; nothing to point at
    el.skip.hidden = reduced.matches;

    /* Counted here, at the press — not at the signature. Most people never type
       a name, and they hoisted the flag all the same. Fire-and-forget: the
       ceremony must not wait on a network round trip. */
    countThisHoist();

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
    if (Sound.on) anthem.playHoist();
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
    el.anthemPanel.hidden = false;
    el.skip.hidden = true;
    el.invite.hidden = true; // whoever invited them has served their purpose
    el.stepHoist.hidden = true;
    el.stepName.hidden = false;
    /* The share buttons appear with the name field, not after it. Most people
       will not type a name — some will not work out that they can — and none of
       that should stand between them and sending the link on. */
    el.stepShare.hidden = false;
    prepareShare(null);
    setStep(2);
    say('The Tiranga is flying. Sign it with your name, or share it as it is.');
    if (!matchMedia('(hover: none)').matches) el.name.focus({ preventScroll: true });
    /* After the reveal, not during it: the card has to be laid out before the
       bubble can be hung off the name box. */
    COACH.name();
  }

  function skipCeremony() {
    skipped = true;
    anthem.stop();
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
    anthem.stop();
    el.anthemPanel.hidden = true;
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
    el.certificate.hidden = true;
    el.namer.reset();
    delete el.nameHint.dataset.error;
    el.nameHint.textContent = DEFAULT_NAME_HINT;
    signed = null;
    myHoistNumber = null;
    setStep(1);
    scrollTo({ top: 0, behavior: 'smooth' });
    COACH.hoist();
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

  /* Default on, because the anthem playing as the flag unfurls is the point of
     the thing — but remembered, so anyone who mutes it stays muted. */
  const MUTE_KEY = 'tiranga.sound';
  try { Sound.on = localStorage.getItem(MUTE_KEY) !== 'off'; } catch { Sound.on = true; }
  el.sound.setAttribute('aria-pressed', String(Sound.on));

  function setSound(on, { confirm = false } = {}) {
    Sound.on = on;
    el.sound.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem(MUTE_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
    if (!on) anthem.pause();
    else if (confirm) Sound.bell(); // also unlocks the AudioContext on this gesture
  }

  el.sound.addEventListener('click', () => setSound(!Sound.on, { confirm: true }));

  /* ------------------------------------------------------- the full anthem */

  el.anthemPlay.addEventListener('click', () => {
    /* An explicit press is a request to hear it, so it un-mutes rather than
       silently doing nothing. */
    if (!Sound.on) setSound(true);
    anthem.unlock();
    anthem.toggleFull();
  });

  anthem.onChange((a) => {
    const playing = a.playing;
    el.anthemPlay.setAttribute('aria-pressed', String(playing));
    el.anthemLabel.textContent = playing ? 'Playing the anthem' : 'Play the full anthem';
    /* Only ask people to stand for the whole anthem, not for the 14-second
       passage that plays over the hoist. */
    el.anthemNote.hidden = !(playing && a.mode === 'full');
    const pct = a.duration ? (a.position / a.duration) * 100 : 0;
    el.anthemFill.style.width = `${pct.toFixed(1)}%`;
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

  /* Always ends in a slash, so appending "?by=" gives ".../?by=Name" rather than
     the slashless ".../…web.app?by=Name". Both resolve, but only one looks like
     a link somebody meant to send. */
  const siteBase = () => {
    const configured = (CFG.siteUrl || '').trim().replace(/\/+$/, '');
    if (configured) return `${configured}/`;
    return location.origin + location.pathname.replace(/index\.html$/, '');
  };

  let signed = null;         // { name, at, shareUrl } — name is null until signed
  let myHoistNumber = null;  // this visitor's place in the tally, once known

  /** What the message says. Without a name it speaks for itself. */
  const shareLine = (name) => (name
    ? `I just hoisted the Tiranga 🇮🇳 — ${name}. ${yearsFree} years of freedom. Jai Hind!`
    : `I just hoisted the Tiranga 🇮🇳 ${yearsFree} years of freedom. Hoist yours — it takes six seconds. Jai Hind!`);

  function tweetHref({ name, shareUrl }) {
    const handle = (CFG.twitterHandle || '').replace(/^@/, '').trim();
    const lines = [
      'I just hoisted the Tiranga 🇮🇳',
      '',
      ...(name ? [`— ${name}`, ''] : []),
      `${yearsFree} years of freedom. Jai Hind!`,
      '',
      /* Spelled out in the body rather than passed as `via`, which Twitter
         renders as a trailing "via @handle" — that reads as who sent the tweet,
         not who made the thing. Credit goes above the hashtags so the tweet
         still ends on them. */
      ...(handle ? [`Made by @${handle}`] : []),
      '#IndependenceDay #HarGharTiranga',
    ];
    const params = new URLSearchParams({ text: lines.join('\n'), url: shareUrl });
    return `https://twitter.com/intent/tweet?${params}`;
  }

  /* wa.me with no number opens the contact picker, which is exactly the "send
     this to someone" flow. WhatsApp takes one text field, so the link is part
     of it rather than a separate parameter. */
  function whatsappHref({ name, shareUrl }) {
    const text = `${shareLine(name)}\n${shareUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  const sealText = () => (myHoistNumber
    ? `Hoist #${myHoistNumber.toLocaleString('en-IN')} · Har Ghar Tiranga`
    : 'Har Ghar Tiranga');

  /**
   * Point every share action at the current state. Called once with null the
   * moment the flag is up, and again with the name if one is ever typed.
   */
  function prepareShare(name) {
    const at = signed?.at || new Date();
    const shareUrl = name ? `${siteBase()}?by=${encodeURIComponent(name)}` : siteBase();
    signed = { name, at, shareUrl };

    el.tweet.href = tweetHref(signed);
    el.whatsapp.href = whatsappHref(signed);

    /* The image has a name printed across the middle of it, so that one button
       waits until there is a name to print. */
    el.save.hidden = !name;
    el.certificate.hidden = !name;

    if (name) {
      const dateText = at.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      const timeText = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      el.certName.textContent = name;
      el.certMeta.textContent = `${dateText} · ${timeText}`;
      el.certSeal.textContent = sealText();
    }
  }

  el.namer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = cleanName(el.name.value);

    if (!name) {
      el.nameHint.textContent = 'Type your name in the box first — or skip it and just share the link.';
      el.nameHint.dataset.error = '';
      el.name.focus();
      return;
    }
    delete el.nameHint.dataset.error;
    el.nameHint.textContent = 'Signed. Your name is on the certificate below.';

    prepareShare(name);
    setStep(3);
    say(`Signed by ${name}. Share it, or save the image.`);
    buzz(25);
    if (!reduced.matches) party.burst(flagBox(), burstScale() * 0.45);
    el.stepShare.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    /* The certificate has just appeared above the buttons and a smooth scroll is
       under way, so let both land before measuring where WhatsApp ended up. */
    setTimeout(COACH.share, 620);

    /* Best-effort, and never blocks the share buttons. The hoist itself was
       already counted at the press, so this normally only attaches the name —
       it reports a total only when it had to fall back to writing a fresh
       record, and then that total is the one to trust. */
    const result = await window.HoistStore.sign(name);
    if (typeof result.total === 'number') {
      serverTotal = result.total;
      unconfirmed = 0;
      myHoistNumber = shown(result.total);
      el.certSeal.textContent = sealText();
      paintTally();
    }
    loadNames();
  });

  /* -------------------------------------------------------------- actions */

  if (navigator.share) el.share.hidden = false;

  el.share.addEventListener('click', async () => {
    if (!signed) return;
    try {
      await navigator.share({
        title: 'Hoist the Tiranga',
        text: shareLine(signed.name),
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
    if (!signed?.name) return;
    const label = el.save.querySelector('span');
    const original = label.textContent;
    label.textContent = 'Drawing…';
    el.save.disabled = true;

    try {
      const canvas = await window.Certificate.render({
        name: signed.name,
        meta: el.certMeta.textContent,
        seal: myHoistNumber
          ? `Hoist #${myHoistNumber.toLocaleString('en-IN')}`
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

  /* The tally shown is seedCount plus the true number of hoists. Everywhere a
     number appears — the badge and the certificate's hoist number — has to come
     through here, or the badge and the certificate would disagree with each
     other in front of the same person. */
  const SEED = Math.max(0, Math.floor(Number(CFG.seedCount) || 0));
  const shown = (real) => SEED + (typeof real === 'number' ? real : 0);

  let tallyJob = null;

  /* Two numbers, because they arrive at different times and from different
     places: what the server last told us, and what this browser has done since
     that the server has not confirmed yet. Keeping them apart is what stops a
     slow first count() — six seconds on a cold mobile connection — from landing
     after a hoist and walking the displayed number back down by one. */
  let serverTotal = null;
  let unconfirmed = 0;

  const paintTally = () => renderTally((serverTotal || 0) + unconfirmed);

  /* Counting up reads as a live number rather than a static one. Short enough
     not to delay anything, and it settles on the exact figure. */
  function renderTally(real) {
    const total = shown(real);
    if (!total) { el.tally.hidden = true; return; }
    el.tally.hidden = false;

    if (tallyJob) window.Ticker.remove(tallyJob);

    const from = Number(el.tallyNum.textContent.replace(/[^0-9]/g, '')) || Math.floor(total * 0.985);
    if (reduced.matches || from === total) {
      el.tallyNum.textContent = total.toLocaleString('en-IN');
      return;
    }
    let t0 = 0;
    tallyJob = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / 1100);
      const eased = 1 - Math.pow(1 - k, 3);
      el.tallyNum.textContent = Math.round(from + (total - from) * eased).toLocaleString('en-IN');
      if (k >= 1) { window.Ticker.remove(tallyJob); tallyJob = null; }
    };
    window.Ticker.add(tallyJob);
  }

  /**
   * Count this hoist. The optimistic bump is the point: the write can be slow,
   * throttled or blocked, and the number has to move while the flag is still on
   * its way up, or pressing the button appears to do nothing.
   */
  async function countThisHoist() {
    unconfirmed += 1;
    paintTally();

    const result = await window.HoistStore.hoist();
    if (typeof result.total === 'number') {
      /* The server's total now includes this hoist, so the local bump is spent.
         If the write failed the bump stays put: they did hoist the flag, and a
         number that jumps back down is worse than one that is one ahead. */
      serverTotal = result.total;
      unconfirmed = 0;
      myHoistNumber = shown(result.total);
      paintTally();
      if (signed?.name) el.certSeal.textContent = sealText();
    }
    loadNames();
  }

  /* ------------------------------------------------------- the wall of names */

  /* How long one name takes to travel the full height of the column, and how
     many ride it at once. Slow and few: this sits behind the ceremony and must
     never pull the eye off the flag. */
  const ROLL_MS = 19000;
  const ROLL_MAX = 10;

  /**
   * The names, in two places at once: drifting up the sky for whoever is
   * watching, and as a plain line of text in the share card for whoever is
   * reading with a screen reader or has motion turned off.
   */
  function renderNames(names) {
    if (!names.length) return;

    el.wall.hidden = false;
    el.wall.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = names.slice(0, 8).join(' · ');
    el.wall.append(document.createTextNode('Hoisted here by '), b);

    const riders = names.slice(0, ROLL_MAX);
    el.roll.style.setProperty('--roll-ms', `${ROLL_MS}ms`);
    el.rollTrack.innerHTML = '';
    riders.forEach((name, i) => {
      const span = document.createElement('span');
      span.className = 'roll__name';
      span.textContent = name;
      /* Spread over the loop with negative delays, so the column is already
         full of names on the first frame instead of filling up over 19s. */
      span.style.animationDelay = `${-((i / riders.length) * ROLL_MS).toFixed(0)}ms`;
      el.rollTrack.appendChild(span);
    });
    el.roll.hidden = false;
  }

  async function loadNames() {
    renderNames(await window.HoistStore.recent(ROLL_MAX));
  }

  /* Straight away, with the seed, rather than after the first round trip — that
     took six seconds on a cold connection here, and the badge popping into the
     corner of a scene somebody is already watching is worse than a number that
     corrects itself a moment later. */
  paintTally();

  if (window.HoistStore.remote) {
    window.HoistStore.count().then((total) => {
      if (typeof total === 'number') serverTotal = total;
      paintTally();
    });
    loadNames();
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

  setStep(1);
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

  /* The walkthrough starts on the first control. Deferred a beat so the card's
     entrance animation has settled and the bubble does not chase it. */
  setTimeout(COACH.hoist, 620);
})();
