const CACHE='odds-vinkjes-v11';
const ASSETS=['./','index.html','manifest.webmanifest','icon.svg','sync.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
function withSync(html){return html.includes('src="sync.js"')?html:html.replace('</body>','<script src="sync.js"></script></body>')}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(async r=>{
      const html=withSync(await r.text());
      const headers=new Headers(r.headers);headers.delete('content-length');
      const out=new Response(html,{status:r.status,statusText:r.statusText,headers});
      const copy=out.clone();caches.open(CACHE).then(c=>c.put(req,copy));return out;
    }).catch(()=>caches.match(req).then(async r=>{
      if(!r)r=await caches.match('index.html');
      if(!r)return r;
      const html=withSync(await r.text());
      const headers=new Headers(r.headers);headers.delete('content-length');
      return new Response(html,{status:r.status,statusText:r.statusText,headers});
    })));
    return;
  }
  e.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));return r}).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));
});