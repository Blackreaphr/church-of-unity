#!/usr/bin/env node
/**
 * Purge a forum post or reply (and related KV) via the admin endpoint.
 * Uses MOD_TOKEN for auth (same as moderation endpoints).
 *
 * Usage:
 *   MOD_TOKEN=... node scripts/admin-purge.mjs --domain thechurchofunity.com --id <item_id> [--type post|reply]
 *   or using a token file:
 *   node scripts/admin-purge.mjs --domain thechurchofunity.com --token-file "C:\\path\\to\\moderationpasskey.txt" --id <item_id>
 */

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { domain: '', id: '', type: '', token: '', tokenFile: '' };
  for (let i=0; i<args.length; i++){
    const a = args[i];
    if (a === '--domain') out.domain = String(args[++i] || '');
    else if (a === '--id') out.id = String(args[++i] || '');
    else if (a === '--type') out.type = String(args[++i] || '');
    else if (a === '--token') out.token = String(args[++i] || '');
    else if (a === '--token-file') out.tokenFile = String(args[++i] || '');
  }
  return out;
}

function req(name, v){ if(!v) throw new Error(`Missing ${name}`); return v; }

async function readToken(opts){
  let token = (opts.token || process.env.MOD_TOKEN || '').trim();
  if (!token && opts.tokenFile) {
    const fs = await import('fs/promises');
    const raw = (await fs.readFile(opts.tokenFile, 'utf8')).toString();
    const parts = raw.split(/[^A-Za-z0-9._-]+/).filter(Boolean);
    const cand = parts.filter(x => x.length >= 20).sort((a,b)=> b.length - a.length)[0];
    token = (cand || raw).trim();
  }
  req('MOD_TOKEN env or --token/--token-file', token);
  return token;
}

async function main(){
  const opts = parseArgs();
  const domain = req('--domain', opts.domain).replace(/\/$/, '');
  const token = await readToken(opts);
  const id = req('--id', opts.id);
  const body = { item_id: id }; if (opts.type) body.type = opts.type;
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  const url = `${base}/api/admin/purge`;
  const res = await fetch(url, { method:'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Purge failed: ${res.status} ${res.statusText} - ${txt}`);
  console.log(txt);
}

main().catch((e)=>{ console.error(e?.message || e); process.exit(1); });
