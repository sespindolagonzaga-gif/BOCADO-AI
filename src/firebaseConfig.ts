import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  serverTimestamp // ✅ Añadido para resolver error 2304
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics"; // ✅ Añadido logEvent para error 2552
import { env } from './environment/env';

const app = !getApps().length ? initializeApp(env.firebase) : getApp();

// ✅ CONFIGURACIÓN OFFLINE (Firestore Persistence)
// Solo declaramos 'db' UNA vez (resuelve error 2451)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// ✅ AUTH
// Solo declaramos 'auth' UNA vez (resuelve error 2451)
const auth = getAuth(app);

// ✅ ANALYTICS
let analytics: ReturnType<typeof getAnalytics> | null = null;

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('✅ Analytics inicializado');
    }
  }).catch((err) => {
    console.warn('Analytics no soportado:', err);
  });
}

// Helper para trackear eventos
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
};

export { db, auth, serverTimestamp, analytics };