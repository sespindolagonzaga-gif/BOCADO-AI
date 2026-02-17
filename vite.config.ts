import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isStorybook = process.env.npm_lifecycle_event?.includes('storybook') ?? false;
  
  return {
    plugins: [
      react(),
      !isStorybook && VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        // Control manual de actualizaciones
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          importScripts: ['firebase-messaging-sw.js', 'sw-extension.js'],
          
          // Página offline para navegación fallida
          navigateFallback: '/offline.html',
          navigateFallbackDenylist: [
            /^\/api/,           // APIs del backend
            /^\/admin/,         // Panel admin
            /^\/__/            // Firebase internals
          ],
          
          // Precache de assets críticos
          globIgnores: ['**/node_modules/**/*', '**/sw.js'],
          
          // Estrategias de caching en runtime
          runtimeCaching: [
            // Cache de fuentes de Google (CSS)
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-css-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache de fuentes de Google (archivos de fuentes)
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache de APIs de Firebase (Firestore, Auth, etc)
            {
              urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firebase-apis-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200, 204]
                }
              }
            },
            // Cache de Firebase Storage
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'firebase-storage-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache de imágenes locales y del app
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 60 // 60 días
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache de iconos específicamente
            {
              urlPattern: /\/icons\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'icons-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache de API de Geonames
            {
              urlPattern: /^https:\/\/secure\.geonames\.org\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'geonames-api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 1 día
                },
                networkTimeoutSeconds: 3
              }
            },
            // Cache de archivos JS y CSS (ya precacheados, pero por si acaso)
            {
              urlPattern: /\.(?:js|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días
                }
              }
            }
          ],
          
          // Limpieza de caches antiguas
          cleanupOutdatedCaches: true
        },
        manifest: {
          name: 'Bocado - Guía Nutricional Inteligente',
          short_name: 'Bocado',
          description: 'Recomendaciones nutricionales personalizadas con IA',
          theme_color: '#4A7C59',
          background_color: '#FAFAF5',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'es',
          icons: [
            {
              src: '/icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png'
            },
            {
              src: '/icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png'
            },
            {
              src: '/icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png'
            },
            {
              src: '/icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png'
            },
            {
              src: '/icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png'
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ],
          categories: ['health', 'food', 'lifestyle'],
          screenshots: []
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ].filter(Boolean),
    server: {
      port: 3000
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});
