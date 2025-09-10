// Church of Unity - dynamic visuals and interactions

(() => {
  const $ = (s, p = document) => p.querySelector(s);

  // Footer year
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // === Navigation: active link + More dropdown behavior ===
  (function navEnhance(){
    const links = document.querySelectorAll('.site-nav a[href]');
    const here = new URL(location.href);
    links.forEach(a => {
      try {
        const url = new URL(a.getAttribute('href'), here.origin);
        const normalize = p => p.replace(/index\.html$/, '').replace(/\/$/, '');
        if (normalize(url.pathname) === normalize(here.pathname)) {
          a.setAttribute('aria-current', 'page');
        } else if (here.pathname === '/' && (url.pathname.endsWith('/index.html') || url.pathname === '/')) {
          a.setAttribute('aria-current', 'page');
        }
      } catch {}
    });
    // Close <details> when clicking outside
    document.addEventListener('click', (e) => {
      document.querySelectorAll('details.more[open]').forEach(d => {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });

    // Hover-to-open for desktop
    const more = document.querySelector('details.more');
    if (more && matchMedia('(hover:hover)').matches) {
      let hoverTimer = null;
      more.addEventListener('mouseenter', () => {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        more.setAttribute('open', '');
      });
      more.addEventListener('mouseleave', () => {
        hoverTimer = setTimeout(() => more.removeAttribute('open'), 120);
      });
      // open when focusing summary via keyboard
      const summary = more.querySelector('summary');
      summary?.addEventListener('focus', () => more.setAttribute('open', ''));
      more.addEventListener('focusout', (e) => {
        if (!more.contains(e.relatedTarget)) more.removeAttribute('open');
      });
    }
  })();

  // === Emblem: spiral generation + warp intensity ===
  const emblem = $('#emblem');
  const spiral = $('#spiral');
  const turb = $('#turb');
  const spiralWrap = $('#spiralWrap');

  function buildSpiral({ turns = 3.5, inner = 6, outer = 78, points = 800 } = {}) {
    const cx = 100, cy = 100;
    const maxTheta = Math.PI * 2 * turns;
    let d = '';
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const theta = t * maxTheta;
      const r = inner + (outer - inner) * t;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    return d.trim();
  }

  if (spiral) {
    spiral.setAttribute('d', buildSpiral());
    // subtle motion: rotate ordered grid; spin spiral counter to it
    let t = 0;
    const spin = () => {
      t += 0.0035;
      const rotOrdered = 2 * Math.sin(t * 0.5);
      const rotSpiral = -8 * Math.sin(t * 0.25);
      const ordered = $('#ordered');
      if (ordered) ordered.setAttribute('transform', `rotate(${rotOrdered} 100 100)`);
      if (spiralWrap) spiralWrap.setAttribute('transform', `rotate(${rotSpiral} 100 100)`);
      requestAnimationFrame(spin);
    };
    requestAnimationFrame(spin);
  }

  // Warp (chaos) modulation based on scroll/hover
  let chaos = 0.001; // baseFrequency
  let targetChaos = chaos;
  const setChaos = (v) => { targetChaos = Math.max(0.0005, Math.min(0.03, v)); };
  const lerp = (a, b, t) => a + (b - a) * t;
  function animateChaos() {
    chaos = lerp(chaos, targetChaos, 0.035);
    if (turb) turb.setAttribute('baseFrequency', chaos.toFixed(4));
    const disp = emblem?.querySelector('feDisplacementMap');
    if (disp) disp.setAttribute('scale', String(chaos * 850));
    requestAnimationFrame(animateChaos);
  }
  requestAnimationFrame(animateChaos);

  emblem?.addEventListener('mouseenter', () => setChaos(0.015));
  emblem?.addEventListener('mouseleave', () => setChaos(0.002));
  document.addEventListener('scroll', () => {
    const sc = Math.min(1, window.scrollY / 400);
    setChaos(0.002 + sc * 0.012);
  }, { passive: true });

  // === Background canvas: geometry morphing to fluid field ===
  const bg = /** @type {HTMLCanvasElement|null} */ ($('#bgCanvas'));
  if (bg) {
    const ctx = bg.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let w, h, t = 0;
    function resize() {
      w = bg.clientWidth; h = bg.clientHeight;
      bg.width = Math.floor(w * DPR); bg.height = Math.floor(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function noise(x, y, seed = 0.0) {
      // cheap pseudo-noise using layered trig; stable and fast enough
      return (
        Math.sin(0.7*x + 1.3*y + seed) +
        Math.sin(1.1*x - 0.9*y + seed*1.7) +
        Math.sin(1.7*x + 0.5*y + seed*2.3)
      ) / 3;
    }

    function draw() {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 0.8;
      const grid = 36; // base spacing
      const rows = Math.ceil(h / grid) + 2;
      const cols = Math.ceil(w / grid) + 2;
      ctx.lineWidth = 1;
      for (let y = -1; y < rows; y++) {
        for (let x = -1; x < cols; x++) {
          const px = x * grid;
          const py = y * grid;
          const nx = x / cols, ny = y / rows;
          const k = (noise(nx*6, ny*6, t) + 1) * 0.5; // 0..1
          const dx = (k - 0.5) * 14;
          const dy = (0.5 - k) * 14;
          // lines toward right/bottom to form evolving lattice
          ctx.strokeStyle = `rgba(255,255,255,${0.06 + k*0.08})`;
          ctx.beginPath();
          ctx.moveTo(px + dx, py + dy);
          ctx.lineTo(px + grid + dx, py + dy);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px + dx, py + dy);
          ctx.lineTo(px + dx, py + grid + dy);
          ctx.stroke();
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // === Reflection Space: interactive field ===
  const reflectSection = $('#reflection');
  const reflectCanvas = /** @type {HTMLCanvasElement|null} */ ($('#reflectCanvas'));
  const toggleReflection = $('#toggleReflection');
  const balance = /** @type {HTMLInputElement|null} */ ($('#balance'));
  const clearBtn = $('#clearReflect');

  if (toggleReflection && reflectSection) {
    toggleReflection.addEventListener('click', () => {
      const nowOpen = reflectSection.classList.toggle('hidden') === false;
      toggleReflection.textContent = nowOpen ? 'Close Reflection Space' : 'Open Reflection Space';
      if (nowOpen) {
        reflectSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // re-seed on open for a calm start
        if (window.__reseedReflection) window.__reseedReflection();
        reflectCanvas?.focus?.();
      }
    });
  }

  if (reflectCanvas) {
    const ctx = reflectCanvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    function size() {
      const r = reflectCanvas.getBoundingClientRect();
      reflectCanvas.width = Math.floor(r.width * DPR);
      reflectCanvas.height = Math.floor(r.height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    size();
    new ResizeObserver(size).observe(reflectCanvas);

    let particles = [];
    const maxP = 420;
    const center = () => ({ x: reflectCanvas.clientWidth/2, y: reflectCanvas.clientHeight/2 });
    const addBurst = (x, y, n = 60) => {
      for (let i=0; i<n && particles.length < maxP; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1.6 + Math.random() * 2.2;
        particles.push({
          x, y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          age: 0,
          life: 45 + Math.floor(Math.random() * 75),
        });
      }
    };
    let pointer = { x: 0, y: 0, down: false };
    const toLocal = (e) => {
      const rect = reflectCanvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const seedBurst = () => { const c = center(); addBurst(c.x, c.y, 120); };

    function resetField({ seed = false } = {}) {
      particles = [];
      // hard clear so the trail disappears immediately
      ctx.clearRect(0, 0, reflectCanvas.clientWidth, reflectCanvas.clientHeight);
      ctx.fillStyle = '#0a0b0f';
      ctx.fillRect(0, 0, reflectCanvas.clientWidth, reflectCanvas.clientHeight);
      if (seed) seedBurst();
    }

    seedBurst();

    // expose reseed for the toggle button
    window.__reseedReflection = () => resetField({ seed: true });

    reflectCanvas.addEventListener('pointerdown', (e) => { pointer = { ...toLocal(e), down: true }; addBurst(pointer.x, pointer.y, 100); });
    reflectCanvas.addEventListener('pointermove', (e) => { const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; if (pointer.down) addBurst(p.x, p.y, 12); });
    reflectCanvas.addEventListener('pointerup', () => pointer.down = false);
    reflectCanvas.addEventListener('pointerleave', () => pointer.down = false);

    clearBtn?.addEventListener('click', () => resetField({ seed: false }));

    let t = 0;
    function flow(x, y) {
      // balanced field varies with slider; combines order (radial) and chaos (curl)
      const k = (Number(balance?.value || 35)) / 100; // 0..1
      const c = center();
      const dx = x - c.x, dy = y - c.y;
      const r = Math.hypot(dx, dy) + 1e-4;
      // ordered radial pull
      const fx = -dx / r;
      const fy = -dy / r;
      // chaotic curl-like component
      const ang = Math.sin(0.7*dx*0.05 + t) + Math.cos(0.6*dy*0.05 - t*1.2);
      const cxv = Math.cos(ang), cyv = Math.sin(ang);
      return {
        x: (1-k)*fx*0.6 + k*cxv,
        y: (1-k)*fy*0.6 + k*cyv
      };
    }

    function tick() {
      t += 0.015;
      ctx.fillStyle = 'rgba(10,11,15,0.12)';
      ctx.fillRect(0,0,reflectCanvas.clientWidth, reflectCanvas.clientHeight);
      for (let i=0; i<particles.length; i++) {
        const p = particles[i];
        const f = flow(p.x, p.y);
        p.vx += f.x * 0.22; p.vy += f.y * 0.22;
        p.vx *= 0.965; p.vy *= 0.965;
        p.x += p.vx; p.y += p.vy;
        p.age++;
        if (p.age > p.life) { particles.splice(i,1); i--; continue; }
        ctx.beginPath();
        const alpha = Math.max(0, 1 - p.age/p.life);
        ctx.strokeStyle = `rgba(226,58,75,${0.22*alpha})`;
        ctx.fillStyle = `rgba(255,255,255,${0.016*alpha})`;
        ctx.arc(p.x, p.y, 1.1, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // === Stats: hover/focus count-up animation ===
  (function statsCountUp(){
    const stats = document.querySelectorAll('.site-stats .stat');
    if (!stats.length) return;

    const statsBlock = document.querySelector('.site-stats');
    const allowMotion = statsBlock?.dataset?.allowMotion === '1';
    const prefersReduced = !allowMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function animateCount(numEl, target, { duration = 900 } = {}) {
      let start = null;
      const startVal = 0;
      const endVal = Number(target) || 0;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      function step(ts) {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const eased = easeOutCubic(p);
        const val = Math.round(startVal + (endVal - startVal) * eased);
        numEl.textContent = String(val);
        if (p < 1) requestAnimationFrame(step);
      }
      if (prefersReduced) { numEl.textContent = String(endVal); return; }
      requestAnimationFrame(step);
    }

    stats.forEach(stat => {
      const numEl = stat.querySelector('.stat-number');
      if (!numEl) return;
      const target = stat.getAttribute('data-target') || numEl.textContent || '0';

      // Allow re-trigger on every interaction; cancel any in-flight animation
      const startAnim = () => {
        if (numEl.__countAnim && typeof numEl.__countAnim.cancel === 'function') {
          numEl.__countAnim.cancel();
        }
        const ctrl = { stopped: false, cancel() { this.stopped = true; } };
        numEl.__countAnim = ctrl;
        let start = null;
        const startVal = 0;
        const endVal = Number(target) || 0;
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const step = (ts) => {
          if (ctrl.stopped) return;
          if (!start) start = ts;
          const p = Math.min(1, (ts - start) / 1000);
          const eased = easeOutCubic(p);
          const val = Math.round(startVal + (endVal - startVal) * eased);
          numEl.textContent = String(val);
          if (p < 1) requestAnimationFrame(step);
        };
        if (prefersReduced) { numEl.textContent = String(endVal); return; }
        requestAnimationFrame(step);
      };

      stat.addEventListener('mouseenter', startAnim);
      stat.addEventListener('pointerenter', startAnim);
      stat.addEventListener('pointerdown', startAnim);
      stat.addEventListener('focus', startAnim);
      // ensure label reflects final value after leaving
      stat.addEventListener('mouseleave', () => { numEl.textContent = String(target); });
      stat.addEventListener('blur', () => { numEl.textContent = String(target); });
    });

    // Auto-trigger when the block scrolls into view (good for mobile)
    if (statsBlock && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            stats.forEach(st => st.dispatchEvent(new Event('pointerenter')));
            io.disconnect();
          }
        });
      }, { threshold: 0.35 });
      io.observe(statsBlock);
    }
  })();

  // === Audio: simple ambient soundscape ===
  const audioBtn = $('#toggleAudio');
  let audioCtx = null, mainGain, oscA, oscB, lfo, lfoGain;
  function createSoundscape() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.0; // fade in
    mainGain.connect(audioCtx.destination);

    // Two gentle detuned sines through a lowpass filter with slow LFO
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.4;
    filter.connect(mainGain);

    oscA = audioCtx.createOscillator();
    oscB = audioCtx.createOscillator();
    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.value = 84; // base tone
    oscB.frequency.value = 84 * 1.01; // slight detune
    oscA.connect(filter); oscB.connect(filter);

    lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06; // very slow
    lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 22; // mod amount (Hz)
    lfo.connect(lfoGain);
    lfoGain.connect(oscA.frequency);
    lfoGain.connect(oscB.frequency);

    oscA.start(); oscB.start(); lfo.start();

    // gentle fade in
    const now = audioCtx.currentTime;
    mainGain.gain.linearRampToValueAtTime(0.12, now + 1.8);

    return { stop: () => {
      const t = audioCtx.currentTime;
      mainGain.gain.linearRampToValueAtTime(0.0, t + 0.8);
      setTimeout(() => { oscA.stop(); oscB.stop(); lfo.stop(); audioCtx.close(); audioCtx = null; }, 900);
    } };
  }

  let soundController = null;
  audioBtn?.addEventListener('click', async () => {
    if (!audioCtx) {
      soundController = createSoundscape();
      audioBtn.textContent = 'Soundscape: On';
    } else {
      soundController?.stop();
      audioBtn.textContent = 'Soundscape: Off';
    }
  });
})();
