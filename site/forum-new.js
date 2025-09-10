function $(s){return document.querySelector(s)}

async function submitPost(e){
  e.preventDefault();
  const title = $('#title').value.trim();
  const body = $('#body').value.trim();
  const category = $('#category').value.trim();
  const tags = ($('#tags').value||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!title||!body){ $('#status').textContent='Title and body required.'; return; }
  $('#submitBtn').disabled=true; $('#status').textContent='Submitting…';
  try{
    // Use membership cookie as a lightweight user id if present
    let uid='anon';
    try{ uid=(document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('co_member='))||'').split('=')[1]||'anon'; }catch{}
    const payload={ title, body, category, tags, user_id: uid, user_context:{ trust_tier:'T0', prior_actions:['none'], report_score:0, velocity:{ posts_last_hour:0, links_last_day:0 } } };
    const res = await fetch('/api/forum/create',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const out = await res.json();
    if(!res.ok){ throw new Error(out && out.error || res.statusText); }
    const r = $('#result'); r.style.display='';
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
    $('#status').textContent='';
  }catch(err){
    $('#status').textContent='Error: '+(err && err.message ? err.message : String(err));
  }finally{
    $('#submitBtn').disabled=false;
  }
}

function init(){ $('#newForm').addEventListener('submit', submitPost); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

