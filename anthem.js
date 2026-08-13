/* ============================================================================
   Anthem — Jana Gana Mana, from two files.

     anthem-hoist.mp3   the closing 14 seconds, which is all the ceremony plays.
                        166KB, and the only audio a visitor is ever charged for
                        unless they ask for more.
     anthem-full.mp3    all 62 seconds, fetched only when somebody presses
                        "Play the full anthem". 742KB.

   This used to be one 1.45MB file that the ceremony seeked into at 48s. The
   comment here claimed the browser range-requested from the seek point; it does
   not. unlock() has to call load() inside the click to satisfy mobile autoplay
   rules, and load() starts at byte zero — measured on the live site, the request
   came back 206 with the whole 1,484,590-byte body. Every visitor was paying for
   62 seconds to hear 14, and at 1.5MB a head that was the app's binding limit:
   about 235 people a day before Firebase Hosting's free bandwidth ran out.

   Both files are mono 96k, encoded from the 339k master rather than from the old
   192k copy, so this is one lossy pass rather than two.

   The clip starts mid-phrase, because the recording sings continuously and there
   is no gap at 48s. The short volume fade is what makes that cut sound
   deliberate instead of like a dropped frame.

   iOS will not let a media element start playing outside a user gesture, and the
   unfurl happens six seconds after the button was clicked. unlock() is what
   bridges that: a play/pause pair inside the click marks the element as
   user-initiated, after which later play() calls are allowed.
   ========================================================================== */

window.Anthem = class Anthem {
  /** @param {{hoistSrc: string, fullSrc: string}} opts */
  constructor({ hoistSrc, fullSrc }) {
    this.unlocked = false;
    this.mode = null; // 'full' | 'hoist', whichever was last started
    this.listeners = new Set();

    this.clip = this.#element(hoistSrc);
    this.whole = this.#element(fullSrc);
  }

  #element(src) {
    const audio = new Audio();
    audio.src = src;
    audio.preload = 'none'; // don't spend a visitor's data until asked
    audio.crossOrigin = 'anonymous';
    for (const event of ['ended', 'pause', 'play', 'timeupdate']) {
      audio.addEventListener(event, () => this.#emit());
    }
    return audio;
  }

  /* ------------------------------------------------------------------ state */

  /** Whichever file the current mode belongs to. The ceremony's clip is the
   *  default, since that is what unlock() primes. */
  get audio() { return this.mode === 'full' ? this.whole : this.clip; }

  get playing() { return !this.audio.paused && !this.audio.ended; }
  get duration() { return this.audio.duration || 0; }
  get position() { return this.audio.currentTime || 0; }

  onChange(fn) { this.listeners.add(fn); }
  #emit() { for (const fn of this.listeners) fn(this); }

  /* ----------------------------------------------------------------- unlock */

  /**
   * Call from inside a real user gesture (the hoist click). Starts the clip
   * downloading and satisfies the mobile autoplay rules for every later play()
   * call. Only the clip: the full anthem stays unfetched until it is wanted.
   */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.clip.preload = 'auto';
    try { this.clip.load(); } catch { /* ignore */ }

    const probe = this.clip.play();
    if (probe && typeof probe.then === 'function') {
      probe.then(() => { this.clip.pause(); this.clip.currentTime = 0; })
        .catch(() => { /* blocked anyway; the button still works */ });
    } else {
      this.clip.pause();
    }
  }

  /* ------------------------------------------------------------------- play */

  /** Ramp volume with the shared ticker rather than a private interval. */
  #fade(audio, to, ms) {
    if (this.fadeJob) window.Ticker.remove(this.fadeJob);
    const from = audio.volume;
    let t0 = 0;
    this.fadeJob = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { window.Ticker.remove(this.fadeJob); this.fadeJob = null; }
    };
    window.Ticker.add(this.fadeJob);
  }

  async #start(audio, fadeMs) {
    audio.volume = fadeMs ? 0 : 1;
    /* Waiting for metadata is what makes the first play reliable on a cold
       cache; without it the element can be asked to play before it knows it has
       anything to play. */
    if (!Number.isFinite(audio.duration)) {
      await new Promise((resolve) => {
        const done = () => { audio.removeEventListener('loadedmetadata', done); resolve(); };
        audio.addEventListener('loadedmetadata', done);
        audio.preload = 'auto';
        try { audio.load(); } catch { resolve(); }
        setTimeout(done, 4000); // never hang the ceremony on a slow network
      });
    }
    try { await audio.play(); } catch { return false; }
    if (fadeMs) this.#fade(audio, 1, fadeMs);
    return true;
  }

  /** The closing passage, for the moment the flag unfurls. */
  playHoist() {
    this.mode = 'hoist';
    try { this.clip.currentTime = 0; } catch { /* not seekable yet */ }
    return this.#start(this.clip, 420);
  }

  /** The whole anthem, from the top. Stops the ceremony's clip so the two
   *  recordings never sound over each other. */
  playFull() {
    this.clip.pause();
    this.mode = 'full';
    try { this.whole.currentTime = 0; } catch { /* not seekable yet */ }
    return this.#start(this.whole, 260);
  }

  pause() {
    this.audio.pause();
    this.audio.volume = 1;
  }

  stop() {
    this.mode = null;
    for (const audio of [this.clip, this.whole]) {
      audio.pause();
      try { audio.currentTime = 0; } catch { /* ignore */ }
      audio.volume = 1;
    }
  }

  toggleFull() {
    /* Only the full anthem is pausable from this button. The 14-second hoist
       passage is very likely still sounding when someone reaches for it, and
       treating that as "playing" made the button pause the ceremony's own audio
       instead of doing what it says. */
    if (this.mode === 'full' && this.playing) {
      this.pause();
      return Promise.resolve(false);
    }
    /* Resume a full playthrough that was paused part-way. */
    if (this.mode === 'full' && this.position > 0.5 && !this.whole.ended) {
      this.clip.pause();
      return this.whole.play().then(() => true).catch(() => false);
    }
    return this.playFull();
  }
};
