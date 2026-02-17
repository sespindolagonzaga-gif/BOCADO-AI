// Extensión del Service Worker para manejar actualizaciones manuales
// Este código se inyectará en el SW generado por Workbox

// Escuchar mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Recibido comando SKIP_WAITING, activando nuevo service worker...');
    self.skipWaiting();
  }
});
