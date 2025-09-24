#!/usr/bin/env node
// Remove any hardcoded references to Vite's modulepreload polyfill from HTML.
// We only scrub built output (dist) so source stays clean if needed.
// Usage: node scripts/scrub-polyfill.mjs dist

import { promises as fs } from 'fs';
import path from 'path';

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error('Usage: node scripts/scrub-polyfill.mjs <dir> [...moreDirs]');
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      yield full;
    }
  }
}

function scrub(html) {
  // Remove any <script ... src="/assets/modulepreload-polyfill-*.js" ...></script>
  let out = html.replace(/<script[^>]*\bsrc=(['"])\/assets\/modulepreload-polyfill-[^"'>]+\.js\?[^"'>]*\1[^>]*><\/script>\s*/gi, '');
  out = out.replace(/<script[^>]*\bsrc=(['"])\/assets\/modulepreload-polyfill-[^"'>]+\.js\1[^>]*><\/script>\s*/gi, '');
  // Remove any <link rel="modulepreload" ... href="/assets/modulepreload-polyfill-*.js" ...>
  out = out.replace(/<link[^>]*\brel=(['"])modulepreload\1[^>]*\bhref=(['"])\/assets\/modulepreload-polyfill-[^"'>]+\.js\?[^"'>]*\2[^>]*>\s*/gi, '');
  out = out.replace(/<link[^>]*\brel=(['"])modulepreload\1[^>]*\bhref=(['"])\/assets\/modulepreload-polyfill-[^"'>]+\.js\2[^>]*>\s*/gi, '');
  // Remove any inline data: modulepreload polyfill variants
  out = out.replace(/<link[^>]*\brel=(['"])modulepreload\1[^>]*\bhref=(['"])data:text\/javascript[^"'>]*\2[^>]*>\s*/gi, '');
  return out;
}

async function main() {
  for (const root of roots) {
    for await (const f of walk(root)) {
      const orig = await fs.readFile(f, 'utf8');
      const next = scrub(orig);
      if (next !== orig) {
        await fs.writeFile(f, next, 'utf8');
        console.log('Scrubbed polyfill refs:', f);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
