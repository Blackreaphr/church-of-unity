import fs from 'fs';
import path from 'path';

const distAssets = path.resolve('dist', 'assets');
const aliasName = 'main-8BzZRDYf.css';

if (!fs.existsSync(distAssets)) {
  console.error('dist/assets not found. Run build first.');
  process.exit(1);
}

const files = fs.readdirSync(distAssets);
const css = files.find(f => /^main-.*\.css$/i.test(f));
if (!css) {
  console.error('No main-*.css found in dist/assets');
  process.exit(1);
}

const src = path.join(distAssets, css);
const dst = path.join(distAssets, aliasName);
try {
  fs.copyFileSync(src, dst);
  console.log(`Aliased ${css} -> ${aliasName}`);
} catch (e) {
  console.error('Alias copy failed:', e.message);
  process.exit(1);
}

