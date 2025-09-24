#!/usr/bin/env node
// Generate PNG favicons from assets/symbol.svg for PWA icons
// Usage: node scripts/generate-icons.mjs [size1 size2 ...]

import fs from 'fs';
import path from 'path';
import url from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const svgPath = path.join(assetsDir, 'symbol.svg');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true }).catch(() => {});
}

function b64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function renderPng(page, svgContent, size, outPath) {
  const html = `<!doctype html>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; padding: 0; width:${size}px; height:${size}px; background: transparent; }
    body { display: grid; place-items: center; }
    img { width:${size}px; height:${size}px; display:block; }
  </style>
  <img src="data:image/svg+xml;base64,${b64(svgContent)}" alt="icon" />`;
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outPath, type: 'png', omitBackground: true });
  console.log(`Generated ${path.relative(root, outPath)}`);
}

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error('assets/symbol.svg not found.');
    process.exit(1);
  }
  const sizes = process.argv.slice(2).map(s => Number(s)).filter(Boolean);
  const targets = sizes.length ? sizes : [192, 512];
  const svg = await fs.promises.readFile(svgPath, 'utf8');

  await ensureDir(assetsDir);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    for (const size of targets) {
      const out = path.join(assetsDir, `symbol-${size}.png`);
      await renderPng(page, svg, size, out);
    }
  } finally {
    try { await browser.close(); } catch {}
  }
}

main().catch((err) => {
  console.error('Icon generation failed:', err?.message || err);
  process.exit(1);
});

