import fs from 'fs';
import path from 'path';

const src = path.resolve('guides', 'print.css');
const dstDir = path.resolve('dist', 'assets');
const dst = path.join(dstDir, 'guides-print.css');

try {
  if (!fs.existsSync(src)) {
    console.error('Source CSS not found:', path.relative('.', src));
    process.exit(1);
  }
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }
  fs.copyFileSync(src, dst);
  console.log(`Copied ${path.relative('.', src)} -> ${path.relative('.', dst)}`);
} catch (e) {
  console.error('Failed to copy guides CSS:', e.message || e);
  process.exit(1);
}

