// Guarda la app en el celular: abre rápido y también sin internet (después de la primera visita)
const V='inventario-v6';
const FILES=['./','index.html','xlsx.full.min.js','jszip.min.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Con internet baja la versión nueva; sin internet (o si tarda más de 3 s) usa la guardada
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const net=fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp))}return r});
  e.respondWith(new Promise(res=>{
    let done=false;const fin=r=>{if(!done&&r){done=true;res(r)}};
    const t=setTimeout(()=>caches.match(e.request).then(fin),3000); // si no hay copia guardada, sigue esperando a la red
    net.then(r=>{clearTimeout(t);fin(r)}).catch(()=>{clearTimeout(t);
      caches.match(e.request).then(m=>fin(m||(e.request.mode==='navigate'?caches.match('index.html'):Response.error())))});
  }));
});
