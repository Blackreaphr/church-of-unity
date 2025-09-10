// Export guides to PDF via Puppeteer.
// Usage: npm i -D puppeteer && npm run dev (in one shell) then npm run pdf
// Or set BASE_URL env to a running preview URL like http://localhost:4173 after `npm run preview`.

import fs from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const PAGES = [
  '/guides/examen.html',
  '/guides/lectio-divina.html',
  '/guides/rule-of-life.html',
];

async function main() {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.error('Please install puppeteer: npm i -D puppeteer');
    process.exit(1);
  }
  const browser = await puppeteer.launch({ headless: 'new' });
  const outDir = new URL('../pdf/', import.meta.url);
  await fs.mkdir(outDir, { recursive: true });

  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const name = path.split('/').pop().replace('.html', '') + '.pdf';
    const filePath = new URL(name, outDir);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' } });
    await page.close();
    console.log('Saved', filePath.pathname);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });

