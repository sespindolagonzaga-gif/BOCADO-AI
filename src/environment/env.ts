import { logger } from '../utils/logger';

const getEnvVar = (key: string): string => {
  const value = import.meta.env[key];
  if (typeof value === 'undefined') {
    logger.warn(`Missing environment variable: ${key}`);
    return ""; 
  }
  return value;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  vapidKey: getEnvVar('VITE_FIREBASE_VAPID_KEY'),
};

const apiConfig = {
  recommendationUrl: '/api/recommend',
  registerUserUrl: getEnvVar('VITE_REGISTER_USER_URL'),
  // ✅ REMOVED: googleMapsApiKey ya no se usa en frontend
  // Las llamadas a Maps ahora van al proxy protegido: /api/maps-proxy
};

// Rango de búsqueda de restaurantes en metros
export const SEARCH_RADIUS = {
  meters: 5000, // 5km por defecto
  label: '5 km',
};

export const env = Object.freeze({
  firebase: firebaseConfig,
  api: apiConfig,
});