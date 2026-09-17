// 오프라인 동작용 서비스워커.
// app.js 의 APP_VERSION 과 아래 VERSION 을 항상 같은 값으로 맞춘다.

const VERSION = '0.7.0';
const CACHE = 'golf-score-v' + VERSION;

// 신호가 약한 곳에서 이만큼 기다렸다가 저장된 버전으로 넘어간다
const NETWORK_TIMEOUT = 2500;

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
  e.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' 를 줘야 GitHub 이 붙인 10분짜리 캐시를 무시하고 진짜 새 파일을 받는다
      .then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 앱을 열 때마다 최신을 먼저 시도한다.
// 신호가 없거나 느리면 저장된 버전으로 넘어가므로 골프장에서도 그대로 뜬다.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(networkFirst(e.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(request, { cache: 'no-store' }), NETWORK_TIMEOUT);
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('느린 연결')), ms)),
  ]);
}
