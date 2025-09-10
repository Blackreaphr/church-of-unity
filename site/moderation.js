// Minimal moderation queue UI + scoring sandbox

const $ = (sel) => document.querySelector(sel);
const tokenKey = 'mod:token';

function getToken() {
  try { return localStorage.getItem(tokenKey) || ''; } catch { return ''; }
}
function setToken(v) {
  try { localStorage.setItem(tokenKey, v || ''); } catch {}
}

function headers(auth = false) {
  const h = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (auth && t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function fetchQueue() {
  const res = await fetch('/api/moderation/queue', { headers: headers(true), cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load queue');
  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

async function applyDecision(item_id, macro_id, fields = {}) {
  const body = { item_id, macro_id, reviewer_id: 'admin', fields };
  const res = await fetch('/api/moderation/decision', {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Decision failed');
  return res.json();
}

async function scoreDraft({ text, tags = [], trust_tier = 'T0' }) {
  const body = {
    item_id: Math.random().toString(36).slice(2),
    user_id: 'tester',
    content_type: 'topic',
    text: String(text || '').slice(0, 50000),
    links: [],
    media: [],
    tags,
    user_context: {
      trust_tier,
      prior_actions: ['none'],
      report_score: 0,
      velocity: { posts_last_hour: 0, links_last_day: 0 }
    }
  };
  const res = await fetch('/api/moderation/score', {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Score failed');
  return res.json();
}

function macroOptions() {
  return [
    { id: 'remove', label: 'Remove' },
    { id: 'edit_request', label: 'Edit Request' },
    { id: 'age_gate_blur', label: 'Age‑Gate + Blur' },
    { id: 'limit_distribution', label: 'Limit Distribution' },
    { id: 'warning', label: 'Warning' },
    { id: 'temp_suspend', label: 'Temporary Suspension' },
    { id: 'perm_ban', label: 'Permanent Ban' },
    { id: 'kill_switch', label: 'Kill‑Switch' }
  ];
}

function renderQueue(items) {
  const list = $('#queueList');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="muted">No items in queue.</div>';
    return;
  }
  const html = items.map((it) => {
    const labels = (it.policy_labels||[]).join(', ') || 'P2';
    const reasons = (it.routing && it.routing.reasons || []).join(', ');
    const esc = (s) => String(s||'').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    return `
    <article class="forum-item" role="listitem" data-id="${esc(it.item_id)}">
      <div class="topic-head">
        <h3 class="topic-title">${esc(it.item_id)} <span class="pill">Risk ${Number(it.risk_score||0)}</span> <span class="pill">${esc(labels)}</span></h3>
      </div>
      <div class="meta-line">
        <span class="muted">${esc(reasons)}</span>
      </div>
      ${it.text_preview ? `<p>${esc(it.text_preview)}</p>` : ''}
      <div style="display:flex; gap:8px; align-items:center; margin-top:6px;">
        <select class="macroSel" aria-label="Decision macro">
          ${macroOptions().map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join('')}
        </select>
        <button class="applyBtn ghost">Apply</button>
      </div>
    </article>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);

  list.querySelectorAll('.applyBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const article = btn.closest('article[data-id]');
      const item_id = article?.getAttribute('data-id') || '';
      const macro = article?.querySelector('.macroSel')?.value || 'remove';
      btn.disabled = true;
      btn.textContent = 'Applying…';
      try {
        await applyDecision(item_id, macro, {});
        article.remove();
      } catch (e) {
        alert('Failed to apply decision: ' + (e && e.message ? e.message : e));
      } finally {
        btn.disabled = false;
        btn.textContent = 'Apply';
      }
    });
  });
}

async function init() {
  // Token controls
  const tok = getToken();
  $('#tokenInput').value = tok;
  $('#saveTokenBtn').addEventListener('click', () => { setToken($('#tokenInput').value || ''); alert('Saved'); });
  $('#clearTokenBtn').addEventListener('click', () => { setToken(''); $('#tokenInput').value=''; alert('Cleared'); });

  // Queue
  $('#refreshQueueBtn').addEventListener('click', async () => {
    try { renderQueue(await fetchQueue()); } catch (e) { alert('Queue load failed'); }
  });
  // Load once on open
  try { renderQueue(await fetchQueue()); } catch {}

  // Scoring sandbox
  $('#scoreBtn').addEventListener('click', async () => {
    const text = $('#textInput').value;
    const trust_tier = $('#tierSelect').value || 'T0';
    const tags = ($('#tagsInput').value || '').split(',').map(s => s.trim()).filter(Boolean);
    $('#scoreStatus').textContent = 'Scoring…';
    try {
      const out = await scoreDraft({ text, tags, trust_tier });
      $('#scoreOut').textContent = JSON.stringify(out, null, 2);
    } catch (e) {
      $('#scoreOut').textContent = 'Error: ' + (e && e.message ? e.message : e);
    } finally {
      $('#scoreStatus').textContent = '';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

