import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, logEvent, isSupported } from "firebase/analytics"; // ← Nuevo
import { env } from './environment/env';

const app = !getApps().length ? initializeApp(env.firebase) : getApp();

const db = getFirestore(app);
const auth = getAuth(app);

// Analytics (solo si el navegador lo soporta y no hay adblockers)
let analytics: ReturnType<typeof getAnalytics> | null = null;

// Inicializar analytics de forma segura
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

// Helper para trackear eventos de forma segura
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
};

export { db, auth, serverTimestamp, analytics };
