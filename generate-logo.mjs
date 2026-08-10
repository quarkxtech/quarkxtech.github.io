// One-time: npm i opentype.js canvas
import opentype from 'opentype.js';
import { createCanvas } from 'canvas';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = 'assets';
await fs.mkdir(OUT, { recursive: true });

// Fetch Fraunces TTFs (regular 400 + italic 500) from fontsource
async function fetchTTF(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed ${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
const REG = 'https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-400-normal.ttf';
const ITAL = 'https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-500-italic.ttf';
const [regBuf, italBuf] = await Promise.all([fetchTTF(REG), fetchTTF(ITAL)]);
const reg = opentype.parse(regBuf.buffer.slice(regBuf.byteOffset, regBuf.byteOffset + regBuf.byteLength));
const ital = opentype.parse(italBuf.buffer.slice(italBuf.byteOffset, italBuf.byteOffset + italBuf.byteLength));

// Manual layout because letter-spacing isn't in getPath
function layout(font, text, x, y, size, ls = 0) {
  const p = new opentype.Path();
  let cx = x;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    p.extend(g.getPath(cx, y, size));
    cx += (g.advanceWidth * size) / font.unitsPerEm + ls;
  }
  return p;
}

// Measure rightmost ink of a string (not advance), needed because the 'k'
// has an arm that extends past its advance width, and we want the italic X
// to clear the actual glyph, not the metric box.
function measureRightInk(font, text, x, size, ls = 0) {
  let cx = x, right = -Infinity;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    const bb = g.getPath(cx, 0, size).getBoundingBox();
    if (bb.x2 > right) right = bb.x2;
    cx += (g.advanceWidth * size) / font.unitsPerEm + ls;
  }
  return right;
}

// Measure leftmost ink of a string (italic X has negative side bearing, its
// top-left ink can sit left of the pen origin).
function measureLeftInk(font, text, x, size, ls = 0) {
  let cx = x, left = Infinity;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    const bb = g.getPath(cx, 0, size).getBoundingBox();
    if (bb.x1 < left) left = bb.x1;
    cx += (g.advanceWidth * size) / font.unitsPerEm + ls;
  }
  return left;
}

// Compute the X pen origin so its leftmost ink sits `gap` units right of
// "Quark"'s rightmost ink, regardless of font version or letter-spacing.
function xOriginFor(size, ls, gap) {
  const quarkRight = measureRightInk(reg, 'Quark', 0, size, ls);
  const xLeftAtZero = measureLeftInk(ital, 'X', 0, size, ls);
  return quarkRight + gap - xLeftAtZero;
}

// Custom path serializer, because opentype.js's toPathData has a NaN bug when
// a coordinate's fractional part is sub-precision floating-point noise
// (e.g. 2.77e-17), because it concatenates that into "Ne+3" before parsing.
// We round ourselves, then format with toFixed, stripping trailing zeros.
function fmt(n, p = 3) {
  const s = (Math.round(n * 10 ** p) / 10 ** p).toFixed(p);
  return s.replace(/\.?0+$/, '');
}
function pathToD(path) {
  let d = '';
  for (const c of path.commands) {
    if (c.type === 'M') d += `M${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === 'L') d += `L${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === 'Q') d += `Q${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === 'C') d += `C${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  return d;
}

// ── Lockup width: measured so the X's right ink + a small margin fits ───
const GAP = 4; // visual gap between 'k' ink and 'X' ink, in viewBox units
const RIGHT_PAD = 6;
const _xOrigin = xOriginFor(64, -2, GAP);
const _xRight = measureRightInk(ital, 'X', _xOrigin, 64, -2);
const LOCKUP_W = Math.ceil(_xRight + RIGHT_PAD);

// ── PNG renderer ────────────────────────────────────────
function renderLockupPNG(scale, ink, accent, bg) {
  const W = LOCKUP_W * scale, H = 80 * scale;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
  const fs = 64 * scale, ls = -2 * scale;
  // Quark
  let cx = 0;
  for (const ch of 'Quark') {
    const g = reg.charToGlyph(ch);
    const p = g.getPath(cx, 60 * scale, fs); p.fill = ink; p.draw(ctx);
    cx += (g.advanceWidth * fs) / reg.unitsPerEm + ls;
  }
  // X (italic, accent): origin measured so its left ink clears 'k' by GAP
  cx = xOriginFor(fs, ls, GAP * scale);
  for (const ch of 'X') {
    const g = ital.charToGlyph(ch);
    const p = g.getPath(cx, 60 * scale, fs); p.fill = accent; p.draw(ctx);
    cx += (g.advanceWidth * fs) / ital.unitsPerEm + ls;
  }
  return cv.toBuffer('image/png');
}

function renderFaviconPNG(size, accent, bg) {
  const cv = createCanvas(size, size);
  const ctx = cv.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
  const k = size / 64;
  const g = ital.charToGlyph('X');
  const p = g.getPath(6 * k, 54 * k, 62 * k); p.fill = accent; p.draw(ctx);
  return cv.toBuffer('image/png');
}

// ── SVG renderer (path outlines, font-independent) ──────
function lockupSVG(ink, accent) {
  const quark = layout(reg, 'Quark', 0, 60, 64, -2);
  const xOrigin = xOriginFor(64, -2, GAP);
  const x = layout(ital, 'X', xOrigin, 60, 64, -2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOCKUP_W} 80" width="${LOCKUP_W}" height="80">
  <path fill="${ink}" d="${pathToD(quark)}"/>
  <path fill="${accent}" d="${pathToD(x)}"/>
</svg>
`;
}
function faviconSVG(accent) {
  const x = layout(ital, 'X', 6, 54, 62, -2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path fill="${accent}" d="${pathToD(x)}"/>
</svg>
`;
}

// ── Write everything ────────────────────────────────────
const INK = '#1a1410', ACCENT = '#a84432', PAPER = '#f4ece3', ACCENT_DARK = '#c47a4a';

// SVGs (these are the canonical ones for the site: outlined, font-independent)
await fs.writeFile(path.join(OUT, 'quarkx-lockup-light.svg'), lockupSVG(INK, ACCENT));
await fs.writeFile(path.join(OUT, 'quarkx-lockup-dark.svg'), lockupSVG(PAPER, ACCENT_DARK));
await fs.writeFile(path.join(OUT, 'favicon-x.svg'), faviconSVG(ACCENT));

// PNGs (for social, decks, anywhere SVG isn't great)
for (const s of [1, 2, 4]) {
  await fs.writeFile(path.join(OUT, `quarkx-lockup-light-${s}x.png`), renderLockupPNG(s, INK, ACCENT, PAPER));
  await fs.writeFile(path.join(OUT, `quarkx-lockup-dark-${s}x.png`), renderLockupPNG(s, PAPER, ACCENT_DARK, INK));
}
await fs.writeFile(path.join(OUT, 'quarkx-lockup-light-transparent.png'), renderLockupPNG(4, INK, ACCENT, null));
await fs.writeFile(path.join(OUT, 'quarkx-lockup-dark-transparent.png'), renderLockupPNG(4, PAPER, ACCENT_DARK, null));

for (const s of [16, 32, 64]) {
  await fs.writeFile(path.join(OUT, `favicon-${s}.png`), renderFaviconPNG(s, ACCENT, null));
}
await fs.writeFile(path.join(OUT, 'favicon-180.png'), renderFaviconPNG(180, ACCENT, PAPER));
await fs.writeFile(path.join(OUT, 'favicon-512.png'), renderFaviconPNG(512, ACCENT, PAPER));

console.log('✓ Logo files written to ./assets/');
