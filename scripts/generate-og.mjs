// One-time: npm run build:og  (deps: npm i opentype.js canvas)
// Renders assets/og-image.png, the 1200x630 link-preview card: one flat cream
// field, the wordmark centred, one whispered line beneath. The card is the
// mark, not a poster.
import opentype from "opentype.js";
import { createCanvas, loadImage } from "canvas";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Output is resolved against the repository root, not the working directory, so
   the script produces the same file wherever it is invoked from. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OG_IMAGE = path.join(REPO_ROOT, "assets", "og-image.png");

const W = 1200;
const H = 630;

async function fetchTTF(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed ${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const monoBuf = await fetchTTF(
  "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@latest/latin-500-normal.ttf"
);
const mono = opentype.parse(
  monoBuf.buffer.slice(monoBuf.byteOffset, monoBuf.byteOffset + monoBuf.byteLength)
);

function draw(ctx, font, text, x, y, size, color, ls = 0) {
  let cx = x;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    const p = g.getPath(cx, y, size);
    p.fill = color;
    p.draw(ctx);
    cx += (g.advanceWidth * size) / font.unitsPerEm + ls;
  }
  return cx;
}

/** Advance width of a letterspaced string, for centring. */
function width(font, text, size, ls = 0) {
  return font.getAdvanceWidth(text, size) + ls * Math.max(0, text.length - 1);
}

function drawCentered(ctx, font, text, y, size, color, ls = 0) {
  draw(ctx, font, text, (W - width(font, text, size, ls)) / 2, y, size, color, ls);
}

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#f2ebdf";
ctx.fillRect(0, 0, W, H);

// The site's own wordmark, centred, from its transparent-ground render.
const lockup = await loadImage(
  path.join(REPO_ROOT, "assets", "quarkx-lockup-light-transparent.png")
);
const lw = 520;
const lh = (lockup.height / lockup.width) * lw;
ctx.drawImage(lockup, (W - lw) / 2, H / 2 - lh / 2 - 36, lw, lh);

drawCentered(
  ctx,
  mono,
  "AUTONOMOUS INTELLIGENCE",
  H / 2 + lh / 2 + 42,
  19,
  "#99562d",
  8
);

await fs.writeFile(OG_IMAGE, canvas.toBuffer("image/png"));
console.log(`wrote ${path.relative(REPO_ROOT, OG_IMAGE)}`);
