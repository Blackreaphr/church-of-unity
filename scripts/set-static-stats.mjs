#!/usr/bin/env node
/**
 * Set static Members and Views on the homepage and remove dynamic loaders.
 *
 * Usage examples:
 *   node scripts/set-static-stats.mjs --members 60 --views 398
 *   node scripts/set-static-stats.mjs --fetch --domain thechurchofunity.com
 *
 * What it does:
 * - Updates `index.html` and `dist/index.html` if present:
 *   - Sets #memberCount and #viewCount text to provided values
 *   - Removes any "+" suffix and data-suffix attributes
 *   - Strips <script src="/site/stats.js"> and the inline fallback block
 */

import fs from 'fs/promises';
import path from 'path';

async function readFileIfExists(p){ try { return await fs.readFile(p, 'utf8'); } catch { return null; } }
async function writeFileIfChanged(p, next){
  const cur = await readFileIfExists(p);
  if (cur == null) return false;
  if (cur === next) return false;
  await fs.writeFile(p, next, 'utf8');
  return true;
}

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { members: null, views: null, fetch: false, domain: 'thechurchofunity.com' };
  for (let i=0; i<args.length; i++){
    const a = args[i];
    if (a === '--members') { out.members = Number(args[++i] || 0) || 0; continue; }
    if (a === '--views')   { out.views   = Number(args[++i] || 0) || 0; continue; }
    if (a === '--fetch')   { out.fetch   = true; continue; }
    if (a === '--domain')  { out.domain  = String(args[++i] || out.domain); continue; }
  }
  return out;
}

async function fetchLive(domain){
  const base = `https://${domain}`;
  const getJson = async (u) => {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  };
  const ns = domain.replace(/^www\./,'').toLowerCase();
  const membersUrl = `${base}/api/stats/get/${encodeURIComponent(ns)}/members`;
  const viewsUrl   = `${base}/api/stats/get/${encodeURIComponent(ns)}/site-views`;
  const [{ value: members }, { value: views }] = await Promise.all([ getJson(membersUrl), getJson(viewsUrl) ]);
  return { members: Number(members)||0, views: Number(views)||0 };
}

function makeStatic(html, members, views){
  let next = html;
  // Remove trailing plus and data-suffix
  next = next.replace(/\sdata-suffix=(["'])\+\1/ig, '');
  next = next.replace(/<span\s+class=(["'])stat-suffix\1>\+<\/span>/ig, '');
  // Replace the numbers
  next = next.replace(/(id=(["'])memberCount\2>)[^<]*/i, `$1${members}`);
  next = next.replace(/(id=(["'])viewCount\2>)[^<]*/i, `$1${views}`);
  // Sync aria-labels
  next = next.replace(/(aria-label=(["']))Members:\s*\d+\2/ig, `$1Members: ${members}$2`);
  next = next.replace(/(aria-label=(["']))Views:\s*\d+\2/ig, `$1Views: ${views}$2`);
  // Sync data-target on the corresponding .stat containers (robust scan around the id)
  function setDataTarget(html, id, value){
    const idRe = new RegExp('id=(["\'])' + id + '\\1', 'i');
    const m = idRe.exec(html);
    if (!m) return html;
    const idPos = m.index;
    const openDivPos = html.lastIndexOf('<div', idPos);
    if (openDivPos < 0) return html;
    const tagEnd = html.indexOf('>', openDivPos);
    if (tagEnd < 0) return html;
    const before = html.slice(0, openDivPos);
    const tag = html.slice(openDivPos, tagEnd + 1);
    const after = html.slice(tagEnd + 1);
    if (!/class=(["'])stat\1/i.test(tag)) return html; // not the expected container
    let newTag = tag;
    if (/\bdata-target=(["'])\d+\1/i.test(newTag)){
      newTag = newTag.replace(/(\bdata-target=(["']))\d+(\2)/i, `$1${value}$3`);
    } else if (/\bdata-target=(["'])[^"]*\1/i.test(newTag)){
      newTag = newTag.replace(/(\bdata-target=(["']))[^"']*(\2)/i, `$1${value}$3`);
    } else {
      newTag = newTag.replace(/>$/, ` data-target="${value}">`);
    }
    return before + newTag + after;
  }
  function updateStatTarget(html, id, value){
    const idRe = new RegExp(`id=(['"])` + id + `\\1`, 'i');
    const m = idRe.exec(html);
    if (!m) return html;
    let pos = m.index;
    while (pos > 0) {
      const open = html.lastIndexOf('<div', pos);
      if (open < 0) break;
      const end = html.indexOf('>', open);
      if (end < 0) break;
      const tag = html.slice(open, end + 1);
      if (/class=(["'])stat\1/i.test(tag)) {
        const before = html.slice(0, open);
        const after = html.slice(end + 1);
        let out = tag;
        if (/\bdata-target=(["'])\d+\1/i.test(out)) {
          out = out.replace(/(\bdata-target=(["']))\d+(\2)/i, `$1${value}$3`);
        } else if (/\bdata-target=(["'])[^"]*\1/i.test(out)) {
          out = out.replace(/(\bdata-target=(["']))[^"']*(\2)/i, `$1${value}$3`);
        } else {
          out = out.replace(/>$/, ` data-target=\"${value}\">`);
        }
        return before + out + after;
      }
      pos = open - 1;
    }
    return html;
  }
  next = updateStatTarget(next, 'memberCount', members);
  next = updateStatTarget(next, 'viewCount', views);
  // Strip dynamic loaders on homepage
  next = next.replace(/<script[^>]*\bsrc=(['"])\/?site\/stats\.js[^>]*>[^<]*<\/script>\s*/ig, '');
  next = next.replace(/<!--\s*stats-inline-fallback[\s\S]*?<\/script>\s*/ig, '');
  return next;
}

async function run(){
  const opts = parseArgs();
  let members = opts.members, views = opts.views;
  if (opts.fetch) {
    const live = await fetchLive(opts.domain).catch((e)=>{ console.error('Fetch live failed:', e?.message || e); return null; });
    if (live){ members = live.members; views = live.views; }
    if (members == null || views == null) throw new Error('Missing values and live fetch failed. Provide --members and --views.');
  } else if (members == null || views == null) {
    throw new Error('Provide --members and --views, or use --fetch');
  }
  const roots = ['.', 'dist'];
  let changed = false;
  for (const r of roots){
    const p = path.resolve(r, 'index.html');
    const html = await readFileIfExists(p);
    if (!html) continue;
    const next = makeStatic(html, members, views);
    const did = await writeFileIfChanged(p, next);
    if (did) { changed = true; console.log(`Updated ${path.relative('.', p)} -> members=${members}, views=${views}`); }
  }
  if (!changed) console.log('No homepage changes written.');
}

run().catch((e)=>{ console.error(e?.message || e); process.exit(1); });
