# 🏗️ ARQUITECTURA DE FALLBACK Y CACHÉ - BOCADO AI

**Fecha:** 2026-02-15  
**Complemento a:** FINOPS_ANALYSIS.md

---

## 📐 JERARQUÍA DE FALLBACK (3 CAPAS)

### **Principio:** LocalStorage → Memory Cache → Redis → Firestore → LLM

```
FLUJO DE LECTURA (con latencias):
═══════════════════════════════════════════════════════════════

Request → ┌────────────────────────────────────┐
          │  1️⃣ LocalStorage (Frontend)       │ 
          │     Latencia: ~5ms                 │
          │     TTL: 15 minutos                │
          │     Hit Rate: 40%                  │
          └────────────┬───────────────────────┘
                       │ Miss ↓
          ┌────────────────────────────────────┐
          │  2️⃣ Memory Cache (Node.js)        │
          │     Latencia: ~10ms                │
          │     TTL: 10 minutos                │
          │     Hit Rate: 35%                  │
          └────────────┬───────────────────────┘
                       │ Miss ↓
          ┌────────────────────────────────────┐
          │  3️⃣ Redis/Upstash (Edge) [OPCIONAL]│
          │     Latencia: ~50ms                │
          │     TTL: 1 hora                    │
          │     Hit Rate: 20%                  │
          └────────────┬───────────────────────┘
                       │ Miss ↓
          ┌────────────────────────────────────┐
          │  4️⃣ Firestore (Source of Truth)   │
          │     Latencia: ~150ms               │
          │     Always Available                │
          │     Hit Rate: 5%                   │
          └────────────┬───────────────────────┘
                       │
                       ▼
          ┌────────────────────────────────────┐
          │  5️⃣ Gemini LLM (Generación)       │
          │     Latencia: ~2000ms              │
          │     Costo: $0.0093/request         │
          └────────────────────────────────────┘

RESULTADO: 95% de requests evitan Firestore
           100% de requests evitan LLM innecesario
```

---

## 🎯 ESTRATEGIA POR TIPO DE DATO

### **1. USER PROFILE** 👤

**Características:**
- Cambia raramente (1-2 veces/semana)
- Crítico para personalización
- Tamaño: ~2KB

**Jerarquía:**
```typescript
async function getUserProfile(userId: string): Promise<UserProfile> {
  // Layer 1: LocalStorage (Frontend)
  const localCached = localStorage.getItem(`profile_${userId}`);
  if (localCached) {
    const { data, timestamp } = JSON.parse(localCached);
    if (Date.now() - timestamp < 15 * 60 * 1000) {
      return data; // ⚡ 5ms
    }
  }
  
  // Layer 2: Memory Cache (Backend)
  const memoryCached = profileCache.get<UserProfile>(userId);
  if (memoryCached) {
    return memoryCached; // ⚡ 10ms
  }
  
  // Layer 3: Redis (opcional, si >5k usuarios)
  if (redis) {
    const redisCached = await redis.get<UserProfile>(`profile:${userId}`);
    if (redisCached) {
      profileCache.set(userId, redisCached); // Warm up memory
      return redisCached; // ⚡ 50ms
    }
  }
  
  // Layer 4: Firestore (Source of Truth)
  try {
    const snap = await db.collection('users').doc(userId).get();
    const profile = snap.data() as UserProfile;
    
    // Populate all caches (write-through)
    if (redis) await redis.set(`profile:${userId}`, profile, { ex: 3600 });
    profileCache.set(userId, profile);
    
    return profile; // ⚡ 150ms
  } catch (error) {
    logger.error('Failed to fetch profile from Firestore:', error);
    throw error; // No fallback posible aquí
  }
}
```

**Invalidación:**
```typescript
// Cuando usuario actualiza perfil
async function invalidateProfileCache(userId: string) {
  // Invalidar todas las capas
  localStorage.removeItem(`profile_${userId}`);
  profileCache.del(userId);
  if (redis) await redis.del(`profile:${userId}`);
  
  // Event-driven: Notificar otros clientes
  await pubsub.publish('profile_updated', { userId });
}
```

---

### **2. PANTRY ITEMS** 🥕

**Características:**
- Cambia frecuentemente (2-3 veces/semana)
- No crítico si ligeramente desactualizado
- Tamaño: ~1KB

**Jerarquía:**
```typescript
async function getPantryItems(userId: string): Promise<string[]> {
  // Layer 1: LocalStorage (Frontend) - MUY AGRESIVO
  const localCached = localStorage.getItem(`pantry_${userId}`);
  if (localCached) {
    const { data, timestamp } = JSON.parse(localCached);
    if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 min TTL corto
      return data;
    }
  }
  
  // Layer 2: Memory Cache (Backend)
  const memoryCached = pantryCache.get<string[]>(userId);
  if (memoryCached) {
    return memoryCached;
  }
  
  // Layer 3: Firestore
  const snap = await db.collection('user_pantry').doc(userId).get();
  const items = snap.data()?.items || [];
  
  // Populate caches
  pantryCache.set(userId, items, 600); // 10 min TTL
  
  return items;
}
```

**Estrategia defensiva:**
```typescript
// Fallback a array vacío si todo falla
async function getPantrySafe(userId: string): Promise<string[]> {
  try {
    return await getPantryItems(userId);
  } catch (error) {
    logger.warn('Pantry fetch failed, using empty:', error);
    return []; // ✅ Graceful degradation
  }
}
```

---

### **3. RECOMMENDATION HISTORY** 📜

**Características:**
- Cambia cada nueva recomendación
- Usado para evitar repeticiones
- Tamaño: ~500 bytes

**Jerarquía (Pre-procesado en Background):**
```typescript
// Cloud Function: Se ejecuta cada 1 hora
export const updateHistoryCache = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const activeUsers = await getActiveUsers(last7Days);
    
    for (const userId of activeUsers) {
      // Query historial una sola vez
      const historySnap = await db.collection('historial_recetas')
        .where('user_id', '==', userId)
        .limit(10)
        .get();
      
      // Procesar y resumir
      const summary = historySnap.docs
        .map(d => d.data().receta?.recetas?.[0]?.titulo)
        .filter(Boolean)
        .slice(0, 5)
        .join(', ');
      
      // Guardar en cache collection
      await db.collection('history_cache').doc(userId).set({
        summary,
        lastUpdated: FieldValue.serverTimestamp()
      });
    }
  });

// En recommend.ts: Leer cache pre-procesado
async function getHistoryContext(userId: string): Promise<string> {
  // Layer 1: Memory Cache
  const cached = historyCache.get<string>(userId);
  if (cached) return cached;
  
  // Layer 2: Pre-computed Firestore cache
  const cacheSnap = await db.collection('history_cache').doc(userId).get();
  const summary = cacheSnap.data()?.summary || '';
  
  historyCache.set(userId, summary, 3600); // 1 hora
  return summary;
}
```

**Fallback si cache vacío:**
```typescript
// Si cache falla, usar query en vivo (fallback)
if (!summary) {
  const liveSnap = await db.collection('historial_recetas')
    .where('user_id', '==', userId)
    .limit(5)
    .get();
  summary = processHistory(liveSnap.docs);
}
```

---

### **4. AIRTABLE INGREDIENTS** 🗃️

**Características:**
- Datos estáticos (cambian 1-2 veces/mes)
- Muy grande (~500 items)
- Crítico para filtrado

**Jerarquía (Ya implementado ✅):**
```typescript
// Actual: Cache en Firestore con TTL 6 horas
const cacheKey = `airtable_${formulaHash}`;
const cacheSnap = await db.collection('airtable_cache').doc(cacheKey).get();

if (cacheSnap.exists) {
  const cacheData = cacheSnap.data();
  const age = Date.now() - cacheData.timestamp;
  
  if (age < 6 * 60 * 60 * 1000) { // 6 horas
    return cacheData.data; // ✅ Cache hit
  }
}

// Cache miss: Fetch from Airtable
const freshData = await fetchFromAirtable();
await db.collection('airtable_cache').doc(cacheKey).set({
  data: freshData,
  timestamp: Date.now()
});
```

**Mejora propuesta: Aumentar TTL**
```typescript
// De 6 horas → 24 horas (datos cambian raramente)
if (age < 24 * 60 * 60 * 1000) {
  return cacheData.data;
}
```

---

## 🔄 INVALIDACIÓN DE CACHÉ (Event-Driven)

### **Arquitectura:**
```
User Action → Backend Update → Cache Invalidation → Notify Clients
═══════════════════════════════════════════════════════════════════

┌─────────────┐
│   USUARIO   │ Actualiza perfil
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  ProfileScreen.tsx              │
│  - Save profile to Firestore    │
│  - POST /api/invalidate-cache   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  api/invalidate-cache.ts        │
│  1. Clear Memory Cache          │
│  2. Clear Redis Cache           │
│  3. Publish event to PubSub     │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Firebase Cloud Messaging       │
│  - Notify all active clients    │
│  - Force LocalStorage refresh   │
└─────────────────────────────────┘
```

### **Implementación:**

```typescript
// api/invalidate-cache.ts
export default async function handler(req: NextRequest) {
  const { userId, type } = await req.json();
  
  switch(type) {
    case 'profile':
      profileCache.del(userId);
      if (redis) await redis.del(`profile:${userId}`);
      await notifyClients(userId, 'profile_updated');
      break;
      
    case 'pantry':
      pantryCache.del(userId);
      await notifyClients(userId, 'pantry_updated');
      break;
      
    case 'all':
      profileCache.del(userId);
      pantryCache.del(userId);
      historyCache.del(userId);
      if (redis) {
        await redis.del(`profile:${userId}`);
        await redis.del(`pantry:${userId}`);
      }
      await notifyClients(userId, 'cache_invalidated');
      break;
  }
  
  return NextResponse.json({ success: true });
}
```

---

## 🛡️ DEFENSIVE PATTERNS (Post-Crash Fixes)

### **Pattern #1: Timeout en TODAS las capas**
```typescript
async function getCachedWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  fallbackFn: () => Promise<T>
): Promise<T> {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Cache timeout')), timeoutMs)
      )
    ]);
  } catch (error) {
    logger.warn('Cache failed, using fallback:', error);
    return await fallbackFn();
  }
}

// Uso:
const profile = await getCachedWithTimeout(
  () => getCachedProfile(userId),
  2000, // 2s timeout para cache
  () => fetchProfileFromFirestore(userId) // Fallback
);
```

---

### **Pattern #2: Circuit Breaker para Redis**
```typescript
class CacheCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private isOpen = false;
  
  async execute<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    // Si circuit está abierto, usar fallback directo
    if (this.isOpen) {
      if (Date.now() - this.lastFailure > 60000) { // 1 min
        this.isOpen = false;
        this.failures = 0;
      } else {
        return fallback();
      }
    }
    
    try {
      const result = await fn();
      this.failures = 0; // Reset on success
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.failures >= 3) {
        this.isOpen = true; // Abrir circuit
        logger.error('Cache circuit breaker opened');
      }
      
      return fallback();
    }
  }
}

const cacheBreaker = new CacheCircuitBreaker();

// Uso:
const profile = await cacheBreaker.execute(
  () => redis.get(`profile:${userId}`),
  () => fetchProfileFromFirestore(userId)
);
```

---

### **Pattern #3: Validación de Datos de Cache**
```typescript
function validateCachedProfile(data: any): data is UserProfile {
  return (
    data &&
    typeof data === 'object' &&
    'userId' in data &&
    'eatingHabit' in data
  );
}

async function getCachedProfileSafe(userId: string): Promise<UserProfile | null> {
  try {
    const cached = await redis.get(`profile:${userId}`);
    
    // Validar estructura antes de usar
    if (!validateCachedProfile(cached)) {
      logger.warn('Invalid cached profile, refetching:', userId);
      await redis.del(`profile:${userId}`); // Limpiar cache corrupto
      return null;
    }
    
    return cached;
  } catch (error) {
    logger.error('Cache read failed:', error);
    return null;
  }
}
```

---

### **Pattern #4: Graceful Degradation**
```typescript
async function getRecommendation(userId: string, request: RequestBody) {
  let profile: UserProfile;
  let pantry: string[] = [];
  let history: string = '';
  
  // Obtener profile (CRÍTICO - debe funcionar)
  try {
    profile = await getUserProfile(userId);
  } catch (error) {
    throw new Error('Cannot generate recommendation without user profile');
  }
  
  // Obtener pantry (OPCIONAL - graceful degradation)
  try {
    pantry = await getPantryItems(userId);
  } catch (error) {
    logger.warn('Pantry unavailable, continuing without:', error);
    pantry = []; // ✅ Continuar sin pantry
  }
  
  // Obtener history (OPCIONAL - graceful degradation)
  try {
    history = await getHistoryContext(userId);
  } catch (error) {
    logger.warn('History unavailable, continuing without:', error);
    history = ''; // ✅ Continuar sin history
  }
  
  // Generar recomendación con los datos disponibles
  return await generateRecommendation({ profile, pantry, history, request });
}
```

---

## 📊 MONITORING Y OBSERVABILIDAD

### **Métricas Clave a Trackear:**

```typescript
// src/utils/cacheMetrics.ts
interface CacheMetrics {
  layer: 'localStorage' | 'memory' | 'redis' | 'firestore';
  operation: 'get' | 'set' | 'del';
  hit: boolean;
  latencyMs: number;
  userId?: string;
  dataType: 'profile' | 'pantry' | 'history';
}

export function trackCacheMetrics(metrics: CacheMetrics) {
  // Log para analytics
  analytics.track('cache_metrics', metrics);
  
  // Aggregate para dashboard
  if (metrics.hit) {
    cacheHitCounter.inc({ layer: metrics.layer, type: metrics.dataType });
  } else {
    cacheMissCounter.inc({ layer: metrics.layer, type: metrics.dataType });
  }
  
  latencyHistogram.observe(
    { layer: metrics.layer },
    metrics.latencyMs
  );
}
```

### **Dashboard (Vercel Analytics / Firebase):**
```
Cache Performance Dashboard
═══════════════════════════════════════════════

Layer          | Hit Rate | Avg Latency | Errors/hour
───────────────┼──────────┼─────────────┼─────────────
LocalStorage   | 40%      | 5ms         | 0
Memory (Node)  | 35%      | 10ms        | 2
Redis          | 20%      | 50ms        | 5
Firestore      | 5%       | 150ms       | 1

Total Requests: 60,000/day
Cache Effectiveness: 95%
Firestore Reads Saved: 57,000/day
Cost Savings: $0.51/day
```

---

## 🚀 IMPLEMENTACIÓN PASO A PASO

### **Sprint 1: Caché en Memoria (Quick Win)**

**Día 1:**
```typescript
// 1. Instalar node-cache
npm install node-cache

// 2. Crear archivo cache.ts
// api/utils/cache.ts
import NodeCache from 'node-cache';

export const profileCache = new NodeCache({ 
  stdTTL: 600,  // 10 min
  checkperiod: 120,
  useClones: false 
});

export const pantryCache = new NodeCache({ 
  stdTTL: 300,  // 5 min
  checkperiod: 60 
});

export const historyCache = new NodeCache({ 
  stdTTL: 3600  // 1 hora
});
```

**Día 2:**
```typescript
// 3. Integrar en recommend.ts
import { profileCache, pantryCache } from './utils/cache';

async function getUserProfile(userId: string) {
  const cached = profileCache.get<UserProfile>(userId);
  if (cached) return cached;
  
  const snap = await db.collection('users').doc(userId).get();
  const profile = snap.data() as UserProfile;
  profileCache.set(userId, profile);
  return profile;
}
```

**Día 3:**
```typescript
// 4. Agregar invalidación
// api/invalidate-cache.ts
export default async function handler(req: NextRequest) {
  const { userId } = await req.json();
  profileCache.del(userId);
  pantryCache.del(userId);
  return NextResponse.json({ success: true });
}

// 5. Llamar desde ProfileScreen.tsx
await updateProfile(userId, data);
await fetch('/api/invalidate-cache', { 
  method: 'POST',
  body: JSON.stringify({ userId })
});
```

---

### **Sprint 2: LocalStorage Frontend (Quick Win)**

```typescript
// src/hooks/useProfileWithCache.ts
export function useProfileWithCache(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  useEffect(() => {
    // Try LocalStorage first
    const cacheKey = `bocado_profile_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 15 * 60 * 1000) {
        setProfile(data);
        return;
      }
    }
    
    // Fetch from backend
    fetchProfile(userId).then(p => {
      setProfile(p);
      localStorage.setItem(cacheKey, JSON.stringify({
        data: p,
        timestamp: Date.now()
      }));
    });
  }, [userId]);
  
  // Invalidate on update
  const invalidateCache = useCallback(() => {
    localStorage.removeItem(`bocado_profile_${userId}`);
  }, [userId]);
  
  return { profile, invalidateCache };
}
```

---

### **Sprint 3: Redis (Opcional, Solo >5k Usuarios)**

```typescript
// api/utils/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// api/utils/cache.ts (actualizar)
export async function getCachedProfile(userId: string) {
  // Layer 1: Memory
  const memoryCached = profileCache.get<UserProfile>(userId);
  if (memoryCached) return memoryCached;
  
  // Layer 2: Redis
  const redisCached = await redis.get<UserProfile>(`profile:${userId}`);
  if (redisCached) {
    profileCache.set(userId, redisCached);
    return redisCached;
  }
  
  // Layer 3: Firestore
  const profile = await fetchProfileFromFirestore(userId);
  await redis.set(`profile:${userId}`, profile, { ex: 3600 });
  profileCache.set(userId, profile);
  return profile;
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Pre-Deployment:**
- [ ] Tests unitarios para cache hit/miss
- [ ] Tests de invalidación de cache
- [ ] Load testing (simular 1000 requests/min)
- [ ] Timeout tests (simular Redis caído)
- [ ] Circuit breaker tests

### **Post-Deployment:**
- [ ] Monitor cache hit rate (target: >85%)
- [ ] Monitor latencia p50/p95
- [ ] Monitor errores de cache
- [ ] Validar ahorro de costos
- [ ] A/B test calidad de recomendaciones

---

**Fecha creación:** 2026-02-15  
**Autor:** Cloud Architect  
**Versión:** 1.0
