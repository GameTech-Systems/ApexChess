// Rebuilds the launch images in apps/web/public from the existing logo (favicon.svg): the social
// share card, the app icons, and favicon.ico. It only places the logo and plain text; it draws
// no new art. Playwright is not a project dependency, so run it where it is installed:
//   node scripts/brand-images.mjs
// The generated PNGs are committed; run this only when the logo or the tagline changes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Buffer } from "node:buffer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps", "web", "public");
const { chromium } = createRequire(import.meta.url)("playwright");

const PAGE = "#f3f6fa";
const INK = "#1c2740";
const MUTED = "#586378";
const BRASS = "#c99a2e";
const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Noto Serif",Georgia,"DejaVu Serif",serif`;
const SANS = `system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Liberation Sans",sans-serif`;

const logo = readFileSync(join(out, "favicon.svg"), "utf8");
const logoUri = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;

const card = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:${PAGE};position:relative;overflow:hidden;font-family:${SANS};color:${INK}}
  .bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:${BRASS}}
  img{position:absolute;left:96px;top:95px;width:440px;height:440px}
  .t{position:absolute;left:600px;top:112px;right:60px}
  .name{font:700 40px ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin:0 0 20px}
  h1{margin:0;font:700 104px/0.95 ${SERIF};letter-spacing:-.02em}
  h1 span{display:block}
  h1 .s{padding-left:.8em}
  p{margin:30px 0 0;font:400 30px/1.35 ${SANS};color:#2f3b55;max-width:540px}
  .url{position:absolute;left:600px;bottom:44px;font:600 28px ${SANS};color:${MUTED}}
</style>
<div class="bar"></div><img src="${logoUri}" alt="">
<div class="t"><div class="name">Apex Chess</div><h1><span>Chess</span><span class="s">Shifted</span></h1>
<p>The chess pieces you know, on a board turned 45°.</p></div>
<div class="url">apexchess.icu</div>`;

const icon = (size) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}body{width:${size}px;height:${size}px;background:${PAGE};display:grid;place-items:center}
  img{width:${Math.round(size * 0.8)}px;height:${Math.round(size * 0.8)}px}</style><img src="${logoUri}" alt="">`;

const bare = (size) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${logoUri}" alt="">`;

const browser = await chromium.launch();
async function shot(html, w, h, file, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.waitForLoadState("load");
  const buf = await page.screenshot({ omitBackground: transparent });
  await page.close();
  if (file) writeFileSync(join(out, file), buf);
  return buf;
}

mkdirSync(out, { recursive: true });
await shot(card, 1200, 630, "og-image.png");
await shot(icon(180), 180, 180, "apple-touch-icon.png");
await shot(icon(192), 192, 192, "icon-192.png");
await shot(icon(512), 512, 512, "icon-512.png");

// favicon.ico: PNG images inside an ICO container (16, 32 and 48 px; supported by every current browser).
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await shot(bare(s), s, s, undefined, true));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  head[e] = s;
  head[e + 1] = s;
  head.writeUInt16LE(1, e + 4);
  head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[i].length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
writeFileSync(join(out, "favicon.ico"), Buffer.concat([head, ...pngs]));
await browser.close();
