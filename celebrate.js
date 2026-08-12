/* ============================================================================
   Celebration — confetti and flower petals on one canvas.

   Three particle kinds, because a single one reads as cheap:

     confetti  stiff foil rectangles. Fast, heavy, tumbling. Fake their spin
               about a horizontal axis by oscillating height, so each piece
               flashes edge-on and back as it falls.
     ribbon    long streamers. Light, slow, wobbling along their length.
     petal     marigold and rose petals released from the furled flag, which is
               what actually happens at the Red Fort. Light, high drag,
               fluttering rather than tumbling.

   Canvas rather than DOM nodes: a couple of hundred animated elements each with
   its own compositing layer will stall a mid-range phone, and CSS keyframes
   cannot express drag or a spin that flips a piece edge-on.
   ========================================================================== */

window.Celebration = class Celebration {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bits = [];
    this.running = false;
    this.tick = this.tick.bind(this);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  /* ------------------------------------------------------------- the palette */

  /* Tricolour, plus gold for lift and the chakra's navy for contrast. A brighter
     party blue in here immediately reads as generic birthday confetti. */
  static CONFETTI = ['#ff9933', '#ffffff', '#138808', '#ffd24a', '#ff6f3c', '#1b3f9c'];
  static PETALS = ['#f2a73b', '#e4841f', '#e8577d', '#f7c9d6', '#fff3dd', '#ffbf5e'];
  static LEAF = '#3d8b4a';

  /**
   * @param {{x:number, y:number, w:number, h:number}} from
   *   The flag's box in canvas-local coordinates — everything is released from
   *   the cloth, not from the top of the window.
   * @param {number} [scale] 0..1, thins the burst on small screens.
   */
  burst(from, scale = 1) {
    if (!this.w) this.resize();
    if (!this.w) return;

    const C = Celebration;
    const count = Math.round(150 * scale);
    const cx = from.x + from.w * 0.42;
    const cy = from.y + from.h * 0.5;

    for (let i = 0; i < count; i++) {
      const kind = i % 9 === 0 ? 'ribbon' : i % 5 < 2 ? 'petal' : 'confetti';

      /* Launched from a point on the cloth, biased outward and upward so the
         burst opens out of the flag rather than raining straight down. */
      const ax = from.x + Math.random() * from.w;
      const ay = from.y + Math.random() * from.h;
      const away = Math.atan2(ay - cy, ax - cx + 0.001);
      const spread = away + (Math.random() - 0.5) * 1.5;
      const power = kind === 'confetti' ? 0.16 + Math.random() * 0.30 : 0.05 + Math.random() * 0.14;

      this.bits.push({
        kind,
        x: ax,
        y: ay,
        vx: Math.cos(spread) * power + 0.02,
        vy: Math.sin(spread) * power - (0.08 + Math.random() * 0.16),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (kind === 'confetti' ? 0.010 : 0.004),
        flip: Math.random() * Math.PI * 2,
        flipRate: kind === 'confetti' ? 0.004 + Math.random() * 0.006 : 0.0015,
        sway: Math.random() * Math.PI * 2,
        swayRate: 0.0012 + Math.random() * 0.0022,
        swayAmp: kind === 'petal' ? 0.030 + Math.random() * 0.030 : 0.012,
        len: kind === 'ribbon' ? 16 + Math.random() * 20 : 5 + Math.random() * 7,
        thick: kind === 'ribbon' ? 2.5 + Math.random() * 2 : 3 + Math.random() * 4,
        grav: kind === 'confetti' ? 0.00042 : kind === 'ribbon' ? 0.00020 : 0.00016,
        drag: kind === 'confetti' ? 0.9955 : 0.9925,
        colour: kind === 'petal'
          ? (Math.random() < 0.1 ? C.LEAF : C.PETALS[(Math.random() * C.PETALS.length) | 0])
          : C.CONFETTI[(Math.random() * C.CONFETTI.length) | 0],
        life: 0,
        fade: 2600 + Math.random() * 2600,
      });
    }

    this.start();
  }

  /** A thin, continuous drift of petals once the flag is up and settled. */
  drift(from, scale = 1) {
    if (!this.w) this.resize();
    if (!this.w) return;
    const C = Celebration;
    for (let i = 0; i < Math.round(3 * scale); i++) {
      this.bits.push({
        kind: 'petal',
        x: from.x + Math.random() * from.w,
        y: from.y + Math.random() * from.h * 0.7,
        vx: (Math.random() - 0.3) * 0.03,
        vy: 0.01 + Math.random() * 0.03,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.003,
        flip: 0, flipRate: 0.0012,
        sway: Math.random() * Math.PI * 2,
        swayRate: 0.0010 + Math.random() * 0.0018,
        swayAmp: 0.032 + Math.random() * 0.028,
        len: 5 + Math.random() * 6,
        thick: 3 + Math.random() * 3,
        grav: 0.00010,
        drag: 0.9930,
        colour: Math.random() < 0.1 ? C.LEAF : C.PETALS[(Math.random() * C.PETALS.length) | 0],
        life: 0,
        fade: 4200 + Math.random() * 2600,
      });
    }
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.Ticker.add(this.tick);
  }

  stop() {
    this.running = false;
    window.Ticker.remove(this.tick);
    if (this.ctx && this.canvas.width) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  clear() {
    this.bits.length = 0;
    this.stop();
  }

  /* --------------------------------------------------------------- the loop */

  tick(now, dt) {
    const { ctx } = this;
    if (!this.w) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(this.dpr, this.dpr);

    const bits = this.bits;
    const floor = this.h + 40;
    let alive = 0;

    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      b.life += dt;

      b.vy += b.grav * dt;
      b.vx *= b.drag;
      b.vy *= b.drag;
      b.sway += b.swayRate * dt;

      b.x += (b.vx + Math.sin(b.sway) * b.swayAmp) * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      b.flip += b.flipRate * dt;

      const t = b.life / b.fade;
      if (t >= 1 || b.y > floor || b.x < -60 || b.x > this.w + 60) continue;

      bits[alive++] = b;

      /* Ease out over the last third rather than popping out of existence, and
         again on the way past the bottom edge — the stage clips its overflow, so
         a piece at full opacity would otherwise be sliced off mid-fall. */
      const byAge = t > 0.66 ? 1 - (t - 0.66) / 0.34 : 1;
      const byExit = Math.min(1, Math.max(0, (this.h - b.y) / 70));
      ctx.globalAlpha = byAge * byExit;
      ctx.fillStyle = b.colour;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);

      if (b.kind === 'petal') {
        /* Tilting a petal about its long axis narrows it; never quite to zero,
           since a petal is curved and always catches some light. */
        const squash = 0.35 + 0.65 * Math.abs(Math.cos(b.flip));
        ctx.scale(1, squash);
        ctx.beginPath();
        ctx.ellipse(0, 0, b.len, b.thick, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === 'ribbon') {
        /* A streamer wobbles along its length instead of staying straight. */
        ctx.beginPath();
        ctx.moveTo(-b.len, 0);
        ctx.quadraticCurveTo(0, Math.sin(b.flip) * b.len * 0.5, b.len, 0);
        ctx.lineWidth = b.thick;
        ctx.strokeStyle = b.colour;
        ctx.stroke();
      } else {
        /* Foil confetti tumbling end over end: scaling height through zero
           flashes each piece edge-on, which reads as a spin in depth. */
        const flip = Math.cos(b.flip);
        ctx.fillRect(-b.len, -b.thick * flip, b.len * 2, b.thick * 2 * flip);
      }

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    bits.length = alive;
    ctx.globalAlpha = 1;

    if (!alive) this.stop();
  }
};
