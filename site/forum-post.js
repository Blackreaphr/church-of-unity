function $(s){return document.querySelector(s)}

let POST_ID = '';
let VIEW_SECRET = '';

async function load(){
  const p = new URL(location.href).searchParams; const id = p.get('id')||''; const secret = p.get('secret')||'';
  POST_ID = id; VIEW_SECRET = secret;
  if(!id){ $('#topic').innerHTML='<p class="muted">Missing id.</p>'; return; }
  const url = new URL('/api/forum/post', location.origin); url.searchParams.set('id', id); if(secret) url.searchParams.set('secret', secret);
  try{
    const res = await fetch(url.toString(), { cache:'no-store' }); const data = await res.json();
    if(!res.ok) throw new Error(data && data.error || res.statusText);
    const d = data||{};
    $('#topic').innerHTML = `
      <header class="topic-head">
        <h1 class="site-title">${escapeHtml(d.title||'Topic')}</h1>
        ${d.category?`<span class="pill">${escapeHtml(d.category)}</span>`:''}
      </header>
      <div class="topic-body">${formatBody(d.body||'')}</div>
    `;
    const state = (d.visibility_state||'publish');
    if(state!=='publish') $('#notice').textContent='This topic is not public yet.';
    await loadReplies();
    setupReplyForm();
  }catch(e){
    $('#topic').innerHTML = `<p class="muted">Not found.</p>`;
  }
}

function escapeHtml(s){return String(s).replace(/[&<>]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]))}
function formatBody(s){
  // Very light formatting: paragraphs and line breaks
  const esc = escapeHtml(s).replace(/\r\n/g,'\n').replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br/>');
  return `<p>${esc}</p>`;
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', load); else load();

async function loadReplies(secret){
  const url = new URL('/api/forum/replies', location.origin); url.searchParams.set('post_id', POST_ID); if(secret) url.searchParams.set('secret', secret);
  try{
    const res = await fetch(url.toString(), { cache:'no-store' }); const json = await res.json();
    if(!res.ok) throw new Error(json && json.error || res.statusText);
    const list = Array.isArray(json.replies)? json.replies : [];
    renderReplies(list);
  }catch(e){ $('#replyList').innerHTML = '<div class="muted">Failed to load replies.</div>'; }
}

function renderReplies(items){
  const html = items.map(r => {
    const when = timeAgo(new Date(r.created_at||Date.now()).toISOString());
    const badge = r.mine && r.visibility_state !== 'publish' ? `<span class="pill">Pending</span>` : '';
    return `
    <article class="forum-item" role="listitem">
      <div class="meta-line"><span class="muted">${when}</span> ${badge}</div>
      <div class="topic-body">${formatBody(r.body||'')}</div>
    </article>`;
  }).join('');
  $('#replyList').innerHTML = html || '<div class="muted">Be the first to reply.</div>';
}

function setupReplyForm(){
  const form = $('#replyForm'); if(!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ($('#replyBody').value||'').trim(); if(!text){ $('#replyStatus').textContent='Write a reply first.'; return; }
    $('#replyBtn').disabled = true; $('#replyStatus').textContent='Posting…';
    try{
      let uid='anon'; try{ uid=(document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('co_member='))||'').split('=')[1]||'anon'; }catch{}
      const payload = { post_id: POST_ID, body: text, user_id: uid, user_context:{ trust_tier:'T0', prior_actions:['none'], report_score:0, velocity:{ posts_last_hour:0, links_last_day:0 } } };
      const res = await fetch('/api/forum/reply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const out = await res.json();
      if(!res.ok) throw new Error(out && out.error || res.statusText);
      const state = out.visibility_state || 'publish';
      if(state==='publish'){
        await loadReplies();
        $('#replyBody').value=''; $('#replyStatus').textContent='Posted.';
      }else{
        // Include just-posted reply in view for the author
        await loadReplies(out.author_secret);
        $('#replyBody').value='';
        $('#replyStatus').textContent = state==='limited' ? 'Reply posted with limited distribution pending review.' : 'Reply submitted for review.';
      }
    }catch(err){ $('#replyStatus').textContent='Error: '+(err && err.message ? err.message : String(err)); }
    finally { $('#replyBtn').disabled=false; }
  });
}

function timeAgo(iso){ if(!iso) return ''; const t=new Date(iso).getTime(); if(isNaN(t)) return ''; const s=Math.floor((Date.now()-t)/1e3); if(s<60) return `${s}s ago`; const m=Math.floor(s/60); if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; const d=Math.floor(h/24); if(d<30) return `${d}d ago`; const mo=Math.floor(d/30); return mo<12?`${mo}mo ago`:`${Math.floor(mo/12)}y ago`; }
