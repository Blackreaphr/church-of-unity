#!/usr/bin/env node
// Build specific forum essay pages into dist by templating an existing built forum page.
// This is a lightweight workaround when a full Vite build isn't available.

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const srcDir = path.join(root, 'forum');
const distDir = path.join(root, 'dist');
const distForumDir = path.join(distDir, 'forum');
const templatePath = path.join(distForumDir, 'prayer-reflection-quiet-trust.html');

const files = [
  'daily-examen-what-changes-with-practice.html',
  'on-beginning-philosophy-together.html',
  'chaos-and-order-first-reflections.html',
];

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, 'utf8'); }

function extract(text, re, fallback = '') {
  const m = text.match(re);
  return m ? (m[1] || '') : fallback;
}

function replace1(text, re, repl) {
  return text.replace(re, repl);
}

function buildOne(srcName) {
  const srcPath = path.join(srcDir, srcName);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[skip] source not found: ${srcName}`);
    return false;
  }
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at ${templatePath}`);
  }
  const src = read(srcPath);
  let out = read(templatePath);

  // Extract values from source
  const title = extract(src, /<title>([\s\S]*?)<\/title>/i, 'Forum | Church of Unity').trim();
  const desc = extract(src, /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/>/i, '').trim();
  const h1 = extract(src, /<h1\s+class=["']site-title["']>([\s\S]*?)<\/h1>/i, '').trim();
  const tagline = extract(src, /<p\s+class=["']tagline["']>([\s\S]*?)<\/p>/i, '').trim();
  const article = extract(src, /<article\b[\s\S]*?>([\s\S]*?)<\/article>/i, '').trim();

  // Replace in template head
  out = replace1(out, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  if (desc) {
    if (/meta\s+name=["']description["']/.test(out)) {
      out = replace1(out, /<meta\s+name=["']description["']\s+content=["'][\s\S]*?["']\s*\/>/i, `<meta name="description" content="${desc}" />`);
    } else {
      out = out.replace(/<meta\s+name=["']color-scheme["'][\s\S]*?>/i, (m) => `${m}\n    <meta name=\"description\" content=\"${desc}\" />`);
    }
  }

  // Replace H1 and tagline in body
  if (h1) out = replace1(out, /<h1\s+class=["']site-title["']>[\s\S]*?<\/h1>/i, `<h1 class="site-title">${h1}</h1>`);
  if (tagline) out = replace1(out, /<p\s+class=["']tagline["']>[\s\S]*?<\/p>/i, `<p class="tagline">${tagline}</p>`);

  // Ensure back link points to Forum Feed
  out = replace1(out, /<div class=\"top-actions\">[\s\S]*?<\/div>/i, `<div class="top-actions"><a class="link-back" href="/forum-feed.html">Back to Forum Feed</a></div>`);

  // Ensure header emblem symbol exists before hero-copy
  out = out.replace(
    /<header class=\"hero\"><div class=\"container hero-inner\">(\s*)(<div class=\"hero-copy\">)/i,
    `<header class="hero"><div class="container hero-inner">$1<div class="symbol-wrap" aria-hidden="true">\n          <img id="emblem" class="symbol" src="/assets/symbol.svg" alt="" loading="lazy" decoding="async" />\n        </div>$1$2`
  );

  // Replace article content
  if (article) {
    out = replace1(out, /<article\b[\s\S]*?>[\s\S]*?<\/article>/i, `<article class="section dropcap">\n${article}\n      </article>`);
  }

  const slug = path.basename(srcName, '.html');
  const outFile = path.join(distForumDir, `${slug}.html`);
  const outIndex = path.join(distForumDir, slug, 'index.html');
  write(outFile, out);
  write(outIndex, out);
  console.log(`[built] forum/${slug}.html (+ fallback index.html)`);
  return true;
}

function main(){
  let ok = 0; for (const f of files) { if (buildOne(f)) ok++; }
  if (ok === 0) process.exitCode = 1;
}

main();
