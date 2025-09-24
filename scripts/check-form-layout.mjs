// @ts-nocheck
// Optional Puppeteer runner for checking form layout
// Uses dynamic import to avoid TS 2307 when puppeteer isn't installed.
let puppeteer;
try {
  // optional dependency, use computed specifier to avoid TS module resolution
  const mod = await import(String('puppeteer'));
  puppeteer = mod.default || mod;
} catch (e) {
  console.error('Puppeteer is not installed. Install with: npm i -D puppeteer');
  process.exit(1);
}
import path from 'path';

const distPath = path.resolve('dist/forum/welcome.html');
const url = 'file://' + distPath.replace(/\\/g,'/');

const result = { url, widths: {} };

const widths = [600, 1024];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  for (const w of widths) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    const styles = await page.evaluate(() => {
      const el = document.querySelector('.form');
      const lab1 = document.querySelector('.form label:nth-of-type(1)');
      const lab2 = document.querySelector('.form label:nth-of-type(2)');
      const lab3 = document.querySelector('.form label:nth-of-type(3)');
      const lab4 = document.querySelector('.form label:nth-of-type(4)');
      const get = (el) => el ? getComputedStyle(el) : null;
      const s = get(el);
      const g = (k)=> s ? s.getPropertyValue(k) : null;
      const gc = (el)=>{
        const s = el ? getComputedStyle(el) : null;
        return s ? s.getPropertyValue('grid-column') : null;
      };
      return {
        display: g('display'),
        gap: g('gap'),
        gridTemplateColumns: g('grid-template-columns'),
        labelColumns: [gc(lab1), gc(lab2), gc(lab3), gc(lab4)]
      };
    });
    result.widths[w] = styles;
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
