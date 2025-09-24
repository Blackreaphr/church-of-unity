#!/usr/bin/env node
/**
 * Post a moderation decision to your Worker for a queue item.
 *
 * Usage:
 *   MOD_TOKEN=your_mod_token node scripts/mod-queue-decision.mjs \
 *     --domain thechurchofunity.com --item <item_id> --macro limit_distribution --reviewer you
 */

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { domain: '', item: '', macro: '', reviewer: 'cli', fields: '', token: '', tokenFile: '' };
  for (let i=0; i<args.length; i++){
    const a = args[i];
    if (a === '--domain')   { out.domain   = String(args[++i] || ''); continue; }
    if (a === '--item')     { out.item     = String(args[++i] || ''); continue; }
    if (a === '--macro')    { out.macro    = String(args[++i] || ''); continue; }
    if (a === '--reviewer') { out.reviewer = String(args[++i] || 'cli'); continue; }
    if (a === '--fields')   { out.fields   = String(args[++i] || ''); continue; }
    if (a === '--token')    { out.token    = String(args[++i] || ''); continue; }
    if (a === '--token-file') { out.tokenFile = String(args[++i] || ''); continue; }
  }
  return out;
}

function requireVal(name, v){ if (!v) throw new Error(`Missing ${name}`); return v; }

function parseFields(json){
  if (!json) return {};
  try { return JSON.parse(json); } catch { throw new Error('Invalid --fields JSON'); }
}

const ALLOWED = new Set([
  'remove', 'edit_request', 'age_gate_blur', 'limit_distribution', 'warning', 'temp_suspend', 'perm_ban', 'kill_switch'
]);

async function main(){
  const opts = parseArgs();
  const domain = requireVal('--domain', opts.domain).replace(/\/$/, '');
  let token = (opts.token || process.env.MOD_TOKEN || '').trim();
  if (!token && opts.tokenFile) {
    const fs = await import('fs/promises');
    const raw = (await fs.readFile(opts.tokenFile, 'utf8')).toString();
    const parts = raw.split(/[^A-Za-z0-9._-]+/).filter(Boolean);
    const cand = parts.filter(x => x.length >= 20).sort((a,b)=> b.length - a.length)[0];
    token = (cand || raw).trim();
  }
  requireVal('MOD_TOKEN env or --token/--token-file', token);
  const item_id = requireVal('--item', opts.item);
  const macro_id = requireVal('--macro', opts.macro);
  if (!ALLOWED.has(macro_id)) throw new Error(`Unknown macro: ${macro_id}`);
  const reviewer_id = opts.reviewer || 'cli';
  const fields = parseFields(opts.fields);
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  const url = `${base}/api/moderation/decision`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id, macro_id, reviewer_id, fields })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Decision failed: ${res.status} ${res.statusText} - ${body}`);
  console.log(body);
}

main().catch((e)=>{ console.error(e?.message || e); process.exit(1); });
