# Configuración PWA Offline - Bocado AI

Este documento describe las mejoras implementadas para soporte offline en la aplicación Bocado AI.

## 🎯 Resumen de Cambios

### 1. Service Worker Mejorado (`public/firebase-messaging-sw.js`)

El Service Worker ahora incluye:

- **Firebase Messaging** (existente): Manejo de notificaciones push
- **Caching Offline** (nuevo):
  - Estrategia `CacheFirst` para assets estáticos (JS, CSS, fuentes)
  - Estrategia `NetworkFirst` para APIs con fallback a cache
  - Estrategia `StaleWhileRevalidate` para imágenes
  - Precache de assets críticos: `/`, `/offline.html`, iconos
  - Página de fallback para navegación offline

#### Estrategias de Cache

| Tipo | Estrategia | Descripción |
|------|------------|-------------|
| JS/CSS | CacheFirst | Cachea assets estáticos, fallback a cache si no hay red |
| Imágenes | StaleWhileRevalidate | Muestra cache inmediatamente, actualiza en segundo plano |
| APIs | NetworkFirst | Intenta red primero, usa cache si falla |
| Navegación | NetworkFirst | Red primero, fallback a offline.html |

### 2. Página Offline (`public/offline.html`)

Página amigable que se muestra cuando:
- No hay conexión a internet
- Falla la carga de una ruta

**Características:**
- Diseño con colores del tema Bocado (verdes)
- Icono animado de "sin conexión"
- Botón "Reintentar" con indicador de carga
- Detección automática de reconexión
- Redirección automática cuando vuelve la conexión
- Tips útiles para el usuario

### 3. Configuración VitePWA (`vite.config.ts`)

Actualizado con:

```typescript
workbox: {
  navigateFallback: '/offline.html',
  navigateFallbackDenylist: [/^\/api/, /^\/admin/, /^\/__/],
  cleanupOutdatedCaches: true,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // Firebase APIs
    { urlPattern: /\.googleapis\.com/, handler: 'NetworkFirst' },
    // Firebase Storage
    { urlPattern: /firebasestorage\.googleapis\.com/, handler: 'StaleWhileRevalidate' },
    // Fuentes Google
    { urlPattern: /fonts\.googleapis\.com/, handler: 'CacheFirst' },
    { urlPattern: /fonts\.gstatic\.com/, handler: 'CacheFirst' },
    // Iconos
    { urlPattern: /\/icons\//, handler: 'CacheFirst' },
    // Imágenes
    { urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/, handler: 'CacheFirst' },
  ]
}
```

### 4. Hook de Estado de Red (`src/hooks/useNetworkStatus.ts`)

Nuevo hook para detectar cambios en la conectividad:

```typescript
const { 
  isOnline, 
  isOffline, 
  connectionType, 
  downlink,
  checkConnection 
} = useNetworkStatus({
  showReconnectionToast: true,
  onOffline: () => console.log('Sin conexión'),
  onOnline: () => console.log('Conexión restaurada'),
});
```

**Características:**
- Detecta cambios online/offline del navegador
- Usa Network Information API para calidad de conexión
- Verificación activa con `fetch` al endpoint `/manifest.json`
- Detecta cambios cuando la app vuelve a primer plano
- Callbacks configurables para online/offline

### 5. Toast de Estado de Red (`src/components/NetworkStatusToast.tsx`)

Componente que muestra notificaciones toast:
- **Offline**: Toast ambar con mensaje "Sin conexión a internet"
- **Online**: Toast verde con mensaje "Conexión restaurada"

Integrado en `App.tsx` para mostrarse globalmente.

## 📁 Archivos Modificados/Creados

### Nuevos Archivos
- `public/offline.html` - Página de fallback offline
- `src/hooks/useNetworkStatus.ts` - Hook de estado de red
- `src/components/NetworkStatusToast.tsx` - Componente de notificaciones
- `docs/PWA_OFFLINE_SETUP.md` - Este documento

### Archivos Modificados
- `public/firebase-messaging-sw.js` - Extendido con caching offline
- `vite.config.ts` - Configuración Workbox actualizada
- `src/hooks/index.ts` - Exportación del nuevo hook
- `src/App.tsx` - Integración del NetworkStatusToast

## 🧪 Cómo Probar

### 1. Modo Offline en Desarrollo

```bash
npm run build
npm run preview
```

Luego en Chrome DevTools:
1. Abrir DevTools (F12)
2. Ir a Network tab
3. Cambiar "No throttling" a "Offline"
4. Recargar la página

### 2. Verificar Service Worker

En DevTools > Application > Service Workers:
- Verificar que está registrado
- Verificar que está activo
- Forzar "Update on reload" para desarrollo

### 3. Verificar Cache

En DevTools > Application > Cache Storage:
- `workbox-precache-v2` - Assets precacheados
- `google-fonts-cache` - Fuentes
- `firebase-apis-cache` - Respuestas de APIs
- `images-cache` - Imágenes

### 4. Lighthouse PWA Audit

Correr Lighthouse en Chrome DevTools para verificar:
- ✓ Detectable como PWA
- ✓ Instalable
- ✓ Funciona offline
- ✓ Configurado para pantalla de inicio

## 🚀 Comportamiento Esperado

### Escenario 1: Pérdida de Conexión
1. Usuario está navegando la app
2. Se pierde la conexión
3. Aparece toast "Sin conexión a internet"
4. Cache sirve contenido ya visitado
5. Nuevas navegaciones muestran offline.html

### Escenario 2: Recuperación de Conexión
1. Vuelve la conexión
2. Aparece toast "Conexión restaurada"
3. La app sincroniza datos automáticamente
4. Usuario puede continuar normalmente

### Escenario 3: Instalación PWA
1. Usuario instala la app
2. Service Worker se registra
3. Assets se cachean en instalación
4. App funciona offline desde el primer uso

## 📱 Compatibilidad

- **Chrome/Edge**: Soporte completo
- **Firefox**: Soporte completo (sin Background Sync)
- **Safari**: Soporte parcial (limitado por iOS)
- **Opera**: Soporte completo

## 🔧 Variables de Entorno

No se requieren variables de entorno adicionales. El Service Worker usa:
- `self.__FIREBASE_CONFIG__` - Inyectado por VitePWA

## 📝 Notas Técnicas

1. **importScripts**: El SW principal generado por Workbox importa `firebase-messaging-sw.js`
2. **Cache Versioning**: Las caches incluyen versión (`v2`) para invalidación controlada
3. **Network Timeout**: APIs tienen timeout de 5 segundos antes de fallback a cache
4. **Cleanup**: Caches antiguas se limpian automáticamente en activación

## 🔗 Recursos

- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker Lifecycle](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle)
