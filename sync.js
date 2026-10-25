(()=>{
  const SYNC_KEY='odds-sync-key-v1';
  const ENDPOINT='https://gtmzznlknmpjcwuyupjv.supabase.co/functions/v1/odds-analyse-sync';
  let timer=null;

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
    if(document.getElementById('syncCard'))return;
    const tab=document.getElementById('tabInput');if(!tab)return;
    const card=document.createElement('section');card.id='syncCard';card.className='card';
    card.innerHTML='<h2 style="margin:0 0 8px;font-size:20px">Automatisch naar WedjeBetje</h2><div class="hint">Eenmalig koppelen. Daarna worden wijzigingen in Odds Analyse automatisch door WedjeBetje gebruikt.</div><div class="toolbar"><button id="linkWedjeBtn" class="primary" type="button">Koppel met WedjeBetje</button><button id="copySyncBtn" type="button">Koppelcode kopiëren</button></div><div id="syncStatus" class="mini"></div>';
    const stats=tab.querySelector('.stats');
    if(stats&&stats.nextSibling)tab.insertBefore(card,stats.nextSibling);else tab.appendChild(card);
    document.getElementById('linkWedjeBtn').addEventListener('click',()=>{
      const key=ensureKey();
      syncNow();
      location.href='https://wedjebetje.nl/#odds-sync='+encodeURIComponent(key);
    });
    document.getElementById('copySyncBtn').addEventListener('click',async()=>{
      const key=ensureKey();
      try{await navigator.clipboard.writeText(key);document.getElementById('syncStatus').textContent='Koppelcode gekopieerd.'}catch{prompt('Kopieer deze koppelcode:',key)}
    });
    document.getElementById('syncStatus').textContent=getKey()?'Automatische koppeling is ingesteld.':'Nog niet gekoppeld met WedjeBetje.';
  }

  addUi();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addUi);
  if(getKey())queueSync();
})();