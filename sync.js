(()=>{
  const SYNC_KEY='odds-sync-key-v1';
  const ENDPOINT='https://gtmzznlknmpjcwuyupjv.supabase.co/functions/v1/odds-analyse-sync';
  let timer=null,alerts=[];

  function getKey(){return localStorage.getItem(SYNC_KEY)||''}
  function newKey(){
    const a=new Uint8Array(24);crypto.getRandomValues(a);
    const k=[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(SYNC_KEY,k);return k;
  }
  function ensureKey(){return getKey()||newKey()}
  function payload(){
    const groups=typeof grouped==='function'?grouped():[];
    return {version:1,updatedAt:new Date().toISOString(),groups:groups.map(g=>({odd:Number(g.odd),total:Number(g.total),good:Number(g.good),bad:Number(g.bad),score:Math.round(Number(g.score)*10)/10}))};
  }
  async function syncNow(){
    const status=document.getElementById('syncStatus');
    try{
      const key=ensureKey();
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,payload:payload()})});
      if(!r.ok)throw new Error('sync '+r.status);
      if(status)status.textContent='✓ Automatisch gesynchroniseerd · '+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
    }catch(e){
      console.warn('[Odds sync]',e);
      if(status)status.textContent='Synchronisatie mislukt — gegevens blijven lokaal bewaard.';
    }
  }
  function queueSync(){clearTimeout(timer);timer=setTimeout(syncNow,350)}

  if(typeof save==='function'){
    const oldSave=save;
    save=function(){const r=oldSave.apply(this,arguments);queueSync();return r};
  }

  function addUi(){
    if(!document.getElementById('syncCard')){
      const tab=document.getElementById('tabInput');
      if(tab){
        const card=document.createElement('section');card.id='syncCard';card.className='card';
        card.innerHTML='<h2>Automatisch naar WedjeBetje</h2><div class="hint">Eenmalig koppelen. Daarna worden wijzigingen in Odds Analyse automatisch door WedjeBetje gebruikt.</div><div class="toolbar"><button id="linkWedjeBtn" class="primary" type="button">Koppel met WedjeBetje</button><button id="copySyncBtn" type="button">Koppelcode kopiëren</button></div><div id="syncStatus" class="mini"></div>';
        const stats=tab.querySelector('.stats');
        if(stats&&stats.nextSibling)tab.insertBefore(card,stats.nextSibling);else tab.appendChild(card);
        document.getElementById('linkWedjeBtn').addEventListener('click',()=>{const key=ensureKey();syncNow();location.href='https://wedjebetje.nl/#odds-sync='+encodeURIComponent(key)});
        document.getElementById('copySyncBtn').addEventListener('click',async()=>{const key=ensureKey();try{await navigator.clipboard.writeText(key);document.getElementById('syncStatus').textContent='Koppelcode gekopieerd.'}catch{prompt('Kopieer deze koppelcode:',key)}});
        document.getElementById('syncStatus').textContent=getKey()?'Automatische koppeling is ingesteld.':'Nog niet gekoppeld met WedjeBetje.';
      }
    }
    addAlertsTab();
  }

  function addAlertsTab(){
    if(document.getElementById('tabAlertsBtn'))return;
    const tabs=document.querySelector('.tabs'),main=document.querySelector('main.wrap');if(!tabs||!main)return;
    tabs.style.gridTemplateColumns='repeat(3,1fr)';
    const btn=document.createElement('button');btn.id='tabAlertsBtn';btn.className='tabBtn';btn.type='button';btn.textContent='Meldingen';tabs.appendChild(btn);
    const sec=document.createElement('section');sec.id='tabAlerts';sec.className='tab';
    sec.innerHTML='<section class="card"><h2>🔥 Sterke-odd meldingen</h2><div class="hint">Wedstrijden waarbij WedjeBetje een sterke odd heeft gemarkeerd. De historische score wordt vastgezet op het moment van de melding.</div><div class="stats four"><div class="stat"><small>Meldingen</small><strong id="alertTotal">0</strong></div><div class="stat"><small>Goed</small><strong id="alertGood">0</strong></div><div class="stat"><small>Hitrate</small><strong id="alertHit">—</strong></div><div class="stat"><small>ROI €1</small><strong id="alertRoi">—</strong></div></div><div class="toolbar"><button id="refreshAlertsBtn" type="button">↻ Vernieuwen</button></div><div id="alertsStatus" class="mini"></div><div id="alertsList" class="alertList"></div></section>';
    const footer=main.querySelector('.footer');main.insertBefore(sec,footer||null);
    btn.addEventListener('click',()=>showAlertsTab());
    document.getElementById('refreshAlertsBtn').addEventListener('click',loadAlerts);
    for(const id of ['tabInputBtn','tabOverviewBtn'])document.getElementById(id)?.addEventListener('click',()=>sec.classList.remove('active'));
    document.getElementById('alertsList').addEventListener('click',e=>{const b=e.target.closest('button[data-alert-result]');if(b)manualResult(b.dataset.id,b.dataset.alertResult)});
  }
  function showAlertsTab(){
    document.getElementById('tabInput')?.classList.remove('active');document.getElementById('tabOverview')?.classList.remove('active');
    document.getElementById('tabInputBtn')?.classList.remove('active');document.getElementById('tabOverviewBtn')?.classList.remove('active');
    document.getElementById('tabAlerts')?.classList.add('active');document.getElementById('tabAlertsBtn')?.classList.add('active');loadAlerts();
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function fmtPct(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*10)/10).replace('.',',')+'%':'—'}
  function renderAlerts(){
    const list=document.getElementById('alertsList');if(!list)return;
    const p=alerts.map(x=>x.payload||x).filter(Boolean),settled=p.filter(x=>x.result==='goed'||x.result==='fout'),good=settled.filter(x=>x.result==='goed').length;
    let profit=0;for(const x of settled)profit+=x.result==='goed'?(Number(x.odd)||0)-1:-1;
    document.getElementById('alertTotal').textContent=p.length;document.getElementById('alertGood').textContent=good;
    document.getElementById('alertHit').textContent=settled.length?Math.round(good/settled.length*100)+'%':'—';
    document.getElementById('alertRoi').textContent=settled.length?(profit/settled.length*100>=0?'+':'')+Math.round(profit/settled.length*1000)/10+'%':'—';
    list.innerHTML=p.length?p.map(x=>{const res=x.result==='goed'?'✅ Goed':x.result==='fout'?'❌ Fout':'⏳ Open';const cls=x.result==='goed'?'ok':x.result==='fout'?'no':'warn';const st=x.result==='goed'||x.result==='fout'?x.result:'open';return '<div class="alert"><div class="alertTop"><div style="min-width:0"><div class="alertMatch">'+esc(x.match||'Wedstrijd')+'</div><div class="alertMeta"><span class="chip">WB '+esc(x.tip)+' @ '+Number(x.odd).toFixed(2).replace('.',',')+'</span><span>bij melding <b>'+fmtPct(x.historyScore)+' · '+esc(x.historyGood)+'/'+esc(x.historyTotal)+'</b></span>'+(x.finalScore?'<span>Uitslag <b>'+esc(x.finalScore)+'</b></span>':'')+(x.settledBy==='server'?'<span>· officieel (90 min)</span>':x.settledBy==='manual'?'<span>· handmatig</span>':'')+'</div>'+(x.settleNote?'<div class="alertMeta" style="color:var(--warn)">'+esc(x.settleNote)+'</div>':'')+'</div><span class="badge '+cls+'">'+res+'</span></div><div class="alertBtns"><button class="good'+(st==='goed'?' on':'')+'" data-alert-result="goed" data-id="'+esc(x.id)+'">✓ Goed</button><button class="bad'+(st==='fout'?' on':'')+'" data-alert-result="fout" data-id="'+esc(x.id)+'">✕ Fout</button><button class="'+(st==='open'?'on':'')+'" data-alert-result="open" data-id="'+esc(x.id)+'">Open</button></div></div>'}).join(''):'<div class="empty">Nog geen sterke-odd meldingen opgeslagen.</div>';
  }
  async function loadAlerts(){
    const st=document.getElementById('alertsStatus'),key=getKey();if(key.length<32){if(st)st.textContent='Koppel eerst met WedjeBetje.';alerts=[];renderAlerts();return}
    if(st)st.textContent='Meldingen laden…';
    try{const r=await fetch(ENDPOINT+'?kind=alerts&key='+encodeURIComponent(key),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();alerts=Array.isArray(j.alerts)?j.alerts:[];renderAlerts();if(st)st.textContent='Bijgewerkt · '+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}catch(e){console.warn(e);if(st)st.textContent='Meldingen konden niet worden geladen.'}
  }
  async function manualResult(id,result){
    const row=alerts.find(x=>(x.payload||x).id===id),x=row&&(row.payload||row);if(!x)return;
    const next={...x,result,source:'manual',settledAt:result==='open'?null:new Date().toISOString()};
    try{const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:ensureKey(),kind:'alert',alert:next})});if(!r.ok)throw new Error('HTTP '+r.status);await loadAlerts()}catch(e){alert('Opslaan mislukt: '+e.message)}
  }

  addUi();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUi);
  window.oddsLoadAlerts=loadAlerts;
  // v15: automatische WB-historie (afgerekende WB-tips uit Vergelijk, Edge Function kind=wbhist)
  window.oddsLoadWbHist=async()=>{const key=getKey();if(key.length<32)throw new Error('nokey');const r=await fetch(ENDPOINT+'?kind=wbhist&key='+encodeURIComponent(key),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(!j||!j.payload||!Array.isArray(j.payload.groups))throw new Error('ongeldig antwoord');return j.payload};
  if(getKey())queueSync();
})();