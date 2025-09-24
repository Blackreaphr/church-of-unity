// Lightweight live counters for views and members
// Single source of truth via <meta name="stats-endpoint">; no third-party fallbacks

// Lazy endpoint resolution (after DOM is ready)
// Prefer centralized config (window.SITE_META.statsEndpoint), then per-page meta tag, then default
// Use same-origin by default so CSP `connect-src 'self'` permits requests
const DEFAULT_EP = '/api/stats';
let STATS_ENDPOINT = DEFAULT_EP;
let STATS_ENABLED = true;
let STATS_WARNED = false;
function resolveStatsEndpoint() {
  // Be TS-friendly: access unknown globals via bracket notation/cast
  const siteMeta = /** @type {any} */ (window)['SITE_META'];
  const cfg = (siteMeta && siteMeta.statsEndpoint) || null;
  const tag = document.querySelector('meta[name="stats-endpoint"]');
  const tagContent = tag && tag.getAttribute ? tag.getAttribute('content') : null;
  STATS_ENDPOINT = (cfg || tagContent || DEFAULT_EP).replace(/\/\/+$/, '');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', resolveStatsEndpoint);
} else {
  resolveStatsEndpoint();
}

// normalized namespace used everywhere
const NS = location.hostname.toLowerCase().replace(/^www\./, '');

// helper
async function handleJsonResponse(r) {
  const ct = (r.headers && (r.headers.get('Content-Type') || r.headers.get('content-type'))) || '';
  const isJson = /application\/json|json/i.test(ct);
  if (r.ok) {
    if (isJson) return r.json();
    // 200 but not JSON (likely a static HTML fallback). Surface a clear error.
    let body = '';
    try { body = await r.text(); } catch {}
    const err = Object.assign(new Error('Non-JSON response'), {
      status: r.status,
      body: (body || '').slice(0, 256)
    });
    throw err;
  }
  let msg = r.statusText || String(r.status);
  if (isJson) {
    try {
      const j = await r.json();
      if (j && j.error) msg = j.error;
    } catch {}
  } else {
    try {
      const t = await r.text();
      // Extract first <title> if present for a better message
      const m = /<title>([^<]{1,120})<\/title>/i.exec(t);
      if (m && m[1]) msg = `${msg} (${m[1].trim()})`;
    } catch {}
  }
  const err = Object.assign(new Error(msg), { status: r.status });
  throw err;
}

// Quick health check to avoid noisy errors when the endpoint isn't deployed.
async function isEndpointLive() {
  const u = `${STATS_ENDPOINT}/health`;
  try {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 1500) : null;
    const r = await fetch(u, { credentials: 'omit', signal: ctl ? ctl.signal : undefined });
    if (t) clearTimeout(t);
    if (!r.ok) return false;
    const ct = r.headers.get('Content-Type') || r.headers.get('content-type') || '';
    if (!/json/i.test(ct)) return false;
    const j = await r.json().catch(() => null);
    return !!(j && j.ok);
  } catch {
    return false;
  }
}

function disableStats(reason) {
  STATS_ENABLED = false;
  try {
    if (!STATS_WARNED) { STATS_WARNED = true; console.info('Stats disabled:', reason || 'endpoint unavailable'); }
    // Hide any trailing plus suffix so the UI does not look unfinished
    try { document.querySelectorAll('.stat-suffix').forEach(el => { if (el instanceof HTMLElement) el.style.display = 'none'; }); } catch {}
    // Leave buttons enabled; run() will attach local-only fallbacks when needed
  } catch {}
}
const api = (path, init = {}) =>
  fetch(`${STATS_ENDPOINT}/${path}`, { credentials: 'omit', ...init }).then(handleJsonResponse);

// endpoints that set/read cookies (same-origin in prod)
const apiAuth = (path, init = {}) =>
  fetch(`${STATS_ENDPOINT}/${path}`, { credentials: 'include', ...init }).then(handleJsonResponse);

// rendering helpers (adapt selectors if needed)
const setMembers = (n) => document
  .querySelectorAll('#memberCount,[data-members]')
  .forEach((el) => {
    el.textContent = String(n);
    // Hide any "+" suffix element once live member value is shown
    try {
      const suffix = el.parentElement && el.parentElement.querySelector('.stat-suffix');
      if (suffix && suffix instanceof HTMLElement) suffix.style.display = 'none';
    } catch {}
  });
const setViews = (n) => document
  .querySelectorAll('#viewCount,[data-views]')
  .forEach((el) => {
    el.textContent = String(n);
    // Hide any "+" suffix element once live value is shown
    try {
      const suffix = el.parentElement && el.parentElement.querySelector('.stat-suffix');
      if (suffix && suffix instanceof HTMLElement) suffix.style.display = 'none';
    } catch {}
  });

// calls
async function syncMembers() {
  const { value } = await api(`get/${encodeURIComponent(NS)}/members`);
  const cached = Number(localStorage.getItem('co:members') || 0);
  const v = Math.max(cached, Number(value) || 0);
  setMembers(v);
  try { localStorage.setItem('co:members', String(v)); } catch {}
}
async function joinOnce() {
  // idempotent join; server dedupes per device via cookie
  const { value } = await apiAuth(`join/${encodeURIComponent(NS)}`);
  setMembers(value);
  try { localStorage.setItem('co:members', String(Number(value) || 0)); } catch {}
}
async function bumpViewsOncePerSession() {
  const key = 'co:viewed';
  const path = sessionStorage.getItem(key)
    ? `get/${encodeURIComponent(NS)}/site-views`
    : `hit/${encodeURIComponent(NS)}/site-views`;
  const { value } = await api(path);
  setViews(value);
  sessionStorage.setItem(key, '1');
}

function run() {
  // Hide any "+" suffix immediately to avoid stale UI before data loads
  try { document.querySelectorAll('.stat-suffix').forEach(el => { if (el instanceof HTMLElement) el.style.display = 'none'; }); } catch {}
  // ensure endpoint ready before first call
  resolveStatsEndpoint();
  // Detect live endpoint; if missing, degrade silently after seeding from cache
  isEndpointLive().then((ok) => {
    if (!ok) disableStats('health check failed');
    if (!STATS_ENABLED) return; // no network calls if disabled
    // fire-and-forget; surface errors to console for diagnosis
    bumpViewsOncePerSession().catch((e) => {
      console.warn('views update failed:', e);
      // Ensure trailing plus sign is hidden even if views fail to load
      try { document.querySelectorAll('.stat-suffix').forEach(el => { if (el instanceof HTMLElement) el.style.display = 'none'; }); } catch {}
    });
  });
  // Request persistent storage to reduce eviction on mobile (best effort)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
  // Seed UI from last known value to avoid lag on eventual consistency
  try {
    const cachedMembers = Number(localStorage.getItem('co:members') || 0);
    if (cachedMembers > 0) setMembers(cachedMembers);
  } catch {}
  if (STATS_ENABLED) {
    syncMembers().catch((e) => console.warn('members update failed:', e));
  }
  /** @type {HTMLButtonElement|null} */
  const btn = /** @type {any} */ (document.getElementById('joinBtn'));
  /** @type {HTMLButtonElement|null} */
  const restoreBtn = /** @type {any} */ (document.getElementById('restoreBtn'));
  /** @type {HTMLButtonElement|null} */
  const getCodeBtn = /** @type {any} */ (document.getElementById('getRecoveryBtn'));
  /** @type {HTMLElement|null} */
  const recoveryWrap = /** @type {any} */ (document.getElementById('recoveryArea'));
  /** @type {HTMLElement|null} */
  const recoveryText = /** @type {any} */ (document.getElementById('recoveryText'));
  /** @type {HTMLButtonElement|null} */
  const copyRecoveryBtn = /** @type {any} */ (document.getElementById('copyRecoveryBtn'));
  if (btn) {
    const joinedKey = 'co:joined';
    const setJoinedUI = (joined) => {
      if (!btn) return;
      if (joined) {
        btn.textContent = 'Joined(Member)';
        btn.setAttribute('aria-label', 'Joined(Member)');
        btn.classList.add('joined');
        btn.disabled = true;
        if (restoreBtn) restoreBtn.style.display = 'none';
        if (getCodeBtn) getCodeBtn.style.display = '';
      } else {
        btn.textContent = 'Join Unity';
        btn.setAttribute('aria-label', 'Join Unity');
        btn.classList.remove('joined');
        btn.disabled = false;
        if (restoreBtn) restoreBtn.style.display = '';
        if (getCodeBtn) getCodeBtn.style.display = 'none';
      }
    };
    // Initialize UI from local state
    setJoinedUI(!!localStorage.getItem(joinedKey));
    // Try to restore from server-side cookie if local state missing
    if (!localStorage.getItem(joinedKey)) {
      apiAuth(`me/${encodeURIComponent(NS)}`).then(({ joined }) => {
        if (joined) { try { localStorage.setItem(joinedKey, '1'); } catch {}; setJoinedUI(true); }
      }).catch(() => {});
    }
    // Recovery: restore via code (sets cookie, no increment)
    if (restoreBtn) {
      restoreBtn.addEventListener('click', async () => {
        const code = (prompt('Enter your recovery code') || '').trim();
        if (!code) return;
        restoreBtn.disabled = true;
        try {
          const { joined, value } = await apiAuth(`recovery/restore/${encodeURIComponent(NS)}?code=${encodeURIComponent(code)}`);
          if (joined) {
            try { localStorage.setItem(joinedKey, '1'); } catch {}
            if (typeof value === 'number') setMembers(value);
            setJoinedUI(true);
            alert('Membership restored on this device.');
          } else {
            alert('Could not restore membership.');
          }
        } catch (e) {
          console.warn('restore failed:', e);
          const msg = (e && e.message) ? String(e.message) : 'Invalid or expired recovery code.';
          alert(msg);
        } finally {
          restoreBtn.disabled = false;
        }
      });
    }
    // Recovery: generate a new code (requires joined)
    if (getCodeBtn) {
      getCodeBtn.addEventListener('click', async () => {
        getCodeBtn.disabled = true;
        try {
          // Ensure server sees membership (cookie + marker). If missing, join and re-check a few times.
          const ensureJoined = async () => {
            const tries = [0, 150, 350];
            for (let i = 0; i < tries.length; i++) {
              try {
                const me = await apiAuth(`me/${encodeURIComponent(NS)}`);
                if (me && me.joined) return true;
              } catch {}
              try { await joinOnce(); } catch {}
              const wait = tries[i];
              if (wait) await new Promise(r => setTimeout(r, wait));
            }
            // final check
            try {
              const me = await apiAuth(`me/${encodeURIComponent(NS)}`);
              return !!(me && me.joined);
            } catch { return false; }
          };

          const ok = await ensureJoined();
          if (!ok) throw new Error('Not joined on this device');

          const { code } = await apiAuth(`recovery/new/${encodeURIComponent(NS)}`);
          if (code) {
            if (recoveryWrap && recoveryText) {
              recoveryText.textContent = code;
              try { recoveryWrap.hidden = false; } catch {}
            } else {
              alert(`Your recovery code:\n${code}\n\nSave this code to restore membership if needed.`);
            }
            return; // success
          }
          throw new Error('Failed to generate code');
        } catch (e) {
          console.warn('get recovery code failed:', e);
          const msg = (e && e.message) ? String(e.message) : 'You need to be joined on this device to get a code.';
          alert(msg);
        } finally {
          getCodeBtn.disabled = false;
        }
      });
    }
    if (copyRecoveryBtn && recoveryText) {
      copyRecoveryBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(recoveryText.textContent || '');
          copyRecoveryBtn.textContent = 'Copied!';
          setTimeout(() => { copyRecoveryBtn.textContent = 'Copy'; }, 1200);
        } catch {}
      });
    }
    btn.addEventListener('click', async () => {
      if (!STATS_ENABLED) {
        // Local-only fallback: mark joined on this device and bump display from cache
        const already = !!localStorage.getItem(joinedKey);
        const cached = Number(localStorage.getItem('co:members') || '0') || 0;
        const next = already ? cached : cached + 1;
        if (!already) {
          try { localStorage.setItem('co:members', String(next)); } catch {}
          localStorage.setItem(joinedKey, '1');
        }
        setMembers(next);
        setJoinedUI(true);
        return;
      }
      if (localStorage.getItem(joinedKey)) { setJoinedUI(true); return; }
      btn.disabled = true;
      const prev = btn.textContent;
      // ASCII to avoid encoding issues on some hosts
      btn.textContent = 'Joining...';
      try {
        await joinOnce();
        localStorage.setItem(joinedKey, '1');
        setJoinedUI(true);
      } catch (e) {
        console.warn('join failed:', e);
        // Graceful fallback: mark joined locally so the button still works
        try {
          const already = !!localStorage.getItem(joinedKey);
          const cached = Number(localStorage.getItem('co:members') || '0') || 0;
          const next = already ? cached : cached + 1;
          if (!already) {
            try { localStorage.setItem('co:members', String(next)); } catch {}
            localStorage.setItem(joinedKey, '1');
          }
          setMembers(next);
          setJoinedUI(true);
          // Also hide any "+" suffix if present (mirrors successful state)
          try { document.querySelectorAll('.stat-suffix').forEach(el => { if (el instanceof HTMLElement) el.style.display = 'none'; }); } catch {}
          return; // stop default 'Try again' UI since we succeeded locally
        } catch {}
        btn.textContent = 'Try again';
        btn.disabled = false;
        setTimeout(() => { if (btn && !localStorage.getItem(joinedKey)) btn.textContent = prev || 'Join Unity'; }, 1600);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}

// Mark this file as an ES module for TypeScript without affecting runtime side-effects
export {};
