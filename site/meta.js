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
try { window.SITE_META = SITE; } catch (_) {}
export default SITE;

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
  const pageName = rawTitle.replace(/\s*[•|].*$/,'').trim();
  const title = `${pageName} | ${SITE.name}`;
  if (document.title !== title) document.title = title;

  const descEl = document.head.querySelector('meta[name="description"]');
  const description = (descEl?.getAttribute('content') || '').trim().slice(0, 300);

  // Canonical
  // Canonical: prefer extensionless URLs
  const cleanPath = location.pathname
    .replace(/\/index\.html$/i, '/')
    .replace(/\.html$/i, '');
  const canonicalUrl = `${SITE.baseUrl}${cleanPath}`;
  const linkCanonical = ensureEl('link[rel="canonical"]', () => {
    const l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    return l;
  });
  linkCanonical.setAttribute('href', canonicalUrl);

  // Favicon + manifest
  ensureEl('link[rel="icon"]', () => {
    const l = document.createElement('link');
    l.rel = 'icon'; l.href = '/assets/symbol.svg'; l.type = 'image/svg+xml';
    return l;
  });
  ensureEl('link[rel="manifest"]', () => {
    const l = document.createElement('link');
    l.rel = 'manifest'; l.href = '/site.webmanifest';
    return l;
  });

  // Determine type
  const isArticle = location.pathname.includes('/essays/');
  const ogType = isArticle ? 'article' : 'website';

  // Open Graph
  setMeta('og:type', ogType, { property: true });
  setMeta('og:title', title, { property: true });
  if (description) setMeta('og:description', description, { property: true });
  setMeta('og:url', canonicalUrl, { property: true });
  setMeta('og:image', SITE.defaultImage, { property: true });

  // Twitter
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  if (description) setMeta('twitter:description', description);
  setMeta('twitter:image', SITE.defaultImage);

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

  // Ensure Forum link exists in the main nav in a consistent position (after About, before More)
  try {
    const nav = document.querySelector('.site-nav .nav-links');
    if (nav && !nav.querySelector('a[href="/forum"]')) {
      const forum = document.createElement('a');
      forum.href = '/forum';
      forum.textContent = 'Forum';
      const afterAbout = nav.querySelector('a[href="/about"]');
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
    if (menu && !menu.querySelector('a[href="/philosophy"]')) {
      const link = document.createElement('a');
      link.setAttribute('role', 'menuitem');
      link.href = '/philosophy';
      link.textContent = 'Philosophy';
      const after = menu.querySelector('a[href="/divine-law"]');
      if (after) after.insertAdjacentElement('afterend', link); else menu.appendChild(link);
    }
  } catch (_) {}

  // Ensure Condemnation link exists in the More menu
  try {
    const menu = document.querySelector('.more-menu');
    if (menu && !menu.querySelector('a[href="/condemnation"]')) {
      const link = document.createElement('a');
      link.setAttribute('role', 'menuitem');
      link.href = '/condemnation';
      link.textContent = 'Condemnation';
      const beforeGov = menu.querySelector('a[href="/about#governance"]');
      if (beforeGov) beforeGov.insertAdjacentElement('beforebegin', link); else menu.appendChild(link);
    }
  } catch (_) {}

  // On simple forum pages, ensure 'Forum' then 'Forum Feed' appear after Home, with separators
  try {
    const nav = document.querySelector('.site-nav .nav-links');
    // Allow pages to opt out (e.g., Study Guides pages show a category link instead)
    const noFeed = !!document.head.querySelector('meta[name="forum-nav-no-feed"]');
    if (nav && !noFeed) {
      const forum = nav.querySelector('a[href="/forum"]');
      const home = nav.querySelector('a[href="/"]');
      const feed = nav.querySelector('a[href^="/forum-feed"]');
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
        const link = document.createElement('a'); link.href = '/forum-feed'; link.textContent = 'Forum Feed';
        forum.nextElementSibling.insertAdjacentElement('afterend', link);
      }
    }
  } catch (_) {}

  // Highlight active nav link and avoid always-highlighting Home
  try {
    const normalize = (p) => (p === '/' || p === '' ? '/index.html' : p);
    const current = normalize(location.pathname);
    const links = document.querySelectorAll('.site-nav a[href]');
    links.forEach((a) => {
      const hrefPath = normalize(new URL(a.getAttribute('href'), location.origin).pathname);
      if (hrefPath === current) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
    const home = document.querySelector('.site-nav a.home');
    if (home) {
      if (current !== '/index.html') {
        home.classList.remove('home');
      } else {
        if (!home.classList.contains('home')) home.classList.add('home');
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

// Normalize <a> links to extensionless URLs (e.g., /about.html -> /about, /index.html -> /)
(function normalizeAnchorLinks(){
  function toPretty(path){
    try {
      // Only root-relative paths
      if (!path || path[0] !== '/') return path;
      // Keep directories and files with extensions other than .html
      if (/\.[a-z0-9]+$/i.test(path) && !/\.html?$/i.test(path)) return path;
      // /index.html -> /
      if (/\/index\.html?$/i.test(path)) return path.replace(/\/index\.html?$/i, '/');
      // *.html -> *
      if (/\.html?$/i.test(path)) return path.replace(/\.html?$/i, '');
      return path;
    } catch { return path; }
  }
  function rewriteAll(){
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      // Skip non-root-relative and mailto/tel
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

// Load site-wide stats; propagate version query from this module to bust cache on deploys
{
  const ver = (() => { try { return new URL(import.meta.url).searchParams.get('v') || ''; } catch { return ''; } })();
  const spec = ver ? `./stats.js?v=${ver}` : './stats.js';
  // Use a Promise catch, not try/catch (import() is async)
  import(spec).catch(() => import('./stats.js'));
}
