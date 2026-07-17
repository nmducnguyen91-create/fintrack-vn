// FinTrack VN — service worker (offline app shell)
const CACHE = 'fintrack-shell-v13';
const ASSETS = [
  './',
  'fintrack-vn.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // cache:'reload' buộc tải bản mới từ máy chủ, bỏ qua bộ nhớ đệm HTTP của trình duyệt
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(ASSETS.map(u =>
      fetch(new Request(u, { cache: 'reload' })).then(r => c.put(u, r)).catch(() => {})
    ))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

function isHTML(req) {
  return req.mode === 'navigate' ||
    req.destination === 'document' ||
    req.url.endsWith('.html') ||
    req.url.endsWith('/');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  // Không bao giờ cache lưu lượng đồng bộ thời gian thực — luôn đi thẳng ra mạng
  if (url.includes('firestore.googleapis') || url.includes('firebaseio') || url.includes('google.com')) return;

  // ƯU TIÊN MẠNG cho HTML: luôn lấy bản mới nhất khi có mạng, chỉ dùng bản lưu khi offline.
  if (isHTML(req)) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('fintrack-vn.html')))
    );
    return;
  }

  // ƯU TIÊN BỘ NHỚ ĐỆM cho tài nguyên tĩnh (icon, thư viện) — tải nhanh
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
