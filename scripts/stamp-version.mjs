#!/usr/bin/env node
// Stamp all HTML files with a version on the /site/meta.js script tag.
// Usage:
//   node scripts/stamp-version.mjs            # stamp project root
//   node scripts/stamp-version.mjs dist       # stamp dist only
//   BUILD_VERSION=abc123 node scripts/stamp-version.mjs . dist

import { promises as fs } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const roots = args.length ? args : ['.'];
const version = process.env.BUILD_VERSION || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);

const metaSrcRe = /src=(['"])\/site\/meta\.js(?:\?[^"'<>]*)?\1/g;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip node_modules and .git by default
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      yield* walk(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      yield full;
    }
  }
}

async function stampFile(file) {
  const orig = await fs.readFile(file, 'utf8');
  const next = orig.replace(metaSrcRe, (_, q) => `src=${q}/site/meta.js?v=${version}${q}`);
  if (next !== orig) {
    await fs.writeFile(file, next, 'utf8');
    console.log(`Stamped ${file} -> v=${version}`);
  }
}

async function main() {
  for (const root of roots) {
    for await (const f of walk(root)) {
      await stampFile(f);
    }
  }
  console.log(`Done. Version: ${version}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

