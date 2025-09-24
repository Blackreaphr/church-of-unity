import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, process.argv[2] || 'dist');

async function copyForumIntoAssets() {
  const forumDir = path.join(distDir, 'forum');
  const assetsDir = path.join(distDir, 'assets');
  try { await fs.mkdir(assetsDir, { recursive: true }); } catch {}
  let entries = [];
  try {
    entries = await fs.readdir(forumDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith('.html')) continue;
    if (ent.name.toLowerCase() === 'index.html') continue;
    const base = ent.name.slice(0, -'.html'.length);
    const src = path.join(forumDir, ent.name);
    const dst = path.join(assetsDir, `forum-${base}.html`);
    try {
      await fs.copyFile(src, dst);
      console.log(`Copied forum -> assets: assets/forum-${base}.html`);
    } catch (err) {
      console.error(`Failed to copy forum asset for ${ent.name}:`, err.message || err);
      process.exitCode = 1;
    }
  }
}

copyForumIntoAssets();

