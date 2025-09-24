import fs from 'fs';
import path from 'path';
import url from 'url';
import SftpClient from 'ssh2-sftp-client';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, 'dist');

function env(name, fallback = undefined) {
  const v = process.env[name];
  return v !== undefined && v !== '' ? v : fallback;
}

function requireEnv(name) {
  const v = env(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function readKeyMaterial() {
  const keyText = env('DEPLOY_KEY_TEXT');
  const keyPath = env('DEPLOY_KEY');
  if (keyText) return keyText;
  if (keyPath) return fs.readFileSync(path.resolve(keyPath), 'utf8');
  return undefined;
}

async function ensureRemoteDir(sftp, remotePath) {
  const exists = await sftp.exists(remotePath);
  if (exists === 'd') return;
  if (!exists) {
    // create recursively
    const parts = remotePath.split('/').filter(Boolean);
    let cur = remotePath.startsWith('/') ? '/' : '';
    for (const p of parts) {
      cur = path.posix.join(cur, p);
      const e = await sftp.exists(cur);
      if (!e) await sftp.mkdir(cur);
    }
  } else {
    throw new Error(`Remote path exists but is not a directory: ${remotePath}`);
  }
}

async function uploadDir(sftp, localDir, remoteDir, { dryRun = false } = {}) {
  await ensureRemoteDir(sftp, remoteDir);
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    const lp = path.join(localDir, entry.name);
    const rp = path.posix.join(remoteDir, entry.name.replace(/\\/g, '/'));
    if (entry.isDirectory()) {
      if (!dryRun) await ensureRemoteDir(sftp, rp);
      console.log(`[dir ] ${rp}`);
      await uploadDir(sftp, lp, rp, { dryRun });
    } else if (entry.isFile()) {
      console.log(`[put ] ${rp}`);
      if (!dryRun) await sftp.fastPut(lp, rp);
    }
  }
}

async function cleanRemote(sftp, remoteDir) {
  const exists = await sftp.exists(remoteDir);
  if (!exists) return;
  // Remove contents but not the directory itself
  const list = await sftp.list(remoteDir);
  for (const item of list) {
    const rp = path.posix.join(remoteDir, item.name);
    if (item.type === 'd') {
      await sftp.rmdir(rp, true);
      console.log(`[rmdir] ${rp}`);
    } else {
      await sftp.delete(rp);
      console.log(`[del ] ${rp}`);
    }
  }
}

async function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ not found. Run "npm run build" first.');
  }

  const host = requireEnv('DEPLOY_HOST');
  const port = Number(env('DEPLOY_PORT', '22'));
  const username = requireEnv('DEPLOY_USER');
  const password = env('DEPLOY_PASSWORD');
  const privateKey = readKeyMaterial();
  const passphrase = env('DEPLOY_KEY_PASSPHRASE');
  const remoteBase = env('DEPLOY_DEST', 'public_html'); // relative to home by default
  const dryRun = env('DEPLOY_DRY_RUN', '0') === '1';
  const clean = env('DEPLOY_CLEAN', '0') === '1';

  if (!password && !privateKey) {
    throw new Error('Provide either DEPLOY_PASSWORD or DEPLOY_KEY/DEPLOY_KEY_TEXT');
  }

  const sftp = new SftpClient();
  try {
    console.log(`Connecting to ${host}:${port} as ${username} ...`);
    await sftp.connect({ host, port, username, password, privateKey, passphrase });
    console.log('Connected.');

    const remoteDir = remoteBase.startsWith('/') ? remoteBase : path.posix.join(await sftp.cwd(), remoteBase);
    console.log(`Remote base: ${remoteDir}`);
    await ensureRemoteDir(sftp, remoteDir);
    if (clean) {
      console.log('Cleaning remote directory contents ...');
      await cleanRemote(sftp, remoteDir);
    }
    console.log('Uploading dist/ ...');
    await uploadDir(sftp, distDir, remoteDir, { dryRun });
    console.log('Done.');
  } finally {
    try { await sftp.end(); } catch {}
  }
}

main().catch((err) => {
  console.error('Deploy failed:', err.message || err);
  process.exitCode = 1;
});

