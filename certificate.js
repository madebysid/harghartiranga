/* ============================================================================
   Certificate — renders the shareable 1080x1350 image on a canvas.

   4:5 because that is what survives both a WhatsApp status and an Instagram
   post without being cropped. The chakra constants match tools/build-assets.mjs
   so the drawn flag is the same flag as the SVG.
   ========================================================================== */

window.Certificate = (() => {
  const W = 1080;
  const H = 1350;
  const TAU = Math.PI * 2;

  const SAFFRON = '#FF9933';
  const WHITE = '#FFFFFF';
  const GREEN = '#138808';
  const NAVY = '#000080';

  const CH = {
    rim: 0.98, rimWidth: 0.042, hub: 0.112,
    spokeInner: 0.13, spokeOuter: 0.855,
    spokeHalfInner: 0.021, spokeHalfOuter: 0.045,
    budAt: 0.915, budRadius: 0.036, spokes: 24,
  };

  function chakra(ctx, cx, cy, R) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = NAVY;
    ctx.strokeStyle = NAVY;

    ctx.lineWidth = CH.rimWidth * R;
    ctx.beginPath();
    ctx.arc(0, 0, CH.rim * R, 0, TAU);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, CH.hub * R, 0, TAU);
    ctx.fill();

    for (let i = 0; i < CH.spokes; i++) {
      ctx.save();
      ctx.rotate((i / CH.spokes) * TAU);
      ctx.beginPath();
      ctx.moveTo(-CH.spokeHalfInner * R, -CH.spokeInner * R);
      ctx.lineTo(-CH.spokeHalfOuter * R, -CH.spokeOuter * R);
      ctx.lineTo(CH.spokeHalfOuter * R, -CH.spokeOuter * R);
      ctx.lineTo(CH.spokeHalfInner * R, -CH.spokeInner * R);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -CH.budAt * R, CH.budRadius * R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** The tricolour, drawn as vertical columns that follow a wave. */
  function flag(ctx, x, y, w, h) {
    const wave = (p) => Math.sin(p * Math.PI * 2.1) * 16 * p + Math.sin(p * Math.PI * 4.3 + 1) * 5 * p;
    const shade = (p) => Math.cos(p * Math.PI * 2.1) * 0.14 * p;

    const cols = 260;
    const band = h / 3;
    const colours = [SAFFRON, WHITE, GREEN];

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 16;

    for (let c = 0; c < cols; c++) {
      const p = c / cols;
      const cx = x + w * p;
      const cw = w / cols + 1.2;
      const dy = wave(p);
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = colours[b];
        ctx.fillRect(cx, y + dy + band * b, cw, band + 0.6);
      }
      if (c === 0) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
    }

    chakra(ctx, x + w / 2, y + h / 2 + wave(0.5), (band * 0.75) / 2);

    // Cloth shading, laid over the whole flag including the chakra.
    for (let c = 0; c < cols; c++) {
      const p = c / cols;
      const s = shade(p);
      if (Math.abs(s) < 0.004) continue;
      ctx.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(20,10,0,${-s})`;
      ctx.fillRect(x + w * p, y + wave(p), w / cols + 1.2, h + 0.6);
    }
    ctx.restore();
  }

  function fitText(ctx, text, maxWidth, startPx, family, weight = '400') {
    let size = startPx;
    for (;;) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth || size <= 30) return size;
      size -= 2;
    }
  }

  /**
   * @param {{name:string, meta:string, seal:string, url:string}} data
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function render(data) {
    /* Marcellus has no Devanagari coverage, so Tiro follows it in the stack for
       names written in Hindi — per-glyph fallback picks it up without affecting
       Latin names. */
    const serif = "Marcellus, 'Tiro Devanagari Hindi', Georgia, 'Nirmala UI', serif";
    const sans = "Inter, system-ui, -apple-system, 'Segoe UI', 'Nirmala UI', sans-serif";

    /* Canvas silently substitutes a fallback for a font that has not loaded and
       then measures the wrong widths, so wait for the real ones first. */
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load('400 92px Marcellus').catch(() => {}),
        document.fonts.load('600 30px Inter').catch(() => {}),
        document.fonts.load('400 92px "Tiro Devanagari Hindi"').catch(() => {}),
      ]);
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    /* sky */
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070b21');
    sky.addColorStop(0.4, '#1c1c44');
    sky.addColorStop(0.72, '#4b2f4a');
    sky.addColorStop(1, '#b9633a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    /* sun glow */
    const glow = ctx.createRadialGradient(W * 0.72, H * 0.9, 0, W * 0.72, H * 0.9, W * 0.62);
    glow.addColorStop(0, 'rgba(255,214,150,0.55)');
    glow.addColorStop(0.45, 'rgba(255,160,80,0.18)');
    glow.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    /* Red Fort ramparts, kept low enough to stay clear of the text block. The
       merlons are pointed lotus buds, matching the fort in the app — square
       notches read as generic European castle. */
    const wallTop = H - 86;
    ctx.fillStyle = '#100a1c';
    ctx.fillRect(0, wallTop + 24, W, 86);
    const pitch = 40;
    const mw = 29;
    for (let x = 0; x < W; x += pitch) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop + 26);
      ctx.lineTo(x, wallTop + 13);
      ctx.quadraticCurveTo(x + mw / 2, wallTop - 12, x + mw, wallTop + 13);
      ctx.lineTo(x + mw, wallTop + 26);
      ctx.closePath();
      ctx.fill();
    }

    /* flagpole, planted into the wall rather than stopping in mid-air */
    const poleX = 132;
    const pole = ctx.createLinearGradient(poleX, 0, poleX + 12, 0);
    pole.addColorStop(0, '#5e6376');
    pole.addColorStop(0.35, '#e8ecf6');
    pole.addColorStop(1, '#43485a');
    ctx.fillStyle = pole;
    ctx.fillRect(poleX, 150, 12, wallTop + 24 - 150);
    ctx.beginPath();
    ctx.arc(poleX + 6, 138, 15, 0, TAU);
    ctx.fillStyle = '#e8b338';
    ctx.fill();

    /* the flag itself */
    flag(ctx, poleX + 8, 196, 762, 508);

    /* text block */
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `600 27px ${sans}`;
    ctx.letterSpacing = '7px';
    ctx.fillText('HOISTED BY', W / 2, 856);
    ctx.letterSpacing = '0px';

    const nameSize = fitText(ctx, data.name, W - 150, 108, serif);
    ctx.font = `400 ${nameSize}px ${serif}`;
    ctx.fillStyle = '#fff8ec';
    ctx.fillText(data.name, W / 2, 856 + 42 + nameSize * 0.78);

    const metaY = 856 + 60 + nameSize * 0.78 + 44;
    ctx.font = `400 30px ${sans}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(data.meta, W / 2, metaY);

    ctx.font = `600 25px ${sans}`;
    ctx.fillStyle = SAFFRON;
    ctx.letterSpacing = '5px';
    ctx.fillText(data.seal.toUpperCase(), W / 2, metaY + 54);
    ctx.letterSpacing = '0px';

    /* tricolour rule + url */
    const ruleY = H - 196;
    const ruleW = 300;
    [SAFFRON, WHITE, GREEN].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(W / 2 - ruleW / 2 + (ruleW / 3) * i, ruleY, ruleW / 3, 5);
    });

    ctx.font = `400 26px ${sans}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(data.url, W / 2, ruleY + 46);

    return canvas;
  }

  return { render, WIDTH: W, HEIGHT: H };
})();
