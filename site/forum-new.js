(function(){
/**
 * @param {string} s
 * @returns {any}
 */
function qs(s){return document.querySelector(s)}
let tsWidget=null; let tsReady=false;

async function setupTurnstile(){
  try{
    const r = await fetch('/api/stats/turnstile', { cache:'no-store' });
    const { sitekey } = await r.json();
    if(!sitekey) return;
    await new Promise((resolve)=>{
      const s=document.createElement('script'); s.src='https://challenges.cloudflare.com/turnstile/v0/api.js'; s.defer=true; s.async=true; s.onload=resolve; document.head.appendChild(s);
    });
    if(!window.turnstile) return;
    const form = qs('#newForm'); if(!form) return;
    let div = document.getElementById('tsContainer');
    if(!div){ div=document.createElement('div'); div.id='tsContainer'; div.className='cf-turnstile'; div.style='margin:8px 0'; form.insertBefore(div, form.firstChild); }
    tsWidget = window.turnstile.render(div, { sitekey });
    tsReady=true;
  }catch{}
}

async function submitPost(e){
  e.preventDefault();
  const title = qs('#title').value.trim();
  const body = qs('#body').value.trim();
  const category = qs('#category').value.trim();
  const tags = (qs('#tags').value||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!title||!body){ qs('#status').textContent='Title and body required.'; return; }
  if(!category){ qs('#status').textContent='Category is required.'; return; }
  if(tags.length===0){ qs('#status').textContent='At least one tag is required.'; return; }
  qs('#submitBtn').disabled=true; qs('#status').textContent='Submitting…';
  try{
    // Use membership cookie as a lightweight user id if present
    let uid='anon';
    try{ uid=(document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('co_member='))||'').split('=')[1]||'anon'; }catch{}
    const payload={ title, body, category, tags, user_id: uid, user_context:{ trust_tier:'T0', prior_actions:['none'], report_score:0, velocity:{ posts_last_hour:0, links_last_day:0 } } };
    try{ if(tsReady && window.turnstile && tsWidget!=null){ payload.ts = window.turnstile.getResponse(tsWidget) || ''; } }catch{}
    const res = await fetch('/api/forum/create',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const out = await res.json();
    if(!res.ok){
      if(res.status===429){ throw new Error('You are sending too many submissions. Please wait and try again.'); }
      if(res.status===403 && out && out.error==='Verification failed'){ throw new Error('Verification failed. Complete the check and try again.'); }
      if(res.status===403 && out && out.error==='Banned'){ throw new Error('Posting is temporarily disabled for this device/account.'); }
      throw new Error(out && out.error || res.statusText);
    }
    const r = qs('#result'); r.style.display='';
    const state = (out && out.visibility_state) || 'publish';
    const next = out && out.view_url ? `<a href="${out.view_url}">View your topic</a>` : '';
    if(state==='publish'){
      r.textContent='Published! '+next;
    }else if(state==='limited'){
      r.textContent='Submitted with limited distribution pending review. '+next;
    }else if(state==='quarantine'){
      r.textContent='Submitted for review. It is not visible yet. '+next;
    }else{
      r.textContent='Blocked by policy (P0). Please revise and try again.';
    }
    qs('#status').textContent='';
  }catch(err){
    qs('#status').textContent='Error: '+(err && err.message ? err.message : String(err));
  }finally{
    qs('#submitBtn').disabled=false;
  }
}

function init(){ qs('#newForm').addEventListener('submit', submitPost); setupTurnstile(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
