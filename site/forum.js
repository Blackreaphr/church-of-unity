async function loadIndex() {
  try {
    const res = await fetch('/data/forum-posts.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load forum index');
    const json = await res.json();
    return Array.isArray(json) ? { posts: json } : json;
  } catch (e) {
    console.error(e);
    return { posts: [] };
  }
}

const norm = (s) => (s || '').toLowerCase();
function canonicalUrl(u) {
  try {
    if (!u) return u;
    let v = u;
    // Prefer extensionless URLs for forum posts by dropping .html
    if (/^\/forum\/.+\.html(\?.*)?$/i.test(v)) {
      v = v.replace(/\.html(\?.*)?$/i, '$1');
    }
    // For forum routes, prefer trailing slash to ensure directory index resolution
    if (/^\/forum\//i.test(v)) {
      const m = v.match(/^[^?#]+/); // path portion only
      const pathOnly = m ? m[0] : v;
      if (pathOnly && !pathOnly.endsWith('/')) {
        // Insert trailing slash before any query/hash
        const suffix = v.slice(pathOnly.length);
        v = pathOnly + '/' + suffix;
      }
    }
    return v;
  } catch { return u; }
}
const byDateDesc = (a, b) => (b || '').localeCompare(a || '');
function uniq(arr) { return Array.from(new Set(arr)); }
function uniqCategories(posts) { return uniq(posts.map(p => p.category).filter(Boolean)).sort(); }

function slugifyCategory(name) {
  return (name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h/24); if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d/30); if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo/12); return `${y}y ago`;
}

function sortAndFilter(posts, state) {
  let items = posts.slice(0);
  const words = norm(state.q).split(/\s+/).filter(Boolean);
  // Optional time window (in days)
  if (state.sinceDays && Number(state.sinceDays) > 0) {
    const cutoff = Date.now() - (Number(state.sinceDays) * 24 * 60 * 60 * 1000);
    items = items.filter(p => {
      const t = new Date(p.lastReplyAt || p.date).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }
  if (state.category) items = items.filter(p => (p.category || '') === state.category);
  if (state.tab === 'unanswered') items = items.filter(p => (p.replies || 0) === 0);
  if (words.length) {
    items = items.filter(p => {
      const hay = norm(p.title + ' ' + (p.excerpt || '') + ' ' + (p.tags || []).join(' '));
      return words.every(w => hay.includes(w));
    });
  }

  // Base sort by selected tab
  const baseSort = (a,b) => {
    if (state.tab === 'top') {
      return (b.replies||0) - (a.replies||0) || byDateDesc(a.lastReplyAt||a.date, b.lastReplyAt||b.date);
    } else if (state.tab === 'new') {
      return byDateDesc(a.date, b.date);
    }
    return byDateDesc(a.lastReplyAt||a.date, b.lastReplyAt||b.date);
  };

  // Sort with pinned posts first, preserving the chosen base order within each group
  const pinned = items.filter(p => !!p.pinned).sort(baseSort);
  const rest = items.filter(p => !p.pinned).sort(baseSort);

  // Ensure the "Welcome to the Forum" topic is always first when present
  const isWelcome = (p) => {
    const u = (p.url || '').toLowerCase();
    const t = (p.title || '').toLowerCase().trim();
    return u.endsWith('/forum-start/') || t === 'welcome to the forum' || t.startsWith('welcome to the forum');
  };

  const ordered = pinned.concat(rest);
  const wi = ordered.findIndex(isWelcome);
  if (wi > 0) {
    const [w] = ordered.splice(wi, 1);
    ordered.unshift(w);
  }
  return ordered;
}

function renderChunk(listEl, chunk) {
  const html = chunk.map(p => {
    const href = canonicalUrl(p.url || '');
    const cat = p.category ? `<span class="pill">${p.category}</span>` : '';
    const replies = (p.replies || 0) + ' replies';
    const iso = p.lastReplyAt || p.date;
    const last = timeAgo(iso);
    const name = p.starter || 'Member';
    const av = (name || '?').trim().charAt(0).toUpperCase();
    return `
    <article class="forum-item" role="listitem">
      <div class="topic-head">
        <span class="avatar" aria-hidden="true">${av}</span>
        <h3 class="topic-title"><a href="${href}">${p.title}</a></h3>
        ${cat}
      </div>
      <div class="meta-line">
        <span class="muted">${name}</span>
        <span class="muted">&bull; <time class="reltime" datetime="${iso}" aria-label="${new Date(iso).toLocaleString()}">${last}</time></span>
        <span class="muted">&bull; ${replies}</span>
      </div>
      ${p.excerpt ? `<p>${p.excerpt}</p>` : ''}
    </article>`;
  }).join('');
  listEl.insertAdjacentHTML('beforeend', html);
}

async function main() {
  const { posts } = await loadIndex();
  const list = document.getElementById('forumList');
  const sentinel = document.getElementById('forumSentinel');
  const search = document.getElementById('forumSearch');
  const catSel = document.getElementById('forumCategory');
  const tabs = Array.from(document.querySelectorAll('.forum-tabs .tab'));
  const catList = document.getElementById('forumCats');

  // Optionally exclude the current page's post from listings (for forum subpages embedding a feed)
  const excludeSelf = !!document.head.querySelector('meta[name="forum-exclude-self"]');
  const currentPath = location.pathname || '';
  const SOURCE_POSTS = excludeSelf ? posts.filter(p => {
    try { return new URL(p.url, location.origin).pathname !== currentPath; } catch(_) { return true; }
  }) : posts;

  const categories = uniqCategories(SOURCE_POSTS);
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c; catSel.appendChild(o);
  });
  if (catList) {
    catList.innerHTML = categories.map(c => {
      const count = SOURCE_POSTS.filter(p => (p.category||'') === c).length;
      return `<li><a href="#" data-cat="${c}"><span>${c}</span><span class="muted">${count}</span></a></li>`;
    }).join('');
    catList.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest('a[data-cat]');
      if (!a) return;
      e.preventDefault();
      const val = a.getAttribute('data-cat') || '';
      if (catSel instanceof HTMLSelectElement) catSel.value = val;
      state.category = val;
      resetAndRender();
    });
  }

  // Initialize state from URL query params and optional meta default
  const params = new URLSearchParams(location.search);
  const metaDefaultCat = ((document.querySelector('meta[name="forum-default-category"]')?.getAttribute('content')) || '').trim();
  const allowedTabs = new Set(['latest','top','new','unanswered']);
  const initialTab = params.get('tab') || 'latest';
  const catSlugParam = (params.get('cat') || '').trim();
  const legacyCategoryParam = (params.get('category') || '').trim();
  const unslug = (slug) => categories.find(c => slugifyCategory(c) === norm(slug)) || '';

  let initialCategory = legacyCategoryParam || (catSlugParam ? unslug(catSlugParam) : '') || metaDefaultCat || '';
  // Path-based defaults for virtual subroutes
  try {
    const p = (location.pathname || '').toLowerCase();
    if (!initialCategory && p.startsWith('/forum-feed/study-guides')) {
      initialCategory = 'Study Guides';
    }
  } catch {}
  const state = {
    q: params.get('q') || '',
    category: initialCategory,
    tab: allowedTabs.has(initialTab) ? initialTab : 'latest',
    page: 0,
    pageSize: 20,
    sinceDays: undefined,
  };
  const view = (params.get('view') || '').toLowerCase();
  const latestFlag = (params.get('latest') || '').toLowerCase();
  const metaDefaultLatest = !!document.querySelector('meta[name="forum-default-latest"]');
  if (view === 'browse-latest' || view === 'latest' || latestFlag === '1' || latestFlag === 'true' || metaDefaultLatest) {
    state.sinceDays = 7;
  }
  let filtered = sortAndFilter(SOURCE_POSTS, state);

  function syncUrl() {
    try {
      const url = new URL(location.href);
      if (state.q) url.searchParams.set('q', state.q); else url.searchParams.delete('q');
      // Keep URL clean on pages with a default category, and use slug param `cat`
      if (state.category && state.category !== metaDefaultCat) {
        url.searchParams.set('cat', slugifyCategory(state.category));
      } else {
        url.searchParams.delete('cat');
        url.searchParams.delete('category');
      }
      if (state.tab && state.tab !== 'latest') url.searchParams.set('tab', state.tab); else url.searchParams.delete('tab');
      // Represent the 7-day latest view compactly, but keep URL clean if it's the default for this page
      if (state.sinceDays === 7) {
        if (!metaDefaultLatest) url.searchParams.set('latest', '1'); else url.searchParams.delete('latest');
        url.searchParams.delete('view');
      } else {
        url.searchParams.delete('latest');
      }
      history.replaceState(null, '', url);
    } catch (_) {}
  }

  function resetAndRender() {
    list.innerHTML = '';
    state.page = 0;
    filtered = sortAndFilter(SOURCE_POSTS, state);
    // reflect filters in UI
    if (search instanceof HTMLInputElement) search.value = state.q;
    if (catSel instanceof HTMLSelectElement) {
      // Ensure value exists in options; otherwise reset to ''
      const values = Array.from(catSel.options).map(o => o.value);
      catSel.value = values.includes(state.category) ? state.category : '';
    }
    tabs.forEach(b => {
      const tab = b.getAttribute('data-tab') || '';
      b.setAttribute('aria-pressed', tab === state.tab ? 'true' : 'false');
    });
    syncUrl();
    loadMore();
  }

  function loadMore() {
    const start = state.page * state.pageSize;
    const next = filtered.slice(start, start + state.pageSize);
    if (!next.length) return;
    renderChunk(list, next);
    state.page++;
    // Update relative times after injecting new content
    updateRelativeTimes();
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.tab = btn.getAttribute('data-tab') || 'latest';
      resetAndRender();
    });
  });

  if (search instanceof HTMLInputElement) search.addEventListener('input', () => { state.q = search.value; resetAndRender(); });
  if (catSel instanceof HTMLSelectElement) catSel.addEventListener('change', () => { state.category = catSel.value; resetAndRender(); });

  const io = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) loadMore();
  }, { rootMargin: '1200px 0px 1200px 0px' });
  io.observe(sentinel);

  // Apply initial state to UI before first render
  // Add category options now so select can reflect initial category
  if (state.category && (catSel instanceof HTMLSelectElement)) catSel.value = state.category;
  // Set initial tab button state
  tabs.forEach(b => {
    const tab = b.getAttribute('data-tab') || '';
    b.setAttribute('aria-pressed', tab === state.tab ? 'true' : 'false');
  });
  // Set initial search text
  if (state.q && (search instanceof HTMLInputElement)) search.value = state.q;
  resetAndRender();

  // Live-update all relative time displays so they don't become stale
  function updateRelativeTimes(){
    try {
      const els = document.querySelectorAll('time.reltime[datetime]');
      els.forEach(el => {
        const iso = el.getAttribute('datetime') || '';
        if (!iso) return;
        el.textContent = timeAgo(iso);
      });
    } catch {}
  }
  // Update every minute and whenever the tab becomes visible
  updateRelativeTimes();
  const RELTIME_MS = 60 * 1000;
  let reltimeTimer = setInterval(updateRelativeTimes, RELTIME_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateRelativeTimes();
      clearInterval(reltimeTimer);
      reltimeTimer = setInterval(updateRelativeTimes, RELTIME_MS);
    }
  });

  // Copy template helper
  const copyBtn = document.getElementById('copyTemplate');
  const tpl = document.getElementById('topicTemplate');
  if (copyBtn && tpl) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(tpl.textContent || '');
        const old = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = old || 'Copy template'; }, 1200);
      } catch (_) {}
    });
  }

  try { /** @type {any} */ (window).__forumLoaded = true; } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}



