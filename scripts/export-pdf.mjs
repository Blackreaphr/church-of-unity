// @ts-nocheck
// Export guides to PDF via Puppeteer.
// Usage: npm i -D puppeteer && npm run dev (in one shell) then npm run pdf
// Or set BASE_URL env to a running preview URL like http://localhost:4173 after `npm run preview`.

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const PAGES = [
  '/guide-examen',
  '/guide-lectio-divina',
  '/guide-rule-of-life',
];

async function main() {
  let puppeteer;
  try {
    const mod = await import('puppeteer');
    puppeteer = mod.default || mod;
  } catch {
    console.error('Please install puppeteer: npm i -D puppeteer');
    process.exit(1);
  }
  const browser = await puppeteer.launch({ headless: true });
  const outDir = new URL('../pdf/', import.meta.url);
  await fs.mkdir(outDir, { recursive: true });

  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const name = path.split('/').pop().replace('.html', '') + '.pdf';
    const fileUrl = new URL(name, outDir);
    const filePath = fileURLToPath(fileUrl);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' } });
    await page.close();
    console.log('Saved', filePath);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });




