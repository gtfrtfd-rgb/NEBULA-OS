/* NEBULA OS — service worker.
   Включается только на https (GitHub Pages), локальная разработка не кэшируется.
   Имя кэша содержит коммит: каждая публикация гарантированно свежая. */
const VERSION = '1.0.1';
const BUILD_ID = '__BUILD_ID__';
const TAG = BUILD_ID.indexOf('__') === 0 ? 'dev' : BUILD_ID;
const CACHE = `nebula-${VERSION}-${TAG}`;
const FONTS = `nebula-fonts-${VERSION}`;
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

const base = () => self.registration.scope;
const url = (p) => new URL(p, base()).href;

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/nebula.svg',
  'css/base.css',
  'css/windows.css',
  'css/shell.css',
  'css/apps.css',
  'css/terminal.css',
  'js/main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((p) => c.add(new Request(url(p), { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith((async () => {
        const c = await caches.open(CACHE);
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) c.put(url('index.html'), fresh.clone());
          return fresh;
        } catch {
          return (await c.match(url('index.html'))) || (await c.match(url('./'))) || Response.error();
        }
      })());
      return;
    }
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  if (FONT_HOSTS.has(u.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(FONTS);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});