import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, process.argv[2] || 'dist');
const srcDir = path.join(root, 'data');
const destDir = path.join(distDir, 'data');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      console.log(`Copied data: ${path.relative(root, s)} -> ${path.relative(root, d)}`);
    }
  }
}

copyDirSync(srcDir, destDir);

