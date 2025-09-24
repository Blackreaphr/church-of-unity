import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, process.argv[2] || 'dist');

function ensureDirSync(p){
  fs.mkdirSync(p, { recursive: true });
}

function copyOne(src, dest){
  ensureDirSync(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`Copied ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
}

let copied = 0;

// 1) Root/public .htaccess -> dist/.htaccess
for (const src of [path.join(root, 'public', '.htaccess'), path.join(root, '.htaccess')]){
  if (fs.existsSync(src)){
    copyOne(src, path.join(distDir, '.htaccess'));
    copied++;
    break;
  }
}

// 2) Forum-specific rules (ensure forum/.htaccess gets deployed)
const forumHt = path.join(root, 'forum', '.htaccess');
if (fs.existsSync(forumHt)){
  copyOne(forumHt, path.join(distDir, 'forum', '.htaccess'));
  copied++;
}

if (!copied){
  console.error('No .htaccess source file found.');
  process.exit(1);
}
