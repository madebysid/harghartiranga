/**
 * Asset builder — regenerates the SVG flags, the favicon and the social-card PNG.
 *
 *   node tools/build-assets.mjs
 *
 * Everything it writes is committed, so you only need to run this if you want to
 * tweak the geometry. No dependencies: the PNG encoder is hand-rolled on top of
 * node:zlib.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (rel, data) => {
  const path = resolve(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log('wrote', rel, typeof data === 'string' ? `${data.length}B` : `${data.length}B`);
};

/* ------------------------------------------------------------------ palette */

const SAFFRON = '#FF9933'; // Bureau of Indian Standards "India saffron"
const WHITE = '#FFFFFF';
const GREEN = '#138808'; // "India green"
const NAVY = '#000080'; // Ashoka Chakra navy blue

const UJ_BLUE = '#012169';
const UJ_RED = '#C8102E';

/* ------------------------------------------------------- the Ashoka Chakra */

/**
 * 24 spokes, per the flag specification. Drawn at the origin with the given
 * radius so both the SVG flag and the canvas certificate can share the numbers.
 * Ratios below are relative to R and tuned to read correctly from 24px up.
 */
const CHAKRA = {
  rim: 0.98, // centreline of the outer ring
  rimWidth: 0.042,
  hub: 0.112,
  spokeInner: 0.13,
  spokeOuter: 0.855,
  spokeHalfInner: 0.021,
  spokeHalfOuter: 0.045,
  budAt: 0.915,
  budRadius: 0.036,
  spokes: 24,
};

function chakraSvg(cx, cy, R, colour = NAVY) {
  const c = CHAKRA;
  const step = 360 / c.spokes;
  const spoke =
    `M ${(-c.spokeHalfInner * R).toFixed(2)} ${(-c.spokeInner * R).toFixed(2)}` +
    ` L ${(-c.spokeHalfOuter * R).toFixed(2)} ${(-c.spokeOuter * R).toFixed(2)}` +
    ` L ${(c.spokeHalfOuter * R).toFixed(2)} ${(-c.spokeOuter * R).toFixed(2)}` +
    ` L ${(c.spokeHalfInner * R).toFixed(2)} ${(-c.spokeInner * R).toFixed(2)} Z`;

  const arms = Array.from({ length: c.spokes }, (_, i) => {
    const a = (i * step).toFixed(1);
    return (
      `    <g transform="rotate(${a})">` +
      `<path d="${spoke}"/>` +
      `<circle cy="${(-c.budAt * R).toFixed(2)}" r="${(c.budRadius * R).toFixed(2)}"/>` +
      `</g>`
    );
  }).join('\n');

  return [
    `  <g transform="translate(${cx} ${cy})" fill="${colour}">`,
    `    <circle r="${(c.rim * R).toFixed(2)}" fill="none" stroke="${colour}" stroke-width="${(c.rimWidth * R).toFixed(2)}"/>`,
    `    <circle r="${(c.hub * R).toFixed(2)}"/>`,
    arms,
    `  </g>`,
  ].join('\n');
}

/* ------------------------------------------------------------- flag: India */

// 3:2, bands of equal height, chakra diameter = 3/4 of the white band.
const W = 900;
const H = 600;
const BAND = H / 3;
const CHAKRA_R = (BAND * 0.75) / 2;

const tiranga = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Flag of India">
  <rect width="${W}" height="${BAND}" fill="${SAFFRON}"/>
  <rect y="${BAND}" width="${W}" height="${BAND}" fill="${WHITE}"/>
  <rect y="${BAND * 2}" width="${W}" height="${BAND}" fill="${GREEN}"/>
${chakraSvg(W / 2, H / 2, CHAKRA_R)}
</svg>
`;
out('flags/tiranga.svg', tiranga);

/* ---------------------------------------------------- flag: United Kingdom */

// 1:2 on a 60x30 grid. The clip path counterchanges St Patrick's saltire so the
// red diagonal sits on the correct side of the white one in each quadrant.
const unionJack = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="60" height="30" role="img" aria-label="Flag of the United Kingdom">
  <clipPath id="uj-counterchange">
    <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
  </clipPath>
  <rect width="60" height="30" fill="${UJ_BLUE}"/>
  <path d="M0,0 L60,30 M60,0 L0,30" stroke="${WHITE}" stroke-width="6"/>
  <path d="M0,0 L60,30 M60,0 L0,30" stroke="${UJ_RED}" stroke-width="4" clip-path="url(#uj-counterchange)"/>
  <path d="M30,0 v30 M0,15 h60" stroke="${WHITE}" stroke-width="10"/>
  <path d="M30,0 v30 M0,15 h60" stroke="${UJ_RED}" stroke-width="6"/>
</svg>
`;
out('flags/union-jack.svg', unionJack);

/* ----------------------------------------------------------------- favicon */

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="#0b1026"/>
  <rect x="4" y="8" width="24" height="5.33" fill="${SAFFRON}"/>
  <rect x="4" y="13.33" width="24" height="5.33" fill="${WHITE}"/>
  <rect x="4" y="18.66" width="24" height="5.34" fill="${GREEN}"/>
  <circle cx="16" cy="16" r="2.4" fill="none" stroke="${NAVY}" stroke-width="0.7"/>
  <circle cx="16" cy="16" r="0.55" fill="${NAVY}"/>
</svg>
`;
out('favicon.svg', favicon);

/* ═══════════════════════════════════════════════════ the Red Fort (Lal Qila) ══
   Two SVGs rather than one picture, so the wall can tile to any screen width
   while the gate stays a fixed piece parked behind the flagpole:

     fort-wall.svg  a seamless curtain-wall tile, repeated across the horizon
     fort-gate.svg  the Lahori Gate, where the flag is actually hoisted

   Both are drawn in flat tonal bands rather than outlines, so they read as
   silhouette at a glance but hold detail when you look. The distinctive part is
   the merlons: Red Fort parapets are rows of pointed lotus-bud shapes, not the
   square blocks that read as generic European castle.
   ============================================================================ */

const FORT = {
  body: '#1d1128',
  bodyLit: '#251633',   // the chhajja cornice bands catch the sky
  recess: '#0f0817',    // arch openings and recesses
};

/** One pointed lotus-bud merlon, base-aligned at y=`base`. */
function merlon(x, w, h, base) {
  const shoulder = base - h * 0.45;
  const apex = base - h * 1.06;
  return (
    `M${x.toFixed(1)},${base.toFixed(1)}` +
    `L${x.toFixed(1)},${shoulder.toFixed(1)}` +
    `Q${(x + w / 2).toFixed(1)},${apex.toFixed(1)} ${(x + w).toFixed(1)},${shoulder.toFixed(1)}` +
    `L${(x + w).toFixed(1)},${base.toFixed(1)}Z`
  );
}

/** A run of merlons from x0 to x1 on the given pitch. */
function merlonRun(x0, x1, pitch, h, base, duty = 0.74) {
  const n = Math.round((x1 - x0) / pitch);
  const w = pitch * duty;
  return Array.from({ length: n }, (_, i) =>
    merlon(x0 + i * pitch + (pitch - w) / 2, w, h, base)).join('');
}

/** A pointed-arch recess: the blind arcading all over the fort's faces. */
function archRecess(cx, w, top, base) {
  const half = w / 2;
  const spring = top + w * 0.42;
  return (
    `M${(cx - half).toFixed(1)},${base.toFixed(1)}` +
    `L${(cx - half).toFixed(1)},${spring.toFixed(1)}` +
    `Q${(cx - half).toFixed(1)},${top.toFixed(1)} ${cx.toFixed(1)},${(top - w * 0.16).toFixed(1)}` +
    `Q${(cx + half).toFixed(1)},${top.toFixed(1)} ${(cx + half).toFixed(1)},${spring.toFixed(1)}` +
    `L${(cx + half).toFixed(1)},${base.toFixed(1)}Z`
  );
}

/** A chhatri: the domed kiosk on every Mughal roofline. */
function chhatri(cx, base, w, h) {
  const colH = h * 0.34;
  const colW = w * 0.07;
  const archTop = base - colH;
  const entabY = archTop - h * 0.07;
  const domeBase = entabY;
  const apex = domeBase - h * 0.48;

  const pillars = [-0.42, -0.15, 0.15, 0.42]
    .map((f) => `<rect x="${(cx + w * f - colW / 2).toFixed(1)}" y="${archTop.toFixed(1)}" ` +
                `width="${colW.toFixed(1)}" height="${colH.toFixed(1)}"/>`)
    .join('');

  /* A Mughal dome is taller than a hemisphere and bulges outward below its
     widest point, so the curve leaves the base going outward before it turns
     in. A plain arc here reads as a flat cap, not a dome. */
  const dome =
    `M${(cx - w * 0.34).toFixed(1)},${domeBase.toFixed(1)}` +
    `C${(cx - w * 0.44).toFixed(1)},${(domeBase - h * 0.22).toFixed(1)} ` +
    `${(cx - w * 0.27).toFixed(1)},${apex.toFixed(1)} ${cx.toFixed(1)},${apex.toFixed(1)}` +
    `C${(cx + w * 0.27).toFixed(1)},${apex.toFixed(1)} ` +
    `${(cx + w * 0.44).toFixed(1)},${(domeBase - h * 0.22).toFixed(1)} ` +
    `${(cx + w * 0.34).toFixed(1)},${domeBase.toFixed(1)}Z`;

  return (
    `<g fill="${FORT.body}">` +
    `<rect x="${(cx - w * 0.54).toFixed(1)}" y="${base.toFixed(1)}" width="${(w * 1.08).toFixed(1)}" height="${(h * 0.07).toFixed(1)}"/>` +
    pillars +
    `<rect x="${(cx - w * 0.5).toFixed(1)}" y="${entabY.toFixed(1)}" width="${w.toFixed(1)}" height="${(h * 0.075).toFixed(1)}"/>` +
    `<path d="${dome}"/>` +
    `<rect x="${(cx - w * 0.028).toFixed(1)}" y="${(apex - h * 0.15).toFixed(1)}" width="${(w * 0.056).toFixed(1)}" height="${(h * 0.16).toFixed(1)}"/>` +
    `<circle cx="${cx.toFixed(1)}" cy="${(apex - h * 0.175).toFixed(1)}" r="${(w * 0.05).toFixed(1)}"/>` +
    `</g>`
  );
}

/* ── the tiling curtain wall ─────────────────────────────────────────────── */

const WALL_W = 240;
const WALL_H = 180;

const wallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WALL_W} ${WALL_H}" width="${WALL_W}" height="${WALL_H}" preserveAspectRatio="none">
  <!-- wall body -->
  <rect y="38" width="${WALL_W}" height="${WALL_H - 38}" fill="${FORT.body}"/>
  <!-- merlons: pitch divides the tile width exactly, so the tile repeats seamlessly -->
  <path d="${merlonRun(0, WALL_W, 24, 26, 40)}" fill="${FORT.body}"/>
  <!-- chhajja: the projecting cornice under the parapet -->
  <rect y="38" width="${WALL_W}" height="7" fill="${FORT.bodyLit}"/>
  <!-- blind arcading on the wall face -->
  <g fill="${FORT.recess}">
    ${[40, 100, 160, 220].map((cx) => `<path d="${archRecess(cx, 30, 62, 132)}"/>`).join('\n    ')}
  </g>
  <!-- No plinth band here: it is drawn in CSS across the whole horizon, so it
       stays continuous where the gate meets the wall. The two SVGs are shown at
       different heights, so a band baked into each would never line up. -->
</svg>
`;
out('fort-wall.svg', wallSvg);

/* ── the Lahori Gate ─────────────────────────────────────────────────────── */

const G_W = 560;
const G_BODY = 330;
/* Headroom above the masonry. A chhatri stands a little over its own nominal
   height above its base once the dome and finial are counted, and without this
   pad the tallest domes get clipped flat by the top of the viewBox. */
const G_PAD = 60;
const G_H = G_BODY + G_PAD;
const GC = G_W / 2; // 280

/* Bastions stand taller than the block between them, and each carries a big
   chhatri; the central block carries three smaller ones that sit below the
   bastion parapets, which is what gives the gate its stepped roofline. */
const gateSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G_W} ${G_H}" width="${G_W}" height="${G_H}">
 <g transform="translate(0 ${G_PAD})">
  <g fill="${FORT.body}">
    <!-- No flanking wings: the tiling curtain wall already covers the horizon at
         that height, and a second merlon row here at a slightly different pitch
         and height showed as slivers where the two interleaved. The bastions
         simply rise out of the wall, which is how the real gate reads. -->

    <!-- central block -->
    <rect x="150" y="122" width="260" height="${G_BODY - 122}"/>
    <path d="${merlonRun(152, 408, 25.6, 25, 124)}"/>

    <!-- bastions, tapering very slightly inward as they rise -->
    <path d="M44,${G_BODY} L48,82 L152,82 L152,${G_BODY} Z"/>
    <path d="M${G_W - 44},${G_BODY} L${G_W - 48},82 L${G_W - 152},82 L${G_W - 152},${G_BODY} Z"/>
    <path d="${merlonRun(48, 152, 26, 26, 84)}"/>
    <path d="${merlonRun(G_W - 152, G_W - 48, 26, 26, 84)}"/>
  </g>

  <!-- chhajja cornices -->
  <g fill="${FORT.bodyLit}">
    <rect x="146" y="122" width="268" height="8"/>
    <rect x="42" y="82" width="114" height="8"/>
    <rect x="${G_W - 156}" y="82" width="114" height="8"/>
    <rect x="150" y="196" width="260" height="6"/>
  </g>

  <!-- the great gateway, and the blind arcading around it -->
  <g fill="${FORT.recess}">
    <path d="${archRecess(GC, 84, 188, G_BODY)}"/>
    ${[188, 218, 248, 312, 342, 372].map((cx) => `<path d="${archRecess(cx, 22, 148, 190)}"/>`).join('\n    ')}
    ${[78, 122, G_W - 122, G_W - 78].map((cx) => `<path d="${archRecess(cx, 26, 128, 200)}"/>`).join('\n    ')}
    ${[78, 122, G_W - 122, G_W - 78].map((cx) => `<path d="${archRecess(cx, 24, 226, 286)}"/>`).join('\n    ')}
    ${[196, 364].map((cx) => `<path d="${archRecess(cx, 26, 226, 286)}"/>`).join('\n    ')}
  </g>

  <!-- rooflines -->
  ${chhatri(100, 58, 50, 84)}
  ${chhatri(G_W - 100, 58, 50, 84)}
  ${chhatri(GC, 98, 46, 70)}
  ${chhatri(206, 98, 34, 54)}
  ${chhatri(354, 98, 34, 54)}
 </g>
</svg>
`;
out('fort-gate.svg', gateSvg);

/* --------------------------------------------------- PNG encoder (og:image) */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGB Uint8Array (w*h*3) as a PNG buffer. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // 10..12 = compression, filter, interlace — all zero.

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------- draw the og:image */

const OG_W = 1200;
const OG_H = 630;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a + (b - a) * t;
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const px = new Uint8Array(OG_W * OG_H * 3);
/* x and y must land on integers: this indexes a Uint8Array, and a fractional
   index is silently dropped rather than rounded, which shows up as missing
   pixels rather than as an error. */
const put = (x, y, rgb, alpha = 1) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= OG_W || y >= OG_H) return;
  const i = (y * OG_W + x) * 3;
  px[i] = lerp(px[i], rgb[0], alpha);
  px[i + 1] = lerp(px[i + 1], rgb[1], alpha);
  px[i + 2] = lerp(px[i + 2], rgb[2], alpha);
};

// Dawn sky: deep indigo overhead falling to a warm horizon.
const SKY_TOP = hex('#0a0f2c');
const SKY_MID = hex('#2a2350');
const SKY_LOW = hex('#8f4a3a');
const SKY_HORIZON = hex('#e8a34a');
for (let y = 0; y < OG_H; y++) {
  const t = y / (OG_H - 1);
  const c =
    t < 0.45
      ? mixRgb(SKY_TOP, SKY_MID, t / 0.45)
      : t < 0.78
        ? mixRgb(SKY_MID, SKY_LOW, (t - 0.45) / 0.33)
        : mixRgb(SKY_LOW, SKY_HORIZON, (t - 0.78) / 0.22);
  for (let x = 0; x < OG_W; x++) put(x, y, c);
}

// Sun glow low on the right, additive-ish.
const SUN = { x: 905, y: 545, r: 300 };
for (let y = SUN.y - SUN.r; y <= SUN.y + SUN.r; y++) {
  for (let x = SUN.x - SUN.r; x <= SUN.x + SUN.r; x++) {
    const d = Math.hypot(x - SUN.x, y - SUN.y);
    if (d > SUN.r) continue;
    put(x, y, hex('#ffd79a'), 0.4 * (1 - d / SUN.r) ** 2.2);
  }
}

// Flag: 3:2, hoisted upper-left, with a gentle vertical wave so it reads as cloth.
const FL = { x: 300, y: 132, w: 594, h: 396 };
const waveAt = (x) => {
  const p = (x - FL.x) / FL.w;
  return Math.sin(p * Math.PI * 2.1) * 15 * p + Math.sin(p * Math.PI * 4.3 + 1) * 5 * p;
};
const shadeAt = (x) => {
  const p = (x - FL.x) / FL.w;
  return 1 + Math.cos(p * Math.PI * 2.1) * 0.13 * p;
};

const BANDS = [hex(SAFFRON), hex(WHITE), hex(GREEN)];
const bandH = FL.h / 3;
const chR = (bandH * 0.75) / 2;
const chC = { x: FL.x + FL.w / 2, y: FL.y + FL.h / 2 };
const navy = hex(NAVY);

// Supersample 3x3 so the chakra and the flag edges stay clean.
const SS = 3;
for (let y = 0; y < OG_H; y++) {
  for (let x = 0; x < OG_W; x++) {
    let hits = 0;
    let acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const fx = x + (sx + 0.5) / SS;
        const fy = y + (sy + 0.5) / SS;
        if (fx < FL.x || fx > FL.x + FL.w) continue;
        const dy = waveAt(fx);
        const top = FL.y + dy;
        if (fy < top || fy > top + FL.h) continue;

        // Position within the un-waved flag.
        const ly = fy - top;
        let col = BANDS[Math.min(2, Math.floor(ly / bandH))];

        // Chakra, sampled in flag-local space.
        const cdx = fx - chC.x;
        const cdy = fy - (chC.y + dy);
        const d = Math.hypot(cdx, cdy);
        if (d <= chR * 1.02) {
          const c = CHAKRA;
          let ink = false;
          if (Math.abs(d - c.rim * chR) <= (c.rimWidth * chR) / 2) ink = true;
          else if (d <= c.hub * chR) ink = true;
          else if (d >= c.spokeInner * chR && d <= c.spokeOuter * chR) {
            // Distance to the nearest spoke centreline, measured across the arm.
            const ang = Math.atan2(cdy, cdx);
            const step = (Math.PI * 2) / c.spokes;
            const off = Math.abs(((ang % step) + step * 1.5) % step - step / 2);
            const t = (d - c.spokeInner * chR) / ((c.spokeOuter - c.spokeInner) * chR);
            const half = lerp(c.spokeHalfInner, c.spokeHalfOuter, t) * chR;
            if (off * d <= half) ink = true;
          }
          if (!ink && d >= (c.budAt - c.budRadius) * chR && d <= (c.budAt + c.budRadius) * chR) {
            const ang = Math.atan2(cdy, cdx);
            const step = (Math.PI * 2) / c.spokes;
            for (let k = 0; k < c.spokes; k++) {
              const bx = Math.cos(k * step) * c.budAt * chR;
              const by = Math.sin(k * step) * c.budAt * chR;
              if (Math.hypot(cdx - bx, cdy - by) <= c.budRadius * chR) { ink = true; break; }
            }
            void ang;
          }
          if (ink) col = navy;
        }

        const sh = shadeAt(fx);
        acc[0] += Math.min(255, col[0] * sh);
        acc[1] += Math.min(255, col[1] * sh);
        acc[2] += Math.min(255, col[2] * sh);
        hits++;
      }
    }
    if (hits) {
      const a = hits / (SS * SS);
      put(x, y, [acc[0] / hits, acc[1] / hits, acc[2] / hits], a);
    }
  }
}

// Flagpole + finial, drawn after the flag so the pole sits in front of the hoist edge.
const POLE = { x: 292, top: 96, bottom: 630, w: 11 };
for (let y = POLE.top; y < POLE.bottom; y++) {
  for (let x = POLE.x; x < POLE.x + POLE.w; x++) {
    const t = (x - POLE.x) / POLE.w;
    put(x, y, mixRgb(hex('#c9ccd6'), hex('#4a4f61'), Math.abs(t - 0.35) * 1.7));
  }
}
for (let y = POLE.top - 26; y < POLE.top + 4; y++) {
  for (let x = POLE.x - 8; x < POLE.x + POLE.w + 8; x++) {
    const d = Math.hypot(x - (POLE.x + POLE.w / 2), y - (POLE.top - 11));
    if (d <= 12) put(x, y, mixRgb(hex('#ffe9a8'), hex('#b8860b'), d / 12));
  }
}

// Red Fort style ramparts along the bottom.
const RAMPART = hex('#140d1e');
/* Height of the merlon standing above the parapet at x — a semi-ellipse, which
   is a close enough read of the fort's lotus-bud profile at this size. Square
   notches here would not match the fort in the app. */
const ogMerlonRise = (x) => {
  const period = 34;
  const w = 25;
  const p = ((x % period) + period) % period;
  if (p >= w) return 0;
  const t = (p / w) * 2 - 1;
  return 21 * Math.sqrt(Math.max(0, 1 - t * t));
};
for (let x = 0; x < OG_W; x++) {
  const wallTop = Math.round(566 - ogMerlonRise(x));
  for (let y = wallTop; y < OG_H; y++) put(x, y, RAMPART, 0.94);
}

out('og.png', encodePng(OG_W, OG_H, px));

/* ══════════════════════════════════════════════════════════════ app icons ══
   Real PNGs, because iOS ignores an SVG apple-touch-icon and Android's install
   dialog wants raster too. Drawn here rather than exported by hand so the icon
   can never drift out of step with the flag.

   Two shapes are needed. A normal icon is shown as-drawn, so it carries its own
   rounded corners. A maskable icon is cropped to whatever shape the launcher
   likes — anything up to a full circle — so its artwork has to stay inside the
   centre 80% "safe zone" while the background bleeds to all four edges.
   ========================================================================== */

function drawIcon(size, { maskable = false } = {}) {
  const buf = new Uint8Array(size * size * 3);
  const set = (x, y, rgb, a = 1) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    buf[i] = lerp(buf[i], rgb[0], a);
    buf[i + 1] = lerp(buf[i + 1], rgb[1], a);
    buf[i + 2] = lerp(buf[i + 2], rgb[2], a);
  };

  /* Background: the night sky, warming toward the bottom like the app does. */
  const top = hex('#0a0f2c');
  const bot = hex('#3a2247');
  const radius = maskable ? 0 : size * 0.22;
  for (let y = 0; y < size; y++) {
    const c = mixRgb(top, bot, y / (size - 1));
    for (let x = 0; x < size; x++) {
      /* Rounded-rect corners, antialiased, for the non-maskable icon only. */
      let a = 1;
      if (radius) {
        const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
        const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
        if (dx > 0 && dy > 0) {
          const d = Math.hypot(dx, dy);
          if (d > radius + 0.7) continue;
          a = Math.min(1, Math.max(0, radius + 0.5 - d));
        }
      }
      set(x, y, c, a);
    }
  }

  /* The flag, inside the safe zone. Supersampled so the chakra holds up at
     192px, where a spoke is under two pixels wide. */
  const safe = maskable ? 0.62 : 0.76;
  const fw = size * safe;
  const fh = fw / 1.5;
  const fx = (size - fw) / 2 + size * (maskable ? 0.04 : 0.05);
  const fy = (size - fh) / 2;

  const bandH = fh / 3;
  const chR = (bandH * 0.75) / 2;
  const bands = [hex(SAFFRON), hex(WHITE), hex(GREEN)];
  const navy = hex(NAVY);
  const c = CHAKRA;
  const wave = (p) => Math.sin(p * Math.PI * 2) * fh * 0.045 * p;

  const SS = 4;
  for (let y = Math.floor(fy - fh * 0.2); y < Math.ceil(fy + fh * 1.2); y++) {
    for (let x = Math.floor(fx); x < Math.ceil(fx + fw); x++) {
      let hits = 0;
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px2 = x + (sx + 0.5) / SS;
          const py2 = y + (sy + 0.5) / SS;
          if (px2 < fx || px2 > fx + fw) continue;
          const dy = wave((px2 - fx) / fw);
          const localY = py2 - (fy + dy);
          if (localY < 0 || localY > fh) continue;

          let col = bands[Math.min(2, Math.floor(localY / bandH))];
          const cdx = px2 - (fx + fw / 2);
          const cdy = localY - fh / 2;
          const d = Math.hypot(cdx, cdy);
          if (d <= chR * 1.02) {
            let ink = false;
            if (Math.abs(d - c.rim * chR) <= (c.rimWidth * chR) / 2) ink = true;
            else if (d <= c.hub * chR) ink = true;
            else if (d >= c.spokeInner * chR && d <= c.budAt * chR) {
              const step = (Math.PI * 2) / c.spokes;
              const ang = Math.atan2(cdy, cdx);
              const off = Math.abs((((ang % step) + step * 1.5) % step) - step / 2);
              const t = (d - c.spokeInner * chR) / ((c.spokeOuter - c.spokeInner) * chR);
              const half = lerp(c.spokeHalfInner, c.spokeHalfOuter, Math.min(1, t)) * chR;
              if (off * d <= half) ink = true;
            }
            if (ink) col = navy;
          }
          acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
          hits++;
        }
      }
      if (hits) {
        const a = hits / (SS * SS);
        set(x, y, [acc[0] / hits, acc[1] / hits, acc[2] / hits], a);
      }
    }
  }

  /* Flagpole, in front of the hoist edge. */
  const poleW = Math.max(2, size * 0.022);
  for (let y = fy - fh * 0.16; y < fy + fh * 1.16; y++) {
    for (let x = fx - poleW; x < fx; x++) {
      set(x, y, mixRgb(hex('#dfe3ee'), hex('#5b6073'), (x - (fx - poleW)) / poleW));
    }
  }

  return encodePng(size, size, buf);
}

out('icons/icon-192.png', drawIcon(192));
out('icons/icon-512.png', drawIcon(512));
out('icons/icon-maskable-512.png', drawIcon(512, { maskable: true }));
out('icons/apple-touch-icon.png', drawIcon(180));

console.log('\ndone.');
