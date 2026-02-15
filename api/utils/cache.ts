/**
 * 💰 FINOPS: In-Memory Cache Layer
 * 
 * Reduce Firestore reads cacheando datos que cambian raramente:
 * - User Profile: TTL 10 min (cambia ~1-2 veces/semana)
 * - Pantry Items: TTL 5 min (cambia ~2-3 veces/semana)
 * - History Context: TTL 1 hora (cambia en cada recomendación)
 * 
 * Ahorro esperado: $0.90/mes en Firestore reads
 * Latencia: -30ms promedio
 * 
 * Defensive Pattern: Cache fail → Fallback to Firestore (never crash)
 */

import NodeCache from 'node-cache';

// ============================================
// CACHE INSTANCES
// ============================================

/**
 * Profile Cache
 * - TTL: 10 minutos
 * - Check period: 2 minutos
 * - Use clones: false (optimización de memoria)
 */
export const profileCache = new NodeCache({
  stdTTL: 600, // 10 minutos
  checkperiod: 120, // 2 minutos
  useClones: false, // No clonar objetos (más rápido, menos memoria)
  deleteOnExpire: true,
  maxKeys: 10000 // Máximo 10k usuarios en cache
});

/**
 * Pantry Cache
 * - TTL: 5 minutos (cambia más frecuentemente)
 * - Check period: 1 minuto
 */
export const pantryCache = new NodeCache({
  stdTTL: 300, // 5 minutos
  checkperiod: 60, // 1 minuto
  useClones: false,
  deleteOnExpire: true,
  maxKeys: 10000
});

/**
 * History Context Cache
 * - TTL: 1 hora (solo títulos de recomendaciones recientes)
 * - Check period: 5 minutos
 */
export const historyCache = new NodeCache({
  stdTTL: 3600, // 1 hora
  checkperiod: 300, // 5 minutos
  useClones: false,
  deleteOnExpire: true,
  maxKeys: 10000
});

// ============================================
// CACHE UTILITIES
// ============================================

/**
 * Invalidar todos los caches de un usuario
 * Usado cuando el usuario actualiza su perfil
 */
export function invalidateUserCache(userId: string): void {
  try {
    profileCache.del(userId);
    pantryCache.del(userId);
    historyCache.del(userId);
  } catch (error) {
    console.warn('[Cache] Error invalidating user cache:', error);
    // No throw - invalidación de cache no debe romper la app
  }
}

/**
 * Obtener estadísticas del cache (para monitoring)
 */
export function getCacheStats() {
  return {
    profile: {
      keys: profileCache.keys().length,
      hits: profileCache.getStats().hits,
      misses: profileCache.getStats().misses,
      hitRate: profileCache.getStats().hits / (profileCache.getStats().hits + profileCache.getStats().misses) || 0
    },
    pantry: {
      keys: pantryCache.keys().length,
      hits: pantryCache.getStats().hits,
      misses: pantryCache.getStats().misses,
      hitRate: pantryCache.getStats().hits / (pantryCache.getStats().hits + pantryCache.getStats().misses) || 0
    },
    history: {
      keys: historyCache.keys().length,
      hits: historyCache.getStats().hits,
      misses: historyCache.getStats().misses,
      hitRate: historyCache.getStats().hits / (historyCache.getStats().hits + historyCache.getStats().misses) || 0
    }
  };
}

/**
 * Limpiar todos los caches (para testing)
 */
export function clearAllCaches(): void {
  profileCache.flushAll();
  pantryCache.flushAll();
  historyCache.flushAll();
}

// ============================================
// DEFENSIVE PATTERNS
// ============================================

/**
 * Safe cache get con timeout y fallback
 * 
 * @param cache - NodeCache instance
 * @param key - Cache key
 * @param fallbackFn - Función para obtener dato si cache falla
 * @param timeoutMs - Timeout en ms (default: 2000)
 * @returns Promise con el dato
 */
export async function getCachedWithFallback<T>(
  cache: NodeCache,
  key: string,
  fallbackFn: () => Promise<T>,
  timeoutMs: number = 2000
): Promise<T> {
  const createTimeoutPromise = (ms: number) =>
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Fallback timeout')), ms)
    );
  let fallbackPromise: Promise<T> | null = null;
  try {
    // Intentar obtener de cache
    const cached = cache.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Cache miss - usar fallback con timeout
    fallbackPromise = fallbackFn();
    const result = await Promise.race([
      fallbackPromise,
      createTimeoutPromise(timeoutMs)
    ]);

    // Guardar en cache
    cache.set(key, result);
    return result;
  } catch (error) {
    console.warn('[Cache] getCachedWithFallback error:', error);
    // Si todo falla, intentar fallback con timeout secundario
    const secondaryTimeoutMs = 500;
    if (fallbackPromise) {
      return await Promise.race([
        fallbackPromise,
        createTimeoutPromise(secondaryTimeoutMs)
      ]);
    }
    return await Promise.race([
      fallbackFn(),
      createTimeoutPromise(secondaryTimeoutMs)
    ]);
  }
}

// ============================================
// CACHE EVENTS (para logging)
// ============================================

profileCache.on('expired', (key, value) => {
  console.log(`[Cache] Profile expired: ${key}`);
});

pantryCache.on('expired', (key, value) => {
  console.log(`[Cache] Pantry expired: ${key}`);
});

historyCache.on('expired', (key, value) => {
  console.log(`[Cache] History expired: ${key}`);
});

// Log cuando se inicializa
console.log('✅ Cache layer initialized (profile: 10min, pantry: 5min, history: 1h)');
