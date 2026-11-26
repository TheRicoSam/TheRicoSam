/* Service worker: app instalable, funciona con mala señal y recibe notificaciones push. */
importScripts('./firebase-config.js');

const CACHE = 'datacrammer-v2';
const SHELL = [
  './', './index.html', './css/app.css', './firebase-config.js', './manifest.webmanifest',
  './js/app.js', './js/ui.js', './js/map.js', './js/notify.js', './js/backend-demo.js', './js/backend-firebase.js', './js/defaults.js', './js/sort.js',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './icons/icon.svg', './icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Archivos propios: primero la red (siempre la última versión) y, sin señal, la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});

// Push de Firebase Cloud Messaging (mensajes de datos enviados por /functions).
if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
  importScripts(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js',
  );
  firebase.initializeApp(self.FIREBASE_CONFIG);
  firebase.messaging().onBackgroundMessage((payload) => {
    const d = payload.data || {};
    return self.registration.showNotification(d.title || 'Data Crammer', {
      body: d.body || '', tag: d.tag, renotify: !!d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      data: { url: d.url || '#/' }, vibrate: [120, 60, 120],
    });
  });
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '#/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = all.find((c) => c.url.startsWith(self.registration.scope));
    if (win) { await win.focus(); win.postMessage({ url: target }); return; }
    return self.clients.openWindow(`${self.registration.scope}index.html${target}`);
  })());
});
