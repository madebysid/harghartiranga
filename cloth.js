/* ============================================================================
   ClothFlag — the waving flag, drawn on a canvas.

   The flag SVG is rasterised once into an offscreen sheet, then every frame the
   sheet is redrawn as a run of narrow vertical columns, each one displaced,
   stretched, compressed and shaded according to where it sits in a travelling
   wave. Four things happen per column, and it takes all four to read as cloth
   rather than as a wobbling picture:

     displacement  the column slides up or down with the wave
     twist         top and bottom edges follow the wave slightly out of phase,
                   so the column stretches and the flag's edges undulate
                   independently instead of staying parallel
     compression   columns narrow where the fold turns away from the viewer,
                   which is what sells the depth
     shading       brightness tracks the fold's slope, so crests catch light

   This replaces a CSS approach that sliced the flag into strips and animated
   each one. That could only ever move whole strips by whole pixel amounts,
   which showed as stair-stepping along every diagonal in the Union Flag.
   ========================================================================== */

window.ClothFlag = class ClothFlag {
  /** @param {{canvas: HTMLCanvasElement, src: string, ratio: number}} opts */
  constructor({ canvas, src, ratio }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.src = src;
    this.ratio = ratio; // width / height
    this.ready = false;

    this.sheet = document.createElement('canvas');
    this.sheetCtx = this.sheet.getContext('2d');

    this.reveal = 1; // 0..1, drives the unfurl sweep

    /* Per-column scratch, reused every frame so a 60fps draw allocates nothing. */
    this.xs = [];
    this.ys = [];
    this.hs = [];
    this.ws = [];
    this.shadeIdx = [];

    this.setMode('flying');
    this.#load();
  }

  /* ------------------------------------------------------------------ setup */

  #load() {
    const img = new Image();
    img.onload = () => {
      this.img = img;
      this.ready = true;
      if (this.w) this.#rasterise();
    };
    img.src = this.src;
  }

  /**
   * Wave character per stage of the ceremony. A flag being lowered has slack in
   * it: longer, slower, shallower folds than one flying at the top of the pole.
   */
  setMode(mode) {
    const presets = {
      flying:   { waves: 1.5,  speed: 0.0020, amp: 0.088, light: 0.30, dark: 0.34, squeeze: 0.11 },
      lowering: { waves: 0.95, speed: 0.0011, amp: 0.055, light: 0.20, dark: 0.24, squeeze: 0.07 },
      still:    { waves: 1.2,  speed: 0,      amp: 0.022, light: 0.16, dark: 0.18, squeeze: 0.05 },
    };
    this.mode = mode;
    this.p = presets[mode] || presets.flying;
    this.#buildShades();
  }

  /* Changing fillStyle to a fresh template string every column would allocate
     a few hundred strings a frame. The alpha is quantised into a fixed palette
     instead, built only when the mode changes. */
  #buildShades() {
    const STEPS = 49;
    this.shadeSteps = STEPS;
    this.shades = Array.from({ length: STEPS }, (_, i) => {
      const v = (i / (STEPS - 1)) * 2 - 1;
      return v >= 0
        ? `rgba(255,251,240,${(v * this.p.light).toFixed(3)})`
        : `rgba(8,2,24,${(-v * this.p.dark).toFixed(3)})`;
    });
  }

  /**
   * @param {number} cssW on-screen width of the flag itself, in CSS pixels.
   * The canvas is padded beyond that: folds push the cloth above and below its
   * nominal box, and the free edge breathes in and out as columns compress.
   */
  resize(cssW) {
    if (!cssW) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = cssW;
    this.h = cssW / this.ratio;
    this.padX = Math.ceil(cssW * 0.05);
    this.padY = Math.ceil(this.h * 0.20);

    const cw = this.w + this.padX;
    const ch = this.h + this.padY * 2;
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);

    /* One column per ~2 CSS px: past that the extra columns cost draw calls
       without being visible, and below it the compression starts to band. */
    this.cols = Math.max(24, Math.round(cssW / 2));

    if (this.ready) this.#rasterise();
  }

  /* Rasterise the SVG once, a little above display resolution so column
     sampling stays crisp. Redoing this per frame would re-decode the SVG. */
  #rasterise() {
    const sw = Math.round(this.w * this.dpr * 1.3);
    const sh = Math.round(this.h * this.dpr * 1.3);
    this.sheet.width = sw;
    this.sheet.height = sh;
    this.sheetCtx.clearRect(0, 0, sw, sh);
    this.sheetCtx.drawImage(this.img, 0, 0, sw, sh);
  }

  /* ------------------------------------------------------------------- draw */

  draw(now) {
    if (!this.ready || !this.w) return;

    const { ctx, p } = this;
    const dpr = this.dpr;
    const TAU = Math.PI * 2;
    const TWIST = 0.62; // radians the lower edge lags the upper by

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(dpr, dpr);

    const t = now * p.speed;
    const cols = this.cols;
    const shown = Math.ceil(cols * this.reveal);
    if (shown <= 0) return;

    const sheetColW = this.sheet.width / cols;
    const colW = this.w / cols;
    const ampBase = this.h * p.amp;

    /* Pass 1: measure. dstX accumulates, so compressing one column shifts every
       column outboard of it — that is what makes the free edge breathe in and
       out instead of the flag stretching in place. */
    const { xs, ys, hs, ws, shadeIdx, shades } = this;
    const mid = (this.shadeSteps - 1) / 2;

    let dstX = 0;
    for (let i = 0; i < shown; i++) {
      const frac = (i + 0.5) / cols;
      /* Amplitude has to vanish at the hoist edge, which is clamped to the
         pole, and grow toward the free edge. */
      const ramp = Math.pow(frac, 1.2);

      const phase = frac * p.waves * TAU - t;
      const phase2 = frac * p.waves * 2.4 * TAU - t * 1.4 + 2.1;

      const ampTop = ampBase * ramp;
      const ampBot = ampTop * 1.2; // the lower free corner flares more

      const dyTop = Math.sin(phase) * ampTop + Math.sin(phase2) * ampTop * 0.26;
      const dyBot = Math.sin(phase + TWIST) * ampBot + Math.sin(phase2 + TWIST) * ampBot * 0.26;

      /* Slope of the fold: drives both how much the column turns away from the
         viewer (compression) and how much light it catches. */
      const slope = Math.cos(phase) * ramp + Math.cos(phase2) * ramp * 0.26 * 2.4;
      const clamped = slope > 1 ? 1 : slope < -1 ? -1 : slope;

      const squeeze = 1 - Math.abs(clamped) * p.squeeze;
      const droop = frac * frac * this.h * 0.035; // the free edge sags a little

      xs[i] = dstX;
      ys[i] = this.padY + dyTop + droop;
      hs[i] = this.h + (dyBot - dyTop);
      ws[i] = colW * squeeze;
      shadeIdx[i] = Math.round(mid + clamped * mid);

      dstX += ws[i];
    }

    /* Pass 2: the cloth. A hair of overlap on each column hides the seam
       between neighbours without feeding back into the accumulated positions. */
    for (let i = 0; i < shown; i++) {
      ctx.drawImage(
        this.sheet,
        i * sheetColW, 0, sheetColW, this.sheet.height,
        xs[i], ys[i], ws[i] + 0.7, hs[i],
      );
    }

    /* Pass 3: shading.

       These rects must tile exactly — no overlap. The cloth columns above can
       overlap safely because they are opaque and simply paint over each other,
       but these are translucent, so any overlap applies its alpha twice and
       draws a hard dark line down every single seam. xs accumulates by ws, so
       ws is precisely the gap to the next column.

       Neighbouring columns often quantise to the same palette entry along a
       fold, so tracking the current style skips a good share of the fillStyle
       assignments. */
    let current = -1;
    for (let i = 0; i < shown; i++) {
      const s = shadeIdx[i];
      if (s === mid) continue;
      if (s !== current) { ctx.fillStyle = shades[s]; current = s; }
      ctx.fillRect(xs[i], ys[i], ws[i], hs[i]);
    }
  }
};
