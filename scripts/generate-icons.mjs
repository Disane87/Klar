/**
 * Generates all PWA icons, favicons, and OG image for Klar
 * Uses Playwright (already a dev dep) to render SVG → PNG
 * Run: node scripts/generate-icons.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js');
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '../apps/web/src/icons');
const WEB_SRC   = join(__dirname, '../apps/web/src');

mkdirSync(ICONS_DIR, { recursive: true });

// ── Logo SVG (Variante D: Weiß→Lavendel, keine Mittellinie) ─────────────────
const LOGO_SVG = `
  <defs>
    <linearGradient id="fg" x1="7" y1="5" x2="26" y2="27" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#c7d2fe"/>
    </linearGradient>
  </defs>
  <rect x="7"    y="5"   width="2.2" height="22" rx="1.1" fill="url(#fg)"/>
  <rect x="14.6" y="3.8" width="2.2" height="14" rx="1.1" transform="rotate(32 15.7 10.8)" fill="url(#fg)"/>
  <rect x="14.6" y="14"  width="2.2" height="14" rx="1.1" transform="rotate(-32 15.7 21)"  fill="url(#fg)"/>
`;

// Icon auf dunklem Hintergrund (Standard PWA)
function iconHtml(size, padding = 0.2) {
  const p = Math.round(size * padding);
  const inner = size - p * 2;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:#09090b}
  .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
  </style></head><body>
  <div class="wrap">
    <svg width="${inner}" height="${inner}" viewBox="0 0 32 32" fill="none">${LOGO_SVG}</svg>
  </div></body></html>`;
}

// Maskable: mehr Padding (safe zone = 40% Rand)
function maskableHtml(size) {
  const inner = Math.round(size * 0.4);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:#09090b}
  .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
  </style></head><body>
  <div class="wrap">
    <svg width="${inner}" height="${inner}" viewBox="0 0 32 32" fill="none">${LOGO_SVG}</svg>
  </div></body></html>`;
}

// Apple Touch Icon: kein Radius (iOS macht das selbst), leicht mehr Logo
function appleHtml(size) {
  const inner = Math.round(size * 0.55);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:#09090b}
  .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
  </style></head><body>
  <div class="wrap">
    <svg width="${inner}" height="${inner}" viewBox="0 0 32 32" fill="none">${LOGO_SVG}</svg>
  </div></body></html>`;
}

// OG Image: 1200×630 mit Wordmark
function ogHtml() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&display=swap" rel="stylesheet"/>
  <style>*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden;
    background:linear-gradient(135deg,#09090b 0%,#111113 60%,#0f0f14 100%)}
  .wrap{width:1200px;height:630px;display:flex;align-items:center;justify-content:center;gap:24px}
  .wordmark{color:white;font-family:'Space Grotesk',system-ui,sans-serif;font-weight:500;
    font-size:88px;letter-spacing:-0.035em;line-height:1}
  .tagline{position:absolute;bottom:64px;left:0;right:0;text-align:center;
    color:rgba(255,255,255,0.35);font-family:'Space Grotesk',system-ui,sans-serif;
    font-size:24px;letter-spacing:0.01em}
  /* subtle grid */
  body::before{content:'';position:absolute;inset:0;
    background-image:linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px);
    background-size:60px 60px}
  </style></head><body>
  <div class="wrap">
    <svg width="100" height="100" viewBox="0 0 32 32" fill="none">${LOGO_SVG}</svg>
    <span class="wordmark">klar</span>
  </div>
  <div class="tagline">Self-hosted · Privacy-first · Household Budget Tracker</div>
  </body></html>`;
}

// Splash Screen
function splashHtml(w, h) {
  const icon = Math.round(Math.min(w, h) * 0.18);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&display=swap" rel="stylesheet"/>
  <style>*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden;background:#09090b}
  .wrap{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
  .wordmark{color:rgba(255,255,255,0.9);font-family:'Space Grotesk',system-ui,sans-serif;
    font-weight:500;font-size:${Math.round(icon*0.6)}px;letter-spacing:-0.035em}
  </style></head><body>
  <div class="wrap">
    <svg width="${icon}" height="${icon}" viewBox="0 0 32 32" fill="none">${LOGO_SVG}</svg>
    <span class="wordmark">klar</span>
  </div></body></html>`;
}

// ── favicon.svg (direkt schreiben, kein Screenshot nötig) ───────────────────
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="7" fill="#09090b"/>
  <defs>
    <linearGradient id="fg" x1="7" y1="5" x2="26" y2="27" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#c7d2fe"/>
    </linearGradient>
  </defs>
  <rect x="7"    y="5"   width="2.2" height="22" rx="1.1" fill="url(#fg)"/>
  <rect x="14.6" y="3.8" width="2.2" height="14" rx="1.1" transform="rotate(32 15.7 10.8)" fill="url(#fg)"/>
  <rect x="14.6" y="14"  width="2.2" height="14" rx="1.1" transform="rotate(-32 15.7 21)"  fill="url(#fg)"/>
</svg>`;
writeFileSync(join(WEB_SRC, 'favicon.svg'), faviconSvg);
console.log('✓ favicon.svg');

// ── PNG-Generierung via Playwright ──────────────────────────────────────────
const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 1 });

async function renderPng(html, outputPath, width, height) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
  writeFileSync(outputPath, buf);
  await page.close();
  console.log(`✓ ${outputPath.replace(WEB_SRC + '/', '').replace(WEB_SRC, '')}`);
}

// PWA Icons
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of sizes) {
  await renderPng(iconHtml(s), join(ICONS_DIR, `icon-${s}x${s}.png`), s, s);
}

// Apple Touch Icon
await renderPng(appleHtml(180), join(ICONS_DIR, 'apple-touch-icon.png'), 180, 180);

// Maskable
await renderPng(maskableHtml(512), join(ICONS_DIR, 'icon-512-maskable.png'), 512, 512);

// OG Image (fonts from Google — networkidle handles it)
await renderPng(ogHtml(), join(WEB_SRC, 'og-image.png'), 1200, 630);

// Splash Screens
const splashes = [
  { w: 1179, h: 2556, name: 'splash-1179x2556.png' },  // iPhone 14 Pro
  { w: 1290, h: 2796, name: 'splash-1290x2796.png' },  // iPhone 14 Pro Max
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' },  // iPhone 12/13
  { w: 1284, h: 2778, name: 'splash-1284x2778.png' },  // iPhone 12/13 Pro Max
  { w: 828,  h: 1792, name: 'splash-828x1792.png'  },  // iPhone 11 / XR
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' },  // iPhone X/XS
];
for (const { w, h, name } of splashes) {
  await renderPng(splashHtml(w, h), join(ICONS_DIR, name), w, h);
}

// favicon.ico (16 + 32 + 48px, als PNG-in-ICO)
async function renderRaw(html, w) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w, height: w });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: w } });
  await page.close();
  return buf;
}

function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(count, 4);
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i];
    const s = sizes[i];
    header.writeUInt8(s >= 256 ? 0 : s, 6 + i * 16);      // width
    header.writeUInt8(s >= 256 ? 0 : s, 6 + i * 16 + 1);  // height
    header.writeUInt8(0, 6 + i * 16 + 2);  // color count
    header.writeUInt8(0, 6 + i * 16 + 3);  // reserved
    header.writeUInt16LE(1, 6 + i * 16 + 4); // planes
    header.writeUInt16LE(32, 6 + i * 16 + 6); // bit count
    header.writeUInt32LE(png.length, 6 + i * 16 + 8);
    header.writeUInt32LE(offset, 6 + i * 16 + 12);
    offset += png.length;
    chunks.push(png);
  }
  return Buffer.concat([header, ...chunks]);
}

const icoSizes = [16, 32, 48];
const icoPngs = [];
for (const s of icoSizes) {
  icoPngs.push(await renderRaw(iconHtml(s, 0.1), s));
}
const ico = buildIco(icoPngs, icoSizes);
writeFileSync(join(WEB_SRC, 'favicon.ico'), ico);
console.log('✓ favicon.ico (16+32+48px)');

await browser.close();
console.log('\n✅ Alle Assets generiert.');
