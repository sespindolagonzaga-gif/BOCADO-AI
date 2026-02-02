const getEnvVar = (key: string): string => {
  // En Vite, se usa import.meta.env para acceder a las variables
  const value = import.meta.env[key];
  if (typeof value === 'undefined') {
    // Esto detiene la app si falta una variable, causando la pantalla en blanco
    console.warn(`Missing environment variable: ${key}`);
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
};

const apiConfig = {
  // URL de tu nueva API en Vercel
  recommendationUrl: '/api/recommend',
  // Puedes mantener estas si aún usas servicios externos
  registerUserUrl: getEnvVar('VITE_REGISTER_USER_URL'),
};

export const env = Object.freeze({
  firebase: firebaseConfig,
  api: apiConfig,
});