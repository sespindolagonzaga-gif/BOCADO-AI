/**
 * Sentry Integration - Monitoreo de errores en producción
 * 
 * Configuración:
 * 1. Crear proyecto en https://sentry.io
 * 2. Copiar DSN a VITE_SENTRY_DSN
 * 3. Configurar source maps en build
 */

import * as Sentry from '@sentry/react';
import { env } from '../environment/env';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.MODE || 'development';

// Solo inicializar en producción o si hay DSN configurado
const shouldInitialize = SENTRY_DSN && (ENVIRONMENT === 'production' || ENVIRONMENT === 'staging');

export function initSentry(): void {
  if (!shouldInitialize) {
    console.log('[Sentry] Skipped initialization (development or no DSN)');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    // 10% de transacciones en producción, 100% en desarrollo
    
    // Session Replay (para reproducir errores)
    replaysSessionSampleRate: 0.01, // 1% de sesiones
    replaysOnErrorSampleRate: 1.0,  // 100% de sesiones con error
    
    // Configuración de errores
    beforeSend(event) {
      // Sanitizar datos sensibles antes de enviar
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }
      
      // No enviar errores de extensiones de navegador
      if (event.exception?.values?.[0]?.stacktrace?.frames) {
        const frames = event.exception.values[0].stacktrace.frames;
        const isBrowserExtension = frames.some(frame => 
          frame.filename?.includes('chrome-extension://') ||
          frame.filename?.includes('moz-extension://')
        );
        if (isBrowserExtension) {
          return null;
        }
      }
      
      return event;
    },
    
    // Ignorar errores comunes no críticos
    ignoreErrors: [
      // Errores de navegador/adblocker
      'Non-Error promise rejection captured with value: Object Not Found Matching Id',
      'Request failed with status code 429', // Rate limit, ya lo manejamos
      // Errores de Firebase Auth (manejados por UI)
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      // Errores de red (manejados por React Query)
      'Network Error',
      'Failed to fetch',
    ],
    
    // Tags útiles para filtrar
    initialScope: {
      tags: {
        app: 'bocado-ai',
        version: import.meta.env.VITE_APP_VERSION || 'unknown',
      },
    },
  });

  console.log('[Sentry] Initialized');
}

// Helper para capturar errores manualmente
export function captureError(error: Error, context?: Record<string, any>): void {
  if (!shouldInitialize) {
    console.error('[Sentry] Error (not sent):', error, context);
    return;
  }
  
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper para capturar mensajes
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!shouldInitialize) {
    console.log(`[Sentry] Message (${level}):`, message);
    return;
  }
  
  Sentry.captureMessage(message, level);
}

// Helper para establecer contexto de usuario
export function setUserContext(userId: string | null, email?: string): void {
  if (!shouldInitialize) return;
  
  if (userId) {
    Sentry.setUser({ id: userId, email });
  } else {
    Sentry.setUser(null);
  }
}

// Helper para breadcrumbs (rastro de acciones)
export function addBreadcrumb(
  message: string,
  category?: string,
  level: Sentry.SeverityLevel = 'info'
): void {
  if (!shouldInitialize) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Exportar Sentry para uso directo si es necesario
export { Sentry };
