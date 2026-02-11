import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ============================================
// ⚠️ DEPRECATED: Este archivo ya no se usa
// La implementación está inline en api/recommend.ts
// Se mantiene como referencia pero debe eliminarse en futura refactorización
// ============================================
// RATE LIMITING DISTRIBUIDO CON FIRESTORE
// ============================================

export interface RateLimitConfig {
  // Ventana de tiempo en milisegundos (default: 10 minutos)
  windowMs: number;
  // Máximo de requests por ventana (default: 5)
  maxRequests: number;
  // Cooldown entre requests exitosos (default: 30 segundos)
  cooldownMs: number;
  // Tiempo antes de considerar un proceso como "stuck" (default: 2 minutos)
  stuckThresholdMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  secondsLeft?: number;
  error?: string;
  remainingRequests?: number;
}

interface RateLimitRecord {
  requests: number[]; // Timestamps de requests exitosos
  currentProcess?: {
    startedAt: number;
    interactionId: string;
  };
  updatedAt: FirebaseFirestore.Timestamp;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 10 * 60 * 1000,    // 10 minutos
  maxRequests: 5,               // 5 requests por ventana
  cooldownMs: 30 * 1000,        // 30 segundos entre requests
  stuckThresholdMs: 2 * 60 * 1000, // 2 minutos para cleanup
};

/**
 * Rate Limiter distribuido usando transacciones atómicas de Firestore
 * 
 * Características:
 * - Atómico: Usa transacciones Firestore para evitar race conditions
 * - Escalable: Funciona con múltiples instancias serverless
 * - Eficiente: Una sola lectura/escritura por verificación
 * - Auto-cleanup: Detecta y limpia procesos atascados
 */
export class DistributedRateLimiter {
  private db = getFirestore();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica si un usuario puede hacer una nueva request
   * Usa transacción atómica para garantizar consistencia
   */
  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const counterRef = this.db.collection('rate_limit_v2').doc(userId);
    const now = Date.now();

    try {
      return await this.db.runTransaction<RateLimitResult>(async (t) => {
        const doc = await t.get(counterRef);
        const data = doc.exists ? doc.data() as RateLimitRecord : null;

        // 1. Limpiar procesos atascados (stuck)
        if (data?.currentProcess) {
          const processAge = now - data.currentProcess.startedAt;
          
          if (processAge > this.config.stuckThresholdMs) {
            // Proceso atascado: limpiarlo y permitir nueva request
            console.log(`🧹 Limpiando proceso atascado para ${userId} (${Math.round(processAge / 1000)}s)`);
            
            t.update(counterRef, {
              currentProcess: null,
              'metadata.cleanedAt': FieldValue.serverTimestamp(),
              'metadata.cleanReason': 'stuck_timeout',
            });
            
            // Continuar con la verificación normal...
          } else {
            // Hay un proceso activo válido
            const secondsLeft = Math.ceil((this.config.cooldownMs - (now - data.currentProcess.startedAt)) / 1000);
            return {
              allowed: false,
              secondsLeft: Math.max(1, secondsLeft),
              error: 'Ya estás generando una recomendación. Espera un momento.',
              remainingRequests: 0,
            };
          }
        }

        // 2. Limpiar ventana deslizante de requests antiguos
        const validRequests = data?.requests?.filter(
          (ts) => now - ts < this.config.windowMs
        ) || [];

        // 3. Verificar límite de requests en ventana
        if (validRequests.length >= this.config.maxRequests) {
          const oldestRequest = Math.min(...validRequests);
          const retryAfter = Math.ceil(
            (oldestRequest + this.config.windowMs - now) / 1000
          );

          return {
            allowed: false,
            secondsLeft: Math.max(1, retryAfter),
            error: `Límite de ${this.config.maxRequests} recomendaciones cada ${this.config.windowMs / 60000} minutos. Espera ${retryAfter} segundos.`,
            remainingRequests: 0,
          };
        }

        // 4. Verificar cooldown desde último request exitoso
        if (validRequests.length > 0) {
          const lastRequest = Math.max(...validRequests);
          const timeSinceLastRequest = now - lastRequest;

          if (timeSinceLastRequest < this.config.cooldownMs) {
            const secondsLeft = Math.ceil(
              (this.config.cooldownMs - timeSinceLastRequest) / 1000
            );

            return {
              allowed: false,
              secondsLeft,
              error: `Espera ${secondsLeft} segundos antes de generar otra recomendación.`,
              remainingRequests: this.config.maxRequests - validRequests.length,
            };
          }
        }

        // 5. Registrar inicio de proceso
        const newRecord: Partial<RateLimitRecord> = {
          requests: validRequests,
          currentProcess: {
            startedAt: now,
            interactionId: `proc_${now}`,
          },
          updatedAt: FieldValue.serverTimestamp() as any,
        };

        t.set(counterRef, newRecord, { merge: true });

        return {
          allowed: true,
          remainingRequests: this.config.maxRequests - validRequests.length - 1,
        };
      });
    } catch (error: any) {
      console.error('❌ Error en rate limit transaction:', error);
      // FAIL-CLOSED: Si no podemos verificar rate limit, rechazar por seguridad
      return { 
        allowed: false, 
        error: 'Error de seguridad: no se pudo verificar el límite de uso. Intenta de nuevo en unos momentos.' 
      };
    }
  }

  /**
   * Marca un proceso como completado exitosamente
   * Agrega el timestamp a la lista de requests
   */
  async completeProcess(userId: string): Promise<void> {
    const counterRef = this.db.collection('rate_limit_v2').doc(userId);
    const now = Date.now();

    try {
      await this.db.runTransaction(async (t) => {
        const doc = await t.get(counterRef);
        
        if (!doc.exists) {
          // Crear documento si no existe
          t.set(counterRef, {
            requests: [now],
            currentProcess: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        const data = doc.data() as RateLimitRecord;
        
        // Limpiar ventana y agregar nuevo request
        const validRequests = (data.requests || [])
          .filter((ts) => now - ts < this.config.windowMs)
          .concat(now)
          .slice(-this.config.maxRequests); // Mantener solo los últimos N

        t.update(counterRef, {
          requests: validRequests,
          currentProcess: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('❌ Error marcando proceso como completado:', error);
    }
  }

  /**
   * Marca un proceso como fallido (no cuenta para rate limit)
   * Solo limpia el currentProcess sin agregar timestamp
   */
  async failProcess(userId: string, errorInfo?: string): Promise<void> {
    const counterRef = this.db.collection('rate_limit_v2').doc(userId);

    try {
      await counterRef.update({
        currentProcess: null,
        lastError: {
          message: errorInfo || 'Unknown error',
          at: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error marcando proceso como fallido:', error);
    }
  }

  /**
   * Limpia manualmente todos los rate limits de un usuario
   * Útil para soporte/admin
   */
  async resetUser(userId: string): Promise<void> {
    const counterRef = this.db.collection('rate_limit_v2').doc(userId);
    await counterRef.delete();
  }

  /**
   * Obtiene el estado actual del rate limit para debug/monitoring
   */
  async getStatus(userId: string): Promise<{
    requestsInWindow: number;
    currentProcess?: { startedAt: number; interactionId: string };
    canRequest: boolean;
    nextAvailableAt?: number;
  } | null> {
    const counterRef = this.db.collection('rate_limit_v2').doc(userId);
    const now = Date.now();

    try {
      const doc = await counterRef.get();
      if (!doc.exists) return null;

      const data = doc.data() as RateLimitRecord;
      const validRequests = (data.requests || []).filter(
        (ts) => now - ts < this.config.windowMs
      );

      let nextAvailableAt: number | undefined;

      if (data.currentProcess) {
        nextAvailableAt = data.currentProcess.startedAt + this.config.cooldownMs;
      } else if (validRequests.length >= this.config.maxRequests) {
        const oldestRequest = Math.min(...validRequests);
        nextAvailableAt = oldestRequest + this.config.windowMs;
      } else if (validRequests.length > 0) {
        const lastRequest = Math.max(...validRequests);
        const cooldownEnd = lastRequest + this.config.cooldownMs;
        if (cooldownEnd > now) {
          nextAvailableAt = cooldownEnd;
        }
      }

      return {
        requestsInWindow: validRequests.length,
        currentProcess: data.currentProcess,
        canRequest: !data.currentProcess && validRequests.length < this.config.maxRequests,
        nextAvailableAt,
      };
    } catch (error) {
      console.error('Error obteniendo status:', error);
      return null;
    }
  }
}

// Singleton para uso en la API
export const rateLimiter = new DistributedRateLimiter();

// ============================================
// COMPATIBILIDAD CON CÓDIGO EXISTENTE
// ============================================

/**
 * Función drop-in replacement para el checkRateLimit anterior
 * Mantiene la misma firma para no romper código existente
 */
export async function checkRateLimitLegacy(
  userId: string
): Promise<{ allowed: boolean; secondsLeft?: number; error?: string }> {
  return rateLimiter.checkRateLimit(userId);
}

/**
 * Wrapper para ejecutar una función con rate limiting automático
 * Maneja complete/fail automáticamente
 */
export async function withRateLimit<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string; retryAfter?: number }> {
  const check = await rateLimiter.checkRateLimit(userId);
  
  if (!check.allowed) {
    return {
      success: false,
      error: check.error || 'Rate limit exceeded',
      retryAfter: check.secondsLeft,
    };
  }

  try {
    const result = await fn();
    await rateLimiter.completeProcess(userId);
    return { success: true, data: result };
  } catch (error: any) {
    await rateLimiter.failProcess(userId, error.message);
    throw error; // Re-lanzar para manejo upstream
  }
}
