import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, process.argv[2] || 'dist');

async function createForumFallbacks() {
  const forumDir = path.join(distDir, 'forum');
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
    const dstDir = path.join(forumDir, base);
    const dst = path.join(dstDir, 'index.html');
    try {
      await fs.mkdir(dstDir, { recursive: true });
      await fs.copyFile(src, dst);
      console.log(`Created forum fallback: forum/${base}/index.html`);
    } catch (err) {
      console.error(`Failed to create forum fallback for ${ent.name}:`, err.message || err);
      process.exitCode = 1;
    }
  }
}

createForumFallbacks();

