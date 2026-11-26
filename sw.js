// Guarda o site no aparelho para abrir sem internet. O montar.py grava uma versão nova a cada montagem, e a versão nova substitui a antiga.
const VERSAO = '0b1d995947';
const CACHE = 'hcpa-' + VERSAO;
const EXTRA = 'hcpa-extra';
const BASICO = ['./', './index.html', './manifest.webmanifest', './icone-180.png', './icone-192.png', './icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('hcpa-') && k !== CACHE && k !== EXTRA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function guarda(nome, req, resp) {
  if (resp && (resp.ok || resp.type === 'opaque')) {
    const copia = resp.clone();
    caches.open(nome).then(c => c.put(req, copia));
  }
  return resp;
}

self.addEventListener('fetch', e => {
  const r = e.request;
  // Vídeo pede pedaços (Range); o cache não responde pedaços, então vídeo vai sempre direto para a rede.
  if (r.method !== 'GET' || r.headers.has('range') || r.url.endsWith('.mp4')) return;
  const url = new URL(r.url);
  const ehPagina = r.mode === 'navigate' && url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'));
  if (ehPagina) {
    // Com internet, vale a versão nova; com internet ruim (ônibus), em 3 s abre a guardada.
    const daRede = fetch(r).then(resp => guarda(CACHE, './index.html', resp));
    const guardada = new Promise(ok => setTimeout(() => caches.match('./index.html').then(ok), 3000));
    e.respondWith(Promise.race([
      daRede.catch(() => caches.match('./index.html')),
      guardada.then(x => x || daRede),
    ]));
    return;
  }
  const fonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === location.origin || fonte) {
    e.respondWith(caches.match(r).then(achou => {
      const daRede = fetch(r).then(resp => guarda(EXTRA, r, resp));
      return achou || daRede;
    }));
  }
});
