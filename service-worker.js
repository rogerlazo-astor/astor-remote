const CACHE_NAME = 'astor-remote-v14';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './app.mvp.js',
  './app.modules.js',
  './production.ui.js',
  './astor.lab.js',
  './reception.lab.js',
  './cloud.sync.js',
  './cloud.sync.css',
  './cloud.panel.js',
  './supabase.config.js',
  './js/engines/fabrication.engine.js',
  './js/data/materials.library.js',
  './manifest.webmanifest',
  './icon.svg',
  './photo-guide.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // No cachear Supabase ni CDN externos
  const url = event.request.url;
  if (url.includes('supabase.co') || url.includes('jsdelivr') || url.includes('cdn.')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
