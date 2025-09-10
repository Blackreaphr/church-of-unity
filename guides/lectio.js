// Lightweight passage picker for Lectio Divina
// Rotates suggestions daily and allows simple navigation.

import passagesData from '/data/lectio-passages.json';

function dayIndex() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
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
    const v = (catSel.value || 'all').toLowerCase();
    filtered = v === 'all' ? all : all.filter(x => x.category === v);
    if (!filtered.length) filtered = all;
    selectByDay();
  }

  prevBtn.addEventListener('click', () => {
    idx = (idx - 1 + filtered.length) % filtered.length;
    render(filtered[idx]);
  });
  nextBtn.addEventListener('click', () => {
    idx = (idx + 1) % filtered.length;
    render(filtered[idx]);
  });
  randBtn.addEventListener('click', () => {
    idx = Math.floor(Math.random() * filtered.length);
    render(filtered[idx]);
  });
  catSel.addEventListener('change', refilter);

  refilter();
}

function boot() {
  try {
    const list = Array.isArray(passagesData) ? passagesData : [];
    if (list.length) return setupUI(list);
  } catch {}
  // graceful fallback
  render({ ref: 'John 1:5', text: 'And the light shineth in darkness; and the darkness comprehended it not.', category: 'scripture' });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
