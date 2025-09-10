// Lightweight client-side search overlay with fuzzy matching

const PAGES = [
  { title: 'Start Here', url: '/start-here.html', tags: 'foundations catechism begin' },
  { title: 'Practice', url: '/practice.html', tags: 'lectio examen sabbath rule of life guides' },
  { title: 'Texts and Library', url: '/texts-library.html', tags: 'scripture catechism readings philosophy' },
  { title: 'Inquiry Forum', url: '/inquiry-forum.html', tags: 'questions dialogue discussion threads' },
  { title: 'Forum', url: '/forum.html', tags: 'forum essays posts longform' },
  { title: 'About and Governance', url: '/about.html', tags: 'origin commitments norms governance' },
  { title: 'Divine Law', url: '/divine-law.html', tags: 'ten commandments decalogue natural law' },
  { title: 'Chaos and Order', url: '/chaos-order.html', tags: 'yin yang providence creativity discipline' },
  { title: 'Philosophy: Death and What Lies Beyond', url: '/philosophy.html', tags: 'death afterlife resurrection reincarnation soul extinction philosophy' },
  { title: 'Philosophy: Deep Thinking and Faith', url: '/philosophy-2.html', tags: 'philosophy deep thinking faith reason conscience inquiry education indoctrination authoritarianism authority sources verification' },
  { title: 'Fate and Destiny', url: '/fate-destiny.html', tags: 'providence predestination free will grace' },
  { title: 'Heaven, Hell, and the Human Journey', url: '/heaven-hell-journey.html', tags: 'judgment purgation hope grief death' },
  { title: 'The Many Names of God', url: '/names-of-god.html', tags: 'justice mercy wisdom word life death resurrection' },
  { title: 'Sermons and Reflections', url: '/sermons.html', tags: 'essays homilies reflections' },
  { title: 'Glossary', url: '/glossary.html', tags: 'definitions terms revelation providence determinism synergy sacrament metaphysics' },
  { title: 'Condemnation: Safeguards and Accountability', url: '/condemnation.html', tags: 'condemn abuse manipulation coercion indoctrination open inquiry charter conscience freedom dissent transparency accountability clergy leaders governance simony safeguarding' },
  { title: 'Condemnation (Page 2): Extended Statement', url: '/condemnation-2.html', tags: 'condemn abuse simony scandal accountability repentance reform safeguarding spiritual abuse finances catechism canon law' },
  { title: 'Condemnation (Page 3): Practices and Promises', url: '/condemnation-3.html', tags: 'freedom to give freewill offering budget transparency oversight safeguarding consent coercion simony spiritual blackmail accountability' },
  { title: 'Essay: The Ten Commandments', url: '/essays/ten-commandments.html', tags: 'law decalogue essay' },
  { title: 'Essay: Providence and Freedom', url: '/essays/providence-and-freedom.html', tags: 'providence freedom models essay' },
  { title: 'Guide: Daily Examen', url: '/guides/examen.html', tags: 'guide pdf practice examen' },
  { title: 'Guide: Lectio Divina', url: '/guides/lectio-divina.html', tags: 'guide pdf practice lectio' },
  { title: 'Guide: Rule of Life', url: '/guides/rule-of-life.html', tags: 'guide pdf practice rule life' },
];

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.innerHTML = `
    <div class="search-panel" role="dialog" aria-modal="true" aria-labelledby="searchLabel">
      <div class="search-head">
        <label id="searchLabel" class="visually-hidden">Search</label>
        <input class="search-input" type="search" placeholder="Search pages…" autofocus />
        <span class="kbd">Esc</span>
      </div>
      <div class="search-results" role="listbox"></div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function score(q, item) {
  const s = (str) => str.toLowerCase();
  const query = s(q).trim();
  if (!query) return 0;
  const hay = s(item.title + ' ' + (item.tags || ''));
  if (hay.includes(query)) return query.length + (hay.startsWith(query) ? 5 : 0);
  // very light fuzzy: all words must appear
  const words = query.split(/\s+/);
  return words.every(w => hay.includes(w)) ? words.join('').length : 0;
}

function openSearch() {
  const overlay = document.querySelector('.search-overlay') || createOverlay();
  const input = overlay.querySelector('.search-input');
  const list = overlay.querySelector('.search-results');
  let items = PAGES.slice(0);
  let selected = 0;

  function render(q = '') {
    const ranked = PAGES
      .map(it => ({ it, sc: score(q, it) }))
      .filter(x => x.sc > 0 || !q)
      .sort((a,b) => b.sc - a.sc)
      .slice(0, 12)
      .map(x => x.it);
    items = ranked;
    if (selected >= items.length) selected = items.length - 1;
    if (selected < 0) selected = 0;
    list.innerHTML = items.map((it, i) => `<a href="${it.url}" role="option" aria-selected="${i===selected}">${it.title}</a>`).join('');
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  render('');
  setTimeout(() => input.focus(), 0);

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); selected = Math.min(selected + 1, Math.max(items.length - 1, 0)); render(input.value); return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); selected = Math.max(selected - 1, 0); render(input.value); return;
    }
    if (e.key === 'Enter') {
      const it = items[selected];
      if (it) { window.location.href = it.url; }
    }
  }
  function onClick(e) {
    if (e.target === overlay) close();
  }
  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    overlay.removeEventListener('click', onClick);
  }

  input.addEventListener('input', () => { selected = 0; render(input.value); });
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', onClick);
}

// Bind triggers: icon click, Ctrl/Cmd+K, '/'
function bindTriggers() {
  const btn = document.getElementById('navSearch');
  if (btn) btn.addEventListener('click', openSearch);
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if ((mod && e.key.toLowerCase() === 'k') || (e.key === '/' && e.target === document.body)) {
      e.preventDefault();
      openSearch();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindTriggers);
} else {
  bindTriggers();
}
