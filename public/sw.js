const VERSION='workflow-planner-v1.8.1-media-hub-workflow-admin';
const ASSETS=['/','/index.html','/app.css','/app.js','/icon.svg','/manifest.webmanifest','/media-hub.html','/media-hub.js','/media-hub.css','/media-utils.js','/media-export.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(new URL(req.url).pathname==='/config.js')return;
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req)));
});
