import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import fs from 'fs';

function env(name, fallback){
  const v = process.env[name];
  return v !== undefined && v !== '' ? v : fallback;
}

async function main(){
  const host = env('DEPLOY_HOST');
  const port = Number(env('DEPLOY_PORT') || 22);
  const username = env('DEPLOY_USER');
  const password = env('DEPLOY_PASSWORD');
  const privateKey = process.env.DEPLOY_KEY ? fs.readFileSync(process.env.DEPLOY_KEY, 'utf8') : undefined;
  const passphrase = env('DEPLOY_KEY_PASSPHRASE');
  const remoteBase = env('DEPLOY_DEST', 'public_html');
  const target = env('TARGET', 'forum');
  const sftp = new SftpClient();
  await sftp.connect({ host, port, username, password, privateKey, passphrase });
  try {
    const cwd = await sftp.cwd();
    const base = remoteBase.startsWith('/') ? remoteBase : path.posix.join(cwd, remoteBase);
    const dir = path.posix.join(base, target);
    console.log('Listing', dir);
    const list = await sftp.list(dir);
    for (const it of list){
      console.log(it.type === 'd' ? '[d]' : '[f]', it.name, it.size);
    }
    const ht = path.posix.join(dir, '.htaccess');
    try {
      const content = await sftp.get(ht);
      console.log('--- .htaccess ---');
      console.log(String(content));
    } catch (e){
      console.log('No .htaccess or cannot read:', e.message);
    }
  } finally {
    try { await sftp.end(); } catch {}
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });
