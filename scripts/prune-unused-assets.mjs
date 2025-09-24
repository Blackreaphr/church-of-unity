#!/usr/bin/env node
// Remove unused files from dist/assets by scanning all built HTML and webmanifest references.
// Usage: node scripts/prune-unused-assets.mjs [distDir]

import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.argv[2] || 'dist');
const assetsDir = path.join(distDir, 'assets');

function gatherHtmlFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        stack.push(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) {
        out.push(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.webmanifest')) {
        out.push(full); // scan manifests for icon srcs
      }
    }
  }
  return out;
}

function refsFromHtml(html) {
  const refs = new Set();
  const re = /\b(?:src|href)=(['"])\/?assets\/([^'"\s>]+)\1/gi;
  let m;
  while ((m = re.exec(html))) {
    refs.add(path.posix.join('assets', m[2]));
  }
  return refs;
}

function refsFromManifest(jsonText) {
  try {
    const refs = new Set();
    const obj = JSON.parse(jsonText);
    if (Array.isArray(obj.icons)) {
      for (const icon of obj.icons) {
        const src = icon && icon.src;
        if (typeof src === 'string') {
          const p = src.replace(/^\//, '');
          if (p.startsWith('assets/')) refs.add(p);
        }
      }
    }
    return refs;
  } catch { return new Set(); }
}

// Scan built JS and CSS for references to assets. This ensures we keep
// code-split chunks (e.g. stats-<hash>.js) and any images/fonts referenced
// from CSS, even when not directly mentioned in HTML.
function refsFromJsOrCss(text, fileDir) {
  const refs = new Set();
  // 1) Absolute/rooted asset references within strings: '/assets/...' or 'assets/...'
  //    Handles both quotes and unquoted CSS url() where we pass text from JS too.
  const abs = /\/?assets\/([A-Za-z0-9._\-\/]+)/g;
  let m;
  while ((m = abs.exec(text))) {
    const p = m[1].replace(/^\/+/, '');
    const rel = path.posix.join('assets', p);
    refs.add(rel);
  }
  // 2) Relative references like './chunk-XYZ.js' found inside built JS in assets/
  //    Resolve relative to the directory of the JS file (usually assets/ itself).
  const relStr = /(['"])\.\.?(\/[A-Za-z0-9._\-\/]+)\1/g;
  while ((m = relStr.exec(text))) {
    const relPath = m[2]; // like '/stats-ABC.js' or '/icons/foo.png'
    // Normalize relative to fileDir (which should be assetsDir)
    const norm = path.posix.normalize(relPath.replace(/^\/+/, ''));
    const full = path.posix.join(path.posix.basename(fileDir), norm);
    // Only keep things under assets/
    if (full.startsWith('assets/')) refs.add(full);
  }
  // 3) CSS url(...) patterns: url('/assets/...') or url(assets/...)
  const cssUrl = /url\((['"]?)(\/?assets\/[A-Za-z0-9._\-\/]+)\1\)/g;
  while ((m = cssUrl.exec(text))) {
    const p = m[2].replace(/^\/+/, '');
    const rel = path.posix.join('assets', p.replace(/^assets\//, ''));
    refs.add(rel);
  }
  return refs;
}

function main() {
  if (!fs.existsSync(assetsDir)) {
    console.error('No assets directory:', assetsDir);
    process.exit(1);
  }
  const keep = new Set([
    'assets/symbol.svg',
  ]);
  // Always keep PNG favicons if present
  for (const size of ['16','32','48','180','192','512']) {
    keep.add(`assets/symbol-${size}.png`);
  }
  // Keep stamped webmanifest(s) in both root and assets
  for (const ent of fs.readdirSync(assetsDir)) {
    if (/^site-.*\.webmanifest$/i.test(ent)) keep.add(path.posix.join('assets', ent));
  }
  const files = gatherHtmlFiles(distDir);
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    if (f.toLowerCase().endsWith('.html')) {
      for (const r of refsFromHtml(txt)) keep.add(r);
    } else if (f.toLowerCase().endsWith('.webmanifest')) {
      for (const r of refsFromManifest(txt)) keep.add(r);
    }
  }
  // Also scan built JS and CSS inside assets for runtime references to other assets
  try {
    const assetEntries = fs.readdirSync(assetsDir, { withFileTypes: true });
    for (const ent of assetEntries) {
      if (!ent.isFile()) continue;
      const lower = ent.name.toLowerCase();
      if (!(/[.](js|css)$/i.test(lower))) continue;
      const p = path.join(assetsDir, ent.name);
      const txt = fs.readFileSync(p, 'utf8');
      for (const r of refsFromJsOrCss(txt, assetsDir)) keep.add(r);
    }
  } catch {}
  const allAssets = fs.readdirSync(assetsDir);
  let removed = 0;
  let kept = 0;
  for (const name of allAssets) {
    const rel = path.posix.join('assets', name);
    const full = path.join(assetsDir, name);
    if (keep.has(rel)) { kept++; continue; }
    // Only prune known build artifacts: js, css, map, html copies, images with hashes
    if (/[.](js|css|map|html|svg|png|jpg|jpeg|webp)$/i.test(name)) {
      // If not referenced, remove
      fs.unlinkSync(full);
      removed++;
      console.log(`[prune] removed ${rel}`);
    } else {
      kept++;
    }
  }
  console.log(`Done. Kept ${kept} file(s), removed ${removed} unused file(s).`);
}

main();
