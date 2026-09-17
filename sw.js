// 오프라인 동작용 서비스워커.
// 앱 파일을 고쳐서 배포할 때는 아래 CACHE 이름의 숫자를 반드시 올린다.

const CACHE = 'golf-score-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './storage.js',
  './app.js',
  './boot.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 캐시를 먼저 보여주고, 뒤에서 조용히 새 버전을 받아둔다.
// 골프장에서는 즉시 뜨고, 다음에 열 때 최신으로 바뀐다.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((res) => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached || cache.match('./index.html'));
        return cached || network;
      })
    )
  );
});
