#!/usr/bin/env node
/**
 * Export moderation queue items from your Cloudflare Worker to a local JSON report.
 *
 * Why: lets you keep secrets local while giving me a safe, readable list to review.
 *
 * Usage:
 *   MOD_TOKEN=your_mod_token node scripts/mod-queue-export.mjs --domain thechurchofunity.com --out mod-queue-report.json
 *
 * Notes:
 * - Do NOT pass the token via --token on shared terminals; prefer the MOD_TOKEN env var.
 * - The Worker endpoint is: GET https://<domain>/api/moderation/queue (Authorization: Bearer <token>)
 */

import fs from 'fs/promises';
import path from 'path';

function parseArgs(){
  const args = process.argv.slice(2);
  const out = { domain: '', out: 'mod-queue-report.json', token: '', tokenFile: '' };
  for (let i=0; i<args.length; i++){
    const a = args[i];
    if (a === '--domain') { out.domain = String(args[++i] || ''); continue; }
    if (a === '--out')    { out.out = String(args[++i] || out.out); continue; }
    if (a === '--token')  { out.token = String(args[++i] || ''); continue; }
    if (a === '--token-file') { out.tokenFile = String(args[++i] || ''); continue; }
  }
  return out;
}

function requireVal(name, v){ if (!v) throw new Error(`Missing ${name}`); return v; }

function sanitizeItem(x){
  const safe = {
    item_id: x.item_id || '',
    user_id: x.user_id || '',
    risk_score: Number(x.risk_score)||0,
    policy_labels: Array.isArray(x.policy_labels) ? x.policy_labels.slice(0, 10) : [],
    rule_hits: x.rule_hits || { P0: [], P1: [] },
    media_flags: Array.isArray(x.media_flags) ? x.media_flags.slice(0, 10) : [],
    link_risk: x.link_risk || 'low',
    routing: x.routing || { state: 'limited', reasons: [] },
    created_at: Number(x.created_at)||0,
    text_preview: (x.text_preview || '').toString().slice(0, 600)
  };
  return safe;
}

async function main(){
  const opts = parseArgs();
  const domain = requireVal('--domain', opts.domain).replace(/\/$/, '');
  let token = (opts.token || process.env.MOD_TOKEN || '').trim();
  if (!token && opts.tokenFile) {
    try {
      const fs = await import('fs/promises');
      const raw = (await fs.readFile(opts.tokenFile, 'utf8')).toString();
      // Extract the first plausible bearer token-like string (alnum/._-), >= 20 chars
      const parts = raw.split(/[^A-Za-z0-9._-]+/).filter(Boolean);
      const cand = parts.filter(x => x.length >= 20).sort((a,b)=> b.length - a.length)[0];
      token = (cand || raw).trim();
    } catch (e) {
      throw new Error(`Failed to read --token-file: ${e && e.message ? e.message : String(e)}`);
    }
  }
  requireVal('MOD_TOKEN (env) or --token', token);
  const base = domain.startsWith('http') ? domain : `https://${domain}`;
  const url = `${base}/api/moderation/queue`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(()=>'');
    throw new Error(`Queue fetch failed: ${res.status} ${res.statusText} ${body ? `- ${body}` : ''}`);
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const cleaned = items.map(sanitizeItem).sort((a,b)=> b.risk_score - a.risk_score);
  const report = {
    domain,
    generated_at: new Date().toISOString(),
    count: cleaned.length,
    items: cleaned
  };
  const outPath = path.resolve(opts.out);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote ${outPath} (${cleaned.length} items)`);
}

main().catch((e)=>{ console.error(e?.message || e); process.exit(1); });
