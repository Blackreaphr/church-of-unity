// Lightweight passage picker for Lectio Divina
// Rotates suggestions daily and allows simple navigation.

async function loadPassages() {
  try {
    const res = await fetch('/data/lectio-passages.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load passages');
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (_) {
    return [];
  }
}

function dayIndex() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function render(p) {
  const refEl = document.getElementById('passageRef');
  const textEl = document.getElementById('passageText');
  const srcEl = document.getElementById('passageSource');
  refEl.textContent = p.ref;
  textEl.textContent = p.text;
  srcEl.textContent = p.category === 'scripture' ? 'Scripture: KJV' : `Source: ${p.source || 'Classical reflection'}`;
}

function setupUI(all) {
  const catSel = document.getElementById('lectioCategory');
  const prevBtn = document.getElementById('prevPick');
  const nextBtn = document.getElementById('nextPick');
  const randBtn = document.getElementById('randomPick');

  let filtered = all;
  let idx = 0;

  function selectByDay() {
    idx = dayIndex() % filtered.length;
    render(filtered[idx]);
  }

  function refilter() {
    let v = 'all';
    if (catSel instanceof HTMLSelectElement) v = (catSel.value || 'all').toLowerCase();
    filtered = v === 'all' ? all : all.filter(x => (x.category || '').toLowerCase() === v);
    if (!filtered.length) filtered = all;
    selectByDay();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => {
    idx = (idx - 1 + filtered.length) % filtered.length;
    render(filtered[idx]);
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    idx = (idx + 1) % filtered.length;
    render(filtered[idx]);
  });
  if (randBtn) randBtn.addEventListener('click', () => {
    idx = Math.floor(Math.random() * filtered.length);
    render(filtered[idx]);
  });
  if (catSel instanceof HTMLSelectElement) catSel.addEventListener('change', refilter);

  refilter();
}

async function boot() {
  const list = await loadPassages();
  if (list.length) return setupUI(list);
  // graceful fallback
  render({ ref: 'John 1:5', text: 'And the light shineth in darkness; and the darkness comprehended it not.', category: 'scripture' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
