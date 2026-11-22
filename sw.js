/* NEBULA OS — service worker.
   Главная задача: НИКОГДА не отдавать устаревшую сборку.
   - HTML всегда ревалидируется (cache: no-cache), Pages держит max-age=600
   - имя кэша содержит SHA коммита: новая публикация = новый пустой кэш
   - если HTML новее самого воркера, воркер сам себя снимает и перезапускает страницу
   Включается только на https; локальная разработка не кэшируется. */
const VERSION = '1.0.2';
const BUILD_ID = '__BUILD_ID__';
const IS_DEV = BUILD_ID.indexOf('__') === 0;
const TAG = IS_DEV ? 'dev' : BUILD_ID;
const CACHE = `nebula-app-${VERSION}-${TAG}`;
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
  'css/updates.css',
  'js/main.js'
];

let healing = false;

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
    await Promise.all(keys.filter((k) => k.startsWith('nebula-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k)));
    await self.clients.claim();
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ type: 'NEBULA_SW_READY', build: TAG }));
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* сборка на сервере новее этого воркера → воркер устарел, снимаем его */
async function healIfOutdated(html) {
  if (IS_DEV || healing) return;
  const m = html.match(/name="nebula-build"\s+content="([^"]+)"/);
  if (!m) return;
  const commit = m[1].split('·')[0].trim();
  if (!commit || commit === BUILD_ID) return;
  healing = true;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('nebula-')).map((k) => caches.delete(k)));
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ type: 'NEBULA_SW_OUTDATED', from: BUILD_ID, to: commit }));
    await self.registration.unregister();
  } catch (err) {
    healing = false;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith((async () => {
        const c = await caches.open(CACHE);
        try {
          const fresh = await fetch(req, { cache: 'no-cache' });
          if (fresh && fresh.ok) {
            const text = await fresh.clone().text();
            c.put(url('index.html'), fresh.clone());
            healIfOutdated(text);
          }
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
        const res = await fetch(req, { cache: 'no-cache' });
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