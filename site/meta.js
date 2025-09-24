// Shared head/meta injector for Church of Unity
// Reads existing <title> and description, then ensures canonical, Open Graph, and Twitter tags.

const isLocal = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
const SITE = {
  name: 'Church of Unity',
  baseUrl: typeof location !== 'undefined' ? location.origin : '',
  defaultImage: '/assets/symbol.svg',
  // Dev: if running locally, default to wrangler dev on 8787; else same-origin
  statsEndpoint: (typeof location !== 'undefined')
    ? (isLocal ? 'http://127.0.0.1:8787/api/stats' : `${location.origin}/api/stats`)
    : 'https://thechurchofunity.com/api/stats'
};

// Expose as config for consumers that read window.SITE_META and allow module importers
/**
 * @typedef {Window & typeof globalThis & { SITE_META?: any; __forumLoaded?: boolean }} UnityWindow
 */
/** @type {UnityWindow} */
const w = /** @type {any} */ (window);
try { w.SITE_META = SITE; } catch (_) {}

function ensureEl(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

function setMeta(name, content, { property = false } = {}) {
  const sel = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  const el = ensureEl(sel, () => {
    const m = document.createElement('meta');
    if (property) m.setAttribute('property', name); else m.setAttribute('name', name);
    return m;
  });
  el.setAttribute('content', content);
}

function run() {
  const rawTitle = document.title?.trim() || SITE.name;
  const pageName = rawTitle.replace(/\s*[â€¢|].*$/,'').trim();
  const title = `${pageName} | ${SITE.name}`;
  if (document.title !== title) document.title = title;

  const descEl = document.head.querySelector('meta[name="description"]');
  const description = (descEl?.getAttribute('content') || '').trim().slice(0, 300);

  // Canonical
  // Keep .html pages canonical (only collapse /index.html -> /)
  const canonicalPath = location.pathname.replace(/\/index\.html?$/i, '/');
  const canonicalUrl = `${SITE.baseUrl}${canonicalPath}`;
  const linkCanonical = ensureEl('link[rel="canonical"]', () => {
    const l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    return l;
  });
  linkCanonical.setAttribute('href', canonicalUrl);

  // Favicon + manifest (unify across all pages)
  try {
    // Try to read the version param stamped onto this script tag.
    // Avoid direct `import.meta` so non-ESM parsers don't choke.
    const ver = (() => {
      try {
        // ESM path (module scripts): eval avoids parse-time error in CJS environments
        const url = new URL((0, eval)('import.meta.url'));
        return url.searchParams.get('v') || '';
      } catch {}
      try {
        // Fallback: find the script by src
        const scripts = /** @type {NodeListOf<HTMLScriptElement>} */ (document.querySelectorAll('script[src]'));
        for (let i = scripts.length - 1; i >= 0; i--) {
          const s = scripts[i];
          if (s.src && /\/site\/meta\.js(\?|$)/.test(s.src)) {
            return new URL(s.src, location.origin).searchParams.get('v') || '';
          }
        }
      } catch {}
      return '';
    })();
    const withVer = (href) => ver ? `${href}?v=${ver}` : href;
    // Remove any existing, possibly inconsistent icon links first
    const priorIcons = document.head.querySelectorAll(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="alternate icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]'
    );
    priorIcons.forEach(el => el.parentNode?.removeChild(el));

    const addLink = (rel, href, attrs = {}) => {
      const l = document.createElement('link');
      l.setAttribute('rel', rel);
      l.setAttribute('href', href);
      for (const [k, v] of Object.entries(attrs)) l.setAttribute(k, v);
      document.head.appendChild(l);
      return l;
    };

    // Primary SVG favicon
    addLink('icon', withVer('/assets/symbol.svg'), { type: 'image/svg+xml' });
    // Shortcut icon for legacy support (many browsers just use rel=icon)
    addLink('shortcut icon', withVer('/assets/symbol.svg'), { type: 'image/svg+xml' });
    // Safari pinned tab (monochrome SVG uses color for mask)
    addLink('mask-icon', withVer('/assets/symbol.svg'), { color: '#c4161c' });

    // Ensure manifest exists
    ensureEl('link[rel="manifest"]', () => {
      const l = document.createElement('link');
      l.rel = 'manifest'; l.href = withVer('/site.webmanifest');
      return l;
    });
  } catch (_) {}

  // Determine type
  const isArticle = location.pathname.includes('/essays/');
  const ogType = isArticle ? 'article' : 'website';

  // Open Graph
  const ogImage = (() => { try { return new URL(SITE.defaultImage, SITE.baseUrl).href; } catch { return SITE.defaultImage; } })();
  setMeta('og:type', ogType, { property: true });
  setMeta('og:title', title, { property: true });
  if (description) setMeta('og:description', description, { property: true });
  setMeta('og:url', canonicalUrl, { property: true });
  setMeta('og:image', ogImage, { property: true });

  // Twitter
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  if (description) setMeta('twitter:description', description);
  setMeta('twitter:image', ogImage);

  // Provide stats endpoint to stats.js via meta tag on every page if configured
  try {
    if (SITE.statsEndpoint) {
      const m = ensureEl('meta[name="stats-endpoint"]', () => {
        const x = document.createElement('meta');
        x.setAttribute('name', 'stats-endpoint');
        return x;
      });
      m.setAttribute('content', SITE.statsEndpoint);
    }
  } catch (_) {}

  // Helper: canonicalize paths and find links by canonical path (treat .html and extensionless the same)
  function canonPath(p) {
    try {
      if (!p) return '/';
      p = p.replace(/\/index\.html?$/i, '/');
      p = p.replace(/\.html?$/i, '');
      if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
      return p || '/';
    } catch { return p; }
  }
  function linkCanon(a) {
    try { return canonPath(new URL(a.getAttribute('href') || '', location.origin).pathname); } catch { return ''; }
  }
  function findByPath(container, path) {
    const want = canonPath(path);
    const as = container ? container.querySelectorAll('a[href]') : [];
    for (const a of as) { if (linkCanon(a) === want) return a; }
    return null;
  }

  // Ensure Forum link exists in the main nav in a consistent position (after About, before More)
  try {
    const nav = document.querySelector('.site-nav .nav-links');
    if (nav && !findByPath(nav, '/forum')) {
      const forum = document.createElement('a');
      forum.href = '/forum.html';
      forum.textContent = 'Forum';
      const afterAbout = findByPath(nav, '/about');
      const more = nav.querySelector('details.more');
      if (afterAbout && afterAbout.parentNode === nav) {
        afterAbout.insertAdjacentElement('afterend', forum);
      } else if (more && more.parentNode === nav) {
        more.insertAdjacentElement('beforebegin', forum);
      } else {
        nav.appendChild(forum);
      }
    }
  } catch (_) {}

  // Ensure Philosophy link exists in the More menu
  try {
    const menu = document.querySelector('.more-menu');
    if (menu && !findByPath(menu, '/philosophy')) {
      const link = document.createElement('a');
      link.setAttribute('role', 'menuitem');
      link.href = '/philosophy.html';
      link.textContent = 'Philosophy';
      const after = findByPath(menu, '/divine-law');
      if (after) after.insertAdjacentElement('afterend', link); else menu.appendChild(link);
    }
  } catch (_) {}

  // Ensure Condemnation link exists in the More menu
  try {
    const menu = document.querySelector('.more-menu');
    if (menu && !findByPath(menu, '/condemnation')) {
      const link = document.createElement('a');
      link.setAttribute('role', 'menuitem');
      link.href = '/condemnation.html';
      link.textContent = 'Condemnation';
      // Look for Governance item (may be /about.html#governance or /about#governance)
      const beforeGov = menu.querySelector('a[href*="/about"][href*="#governance"]') || findByPath(menu, '/about');
      if (beforeGov) beforeGov.insertAdjacentElement('beforebegin', link); else menu.appendChild(link);
    }
  } catch (_) {}

  // Ensure and position Purgatory link in the More menu
  try {
    const menu = document.querySelector('.more-menu');
    if (menu) {
      // Find existing purgatory link if any
      let purg = findByPath(menu, '/purgatory');
      if (!purg) {
        purg = document.createElement('a');
        purg.setAttribute('role', 'menuitem');
        purg.href = '/purgatory.html';
        purg.textContent = 'Purgatory';
        menu.appendChild(purg);
      }
      // Target position: directly after Heaven, Hell, and the Human Journey
      const afterHeaven = Array.from(menu.querySelectorAll('a[href]')).find(a => /heaven-hell-journey/i.test(a.getAttribute('href')||''));
      if (afterHeaven && afterHeaven.nextSibling !== purg) {
        afterHeaven.insertAdjacentElement('afterend', purg);
      }
    }
  } catch (_) {}

  // Dedupe More menu items by canonical path (guard against double-insertion)
  try {
    const menu = document.querySelector('.more-menu');
    if (menu) {
      const seen = new Set();
      const links = Array.from(menu.querySelectorAll('a[href]'));
      links.forEach((a) => {
        const key = linkCanon(a);
        if (!key) return;
        if (seen.has(key)) {
          a.remove();
        } else {
          seen.add(key);
        }
      });
    }
  } catch (_) {}

  // On simple forum pages, ensure 'Forum' then 'Forum Feed' appear after Home, with separators
  try {
    const nav = document.querySelector('.site-nav .nav-links');
    // Allow pages to opt out (e.g., Study Guides pages show a category link instead)
    const noFeed = !!document.head.querySelector('meta[name="forum-nav-no-feed"]');
    if (nav && !noFeed) {
      const forum = findByPath(nav, '/forum');
      const home = nav.querySelector('a[href="/"]');
      const feed = findByPath(nav, '/forum-feed');
      if (home && forum && !feed) {
        // Ensure Home | Forum | Forum Feed
        if (!home.nextElementSibling || !home.nextElementSibling.classList || !home.nextElementSibling.classList.contains('nav-sep')) {
          const sepAfterHome = document.createElement('span'); sepAfterHome.className = 'nav-sep'; sepAfterHome.textContent = '|';
          home.insertAdjacentElement('afterend', sepAfterHome);
        }
        if (!forum.nextElementSibling || !forum.nextElementSibling.classList || !forum.nextElementSibling.classList.contains('nav-sep')) {
          const sepAfterForum = document.createElement('span'); sepAfterForum.className = 'nav-sep'; sepAfterForum.textContent = '|';
          forum.insertAdjacentElement('afterend', sepAfterForum);
        }
        const link = document.createElement('a'); link.href = '/forum-feed.html'; link.textContent = 'Forum Feed';
        forum.nextElementSibling.insertAdjacentElement('afterend', link);
      }
    }
  } catch (_) {}

  // Highlight active nav link and avoid always-highlighting Home
  try {
    const canon = (p) => {
      try {
        if (!p) return '/';
        // /index.html -> /
        p = p.replace(/\/index\.html?$/i, '/');
        // *.html -> *
        p = p.replace(/\.html?$/i, '');
        // remove trailing slash (except root)
        if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
        return p || '/';
      } catch { return p; }
    };
    const current = canon(location.pathname);
    const links = document.querySelectorAll('.site-nav a[href]');
    links.forEach((a) => {
      const hrefPath = canon(new URL(a.getAttribute('href'), location.origin).pathname);
      if (hrefPath === current) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
    const home = document.querySelector('.site-nav a.home');
    if (home) {
      if (current !== '/') {
        home.classList.remove('home');
      } else if (!home.classList.contains('home')) {
        home.classList.add('home');
      }
    }
  } catch (_) {
    // no-op
  }

  // JSON-LD Organization
  if (!document.head.querySelector('script[type="application/ld+json"][data-site="org"]')) {
    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.baseUrl,
      logo: SITE.defaultImage,
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.dataset.site = 'org';
    s.textContent = JSON.stringify(org);
    document.head.appendChild(s);
  }

  // Ensure footer shows the public domain link once
  try {
    const footer = document.querySelector('footer.footer.container');
    if (footer) {
      const target = footer.querySelector('small') || footer;
      const existing = target.querySelector('a[href^="https://thechurchofunity.com"]');
      if (!existing) {
        // add a subtle separator if there is already text content
        const hasText = (target.textContent || '').trim().length > 0;
        if (hasText) target.appendChild(document.createTextNode(' \u00b7 '));
        const a = document.createElement('a');
        a.href = 'https://thechurchofunity.com';
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'thechurchofunity.com';
        target.appendChild(a);
      }
    }
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}

// Optional: Normalize <a> links to extensionless URLs if explicitly enabled via
//   <meta name="clean-urls" content="1">
(function normalizeAnchorLinks(){
  const enable = !!document.head.querySelector('meta[name="clean-urls"][content="1"]');
  if (!enable) return;
  function toPretty(path){
    try {
      if (!path || path[0] !== '/') return path;
      if (/\.[a-z0-9]+$/i.test(path) && !/\.html?$/i.test(path)) return path;
      if (/\/index\.html?$/i.test(path)) return path.replace(/\/index\.html?$/i, '/');
      if (/\.html?$/i.test(path)) return path.replace(/\.html?$/i, '');
      return path;
    } catch { return path; }
  }
  function rewriteAll(){
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) return;
      const u = new URL(href, location.origin);
      const prettyPath = toPretty(u.pathname);
      const next = prettyPath + (u.search || '') + (u.hash || '');
      if (next !== href) a.setAttribute('href', next);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewriteAll);
  } else {
    rewriteAll();
  }
})();

// Load site-wide stats via bundler-resolved chunk (hashed filename handles cache busting)
// Avoid versioned dynamic path so the bundler rewrites to the correct hashed asset.
import('./stats.js').catch(() => {});

// Forum Feed fallback: if the hashed forum chunk fails (e.g., host perms),
// lazily import the source module to keep the page functional.
(function forumFeedFallback(){
  try {
    const p = location.pathname || '';
    if (!/\/forum-feed(\/|\.html|$)/.test(p)) return;
    setTimeout(() => {
      try {
        if (!w.__forumLoaded) {
          // Use a computed specifier so TS doesn't attempt to resolve types, and ask bundlers to ignore it.
          import(/* webpackIgnore: true, @vite-ignore */ new URL('/site/forum.js', location.origin).pathname);
        }
      } catch {}
    }, 300);
  } catch {}
})();
