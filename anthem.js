/* ============================================================================
   Anthem — Jana Gana Mana, played two ways from one file.

   The hoist plays only the closing passage, from HOIST_AT; the button plays the
   whole thing from the beginning. One file serves both: the MP3 is CBR with a
   Xing header, so seeking is accurate, and the browser range-requests from the
   seek point rather than downloading the first 48 seconds to throw them away.

   The recording sings continuously with no gap at 48s, so starting there would
   otherwise begin on an abrupt mid-word attack. A short fade-in makes the cut
   sound deliberate.

   iOS will not let a media element start playing outside a user gesture, and the
   unfurl happens six seconds after the button was clicked. unlock() is what
   bridges that: a play/pause pair inside the click marks the element as
   user-initiated, after which later play() calls are allowed.
   ========================================================================== */

window.Anthem = class Anthem {
  /** @param {{src: string, hoistAt: number}} opts */
  constructor({ src, hoistAt }) {
    this.hoistAt = hoistAt;
    this.unlocked = false;
    this.mode = null; // 'full' | 'hoist', whichever was last started
    this.listeners = new Set();

    const audio = new Audio();
    audio.src = src;
    audio.preload = 'none'; // 1.4MB: don't spend a visitor's data until asked
    audio.crossOrigin = 'anonymous';
    this.audio = audio;

    audio.addEventListener('ended', () => this.#emit());
    audio.addEventListener('pause', () => this.#emit());
    audio.addEventListener('play', () => this.#emit());
    audio.addEventListener('timeupdate', () => this.#emit());
  }

  /* ------------------------------------------------------------------ state */

  get playing() { return !this.audio.paused && !this.audio.ended; }
  get duration() { return this.audio.duration || 0; }
  get position() { return this.audio.currentTime || 0; }

  onChange(fn) { this.listeners.add(fn); }
  #emit() { for (const fn of this.listeners) fn(this); }

  /* ----------------------------------------------------------------- unlock */

  /**
   * Call from inside a real user gesture (the hoist click). Starts the download
   * and satisfies the mobile autoplay rules for every later play() call.
   */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.audio.preload = 'auto';
    try { this.audio.load(); } catch { /* ignore */ }

    const probe = this.audio.play();
    if (probe && typeof probe.then === 'function') {
      probe.then(() => { this.audio.pause(); this.audio.currentTime = 0; })
        .catch(() => { /* blocked anyway; the button still works */ });
    } else {
      this.audio.pause();
    }
  }

  /* ------------------------------------------------------------------- play */

  /** Ramp volume with the shared ticker rather than a private interval. */
  #fade(to, ms) {
    if (this.fadeJob) window.Ticker.remove(this.fadeJob);
    const from = this.audio.volume;
    let t0 = 0;
    this.fadeJob = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / ms);
      this.audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { window.Ticker.remove(this.fadeJob); this.fadeJob = null; }
    };
    window.Ticker.add(this.fadeJob);
  }

  async #startAt(seconds, fadeMs) {
    this.audio.volume = fadeMs ? 0 : 1;
    /* Seeking a not-yet-loaded element throws in some browsers, and silently
       lands at 0 in others; wait for metadata so the seek actually takes. */
    if (!Number.isFinite(this.audio.duration)) {
      await new Promise((resolve) => {
        const done = () => { this.audio.removeEventListener('loadedmetadata', done); resolve(); };
        this.audio.addEventListener('loadedmetadata', done);
        this.audio.preload = 'auto';
        try { this.audio.load(); } catch { resolve(); }
        setTimeout(done, 4000); // never hang the ceremony on a slow network
      });
    }
    try { this.audio.currentTime = seconds; } catch { /* unseekable */ }
    try { await this.audio.play(); } catch { return false; }
    if (fadeMs) this.#fade(1, fadeMs);
    return true;
  }

  /** The closing passage, for the moment the flag unfurls. */
  playHoist() { this.mode = 'hoist'; return this.#startAt(this.hoistAt, 420); }

  /** The whole anthem, from the top. */
  playFull() { this.mode = 'full'; return this.#startAt(0, 260); }

  pause() {
    this.audio.pause();
    this.audio.volume = 1;
  }

  stop() {
    this.mode = null;
    this.audio.pause();
    try { this.audio.currentTime = 0; } catch { /* ignore */ }
    this.audio.volume = 1;
  }

  toggleFull() {
    /* Only the full anthem is pausable from this button. The 14-second hoist
       passage is very likely still sounding when someone reaches for it, and
       treating that as "playing" made the button pause the ceremony's own audio
       instead of doing what it says. */
    if (this.playing && this.mode === 'full') {
      this.pause();
      return Promise.resolve(false);
    }
    /* Resume a full playthrough that was paused part-way. */
    if (this.mode === 'full' && this.position > 0.5 && !this.audio.ended) {
      return this.audio.play().then(() => true).catch(() => false);
    }
    return this.playFull();
  }
};
