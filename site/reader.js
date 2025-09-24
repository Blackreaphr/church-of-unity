// Lightweight reader-mode toggle and in-page ToC
(function(){
  const LS_KEY = 'reader-mode-v2';
  function slugify(text){
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,80);
  }
  function ensureIds(root){
    const ids = new Set();
    for (const h of root.querySelectorAll('h2, h3')){
      if (!h.id){
        let id = slugify(h.textContent || 'section');
        let n = 2;
        while(ids.has(id) || document.getElementById(id)) { id = id + '-' + (n++); }
        h.id = id; ids.add(id);
      }
    }
  }
  function buildToc(root){
    const heads = [...root.querySelectorAll('h2, h3')];
    if (!heads.length) return null;
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label','On this page');
    nav.className = 'toc';
    const ul = document.createElement('ul');
    for (const h of heads){
      const li = document.createElement('li');
      li.className = h.tagName.toLowerCase();
      const a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = h.textContent || 'Section';
      li.appendChild(a); ul.appendChild(li);
    }
    nav.appendChild(ul); return nav;
  }
  function injectStyles(){
    if (document.getElementById('reader-css')) return;
    const css = `
      .reader-controls{display:flex;gap:8px;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);border:1px solid var(--border, #333843);padding:8px 10px;border-radius:10px;margin:12px 0}
      .reader-btn{border:1px solid var(--border, #333843);background:transparent;color:var(--text, #e8eaed);padding:6px 10px;border-radius:8px;cursor:pointer}
      .reader-btn:focus{outline:2px solid #5b9df9;outline-offset:2px}
      .toc{margin:12px 0 16px;padding:10px;border:1px solid var(--border, #333843);border-radius:10px;background:var(--card, #0f1116)}
      .toc ul{list-style:none;margin:0;padding:0;columns:2;column-gap:22px}
      .toc li{margin:6px 0}
      .toc li.h3{margin-left:10px;font-size:.95em;opacity:.9}
      body.reader-mode, html.reader-mode{background:var(--bg, #0b0c10) !important;color:var(--text, #e8eaed) !important}
      body.reader-mode .section, html.reader-mode .section{background:var(--card, #0f1116);border:1px solid var(--border, #24262c);border-radius:12px;padding:16px}
      body.reader-mode p, body.reader-mode li {font-size:18px; line-height:1.7}
      body.reader-mode h1{font-size:38px}
      body.reader-mode h2{font-size:26px;margin-top:18px}
      body.reader-mode h3{font-size:20px;margin-top:14px}
    `;
    const s = document.createElement('style'); s.id='reader-css'; s.textContent = css; document.head.appendChild(s);
  }
  function setMode(on){
    const root = document.documentElement; const body = document.body;
    [root, body].forEach((el) => el.classList.toggle('reader-mode', !!on));
    try { localStorage.setItem(LS_KEY, on ? '1':'0'); } catch {}
  }
  function getPreferred(){
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  }
  function defaultOnForPath(){
    // Do not enable by default; respect existing dark theme.
    return false;
  }
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const main = document.querySelector('main') || document.body;
    ensureIds(main);
    const controls = document.createElement('div');
    controls.className = 'reader-controls';
    const label = document.createElement('strong'); label.textContent = 'Reader options';
    const btn = document.createElement('button'); btn.className = 'reader-btn'; btn.type='button';
    const applyInitial = getPreferred() || defaultOnForPath();
    setMode(applyInitial);
    btn.textContent = applyInitial ? 'Reader mode: On' : 'Reader mode: Off';
    btn.addEventListener('click', () => { const on = !document.body.classList.contains('reader-mode'); setMode(on); btn.textContent = on ? 'Reader mode: On' : 'Reader mode: Off'; });
    const toc = buildToc(main);
    if (toc){ controls.appendChild(label); controls.appendChild(btn); main.prepend(toc); } else { controls.appendChild(label); controls.appendChild(btn); }
    main.prepend(controls);
  });
})();
