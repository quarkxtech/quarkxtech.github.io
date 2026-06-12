// One-time: node generate-og.mjs  (deps: npm i opentype.js canvas)
// Renders assets/og-image.png — 1200x630 social card matching the site look.
import opentype from "opentype.js";
import { createCanvas } from "canvas";
import fs from "node:fs/promises";

const W = 1200;
const H = 630;

async function fetchTTF(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed ${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const [serifBuf, monoBuf] = await Promise.all([
  fetchTTF(
    "https://cdn.jsdelivr.net/fontsource/fonts/dm-serif-display@latest/latin-400-normal.ttf"
  ),
  fetchTTF(
    "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@latest/latin-500-normal.ttf"
  ),
]);
const serif = opentype.parse(
  serifBuf.buffer.slice(serifBuf.byteOffset, serifBuf.byteOffset + serifBuf.byteLength)
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

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// background
const bg = ctx.createLinearGradient(0, 0, 0, H);
bg.addColorStop(0, "#f4ece3");
bg.addColorStop(1, "#ece0cf");
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// faint grid
ctx.strokeStyle = "rgba(34,26,19,0.05)";
ctx.lineWidth = 1;
for (let x = 0; x <= W; x += 60) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}
for (let y = 0; y <= H; y += 60) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

// glowing signal path sweeping the card
function signal(alpha, width, blur) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-60, 520);
  ctx.bezierCurveTo(300, 560, 520, 380, 760, 430);
  ctx.bezierCurveTo(960, 470, 1080, 360, 1240, 300);
  const grad = ctx.createLinearGradient(0, 520, W, 300);
  grad.addColorStop(0, `rgba(178,108,61,0)`);
  grad.addColorStop(0.55, `rgba(217,119,87,${alpha * 0.65})`);
  grad.addColorStop(1, `rgba(255,157,114,${alpha})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(217,119,87,0.9)";
  ctx.shadowBlur = blur;
  ctx.stroke();
  ctx.restore();
}
signal(0.25, 26, 60);
signal(0.55, 10, 30);
signal(1, 3.4, 14);

// head glow
const head = ctx.createRadialGradient(1140, 322, 0, 1140, 322, 90);
head.addColorStop(0, "rgba(255,138,92,0.95)");
head.addColorStop(0.25, "rgba(255,157,114,0.5)");
head.addColorStop(1, "rgba(255,157,114,0)");
ctx.fillStyle = head;
ctx.beginPath();
ctx.arc(1140, 322, 90, 0, Math.PI * 2);
ctx.fill();

// copy
draw(ctx, mono, "QUARKX — AUTONOMOUS INTELLIGENCE", 84, 130, 19, "#b8512e", 6);
draw(ctx, serif, "Systems that observe,", 80, 240, 74, "#221a13");
draw(ctx, serif, "reason, and intervene.", 80, 330, 74, "#221a13");
draw(
  ctx,
  mono,
  "AGENTIC SYSTEMS FOR THE PHYSICAL WORLD",
  84,
  408,
  17,
  "rgba(95,81,71,0.95)",
  4
);
draw(ctx, mono, "QUARKXTECH.GITHUB.IO", 84, 566, 15, "rgba(147,131,111,0.95)", 4);

await fs.writeFile("assets/og-image.png", canvas.toBuffer("image/png"));
console.log("wrote assets/og-image.png");
