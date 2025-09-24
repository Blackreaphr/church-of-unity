#!/usr/bin/env node
/**
 * Deploy dist/ to Hostinger over SSH.
 * Defaults (override with env):
 *   HOST=82.198.232.46 PORT=65002 USER=u558531826
 *   REMOTE_DIR=domains/thechurchofunity.com/public_html
 *   KEY=~/.ssh/id_ed25519
 * Usage:
 *   node scripts/deploy-hostinger.mjs            # build, pack, upload, extract
 *   SKIP_BUILD=1 node scripts/deploy-hostinger.mjs
 */

import { exec as _exec, execFile as _execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const exec = promisify(_exec);
const execFile = promisify(_execFile);

const HOST = process.env.HOST || '82.198.232.46';
const PORT = String(process.env.PORT || '65002');
const USER = process.env.USER || 'u558531826';
const REMOTE_DIR = process.env.REMOTE_DIR || 'domains/thechurchofunity.com/public_html';
const KEY = process.env.KEY || path.join(os.homedir(), '.ssh', 'id_ed25519');
const SKIP_BUILD = !!process.env.SKIP_BUILD;

function log(msg){ process.stdout.write(msg + '\n'); }

async function fileExists(p){ try{ await fs.access(p); return true; } catch{ return false; } }

async function run(cmd, args, opts={}){
  const pretty = cmd + ' ' + (args||[]).map(a => /\s/.test(a) ? '"'+a+'"' : a).join(' ');
  log('> ' + pretty);
  // npm on Windows behaves better via shell exec
  if ((cmd === 'npm' || cmd === 'npm.cmd') && args && args.length){
    const execOpts = { ...opts, shell: (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh') };
    const { stdout, stderr } = await exec([cmd, ...args].join(' '), execOpts);
    if (stdout?.trim()) log(stdout.trim());
    if (stderr?.trim()) log(stderr.trim());
    return { stdout, stderr };
  }
  const { stdout, stderr } = await execFile(cmd, args, { ...opts });
  if (stdout?.trim()) log(stdout.trim());
  if (stderr?.trim()) log(stderr.trim());
  return { stdout, stderr };
}

async function ensureDistCopies(){
  // Mirror GH Action step: copy root assets into dist
  const dist = 'dist';
  await fs.mkdir(dist, { recursive: true });
  const copies = [];
  if (await fileExists('styles.css')) copies.push(['styles.css', path.join(dist,'styles.css')]);
  if (await fileExists('main.js')) copies.push(['main.js', path.join(dist,'main.js')]);
  if (await fileExists('site')) copies.push(['site', path.join(dist,'site')]);
  if (await fileExists('assets')) copies.push(['assets', path.join(dist,'assets')]);
  if (await fileExists('data')) copies.push(['data', path.join(dist,'data')]);
  for (const [src, dest] of copies){
    const stat = await fs.stat(src);
    if (stat.isDirectory()){
      await run(process.platform === 'win32' ? 'robocopy' : 'rsync',
        process.platform === 'win32'
          ? [src, dest, '/E']
          : ['-a', src + '/', dest + '/']
      ).catch(()=>{});
    } else {
      await fs.copyFile(src, dest).catch(()=>{});
    }
  }
  // Ensure .htaccess copied
  const htDest = path.join(dist, '.htaccess');
  if (!(await fileExists(htDest))){
    if (await fileExists(path.join('public','.htaccess'))) await fs.copyFile(path.join('public','.htaccess'), htDest).catch(()=>{});
    else if (await fileExists('.htaccess')) await fs.copyFile('.htaccess', htDest).catch(()=>{});
  }
}

async function main(){
  if (!SKIP_BUILD){
    // Clean dist to avoid OneDrive/locking hiccups
    try { await fs.rm('dist', { recursive: true, force: true }); } catch {}
    await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','build:stamp']);
  } else {
    log('Skipping build as requested.');
  }

  await ensureDistCopies();

  // Try to normalize remote permissions before upload/extract
  try {
    const fixCmd = `BASE=${REMOTE_DIR}; if [ -d "$BASE" ]; then for d in assets site public_assets; do if [ -d \"$BASE/$d\" ]; then chmod -R u+rwX \"$BASE/$d\" 2>/dev/null || true; find \"$BASE/$d\" -type d -exec chmod 755 {} \\; 2>/dev/null || true; find \"$BASE/$d\" -type f -exec chmod 644 {} \\; 2>/dev/null || true; fi; done; fi`;
    const sshArgsPre = ['-p', PORT];
    if (await fileExists(KEY)) sshArgsPre.push('-i', KEY);
    sshArgsPre.push('-o','StrictHostKeyChecking=no','-o','IdentitiesOnly=yes', `${USER}@${HOST}`, fixCmd);
    await run('ssh', sshArgsPre);
  } catch {}

  if (process.env.USE_TAR) {
    // Pack + extract method
    const tgz = 'dist.tgz';
    try { await fs.unlink(tgz); } catch {}
    await run('tar', ['-C','dist','-czf', tgz, '.']);

    const scpArgs = ['-P', PORT];
    if (await fileExists(KEY)) scpArgs.push('-i', KEY);
    scpArgs.push(tgz, `${USER}@${HOST}:${REMOTE_DIR}/.upload.tgz`);
    await run('scp', scpArgs);

    const remoteCmd = `mkdir -p ${REMOTE_DIR} && tar --overwrite -xzf ${REMOTE_DIR}/.upload.tgz -C ${REMOTE_DIR} || tar -xzf ${REMOTE_DIR}/.upload.tgz -C ${REMOTE_DIR}; rm -f ${REMOTE_DIR}/.upload.tgz`;
    const sshArgs = ['-p', PORT];
    if (await fileExists(KEY)) sshArgs.push('-i', KEY);
    sshArgs.push('-o','StrictHostKeyChecking=no','-o','IdentitiesOnly=yes', `${USER}@${HOST}`, remoteCmd);
    await run('ssh', sshArgs);
  } else {
    // Plain scp copy of the folder contents: use trailing dot to copy contents only
    const scpArgs2 = ['-P', PORT];
    if (await fileExists(KEY)) scpArgs2.push('-i', KEY);
    scpArgs2.push('-r', path.join('dist','.'), `${USER}@${HOST}:${REMOTE_DIR}/`);
    await run('scp', scpArgs2);
  }

  // Finalize permissions after deploy
  try {
    const fixCmd2 = `BASE=${REMOTE_DIR}; if [ -d "$BASE" ]; then for d in assets site public_assets; do if [ -d \"$BASE/$d\" ]; then find \"$BASE/$d\" -type d -exec chmod 755 {} \\; 2>/dev/null || true; find \"$BASE/$d\" -type f -exec chmod 644 {} \\; 2>/dev/null || true; fi; done; fi`;
    const sshArgsPost = ['-p', PORT];
    if (await fileExists(KEY)) sshArgsPost.push('-i', KEY);
    sshArgsPost.push('-o','StrictHostKeyChecking=no','-o','IdentitiesOnly=yes', `${USER}@${HOST}`, fixCmd2);
    await run('ssh', sshArgsPost);
  } catch {}

  log('Deploy complete.');
}

main().catch((e)=>{ console.error(e?.stderr || e?.message || String(e)); process.exit(1); });
