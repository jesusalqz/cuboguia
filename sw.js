// Service worker: todo en caché para funcionar sin internet.
const CACHE = 'cuboguia-v2';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/fonts/inter-latin-400-normal.woff2', 'assets/fonts/inter-latin-500-normal.woff2', 'assets/fonts/inter-latin-600-normal.woff2',
  'assets/fonts/space-grotesk-latin-600-normal.woff2', 'assets/fonts/space-grotesk-latin-700-normal.woff2', 'assets/fonts/jetbrains-mono-latin-700-normal.woff2',
  'vendor/three/three.module.min.js', 'vendor/three/RoundedBoxGeometry.js',
  'vendor/cubejs/cube.js', 'vendor/cubejs/solve.js',
  'src/app.js', 'src/cube/model.js', 'src/cube/validate.js', 'src/cube/notation.js',
  'src/solver/layers.js', 'src/solver/kociemba.worker.js',
  'src/view/cube3d.js', 'src/capture/capture.js', 'src/capture/order.js', 'src/capture/colors.js',
  'src/data/store.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (siempre la versión más nueva, evitando la caché HTTP de GitHub Pages);
// si no hay internet, se usa la copia guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const nav = e.request.mode === 'navigate';
      const res = await fetch(nav ? e.request.url : e.request, { cache: 'reload' });
      if (res.ok) c.put(e.request, res.clone());
      return res;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('index.html')) || (await c.match('./'));
    }
  })());
});
