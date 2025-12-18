const CACHE_NAME = 'leitor-pressao-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// Instalação - cachear arquivos essenciais
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Ativação - limpar caches antigos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch - estratégia network-first para melhor experiência
self.addEventListener('fetch', event => {
    // Ignorar requisições para o Tesseract CDN
    if (event.request.url.includes('cdn.jsdelivr.net')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cachear resposta bem-sucedida
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
