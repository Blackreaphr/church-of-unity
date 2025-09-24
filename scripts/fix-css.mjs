import fs from 'fs';
import path from 'path';

function sanitize(content) {
  // 1) Normalize the "Home" accent override
  const escapedHome = String.raw`\n/* override: do not accent Home by default */\n.site-nav .home{font-weight:inherit;color:inherit}\n`;
  const normalHome = `\n\n/* override: do not accent Home by default */\n.site-nav .home{font-weight:inherit;color:inherit}\n`;

  // 2) High-contrast link color in main content (red + underline)
  const linkBlock = `\n\n/* override: high contrast links */\nmain a:not(.ghost):not(.btn):not(.link-back):not(.cta){color:var(--accent);text-decoration:underline;text-underline-offset:2px}\nmain a:hover{filter:brightness(1.08)}\n`;
  const linkRe = /\/\* override: high contrast links \*\/[\s\S]*?main a:hover\{[^}]*\}/m;

  let out = content.replaceAll(escapedHome, '');
  // Ensure we have the Home override once
  if (!/\/\* override: do not accent Home by default \*\/[\s\S]*?\.site-nav \.home\{font-weight:inherit;color:inherit\}/.test(out)) {
    out = out.trimEnd() + normalHome;
  }

  // Remove any existing link override block(s), then append one
  out = out.replace(linkRe, '');
  out = out.trimEnd() + linkBlock;

  return out;
}

// Fix source CSS if present
const srcCss = path.resolve('assets', 'main-8BzZRDYf.css');
if (fs.existsSync(srcCss)) {
  const orig = fs.readFileSync(srcCss, 'utf8');
  const fixed = sanitize(orig);
  if (fixed !== orig) {
    fs.writeFileSync(srcCss, fixed, 'utf8');
    console.log('Fixed assets/main-8BzZRDYf.css');
  }
}

// Fix built CSS
const distAssets = path.resolve('dist', 'assets');
if (fs.existsSync(distAssets)) {
  for (const f of fs.readdirSync(distAssets)) {
    if (/^main-.*\.css$/i.test(f)) {
      const p = path.join(distAssets, f);
      const orig = fs.readFileSync(p, 'utf8');
      const fixed = sanitize(orig);
      if (fixed !== orig) {
        fs.writeFileSync(p, fixed, 'utf8');
        console.log('Fixed', f);
      }
    }
  }
}
