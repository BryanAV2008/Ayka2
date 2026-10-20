// Service worker de Bisuterías Ayka
// Estrategia "red primero": siempre se intenta cargar la versión más reciente del sitio
// (así nadie ve precios o textos viejos) y la copia guardada solo se usa si no hay internet.
// Los datos de productos vienen de Firebase en vivo y nunca se guardan aquí.

const CACHE_NOMBRE = "ayka-v3";
const ARCHIVOS_BASE = [
  "index.html",
  "style.css",
  "manifest.json",
  "images/logo-ayka.jpeg",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE_NOMBRE).then((cache) => cache.addAll(ARCHIVOS_BASE)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NOMBRE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);

  // Solo archivos propios del sitio y solo lectura (GET). Firebase, Cloudinary, Google Fonts, etc. no se tocan.
  if (peticion.method !== "GET" || url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok && respuesta.type === "basic") {
          const copia = respuesta.clone();
          caches.open(CACHE_NOMBRE).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() =>
        caches.match(peticion).then((guardada) => {
          if (guardada) return guardada;
          if (peticion.mode === "navigate") return caches.match("index.html");
          return Response.error();
        })
      )
  );
});
