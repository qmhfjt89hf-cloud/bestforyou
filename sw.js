/* =========================
   ⚙️ CONFIG (best-4-you.ru)
========================= */

const VERSION = 'v8'; // ← ОБЯЗАТЕЛЬНО увеличил версию

const CACHE = {
    static: `bfy-static-${VERSION}`,
    images: `bfy-images-${VERSION}`,
    videos: `bfy-videos-${VERSION}`,
};

const LIMITS = {
    images: 80,
    videos: 12,
};

const OFFLINE_PAGE = '/offline.html';
const OFFLINE_VIDEO_POSTER = '/images/header.webp';

/* =========================
   📦 PRELOAD
========================= */

const STATIC_ASSETS = [
    '/',
    '/index.html',
    OFFLINE_PAGE,
    '/manifest.json',

    // favicons
    '/favicon-16.webp',
    '/favicon-32.webp',
    '/favicon-48.webp',

    // PWA icons (NEW PATH)
    '/splash/icon-light-192.webp',
    '/splash/icon-light-512.webp',
    '/splash/icon-dark-192.webp',
    '/splash/icon-dark-512.webp',

    // branding
    '/logo.png',

    // critical images
    '/images/header.webp',
    '/foto/inter/1.webp'
];

/* =========================
   🧹 HELPERS
========================= */

async function limitCache(name, max) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    while (keys.length > max) {
        await cache.delete(keys.shift());
    }
}

/* =========================
   📦 INSTALL
========================= */

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE.static).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

/* =========================
   🧹 ACTIVATE
========================= */

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(keys =>
                Promise.all(
                    keys
                        .filter(k => !Object.values(CACHE).includes(k))
                        .map(k => caches.delete(k))
                )
            ),
            self.clients.claim()
        ])
    );
});

/* =========================
   🌐 FETCH
========================= */

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.origin !== self.location.origin) return;

    /* ===== HTML ===== */
    if (req.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirst(req));
        return;
    }

    /* ===== IMAGES ===== */
    if (req.destination === 'image') {
        event.respondWith(
            staleWhileRevalidate(req, CACHE.images, LIMITS.images)
        );
        return;
    }

    /* ===== VIDEO ===== */
    if (req.destination === 'video') {
        event.respondWith(videoStrategy(req));
        return;
    }

    /* ===== DEFAULT ===== */
    event.respondWith(cacheFirst(req, CACHE.static));
});

/* =========================
   📘 STRATEGIES
========================= */

async function networkFirst(req) {
    try {
        const res = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE.static);
        cache.put(req, res.clone());
        return res;
    } catch {
        return caches.match(req) || caches.match(OFFLINE_PAGE);
    }
}

async function cacheFirst(req, cacheName) {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
        const res = await fetch(req);
        if (res.ok) {
            const cache = await caches.open(cacheName);
            cache.put(req, res.clone());
        }
        return res;
    } catch {
        return;
    }
}

async function staleWhileRevalidate(req, cacheName, limit) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);

    const network = fetch(req)
        .then(res => {
            if (res.ok) {
                cache.put(req, res.clone());
                limitCache(cacheName, limit);
            }
            return res;
        })
        .catch(() => null);

    return cached || network;
}

async function videoStrategy(req) {
    if (req.headers.get('range')) {
        return fetch(req);
    }

    const cached = await caches.match(req);
    if (cached) return cached;

    try {
        const res = await fetch(req);
        if (res.ok) {
            const cache = await caches.open(CACHE.videos);
            cache.put(req, res.clone());
            limitCache(CACHE.videos, LIMITS.videos);
        }
        return res;
    } catch {
        return caches.match(OFFLINE_VIDEO_POSTER);
    }
}
