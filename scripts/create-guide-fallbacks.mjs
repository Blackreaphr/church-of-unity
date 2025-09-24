import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, process.argv[2] || 'dist');
const guideSlugs = ['examen', 'lectio-divina', 'rule-of-life'];

async function ensureGuideFallbacks() {
  for (const slug of guideSlugs) {
    const src = path.join(distDir, 'guides', `${slug}.html`);
    try {
      const stat = await fs.stat(src);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }
    const dir = path.join(distDir, 'guides', slug);
    const dst = path.join(dir, 'index.html');
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(src, dst);
      console.log(`Created printable guide fallback: ${path.relative(distDir, dst)}`);
    } catch (err) {
      console.error(`Failed to create guide fallback for ${slug}:`, err.message || err);
      process.exitCode = 1;
    }
  }
}

ensureGuideFallbacks();
