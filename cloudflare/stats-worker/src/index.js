export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Handle non-API requests: pretty URLs and pass-through to origin
      const path = url.pathname || '/';
      if (!path.startsWith('/api/')) {
        // Handle common trailing-slash pages like /forum/ -> /forum
        if ((request.method === 'GET' || request.method === 'HEAD') && path.endsWith('/') && path !== '/') {
          const noSlash = path.replace(/\/+$/,'');
          if (noSlash) {
            const tryFile = new URL(url.toString());
            tryFile.pathname = noSlash + '.html';
            try {
              const res = await fetch(new Request(tryFile.toString(), request));
              if (res.ok) { url.pathname = noSlash; return Response.redirect(url.toString(), 301); }
            } catch {}
          }
        }
        const isWelcome = /^\/forum\/welcome(?:\.html)?$/i.test(path);
        if (request.method === 'GET' || request.method === 'HEAD') {
          // /index.html -> /
          if (/\/index\.html$/i.test(path)) {
            url.pathname = path.replace(/\/index\.html$/i, '/');
            return Response.redirect(url.toString(), 301);
          }
          // *.html -> *
          if (/\.html$/i.test(path)) {
            url.pathname = path.replace(/\.html$/i, '');
            return Response.redirect(url.toString(), 301);
          }
        }

        // Resolve target (try *.html for extensionless paths)
        let resp;
        let attemptedHtml = false;
        const hasExt = /\.[a-z0-9]+$/i.test(path);
        if ((request.method === 'GET' || request.method === 'HEAD') && !hasExt && !path.endsWith('/')) {
          attemptedHtml = true;
          const tryHtml = new URL(url.toString());
          tryHtml.pathname = path + '.html';
          const r = await fetch(new Request(tryHtml.toString(), request));
          if (r.ok) resp = r;
        }
        if (!resp) resp = await fetch(request);

        // Inject the Start-a-Topic form into the Welcome page if not deployed yet
        if (request.method === 'GET' && isWelcome) {
          try {
            const ctype = resp.headers.get('Content-Type') || '';
            if (/text\/html/i.test(ctype)) {
              const html = await resp.text();
              const hasForm = /<form[^>]*id=["']newForm["'][^>]*>/i.test(html);
              let out = html;
              if (!hasForm) {
                const formHtml = `\n<section class="section" style="max-width: 860px;">\n  <h2>Begin Your Topic</h2>\n  <p class=\"muted\">Start typing below. Your post may be limited or reviewed before appearing in feeds.</p>\n  <form id=\"newForm\" class=\"form\" novalidate>\n    <label>Title\n      <input id=\"title\" type=\"text\" maxlength=\"180\" required placeholder=\"Clear and descriptive title\" />\n    </label>\n    <label>Category (optional)\n      <input id=\"category\" type=\"text\" maxlength=\"64\" placeholder=\"e.g., philosophy, practice\" />\n    </label>\n    <label>Tags (optional)\n      <input id=\"tags\" type=\"text\" maxlength=\"200\" placeholder=\"Comma-separated tags\" />\n    </label>\n    <label>Body\n      <textarea id=\"body\" rows=\"10\" required placeholder=\"Write your post... (be specific, respectful, and constructive)\"></textarea>\n    </label>\n    <div style=\"display:flex; gap:8px; align-items:center;\">\n      <button id=\"submitBtn\" type=\"submit\" class=\"ghost\">Submit</button>\n      <span id=\"status\" class=\"muted\" aria-live=\"polite\"></span>\n    </div>\n    <div id=\"result\" class=\"callout\" style=\"margin-top:10px; display:none;\"></div>\n  </form>\n</section>\n`;
                if (/<\/main>/i.test(out)) {
                  out = out.replace(/<\/main>/i, formHtml + '</main>');
                } else if (/<\/body>/i.test(out)) {
                  out = out.replace(/<\/body>/i, formHtml + '</body>');
                } else {
                  out += formHtml;
                }
                if (!/site\/forum-new\.js/i.test(out)) {
                  out = out.replace(/<\/body>/i, '<script type="module" src="/site/forum-new.js"></script>\n</body>');
                }
              }
              return new Response(out, { status: resp.status, headers: resp.headers });
            }
          } catch (_) {}
        }

        return resp;
      }
      // CORS: echo Origin for credentialed requests, wildcard otherwise
      const reqOrigin = request.headers.get('Origin') || '';
      const allowOrigin = reqOrigin || '*';
      const baseHeaders = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        // allow common headers; browsers ignore if not used
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
        'Content-Type': 'application/json; charset=utf-8',
        // Dynamic API responses should never be cached
        'Cache-Control': 'no-store, max-age=0',
      };
      if (reqOrigin) {
        // Only send this when an Origin is present (credentialed requests)
        baseHeaders['Access-Control-Allow-Credentials'] = 'true';
      }
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: baseHeaders });
      }

      const notFound = (msg = 'Not found') => new Response(JSON.stringify({ error: msg }), { status: 404, headers: baseHeaders });
      const bad = (msg = 'Bad request') => new Response(JSON.stringify({ error: msg }), { status: 400, headers: baseHeaders });

      const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      // Expecting: api/<service>/<action>/...
      if (parts.length < 2 || parts[0] !== 'api') {
        return notFound();
      }
      const service = parts[1] || '';
      const action = parts[2] || '';

      if (service === 'stats' && action === 'health') {
        return new Response(JSON.stringify({ ok: true }), { headers: baseHeaders });
      }

      function normalizeNs(ns) { const v = String(ns || '').toLowerCase(); return v.replace(/^www\./, ''); }
      function keyOf(ns, key) { return `${ns}:${key}`; }

      async function getValue(ns, key, def = 0) {
        const raw = await env.STATS.get(keyOf(ns, key));
        if (raw == null) return def;
        const n = Number(raw);
        return Number.isFinite(n) ? n : def;
      }

      async function setValue(ns, key, val) {
        const v = Number(val) || 0;
        await env.STATS.put(keyOf(ns, key), String(v));
        return v;
      }

      function parseCookies(req) {
        const str = req.headers.get('Cookie') || '';
        const out = {};
        str.split(';').forEach(part => {
          const [k, ...v] = part.trim().split('=');
          if (!k) return;
          out[decodeURIComponent(k)] = decodeURIComponent(v.join('=') || '');
        });
        return out;
      }

      function cookieHeader(name, value, { https, partitioned } = {}) {
        const maxAge = 60 * 60 * 24 * 365; // ~1 year
        // Use SameSite=None to allow cross-site dev (localhost -> domain) and ensure Secure for HTTPS
        let str = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=None`;
        if (https) str += '; Secure';
        if (partitioned) str += '; Partitioned';
        return str;
      }

      // --- Recovery code helpers ---
      const enc = new TextEncoder();
      async function hmacHex(secret, message) {
        const key = await crypto.subtle.importKey(
          'raw',
          enc.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
        const b = new Uint8Array(sig);
        let hex = '';
        for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, '0');
        return hex;
      }
      function randomRecoveryCode() {
        // Crockford Base32 chars without ambiguous: 23456789ABCDEFGHJKMNPQRSTVWXYZ
        const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
          out += alphabet[bytes[i] % alphabet.length];
          if (i === 3 || i === 7 || i === 11) out += '-';
        }
        return out;
      }

      // === Forum service: create post, feed, and fetch post ===
      if (service === 'forum') {
        async function readJson(req) { try { return await req.json(); } catch { return null; } }
        const clean = (s, n = 20000) => (s == null ? '' : String(s)).trim().slice(0, n);
        const ensureArr = (v) => Array.isArray(v) ? v : (v ? [String(v)] : []);
        const nsOf = () => normalizeNs(url.hostname || '');
        const newId = () => (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
        const excerpt = (text, n = 200) => {
          const t = String(text || '').replace(/\s+/g, ' ').trim();
          return t.length > n ? (t.slice(0, n - 1) + '…') : t;
        };

        // Lightweight scoring using the same rules as moderation
        function localScore(text, tags, media, trust_tier, velocity) {
          const P0_RULES = [
            { id: 'p0_minors_sexual', re: /(minor|underage|child)\W+.*(sex|porn|nude|explicit)/i },
            { id: 'p0_nc_ii', re: /(non[-\s]?consensual|without\s+consent).*(nude|intimate|sexual)/i },
            { id: 'p0_threats', re: /(i\s+will|we\s+will)\s+(kill|murder|shoot|bomb)\b/i },
            { id: 'p0_terror', re: /(join|support)\s+(isis|al[-\s]?qaeda|taliban)\b/i },
            { id: 'p0_illegal_goods', re: /(sell|buy|trade)\s+(stolen\s+cards|drugs|counterfeit|fake\s+passports)/i },
            { id: 'p0_malware_hacking', re: /(ddos|botnet|ransomware|keylogger)\b|sql\s+injection\b|xss\b/i },
            { id: 'p0_copyright_scale', re: /(full\s+movie\s+download|1000\s+songs|mega\s+pack|complete\s+series\s+torrent)/i },
            { id: 'p0_doxxing', re: /(social\s+security\s+number|ssn\s*\d{3}-\d{2}-\d{4}|credit\s*card\s*\d{4}-\d{4}-\d{4}-\d{4})/i }
          ];
          const P1_HINTS = [
            { id: 'p1_adult', re: /(nsfw|porn|explicit|sexual)\b/i },
            { id: 'p1_violence', re: /(gore|graphic\s+violence|blood|beheading)\b/i },
            { id: 'p1_hate_harass', re: /(hate\s+speech|harass|slur)\b/i },
            { id: 'p1_med_fin_claims', re: /(cure\s+for\b|guaranteed\s+returns|financial\s+advice)\b/i },
            { id: 'p1_safety_borderline', re: /(self\s*h[au]rm|pro\s*ana|suicide\s+methods)/i }
          ];
          const rule_hits = { P0: [], P1: [] };
          for (const r of P0_RULES) { if (r.re.test(text)) rule_hits.P0.push(r.id); }
          for (const r of P1_HINTS) { if (r.re.test(text)) rule_hits.P1.push(r.id); }
          if (tags.includes('adult-sexual-content')) rule_hits.P1.push('p1_adult_tag');
          if (tags.includes('graphic-violence')) rule_hits.P1.push('p1_violence_tag');
          if (tags.includes('medical-or-financial-claims')) rule_hits.P1.push('p1_med_fin_tag');
          if (tags.includes('hateful-or-harassing')) rule_hits.P1.push('p1_harass_tag');
          const media_flags = [];
          const linkRisk = 'low';
          const tier = (trust_tier === 'T1' || trust_tier === 'T2') ? trust_tier : 'T0';
          if (rule_hits.P0.length) {
            return { risk: 95, routing: { state: 'blocked', reasons: ['p0_rule'] }, rule_hits, media_flags, policy_labels: ['P0'] };
          }
          let s = Math.min(30, rule_hits.P1.length * 12);
          s += media_flags.includes('nsfw') ? 10 : 0;
          s += tier === 'T0' ? 8 : (tier === 'T1' ? 3 : 0);
          const vel = (velocity && velocity.posts_last_hour) || 0;
          if (vel > 5) s += 10; if (vel > 10) s += 20;
          s = Math.max(0, Math.min(100, s));
          const publish_lt = 20, limited_lt = 50;
          let routing;
          if (tier === 'T0') {
            routing = s < publish_lt ? { state: 'limited', reasons: ['t0_default_limited'] }
              : (s < limited_lt ? { state: 'limited', reasons: ['needs_review'] } : { state: 'quarantine', reasons: ['high_risk'] });
          } else {
            routing = s < publish_lt ? { state: 'publish', reasons: [] }
              : (s < limited_lt ? { state: 'limited', reasons: ['needs_review'] } : { state: 'quarantine', reasons: ['high_risk'] });
          }
          const policy_labels = rule_hits.P1.length ? ['P1'] : ['P2'];
          return { risk: s, routing, rule_hits, media_flags, policy_labels };
        }

        if (action === 'create') {
          if (request.method !== 'POST') return bad('POST required');
          const body = await readJson(request);
          if (!body) return bad('Invalid JSON');
          const title = clean(body.title, 180);
          const content = clean(body.body, 20000);
          const category = clean(body.category, 64);
          const tags = ensureArr(body.tags).map(t => clean(t, 32)).slice(0, 10);
          if (!title || !content) return bad('Title and body are required');
          const ns = nsOf();
          const author_id = clean(body.user_id || '', 100) || 'anon';
          const trust_tier = (body.user_context && body.user_context.trust_tier) || 'T0';
          const velocity = (body.user_context && body.user_context.velocity) || {};
          const score = localScore(`${title}\n${content}`, tags, [], trust_tier, velocity);
          const id = body.item_id || newId();
          const author_secret = newId().replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const now = Date.now();
          const post = {
            id,
            ns,
            title,
            body: content,
            category,
            tags,
            author_id,
            created_at: now,
            updated_at: now,
            visibility_state: score.routing.state,
            risk_score: score.risk,
            policy_labels: score.policy_labels,
            rule_hits: score.rule_hits,
            routing: score.routing,
            author_secret
          };
          await env.STATS.put(`forum:post:${id}`, JSON.stringify(post));
          // Enqueue if not publish (also handled by moderation/score endpoint, but we duplicate for forum directly)
          if (post.visibility_state !== 'publish') {
            let ttlDays = 14; try { const v = parseInt((env.MOD_QUEUE_TTL_DAYS || '').toString(), 10); if (Number.isFinite(v) && v > 0) ttlDays = v; } catch {}
            const ttl = Math.max(1, Math.floor(ttlDays * 24 * 60 * 60));
            const rec = {
              item_id: id,
              user_id: author_id,
              risk_score: post.risk_score,
              policy_labels: post.policy_labels,
              rule_hits: post.rule_hits,
              media_flags: [],
              link_risk: 'low',
              routing: post.routing,
              created_at: now,
              text_preview: excerpt(content, 400)
            };
            await env.STATS.put(`modq:${id}`, JSON.stringify(rec), { expirationTtl: ttl });
          }
          const client = {
            id,
            visibility_state: post.visibility_state,
            routing: post.routing,
            risk_score: post.risk_score,
            policy_labels: post.policy_labels,
            rule_hits: post.rule_hits,
            author_secret,
            view_url: `/forum/post?id=${encodeURIComponent(id)}`
          };
          return new Response(JSON.stringify(client), { headers: baseHeaders });
        }

        if (action === 'feed') {
          const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));
          const ns = nsOf();
          const list = await env.STATS.list({ prefix: 'forum:post:' });
          const items = [];
          for (const k of list.keys) {
            const raw = await env.STATS.get(k.name);
            if (!raw) continue;
            try {
              const p = JSON.parse(raw);
              if (p.ns !== ns) continue;
              if (p.visibility_state !== 'publish') continue;
              items.push({ id: p.id, title: p.title, category: p.category || '', tags: p.tags || [], created_at: p.created_at, excerpt: excerpt(p.body, 240), url: `/forum/post?id=${encodeURIComponent(p.id)}` });
            } catch {}
          }
          items.sort((a,b) => (b.created_at||0) - (a.created_at||0));
          return new Response(JSON.stringify({ posts: items.slice(0, limit) }), { headers: baseHeaders });
        }

        if (action === 'post') {
          const id = url.searchParams.get('id') || '';
          const secret = url.searchParams.get('secret') || '';
          if (!id) return bad('Missing id');
          const raw = await env.STATS.get(`forum:post:${id}`);
          if (!raw) return notFound('Post not found');
          const p = JSON.parse(raw);
          const ns = nsOf();
          if (p.ns !== ns) return notFound('Post not found');
          const state = p.visibility_state || 'publish';
          const isAuthor = secret && secret === p.author_secret;
          if (state !== 'publish' && !isAuthor) return notFound('Post not available');
          const out = { id: p.id, title: p.title, body: p.body, category: p.category || '', tags: p.tags || [], created_at: p.created_at, visibility_state: p.visibility_state };
          return new Response(JSON.stringify(out), { headers: baseHeaders });
        }

        if (action === 'reply') {
          if (request.method !== 'POST') return bad('POST required');
          const body = await readJson(request);
          if (!body) return bad('Invalid JSON');
          const post_id = clean(body.post_id, 64);
          const content = clean(body.body, 10000);
          if (!post_id || !content) return bad('post_id and body are required');
          const postRaw = await env.STATS.get(`forum:post:${post_id}`);
          if (!postRaw) return notFound('Post not found');
          const post = JSON.parse(postRaw);
          const ns = nsOf(); if (post.ns !== ns) return notFound('Post not found');
          const author_id = clean(body.user_id || '', 100) || 'anon';
          const trust_tier = (body.user_context && body.user_context.trust_tier) || 'T0';
          const velocity = (body.user_context && body.user_context.velocity) || {};
          const score = localScore(content, [], [], trust_tier, velocity);
          const id = (body.item_id || newId());
          const author_secret = newId().replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const now = Date.now();
          const reply = { id, post_id, ns, body: content, author_id, created_at: now, updated_at: now, visibility_state: score.routing.state, risk_score: score.risk, policy_labels: score.policy_labels, rule_hits: score.rule_hits, routing: score.routing, author_secret };
          await env.STATS.put(`forum:reply:${post_id}:${id}`, JSON.stringify(reply));
          await env.STATS.put(`forum:replyid:${id}`, post_id);
          if (reply.visibility_state !== 'publish') {
            let ttlDays = 14; try { const v = parseInt((env.MOD_QUEUE_TTL_DAYS || '').toString(), 10); if (Number.isFinite(v) && v > 0) ttlDays = v; } catch {}
            const ttl = Math.max(1, Math.floor(ttlDays * 24 * 60 * 60));
            const rec = { item_id: id, post_id, user_id: author_id, risk_score: reply.risk_score, policy_labels: reply.policy_labels, rule_hits: reply.rule_hits, media_flags: [], link_risk: 'low', routing: reply.routing, created_at: now, text_preview: excerpt(content, 240) };
            await env.STATS.put(`modq:${id}`, JSON.stringify(rec), { expirationTtl: ttl });
          }
          const resp = { id, post_id, visibility_state: reply.visibility_state, routing: reply.routing, author_secret, created_at: now };
          return new Response(JSON.stringify(resp), { headers: baseHeaders });
        }

        if (action === 'replies') {
          const post_id = clean(url.searchParams.get('post_id') || '', 64);
          if (!post_id) return bad('Missing post_id');
          const secret = clean(url.searchParams.get('secret') || '', 64);
          const ns = nsOf();
          const list = await env.STATS.list({ prefix: `forum:reply:${post_id}:` });
          const items = [];
          for (const k of list.keys) {
            const raw = await env.STATS.get(k.name);
            if (!raw) continue;
            try {
              const r = JSON.parse(raw);
              if (r.ns !== ns) continue;
              const isOwn = secret && secret === r.author_secret;
              if (r.visibility_state !== 'publish' && !isOwn) continue;
              items.push({ id: r.id, body: r.body, created_at: r.created_at, visibility_state: r.visibility_state, mine: !!isOwn });
            } catch {}
          }
          items.sort((a,b) => (a.created_at||0) - (b.created_at||0));
          return new Response(JSON.stringify({ replies: items }), { headers: baseHeaders });
        }

        return notFound();
      }

      if (service === 'stats' && (action === 'get' || action === 'hit')) {
        const nsRaw = decodeURIComponent(parts[3] || 'default');
        const key = decodeURIComponent(parts[4] || 'default');
        const ns = normalizeNs(nsRaw);
        if (!ns || !key) return bad('Missing ns/key');
        if (action === 'hit') {
          const next = (await getValue(ns, key, 0)) + 1;
          const v = await setValue(ns, key, next);
          return new Response(JSON.stringify({ value: v }), { headers: baseHeaders });
        } else {
          const v = await getValue(ns, key, 0);
          return new Response(JSON.stringify({ value: v }), { headers: baseHeaders });
        }
      }

      // Idempotent join per device via durable cookie
      if (service === 'stats' && action === 'join') {
        const nsRaw = decodeURIComponent(parts[3] || 'default');
        const ns = normalizeNs(nsRaw);
        if (!ns) return bad('Missing namespace');

        const cookies = parseCookies(request);
        const cookieName = 'co_member';
        let memberId = cookies[cookieName] || '';
        let setCookie = '';
        if (!memberId) {
          memberId = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
          const host = url.hostname || '';
          const apex = host.replace(/^www\./, '');
          const isCrossSite = !!reqOrigin && !reqOrigin.includes(apex);
          setCookie = cookieHeader(cookieName, memberId, { https: url.protocol === 'https:', partitioned: isCrossSite });
          // Always broaden cookie to apex so it works on apex and www
          if (apex) {
            setCookie += `; Domain=${apex}`;
          }
        }

        const markerKey = `member:${memberId}`;
        const already = memberId ? await env.STATS.get(keyOf(ns, markerKey)) : null;
        let newJoin = false;
        if (!already) {
          await env.STATS.put(keyOf(ns, markerKey), '1');
          const next = (await getValue(ns, 'members', 0)) + 1;
          await setValue(ns, 'members', next);
          newJoin = true;
        }
        const value = await getValue(ns, 'members', 0);
        const body = JSON.stringify({ value, newJoin });
        if (setCookie) {
          const headers = new Headers({ ...baseHeaders, 'Set-Cookie': setCookie });
          return new Response(body, { headers });
        }
        return new Response(body, { headers: baseHeaders });
      }

      // Report device membership based on cookie
      if (service === 'stats' && action === 'me') {
        const nsRaw = decodeURIComponent(parts[3] || 'default');
        const ns = normalizeNs(nsRaw);
        if (!ns) return bad('Missing namespace');
        const cookies = parseCookies(request);
        const memberId = cookies['co_member'] || '';
        let joined = false;
        if (memberId) {
          const markerKey = `member:${memberId}`;
          joined = !!(await env.STATS.get(keyOf(ns, markerKey)));
        }
        const value = await getValue(ns, 'members', 0);
        return new Response(JSON.stringify({ joined, value }), { headers: baseHeaders });
      }

      // Recovery API: create and restore codes without storing emails
      if (service === 'stats' && action === 'recovery') {
        const sub = parts[3] || '';
        const nsRaw = decodeURIComponent(parts[4] || 'default');
        const ns = normalizeNs(nsRaw);
        if (!ns) return bad('Missing namespace');

        // Identify current device membership
        const cookies = parseCookies(request);
        const cookieName = 'co_member';
        const memberId = cookies[cookieName] || '';
        const host = url.hostname || '';
        const apex = host.replace(/^www\./, '');
        const https = url.protocol === 'https:';

        if (sub === 'new') {
          if (!memberId) return bad('Not joined on this device');
          const markerKey = `member:${memberId}`;
          const isMember = !!(await env.STATS.get(keyOf(ns, markerKey)));
          if (!isMember) return bad('Not joined on this device');
          const secret = env.RECOVERY_SECRET || '';
          if (!secret) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: baseHeaders });
          const code = randomRecoveryCode();
          const codeNorm = code.replace(/-/g, '').toUpperCase();
          const digest = await hmacHex(secret, `${ns}|${codeNorm}`);
          const mapKey = keyOf(ns, `recovery:${digest}`);
          const ttl = 60 * 60 * 24 * 400; // ~400 days
          await env.STATS.put(mapKey, memberId, { expirationTtl: ttl });
          return new Response(JSON.stringify({ code }), { headers: baseHeaders });
        }

        if (sub === 'restore') {
          const secret = env.RECOVERY_SECRET || '';
          if (!secret) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: baseHeaders });
          const code = (url.searchParams.get('code') || '').trim();
          if (!code) return bad('Missing code');
          const codeNorm = code.replace(/[^0-9A-Z]/gi, '').toUpperCase();
          if (codeNorm.length < 12) return bad('Invalid code');
          const digest = await hmacHex(secret, `${ns}|${codeNorm}`);
          const mapKey = keyOf(ns, `recovery:${digest}`);
          const mapped = await env.STATS.get(mapKey);
          if (!mapped) return bad('Code not found');
          // Set cookie to mapped memberId without changing the count
          const isCrossSite = !!reqOrigin && !reqOrigin.includes(apex);
          let setCookie = cookieHeader(cookieName, mapped, { https, partitioned: isCrossSite });
          // Always broaden cookie to apex for cross-subdomain membership
          if (apex) setCookie += `; Domain=${apex}`;
          const value = await getValue(ns, 'members', 0);
          const body = JSON.stringify({ joined: true, value });
          const headers = new Headers({ ...baseHeaders, 'Set-Cookie': setCookie });
          return new Response(body, { headers });
        }

        return bad('Unknown recovery action');
      }

      if (service === 'stats' && action === 'create') {
        const ns = normalizeNs(url.searchParams.get('namespace') || 'default');
        const key = url.searchParams.get('key') || 'default';
        const value = Number(url.searchParams.get('value') || 0);
        const existing = await env.STATS.get(keyOf(ns, key));
        if (existing == null) await env.STATS.put(keyOf(ns, key), String(value));
        const v = await getValue(ns, key, 0);
        return new Response(JSON.stringify({ value: v }), { headers: baseHeaders });
      }

      if (service === 'stats' && action === 'update') {
        const ns = normalizeNs(url.searchParams.get('namespace') || 'default');
        const key = url.searchParams.get('key') || 'default';
        const amount = Number(url.searchParams.get('amount') || 0);
        const next = (await getValue(ns, key, 0)) + amount;
        const v = await setValue(ns, key, next);
        return new Response(JSON.stringify({ value: v }), { headers: baseHeaders });
      }

      // Moderation service: scoring + simple queue using KV
      if (service === 'moderation') {
        const authBearer = () => {
          const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
          const expected = (env.MOD_TOKEN || '').trim();
          if (expected && token !== expected) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: baseHeaders });
          }
          return null;
        };

        const P0_RULES = [
          { id: 'p0_minors_sexual', re: /(minor|underage|child)\W+.*(sex|porn|nude|explicit)/i },
          { id: 'p0_nc_ii', re: /(non[-\s]?consensual|without\s+consent).*(nude|intimate|sexual)/i },
          { id: 'p0_threats', re: /(i\s+will|we\s+will)\s+(kill|murder|shoot|bomb)\b/i },
          { id: 'p0_terror', re: /(join|support)\s+(isis|al[-\s]?qaeda|taliban)\b/i },
          { id: 'p0_illegal_goods', re: /(sell|buy|trade)\s+(stolen\s+cards|drugs|counterfeit|fake\s+passports)/i },
          { id: 'p0_malware_hacking', re: /(ddos|botnet|ransomware|keylogger)\b|sql\s+injection\b|xss\b/i },
          { id: 'p0_copyright_scale', re: /(full\s+movie\s+download|1000\s+songs|mega\s+pack|complete\s+series\s+torrent)/i },
          { id: 'p0_doxxing', re: /(social\s+security\s+number|ssn\s*\d{3}-\d{2}-\d{4}|credit\s*card\s*\d{4}-\d{4}-\d{4}-\d{4})/i }
        ];
        const P1_HINTS = [
          { id: 'p1_adult', re: /(nsfw|porn|explicit|sexual)\b/i },
          { id: 'p1_violence', re: /(gore|graphic\s+violence|blood|beheading)\b/i },
          { id: 'p1_hate_harass', re: /(hate\s+speech|harass|slur)\b/i },
          { id: 'p1_med_fin_claims', re: /(cure\s+for\b|guaranteed\s+returns|financial\s+advice)\b/i },
          { id: 'p1_safety_borderline', re: /(self\s*h[au]rm|pro\s*ana|suicide\s+methods)/i }
        ];
        const THRESH = { publish_lt: 20, limited_lt: 50 };

        async function readJson(req) { try { return await req.json(); } catch { return null; } }
        const ensureArr = (v) => Array.isArray(v) ? v : [];
        const clean = (s) => (s || '').toString().slice(0, 50000);
        const tierOf = (t) => (t === 'T1' || t === 'T2') ? t : 'T0';
        const linkRisk = (links) => {
          const riskyHosts = ['mega.nz','anonfiles.com','pastebin.com','privfile.com'];
          const shorteners = ['bit.ly','tinyurl.com','t.co','goo.gl','is.gd','buff.ly'];
          let risk = 'low';
          for (const u of links) {
            try {
              const h = new URL(u).hostname.toLowerCase();
              if (shorteners.includes(h) || riskyHosts.includes(h)) return 'high';
              if (h.endsWith('.ru') || h.endsWith('.su') || h.endsWith('.xyz')) risk = 'medium';
            } catch {}
          }
          return risk;
        };
        function detect(text, tags, media) {
          const rule_hits = { P0: [], P1: [] };
          for (const r of P0_RULES) { if (r.re.test(text)) rule_hits.P0.push(r.id); }
          for (const r of P1_HINTS) { if (r.re.test(text)) rule_hits.P1.push(r.id); }
          if (tags.includes('adult-sexual-content')) rule_hits.P1.push('p1_adult_tag');
          if (tags.includes('graphic-violence')) rule_hits.P1.push('p1_violence_tag');
          if (tags.includes('medical-or-financial-claims')) rule_hits.P1.push('p1_med_fin_tag');
          if (tags.includes('hateful-or-harassing')) rule_hits.P1.push('p1_harass_tag');
          const media_flags = [];
          for (const m of media) {
            const mime = (m.mime || '').toLowerCase();
            if ((mime.startsWith('image/') || mime.startsWith('video/')) && /nsfw|explicit/i.test(m.alt_text || '')) media_flags.push('nsfw');
          }
          return { rule_hits, media_flags };
        }
        function aggregate({ rule_hits, media_flags, links, tier, velocity }) {
          if (rule_hits.P0.length) return 95;
          let s = 0;
          s += Math.min(30, rule_hits.P1.length * 12);
          s += media_flags.includes('nsfw') ? 10 : 0;
          const lr = linkRisk(links); s += lr === 'high' ? 25 : lr === 'medium' ? 10 : 0;
          s += tier === 'T0' ? 8 : tier === 'T1' ? 3 : 0;
          const vel = (velocity && (velocity.posts_last_hour || 0)) || 0;
          if (vel > 5) s += 10; if (vel > 10) s += 20;
          return Math.max(0, Math.min(100, s));
        }
        function route({ risk, rule_hits, media_flags, tier }) {
          if (rule_hits.P0.length) return { state: 'blocked', reasons: ['p0_rule'] };
          if (media_flags.includes('hash_match')) return { state: 'quarantine', reasons: ['media_hash'] };
          if (tier === 'T0') {
            if (risk < THRESH.publish_lt) return { state: 'limited', reasons: ['t0_default_limited'] };
            if (risk < THRESH.limited_lt) return { state: 'limited', reasons: ['needs_review'] };
            return { state: 'quarantine', reasons: ['high_risk'] };
          }
          if (risk < THRESH.publish_lt) return { state: 'publish', reasons: [] };
          if (risk < THRESH.limited_lt) return { state: 'limited', reasons: ['needs_review'] };
          return { state: 'quarantine', reasons: ['high_risk'] };
        }

        if (action === 'score') {
          if (request.method !== 'POST') return bad('POST required');
          const body = await readJson(request);
          if (!body) return bad('Invalid JSON');
          const text = clean(body.text || '');
          const links = ensureArr(body.links);
          const media = ensureArr(body.media);
          const tags = ensureArr(body.tags);
          const tier = tierOf(body.user_context && body.user_context.trust_tier);
          const velocity = (body.user_context && body.user_context.velocity) || {};
          const { rule_hits, media_flags } = detect(text, tags, media);
          const risk = aggregate({ rule_hits, media_flags, links, tier, velocity });
          const routing = route({ risk, rule_hits, media_flags, tier });
          const policy_labels = rule_hits.P0.length ? ['P0'] : (rule_hits.P1.length ? ['P1'] : ['P2']);

          // Enqueue when not publish
          if (routing.state !== 'publish') {
            const item_id = body.item_id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
            const rec = {
              item_id,
              user_id: body.user_id || '',
              risk_score: risk,
              policy_labels,
              rule_hits,
              media_flags,
              link_risk: linkRisk(links),
              routing,
              created_at: Date.now(),
              text_preview: text.slice(0, 400)
            };
            // TTL for queue items (default 14 days unless overridden by env)
            let ttlDays = 14;
            try { const v = parseInt((env.MOD_QUEUE_TTL_DAYS || '').toString(), 10); if (Number.isFinite(v) && v > 0) ttlDays = v; } catch {}
            const ttl = Math.max(1, Math.floor(ttlDays * 24 * 60 * 60));
            await env.STATS.put(`modq:${item_id}`, JSON.stringify(rec), { expirationTtl: ttl });
          }

          const resp = {
            item_id: body.item_id || '',
            risk_score: risk,
            policy_labels,
            label_scores: {},
            rule_hits,
            link_risk: linkRisk(links),
            media_flags,
            routing
          };
          return new Response(JSON.stringify(resp), { headers: baseHeaders });
        }

        if (action === 'queue') {
          const authErr = authBearer(); if (authErr) return authErr;
          const list = await env.STATS.list({ prefix: 'modq:' });
          const items = [];
          for (const k of list.keys) {
            const v = await env.STATS.get(k.name);
            if (v) items.push(JSON.parse(v));
          }
          items.sort((a,b) => b.risk_score - a.risk_score);
          return new Response(JSON.stringify({ items }), { headers: baseHeaders });
        }

        if (action === 'decision') {
          if (request.method !== 'POST') return bad('POST required');
          const authErr = authBearer(); if (authErr) return authErr;
          const body = await readJson(request) || {};
          const item_id = body.item_id || '';
          const macro_id = body.macro_id || '';
          if (!item_id || !macro_id) return bad('Missing item_id/macro_id');
          const qKey = `modq:${item_id}`;
          const raw = await env.STATS.get(qKey);
          if (!raw) return notFound('Item not in queue');
          const rec = JSON.parse(raw);
          const MACROS = {
            remove: { result_state: 'unpublished' },
            edit_request: { result_state: 'limited' },
            age_gate_blur: { result_state: 'limited' },
            limit_distribution: { result_state: 'limited' },
            warning: { result_state: 'publish' },
            temp_suspend: { result_state: 'blocked' },
            perm_ban: { result_state: 'blocked' },
            kill_switch: { result_state: 'unpublished' }
          };
          const m = MACROS[macro_id];
          if (!m) return bad('Unknown macro');
          const decision = {
            item_id,
            macro_id,
            reviewer_id: body.reviewer_id || 'system',
            decision_ts: Date.now(),
            fields: body.fields || {},
            result_state: m.result_state,
            prior_routing: rec.routing
          };
          await env.STATS.put(`modlog:${item_id}:${decision.decision_ts}`, JSON.stringify(decision));
          // If a forum post exists with this id, update its visibility_state accordingly
          const postKey = `forum:post:${item_id}`;
          const postRaw = await env.STATS.get(postKey);
          if (postRaw) {
            try {
              const p = JSON.parse(postRaw);
              p.visibility_state = m.result_state;
              p.updated_at = Date.now();
              await env.STATS.put(postKey, JSON.stringify(p));
            } catch {}
          }
          // Or if it's a reply, look up its post id and update
          const replyPostId = await env.STATS.get(`forum:replyid:${item_id}`);
          if (replyPostId) {
            const rKey = `forum:reply:${replyPostId}:${item_id}`;
            const rRaw = await env.STATS.get(rKey);
            if (rRaw) {
              try {
                const r = JSON.parse(rRaw);
                r.visibility_state = m.result_state;
                r.updated_at = Date.now();
                await env.STATS.put(rKey, JSON.stringify(r));
              } catch {}
            }
          }
          await env.STATS.delete(qKey);
          return new Response(JSON.stringify({ ok: true, decision }), { headers: baseHeaders });
        }
      }

      return notFound();
    } catch (e) {
      // Fail safe CORS: echo Origin if available to avoid wildcard with credentials
      const errOrigin = request.headers.get('Origin') || '';
      const headers = new Headers({
        'Access-Control-Allow-Origin': errOrigin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      });
      if (errOrigin) headers.set('Access-Control-Allow-Credentials', 'true');
      return new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 500, headers });
    }
  }
};
