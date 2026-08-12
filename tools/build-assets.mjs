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

/* ------------------------------------------------------- PNG encoder (og:image) */

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
const put = (x, y, rgb, alpha = 1) => {
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
const merlon = (x) => {
  const period = 46;
  const p = ((x % period) + period) % period;
  return p < 26 ? 0 : 17; // notch height
};
for (let x = 0; x < OG_W; x++) {
  const wallTop = 566 + merlon(x) - 17;
  for (let y = wallTop; y < OG_H; y++) put(x, y, RAMPART, 0.94);
}

out('og.png', encodePng(OG_W, OG_H, px));
console.log('\ndone.');
