const CACHE = 'expense-v1';
// 如果 repository 名稱是 s89ab101（跟帳號同名）
const FILES = ['/', '/index.html', '/app.js', '/manifest.json'];

// 如果 repository 名稱是 expense-tracker
const FILES = ['/expense-tracker/', '/expense-tracker/index.html', '/expense-tracker/app.js', '/expense-tracker/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    })).catch(() => caches.match('/index.html'))
  );
});
