import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface PWAState {
  isInstallable: boolean;
  isOffline: boolean;
  isInstalled: boolean;
  installPrompt: Event | null;
  updateAvailable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

/**
 * Hook para manejar funcionalidades PWA
 * - Detecta si la app es instalable
 - Detecta estado offline/online
 - Maneja la instalación
 - Detecta actualizaciones disponibles
 */
export const usePWA = () => {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isOffline: !navigator.onLine,
    isInstalled: false,
    installPrompt: null,
    updateAvailable: false,
    isIOS: false,
    isAndroid: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua)
      || ((platform.includes('Mac') || platform.includes('MacIntel')) && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);

    setState(prev => ({ ...prev, isIOS, isAndroid }));
  }, []);

  // Detectar si está instalado
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone 
        || document.referrer.includes('android-app://');
      
      setState(prev => ({ ...prev, isInstalled: isStandalone }));
    };

    checkInstalled();
    
    // Escuchar cambios en display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, isInstalled: e.matches }));
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Detectar instalabilidad
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setState(prev => ({
        ...prev,
        isInstallable: true,
        installPrompt: e,
      }));
      logger.info('PWA: App is installable');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!state.isIOS) return;

    setState(prev => ({
      ...prev,
      isInstallable: !prev.isInstalled,
    }));
  }, [state.isIOS, state.isInstalled]);

  // Detectar online/offline
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }));
      logger.info('PWA: App is online');
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }));
      logger.info('PWA: App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Detectar actualizaciones del SW
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Escuchar cuando hay un nuevo service worker esperando
      const checkForUpdates = () => {
        navigator.serviceWorker.ready.then((registration) => {
          if (registration.waiting) {
            setState(prev => ({ ...prev, updateAvailable: true }));
            logger.info('PWA: New service worker waiting to activate');
          }

          // Escuchar cuando se instala un nuevo SW
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Hay un nuevo service worker instalado mientras uno viejo sigue activo
                  setState(prev => ({ ...prev, updateAvailable: true }));
                  logger.info('PWA: New service worker installed');
                }
              });
            }
          });
        });
      };

      checkForUpdates();

      // Revisar actualizaciones menos frecuentemente (cada 5 minutos en vez de 1)
      const interval = setInterval(() => {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update();
        });
      }, 300000); // Cada 5 minutos

      return () => clearInterval(interval);
    }
  }, []);

  // Función para instalar la app
  const install = useCallback(async () => {
    if (!state.installPrompt) {
      logger.warn('PWA: No install prompt available');
      return false;
    }

    try {
      const promptEvent = state.installPrompt as any;
      promptEvent.prompt();
      const result = await promptEvent.userChoice;
      
      if (result.outcome === 'accepted') {
        logger.info('PWA: App installed');
        setState(prev => ({ 
          ...prev, 
          isInstallable: false, 
          installPrompt: null,
          isInstalled: true 
        }));
        return true;
      } else {
        logger.info('PWA: Install dismissed');
        return false;
      }
    } catch (error) {
      logger.error('PWA: Error installing app', error);
      return false;
    }
  }, [state.installPrompt]);

  // Función para recargar y actualizar
  const updateApp = useCallback(() => {
    // Ocultar banner inmediatamente
    setState(prev => ({ ...prev, updateAvailable: false }));
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Si hay un service worker esperando, activarlo
        if (registration.waiting) {
          logger.info('PWA: Sending SKIP_WAITING message to service worker');
          
          // Enviar mensaje al SW para que haga skipWaiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Recargar cuando el nuevo SW tome control
          let refreshing = false;
          const handleControllerChange = () => {
            if (!refreshing) {
              logger.info('PWA: Controller changed, reloading page');
              refreshing = true;
              window.location.reload();
            }
          };
          
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          
          // Fallback: Si no hay controllerchange en 2 segundos, recargar de todos modos
          setTimeout(() => {
            if (!refreshing) {
              logger.info('PWA: Fallback reload after timeout');
              window.location.reload();
            }
          }, 2000);
        } else {
          logger.info('PWA: No waiting service worker, just reloading');
          // Si no hay uno esperando, simplemente recargar
          window.location.reload();
        }
      }).catch((error) => {
        logger.error('PWA: Error getting service worker registration', error);
        window.location.reload();
      });
    } else {
      logger.warn('PWA: Service worker not supported, just reloading');
      window.location.reload();
    }
  }, []);

  return {
    ...state,
    install,
    updateApp,
  };
};

export default usePWA;
