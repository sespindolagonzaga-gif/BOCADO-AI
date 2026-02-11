import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore,
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
// Nota: initializeFirestore puede lanzar si el entorno no soporta IndexedDB/BroadcastChannel
// o si HMR re-ejecuta el módulo. En ese caso, fallback a getFirestore.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (err) {
  console.warn('[Firebase] Fallback a getFirestore:', err);
  db = getFirestore(app);
}

// AUTH
const auth = getAuth(app);

// ============================================
// ANALYTICS CON CONTEXTO ENRIQUECIDO
// ============================================

let analytics: ReturnType<typeof getAnalytics> | null = null;
let analyticsReady = false;
const eventQueue: Array<{ eventName: string; params?: Record<string, any> }> = [];

// Constantes para tracking
const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'unknown';
const SESSION_STORAGE_KEY = 'bocado_session_v1';
const ATTR_STORAGE_KEY = 'bocado_utm_v1';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos de inactividad

/**
 * Obtiene o crea un session ID usando localStorage con timeout.
 * Usa localStorage en vez de sessionStorage para soportar PWA mobile
 * donde el usuario puede cerrar y reabrir la app desde el home screen.
 */
const getSessionId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const now = Date.now();
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    
    if (stored) {
      const { id, lastActivity } = JSON.parse(stored);
      // Si la última actividad fue hace menos de SESSION_TIMEOUT, misma sesión
      if (now - lastActivity < SESSION_TIMEOUT) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id, lastActivity: now }));
        return id;
      }
    }
    
    // Nueva sesión
    const id = `${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id, lastActivity: now }));
    
    // Trackear inicio de sesión (usar setTimeout para evitar recursión)
    setTimeout(() => {
      const utm = getAttributionParams();
      trackEventInternal('session_start', {
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        landing_path: utm.landing_path,
        referrer: utm.referrer,
      });
    }, 0);
    
    return id;
  } catch {
    return null;
  }
};

/**
 * Obtiene parámetros de atribución (UTM) de la URL o localStorage.
 * Solo captura una vez y persiste en localStorage para el resto de la sesión.
 * Limpia los parámetros UTM de la URL después de capturarlos.
 */
const getAttributionParams = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    // Si ya tenemos atribución guardada, usarla
    const stored = localStorage.getItem(ATTR_STORAGE_KEY);
    if (stored) return JSON.parse(stored);

    // Capturar de URL
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    let hasUtm = false;

    utmKeys.forEach((key) => {
      const value = params.get(key);
      if (value) {
        utm[key] = value;
        hasUtm = true;
      }
    });

    // Capturar referrer si es externo
    if (document.referrer && !document.referrer.includes(window.location.hostname)) {
      utm.referrer = document.referrer;
    }

    // Si hay datos de atribución, guardarlos y limpiar URL
    if (hasUtm || utm.referrer) {
      utm.landing_path = window.location.pathname || '/';
      utm.captured_at = Date.now().toString();
      localStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(utm));
      
      // Limpiar UTM de la URL para no tener URLs feas
      if (hasUtm && window.history.replaceState) {
        const url = new URL(window.location.href);
        utmKeys.forEach(key => url.searchParams.delete(key));
        window.history.replaceState({}, '', url.toString());
      }
      
      return utm;
    }

    return {};
  } catch {
    return {};
  }
};

/**
 * Construye el contexto base que se añade a todos los eventos.
 */
const buildContext = (): Record<string, any> => ({
  session_id: getSessionId(),
  app_version: APP_VERSION,
});

/**
 * Función interna para trackear sin enriquecimiento (para evitar loops).
 */
const trackEventInternal = (eventName: string, params?: Record<string, any>) => {
  if (!analytics) return;
  try {
    logEvent(analytics, eventName, params);
  } catch (e) {
    // Silenciar errores de analytics
  }
};

const processEventQueue = () => {
  if (!analytics) return;
  
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      trackEventInternal(event.eventName, event.params);
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

/**
 * Helper principal para trackear eventos.
 * Automáticamente enriquece con contexto de sesión y atribución.
 * 
 * Ejemplo de uso:
 *   trackEvent('recipe_saved', { item_title: 'Tacos', type: 'mexican' });
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  const enrichedParams = {
    ...buildContext(),
    ...params,
  };
  
  if (analyticsReady && analytics) {
    trackEventInternal(eventName, enrichedParams);
  } else {
    eventQueue.push({ eventName, params: enrichedParams });
    if (eventQueue.length > 100) {
      eventQueue.shift();
    }
  }
};

/**
 * Establece el ID de usuario y sus propiedades en Analytics.
 * 
 * @param userId - ID único del usuario (null para logout)
 * @param properties - Propiedades opcionales del usuario (isPremium, dietaryGoals, etc.)
 * 
 * Ejemplo:
 *   setAnalyticsUser(user.uid, { 
 *     account_type: 'premium', 
 *     dietary_goals: 'perder_peso,ganar_musculo' 
 *   });
 */
export const setAnalyticsUser = (userId: string | null, properties?: Record<string, any>) => {
  if (!analytics) return;
  
  if (userId) {
    try {
      setUserId(analytics, userId);
    } catch (e) {
      // Silenciar errores
    }
  }
  
  if (properties) {
    try {
      setUserProperties(analytics, {
        user_id: userId, // útil para reports custom
        ...properties,
      });
    } catch (e) {
      // Silenciar errores
    }
  }
};

/**
 * Establece propiedades del usuario en Analytics.
 * @deprecated Usa setAnalyticsUser(userId, properties) en su lugar.
 */
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
