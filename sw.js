/* 持股簿 service worker
 * 更新策略：
 *  - HTML（程式本體）走「網路優先」：有網路開啟＝永遠拿到最新版；離線才用上次存的快取。
 *  - 圖示等靜態檔走「快取優先」：載入快、離線可用。
 *  - 發布新版時把下面的 VERSION 加一（v1 → v2），舊快取會在啟用時自動清除。
 */
const VERSION = 'v4';
const CACHE = 'ledger-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 證交所等外部 API 一律不快取

  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isDoc) {
    // 網路優先：抓最新 HTML，順便更新快取；沒網路才退回快取
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }
  // 其他靜態資源：快取優先
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
