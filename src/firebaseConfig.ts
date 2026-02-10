import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  serverTimestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from "firebase/analytics";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from "firebase/messaging";
import { env } from './environment/env';
import { logger } from './utils/logger';

const app = !getApps().length ? initializeApp(env.firebase) : getApp();

// CONFIGURACIÓN OFFLINE (Firestore Persistence)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// AUTH
const auth = getAuth(app);

// ANALYTICS con manejo de race condition
let analytics: ReturnType<typeof getAnalytics> | null = null;
let analyticsReady = false;
const eventQueue: Array<{ eventName: string; params?: Record<string, any> }> = [];

const processEventQueue = () => {
  if (!analytics) return;
  
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      try {
        logEvent(analytics, event.eventName, event.params);
      } catch (e) {
        // Silenciar errores de analytics
      }
    }
  }
};

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      analyticsReady = true;
      processEventQueue();
      
      if (import.meta.env.DEV) {
        logger.info('✅ Analytics inicializado');
      }
    }
  }).catch((err) => {
    if (import.meta.env.DEV) {
      logger.warn('Analytics no soportado:', err);
    }
  });
}

// Helper para trackear eventos (con cola para race condition)
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (analyticsReady && analytics) {
    try {
      logEvent(analytics, eventName, params);
    } catch (e) {
      // Silenciar errores de analytics
    }
  } else {
    // Encolar evento para procesar cuando analytics esté listo
    eventQueue.push({ eventName, params });
    // Limitar tamaño de cola
    if (eventQueue.length > 100) {
      eventQueue.shift();
    }
  }
};

// Establecer el ID de usuario en Analytics
export const setAnalyticsUser = (userId: string | null) => {
  if (analytics && userId) {
    try {
      setUserId(analytics, userId);
    } catch (e) {
      // Silenciar errores
    }
  }
};

// Establecer propiedades del usuario en Analytics
export const setAnalyticsProperties = (properties: Record<string, any>) => {
  if (analytics) {
    try {
      setUserProperties(analytics, properties);
    } catch (e) {
      // Silenciar errores
    }
  }
};

// ============================================
// FIREBASE MESSAGING (Notificaciones Push)
// ============================================

let messaging: ReturnType<typeof getMessaging> | null = null;

// Inicializar messaging solo si está soportado (no en Safari iOS)
const initMessaging = async () => {
  if (typeof window === 'undefined') return null;
  
  const supported = await isMessagingSupported();
  if (!supported) {
    logger.info('Firebase Messaging no soportado en este navegador');
    return null;
  }
  
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
};

/**
 * Solicitar permiso para notificaciones y obtener token FCM
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const msg = await initMessaging();
    if (!msg) return null;
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      logger.info('Permiso de notificaciones denegado');
      return null;
    }
    
    // Obtener token FCM
    const token = await getToken(msg, {
      vapidKey: env.firebase.vapidKey,
    });
    
    if (token) {
      logger.info('Token FCM obtenido');
      trackEvent('notification_permission_granted');
      return token;
    }
    
    return null;
  } catch (error) {
    logger.error('Error solicitando permiso de notificaciones:', error);
    trackEvent('notification_permission_error');
    return null;
  }
};

/**
 * Escuchar mensajes en primer plano
 */
export const onForegroundMessage = (callback: (payload: any) => void) => {
  initMessaging().then((msg) => {
    if (msg) {
      onMessage(msg, (payload) => {
        logger.info('Mensaje recibido en primer plano:', payload);
        trackEvent('notification_received_foreground', {
          title: payload.notification?.title,
        });
        callback(payload);
      });
    }
  });
};

/**
 * Verificar si las notificaciones están soportadas
 */
export const areNotificationsSupported = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  return isMessagingSupported();
};

export { db, auth, serverTimestamp, analytics, messaging };
