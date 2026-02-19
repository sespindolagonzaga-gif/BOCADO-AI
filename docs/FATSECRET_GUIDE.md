📱 # GUÍA DE FATSECRET API - Plan Premium Free

## 🎯 Estado Actual

**IMPORTANCIA**: FatSecret está **integrado pero DESHABILITADO por defecto** en BOCADO-AI.

### **Por qué deshabilitado:**
1. **Límites restrictivos del plan gratuito**
2. **Búsquedas paralelas pueden exceder cuota rápidamente**
3. **Base de datos local es suficiente para MVP**

---

## 📊 LÍMITES DEL PLAN PREMIUM FREE

| Métrica | Límite | Actual | Estado |
|---------|--------|--------|--------|
| **Requests/hora** | 100 | ⚠️ Sin monitoreo | ❌ RIESGO |
| **Requests/día** | 3,000 | ⚠️ Sin monitoreo | ❌ RIESGO |
| **Búsquedas paralelas** | ~5-10 óptimo | 5 | ⚠️ LÍMITE |
| **Rate limiting** | Manual (delay 1s) | ❌ No implementado | ❌ CRÍTICO |
| **Cache TTL** | 24h recomendado | 24h | ✅ OK |
| **Token TTL** | ~1h | ~1h - 60s buffer | ✅ OK |

---

## 🔴 PROBLEMAS ENCONTRADOS

### **1. SIN RATE LIMITING DE FATSECRET** 
```typescript
// ❌ ACTUAL: 5 búsquedas paralelas sin control
const searches = searchTerms.map(term => 
  searchFatSecretFoods(token, term, user)  // Todos simultáneos
);

// 💬 IMPACTO
// - 1 usuario = 5 requests
// - 10 usuarios simultáneos = 50 requests / segundo
// - A los ~20 usuarios simultáneos: CRASH (100 req/h excedido)
```

### **2. SIN MONITOREO DE CUOTA**
```typescript
// ❌ No hay tracking de requests consumidas
// ❌ No hay alertas cuando se aproxima el limite
// ❌ Timeout = ban sin aviso
```

### **3. BÚSQUEDAS PARALELAS DESCONTROLADAS**
```typescript
// ❌ RIESGO: Promise.allSettled sin concurrency control
// - Todos los requests se lanzan en paralelo
// - Pérdida de control sobre la tasa
```

### **4. SIN FALLBACK A BD LOCAL**
```typescript
// Si FatSecret falla por límite, app se cae
// ❌ Debería fallar gracefully a BD local
```

---

## ✅ SOLUCIONES IMPLEMENTADAS

### **1. DESHABILITADO POR DEFECTO**
```typescript
// 📁 api/recommend.ts
// importó comentado
// import { getFatSecretIngredientsWithCache } from './utils/fatsecret-logic';

// Así, no hay riesgo accidental
```

### **2. BD LOCAL COMO PRIMARY**
```typescript
// 📁 api/recommend.ts - función getAllIngredientes()
// Layer 1: BD local (ingredients collection) ← PRIMARY
// Layer 2: FatSecret (si está habilitado)
// Layer 3: Fallback básico

// Resultado: Funciona sin FatSecret
```

### **3. FUNCIONES FALTANTES CREADAS**
```typescript
// ✅ getAllIngredientes() - obtiene ingredientes
// ✅ filterIngredientes() - filtra por restricciones usuario
// ✅ Merge conflict resuelto
```

---

## 🚀 HABILITANDO FATSECRET (Cuando valores premium)

### **Paso 1: Obtener credenciales**
```
👤 Crear cuenta en https://platform.fatsecret.com/api/
💳 Upgrade a plan "premium free" (gratuito pero con credenciales)
🔑 Copiar:
   - FATSECRET_KEY (client_id)
   - FATSECRET_SECRET (client_secret)
```

### **Paso 2: Configurar en `.env.local` (backend)**
```bash
FATSECRET_KEY=your_client_id_here
FATSECRET_SECRET=your_client_secret_here
```

### **Paso 3: Habilitar en código**
```typescript
// 📁 api/recommend.ts - line 8
// Cambiar de:
// import { getFatSecretIngredientsWithCache } from './utils/fatsecret-logic';

// A:
import { getFatSecretIngredientsWithCache } from './utils/fatsecret-logic';
```

### **Paso 4: Agregar rate limiting de FatSecret**
```typescript
// 📁 api/utils/rateLimiter.ts - ya existe

export const fatsecretLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100,  // 100 requests/hora (plan premium free)
  keyGenerator: (req) => req.user?.uid || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Límite de búsquedas en FatSecret excedido',
      retryAfter: '1 hora',
      tip: 'Usa ingredientes de tu despensa para no consumir búsquedas'
    });
  }
});
```

---

## 📈 MONITOREO DE CUOTA

### **Script para monitorear uso (Firestore)**
```typescript
// 📁 api/utils/fatsecretMonitoring.ts (CREAR)

interface FatSecretQuotaUsage {
  hour: string; // "2026-02-19T14:00:00Z"
  requestsUsed: number;
  requestsLimit: 100;
  percentUsed: number;
  status: 'ok' | 'warning' | 'critical';
  lastUpdated: Date;
}

export async function trackFatSecretRequest(db: any, count = 1) {
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13) + ':00:00Z';
  const quotaRef = db.collection('fatsecret_quota').doc(hourKey);

  await db.runTransaction(async (t) => {
    const doc = await t.get(quotaRef);
    const current = doc.get('requestsUsed') || 0;
    
    if (current + count > 100) {
      // 🚨 CRÍTICAMENTE CERCA DEL LÍMITE
      throw new Error('FatSecret quota exceeded for this hour');
    }

    t.update(quotaRef, {
      requestsUsed: current + count,
      lastUpdated: now,
    });
  });
}

// Usar en fatsecret-logic.ts:
// await trackFatSecretRequest(db, 5); // Después de búsqueda
```

### **Dashboard (Frontend)**
```typescript
// Ver uso actual en Settings > Advanced > API Usage
// Mostrar:
// - FatSecret: 45/100 requests (esta hora)
// - Google Maps: 23/50 requests (este día)
// - Gemini: ~2000 tokens (este mes)
```

---

## 🎯 MEJORES PRÁCTICAS CON FATSECRET

### **Plan A: NO usar FatSecret (RECOMENDADO para MVP)**
```typescript
// ✅ Mantener como DESHABILITADO
// ✅ Usar BD local (ingredients collection)
// ✅ Usuarios pueden agregar ingredientes manualmente
// ✅ Zero API cost, Zero rate limiting issues
```

### **Plan B: Usar FatSecret PERO con control**
```typescript
// ❌ NO: searches en paralelo sin límite
// ✅ SÍ: Serializar búsquedas con delay 200ms mínimo

// Pseudo-código:
const searches = [];
for (const term of searchTerms) {
  await delay(200); // Esperar 200ms
  searches.push(await searchFatSecretFoods(token, term, user));
}

// ✅ Impacto: Max 5 req/segundo = ~2500 req/hora (dentro del plan)
```

### **Plan C: Usar FatSecret + Caché agresivo**
```typescript
// ✅ Cache de 7 días (no 24h)
// ✅ Cache por usuario + dietapreferences (reutilizar búsquedas)
// ✅ Pre-caché on user signup (popular searches)

// Ejemplo:
function getPopularSearchTerms(language = 'es'): string[] {
  return [
    'pollo proteína', 'arroz integral', 'verduras bajas calorías',
    'frutas', 'legumbres', 'huevo', 'pescado', 'leche desnatada',
    'yogur natural', 'queso fresco', 'aceite de oliva',
  ];
}

// On user signup:
// await searchFatSecretFoods(token, term) para cada término
// → Resultado cacheado en Firestore por 7 días
```

---

## 🔐 SEGURIDAD CON FATSECRET

### **Variables de entorno**
```bash
# ✅ CORRECTO: En .env.local (local git-ignored)
FATSECRET_KEY=xxx
FATSECRET_SECRET=xxx

# ❌ INCORRECTO: En código o .env public
# Nunca exponer en frontend
```

### **Token OAuth**
```typescript
// ✅ Token cacheado en memoria + validación timestamp
let fatSecretToken: { access_token: string; expires_at: number } | null = null;

// ✅ Timeout: 60 segundos antes de expiración
expires_at: Date.now() + (data.expires_in - 60) * 1000
```

---

## 📋 CHECKLIST PARA PRODUCCIÓN

- [ ] Obtener credenciales FatSecret premium free
- [ ] Configurar `FATSECRET_KEY` y `FATSECRET_SECRET` en `.env`
- [ ] Habilitar import en `api/recommend.ts`
- [ ] Implementar `fatsecretLimiter` en rate limiting
- [ ] Crear `fatsecretMonitoring.ts` para tracking
- [ ] Agregar alertas en Sentry si quota > 80%
- [ ] Test: Simular 100+ requests/hora
- [ ] Documentar en `/docs` para equipo
- [ ] Agregar  panel de monitoreo en Admin

---

## 🆘 TROUBLESHOOTING

### **Error: `FatSecret token fetch failed`**
```
❌ CAUSA: Credenciales inválidas o API down
✅ FIX: Verificar FATSECRET_KEY y FATSECRET_SECRET en Vercel env
✅ FIX: Desactivar temporalmente (fallback a BD local)
```

### **Error: `Search failed for "query": 429`**
```
❌ CAUSA: Límite de 100 req/hora excedido
✅ FIX: Implementar serialización de búsquedas
✅ FIX: Aumentar cache TTL a 7 días
```

### **Error: `Timeout en FatSecret search`**
```
❌ CAUSA: FatSecret lento o network issue
✅ FIX: Timeout de 8s es razonable (ya implementado)
✅ FIX: Fallback a BD local después de timeout
```

---

## 📞 RECURSOS

- **FatSecret Platform**: https://platform.fatsecret.com/
- **API Docs**: https://platform.fatsecret.com/api/
- **Rate Limiting Best Practices**: https://stripe.com/blog/rate-limiters
- **Cache Strategy**: https://developers.google.com/web/tools/chrome-devtools/storage/cache

---

## ©️ NOTAS

- ⚠️ Plan premium free tiene **100 req/hora** máximo
- 📊 Monitorear en producción para evitar sorpresas
- 🎯 Recomendación: Usar BD local + FatSecret como enhancement opcional
- 🚀 Si alcanzas límite consistentemente → Upgrade a plan paid ($$$)
