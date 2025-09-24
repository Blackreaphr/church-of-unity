#!/usr/bin/env node
// Normalize <link rel="icon"> across all HTML to match localhost and ensure broad browser support.
// Order: PNG (32,16) -> ICO -> SVG -> Apple -> Mask. Adds cache-busting using the stamped manifest hash if present.
// Usage: node scripts/fix-favicons.mjs [dir]

import { promises as fs } from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] || 'dist');

async function* walk(dir) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      yield* walk(full);
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) {
      yield full;
    }
  }
}

function fixIconLinks(html) {
  let next = html;
  // Remove any existing icon-related tags to avoid conflicts and ordering issues
  next = next.replace(/<link[^>]+rel=(["'])icon\1[^>]*>\s*/gi, '');
  next = next.replace(/<link[^>]+rel=(["'])shortcut icon\1[^>]*>\s*/gi, '');
  next = next.replace(/<link[^>]+rel=(["'])apple-touch-icon\1[^>]*>\s*/gi, '');
  next = next.replace(/<link[^>]+rel=(["'])mask-icon\1[^>]*>\s*/gi, '');

  // Reuse the stamped manifest hash as a cache-busting version for icons
  const m = next.match(/href=(["'])\/site-([A-Za-z0-9._-]+)\.webmanifest\1/i);
  const ver = m ? m[2] : '';
  const withVer = (u) => (ver ? `${u}?v=${ver}` : u);

  // Insert in a compatibility-first order (PNG -> ICO -> SVG -> Apple -> Mask)
  const inject = (tag) => { next = next.replace(/<\/head>/i, (x) => `  ${tag}\n${x}`); };
  inject(`<link rel="icon" type="image/png" sizes="32x32" href="${withVer('/assets/symbol-32.png')}">`);
  inject(`<link rel="icon" type="image/png" sizes="16x16" href="${withVer('/assets/symbol-16.png')}">`);
  inject(`<link rel="shortcut icon" href="${withVer('/favicon.ico')}" sizes="any">`);
  inject(`<link rel="icon" href="${withVer('/assets/symbol.svg')}" type="image/svg+xml">`);
  inject(`<link rel="apple-touch-icon" sizes="180x180" href="${withVer('/assets/symbol-180.png')}">`);
  inject(`<link rel="mask-icon" href="${withVer('/assets/symbol.svg')}" color="#c4161c">`);
  return next;
}

async function main(){
  let changed = 0;
  for await (const file of walk(root)) {
    const src = await fs.readFile(file, 'utf8');
    const next = fixIconLinks(src);
    if (next !== src) {
      await fs.writeFile(file, next, 'utf8');
      changed++;
      console.log(`Updated favicon link: ${path.relative(root, file)}`);
    }
  }
  console.log(`Favicons normalized in ${changed} file(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });

