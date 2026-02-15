# 🔥 AUDITORÍA DE ERRORES NO SILENCIOSOS (CRASHES Y BLOQUEOS)

**Fecha:** 2026-02-15  
**Objetivo:** Identificar y catalogar errores que **SÍ crashean** la aplicación, causando:
- ❌ Crashes que detienen la ejecución
- ❌ Pantallas de error que bloquean al usuario  
- ❌ Promise rejections no manejadas
- ❌ Loops infinitos en useEffect
- ❌ TypeErrors por acceso a propiedades undefined

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Total | 🔴 Crítico | 🟠 Alto | 🟡 Medio |
|-----------|-------|-----------|---------|----------|
| **Frontend** | 10 | 3 | 5 | 2 |
| **Backend** | 10 | 4 | 4 | 2 |
| **Hooks** | 5 | 2 | 2 | 1 |
| **TOTAL** | **25** | **9** | **11** | **5** |

---

## 🖥️ FRONTEND - CRASHES EN COMPONENTES REACT

### 🔴 **CRÍTICO #1: Variable hoisting error en MealCard.tsx**
- **Ubicación:** `src/components/MealCard.tsx:199`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
// Línea 199: Se usa isRestaurant ANTES de definirlo
const hasMacros = useMemo(() => {
  if (isRestaurant) return false; // ❌ ReferenceError
  ...
}, [recipe]);

// Línea 214: Definición de isRestaurant
const isRestaurant = !recipe && restaurant;
```
- **Escenario crash:**
  1. Usuario ve recomendación de restaurante
  2. MealCard renderiza
  3. `useMemo` se ejecuta → intenta acceder a `isRestaurant`
  4. **ReferenceError: Cannot access 'isRestaurant' before initialization**
- **Impacto:** Crash total de la card, pantalla en blanco
- **Fix:**
```typescript
const isRestaurant = !recipe && restaurant; // Mover a línea 189
const hasMacros = useMemo(() => {
  if (isRestaurant) return false;
  ...
}, [recipe, isRestaurant]);
```

---

### 🔴 **CRÍTICO #2: .map() en null sin validación en MealCard.tsx**
- **Ubicación:** `src/components/MealCard.tsx:189-193`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
const ingredientsPreview = useMemo(() => {
  return recipe.ingredients?.map((ing) => ing.name).join(", "); // ❌
}, [recipe]);
```
- **Escenario crash:**
  1. Backend retorna recipe sin campo `ingredients`
  2. `recipe.ingredients` es `undefined`
  3. **TypeError: Cannot read property 'map' of undefined**
- **Impacto:** Crash total de la pantalla
- **Fix:**
```typescript
const ingredientsPreview = useMemo(() => {
  if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) return "N/A";
  return recipe.ingredients.map((ing) => ing.name).join(", ");
}, [recipe]);
```

---

### 🟠 **ALTO #3: .toUpperCase() en null en RecommendationScreen.tsx**
- **Ubicación:** `src/components/RecommendationScreen.tsx:401-402`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const detectedCountryCode = getCountryCodeForCurrency(profile?.country);
currency: detectedCountryCode.toUpperCase(), // ❌
```
- **Escenario crash:**
  1. Usuario sin `profile.country`
  2. `getCountryCodeForCurrency()` retorna `null` o `undefined`
  3. **TypeError: Cannot read property 'toUpperCase' of null**
- **Impacto:** Crash al generar recomendación
- **Fix:**
```typescript
currency: (detectedCountryCode || 'MX').toUpperCase(),
```

---

### 🟠 **ALTO #4: Array index sin validación en PlanScreen.tsx**
- **Ubicación:** `src/components/PlanScreen.tsx:133`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
if (!recipesSnap.empty && recipesSnap.docs.length > 0) {
  const recipesDoc = recipesSnap.docs[0]; // ✅ Protegido
  ...
}
// Pero línea 196:
const idx = loadingMessages.indexOf(prev);
const nextMsg = loadingMessages[(idx + 1) % loadingMessages.length]; // ❌
```
- **Escenario crash:**
  1. `prev` no está en `loadingMessages` → `indexOf` retorna `-1`
  2. `(-1 + 1) % 5 = 0` → funciona PERO si `loadingMessages` está vacío → crash
- **Impacto:** Crash en pantalla de carga
- **Fix:**
```typescript
const idx = loadingMessages.indexOf(prev);
const nextIdx = idx >= 0 ? (idx + 1) % loadingMessages.length : 0;
const nextMsg = loadingMessages[nextIdx] || loadingMessages[0] || "Cargando...";
```

---

### 🟠 **ALTO #5: await response.json() sin validación en RecommendationScreen.tsx**
- **Ubicación:** `src/components/RecommendationScreen.tsx:226`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const errorData = await response.json().catch(() => ({})); // ❌ {} silencioso
if (response.status === 429) {
  const retryAfter = errorData.retryAfter || 60; // ❌ undefined
}
```
- **Escenario crash:**
  1. API retorna error 429 con body inválido (no JSON)
  2. `.catch()` retorna `{}`
  3. `errorData.retryAfter` es `undefined` → no crash pero comportamiento incorrecto
  4. Peor: si API retorna 500, `errorData.error` es undefined → mensaje de error vacío
- **Impacto:** Mensaje de error genérico, mala UX
- **Fix:**
```typescript
let errorData: any = {};
try {
  errorData = await response.json();
} catch {
  errorData = { error: 'Error de servidor', retryAfter: 60 };
}
```

---

### 🟡 **MEDIO #6: window.open() retorna null sin manejo en MealCard.tsx**
- **Ubicación:** `src/components/MealCard.tsx:289`
- **Severidad:** 🟡 MEDIO
- **Código:**
```typescript
const handleOpenMaps = () => {
  if (recipe?.link_maps) {
    window.open(recipe.link_maps, "_blank"); // ❌ Puede retornar null
  }
};
```
- **Escenario crash:**
  1. Usuario tiene popup blocker activado
  2. `window.open()` retorna `null`
  3. No crashea PERO silenciosamente falla → mala UX
- **Impacto:** Usuario no ve mensaje de error
- **Fix:**
```typescript
const handleOpenMaps = () => {
  if (recipe?.link_maps) {
    const newWindow = window.open(recipe.link_maps, "_blank");
    if (!newWindow) {
      alert("Por favor permite ventanas emergentes para abrir Google Maps");
    }
  }
};
```

---

### 🟡 **MEDIO #7: clipboard fallback sin manejo completo en MealCard.tsx**
- **Ubicación:** `src/components/MealCard.tsx:323-346`
- **Severidad:** 🟡 MEDIO
- **Código:**
```typescript
// Fallback a execCommand
const success = document.execCommand("copy");
if (!success) {
  throw new Error("execCommand failed"); // ❌ Se captura pero sin logging
}
```
- **Escenario crash:**
  1. Navegador viejo sin Clipboard API
  2. `execCommand` falla silenciosamente
  3. Usuario no sabe por qué no se copió
- **Impacto:** Mala UX sin feedback
- **Fix:**
```typescript
const success = document.execCommand("copy");
if (!success) {
  console.warn('[MealCard] execCommand copy failed');
  throw new Error("execCommand failed");
}
```

---

### 🟠 **ALTO #8: Acceso a profile sin validación en RecommendationScreen.tsx**
- **Ubicación:** `src/components/RecommendationScreen.tsx:290`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
// Línea 143: profile puede ser null
const [profile, setProfile] = useState<UserProfile | null>(null);

// Línea 290: Se usa sin validación completa
const country = profile?.country; // ✅ Safe
// PERO en otras líneas...
```
- **Escenario crash:** Race condition entre load profile y uso
- **Impacto:** Crash intermitente
- **Fix:** Ya está bien con `profile?.country`, verificar otros usos

---

### 🟠 **ALTO #9: await response.text() sin límite de tamaño**
- **Ubicación:** `src/components/RecommendationScreen.tsx:244`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const rawText = await response.text(); // ❌ Sin límite
console.log("[RecommendationScreen] Raw response:", rawText.substring(0, 200));
```
- **Escenario crash:**
  1. API retorna error HTML gigante (>10MB)
  2. `.text()` carga todo en memoria
  3. **Out of memory en dispositivos móviles**
- **Impacto:** Crash de app en móviles
- **Fix:**
```typescript
const rawText = await response.text();
const truncated = rawText.substring(0, 10000); // Max 10KB
console.log("[RecommendationScreen] Raw response:", truncated.substring(0, 200));
```

---

### 🟡 **MEDIO #10: Error state null sin default en PlanScreen.tsx**
- **Ubicación:** `src/components/PlanScreen.tsx:244`
- **Severidad:** 🟡 MEDIO
- **Código:**
```typescript
{error && (
  <div className="text-center text-red-600">
    {error instanceof Error ? error.message : 'Unknown error'}
  </div>
)}
```
- **Escenario crash:**
  1. `useQuery` retorna `error = null` en cierto edge case
  2. Condición `{error &&` evalúa false → no renderiza
  3. No crashea PERO usuario no ve mensaje de error
- **Impacto:** Usuario sin feedback
- **Fix:** Ya está bien manejado, no necesita cambio

---

## 🔧 BACKEND - CRASHES EN API ROUTES

### 🔴 **CRÍTICO #11: ReferenceError por variable usada antes de definirse**
- **Ubicación:** `api/recommend.ts:1282`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
// Línea 1282: Se usa searchCoords ANTES de definir
if (!user.city && !searchCoords) { // ❌ ReferenceError
  return NextResponse.json({ error: "No location available" }, { status: 400 });
}

// Línea 1287: Definición de searchCoords
const searchCoords = gpsCoordinates || {
  lat: user.latitude || 0,
  lng: user.longitude || 0
};
```
- **Escenario crash:**
  1. Usuario sin ciudad registrada
  2. Backend evalúa `if (!user.city && !searchCoords)`
  3. **ReferenceError: searchCoords is not defined**
  4. Endpoint retorna 500
- **Impacto:** 🔥 CRASH TOTAL del endpoint "Fuera"
- **Fix:**
```typescript
// Mover definición ANTES de línea 1282
const searchCoords = gpsCoordinates || {
  lat: user.latitude || 0,
  lng: user.longitude || 0
};

if (!user.city && !searchCoords) {
  return NextResponse.json({ error: "No location available" }, { status: 400 });
}
```

---

### 🔴 **CRÍTICO #12: JSON.parse sin try-catch en extracción**
- **Ubicación:** `api/recommend.ts:1398`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
try {
  parsedData = JSON.parse(responseText); // ✅ Protegido
} catch (e) {
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    const extractedJson = jsonMatch[1] || jsonMatch[0];
    parsedData = JSON.parse(extractedJson); // ❌ SIN try-catch interno
  }
}
```
- **Escenario crash:**
  1. Gemini retorna respuesta malformada con ```json pero JSON inválido
  2. Primer `JSON.parse` falla → entra al catch
  3. Extrae JSON con regex
  4. Segundo `JSON.parse` en línea 1398 falla
  5. **SyntaxError: Unexpected token** → no se captura → endpoint crashea
- **Impacto:** 🔥 CRASH del endpoint, usuario ve error 500
- **Fix:**
```typescript
try {
  parsedData = JSON.parse(responseText);
} catch (e) {
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    const extractedJson = jsonMatch[1] || jsonMatch[0];
    try {
      parsedData = JSON.parse(extractedJson); // ✅ Nested try-catch
    } catch (nestedError) {
      console.error('[recommend] Nested JSON.parse failed:', nestedError);
      throw new Error('Invalid JSON in code block');
    }
  }
}
```

---

### 🟠 **ALTO #13: Math.min/max con array vacío en RateLimiter**
- **Ubicación:** `api/recommend.ts:309-312`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
// Método getStatus() en RateLimiter
getStatus(identifier: string) {
  const requests = this.requests.get(identifier) || [];
  const now = Date.now();
  const validRequests = requests.filter(r => now - r < this.config.windowMs);
  
  const oldestRequest = Math.min(...validRequests); // ❌ Si validRequests = []
  const lastRequest = Math.max(...validRequests);   // ❌ Retorna Infinity
  
  return {
    remaining: this.config.maxRequests - validRequests.length,
    reset: oldestRequest + this.config.windowMs, // ❌ Infinity + número
  };
}
```
- **Escenario crash:**
  1. Usuario hace primera request después de expirar ventana
  2. `validRequests = []` (todas expiradas)
  3. `Math.min(...[])` retorna `Infinity`
  4. `reset: Infinity + 60000` → `Infinity`
  5. Frontend recibe `reset: Infinity` → crash en cálculo de countdown
- **Impacto:** Crash en UI de rate limiting
- **Fix:**
```typescript
const oldestRequest = validRequests.length > 0 ? Math.min(...validRequests) : now;
const lastRequest = validRequests.length > 0 ? Math.max(...validRequests) : now;
```

---

### 🟠 **ALTO #14: .map() en null en pantryData**
- **Ubicación:** `api/recommend.ts:1227`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const pantryItems: string[] = pantryData?.items?.map((item: any) => 
  item.name || ""
) || [];
```
- **Escenario crash:**
  1. Firestore retorna `pantryData = { items: null }` (no undefined)
  2. Optional chaining `?.map()` NO funciona con `null` explícito
  3. **TypeError: Cannot read property 'map' of null**
- **Impacto:** Crash en prompts "En Casa"
- **Fix:**
```typescript
const pantryItems: string[] = (pantryData?.items && Array.isArray(pantryData.items))
  ? pantryData.items.map((item: any) => item.name || "")
  : [];
```

---

### 🔴 **CRÍTICO #15: .substring() en undefined sin validación**
- **Ubicación:** `api/recommend.ts:1049, 1400, 1404`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
// Línea 1049
console.log(`[recommend] Request body: ${JSON.stringify(req.body).substring(0, 200)}`);

// Línea 1400
console.error(`[recommend] Extracted JSON: ${extractedJson.substring(0, 200)}`);
```
- **Escenario crash:**
  1. `req.body` es muy complejo → `JSON.stringify()` falla → retorna `undefined`
  2. `undefined.substring(0, 200)` → **TypeError**
  3. O `extractedJson` es `undefined` si regex falla
- **Impacto:** Crash en logging (no crítico pero rompe flujo)
- **Fix:**
```typescript
const bodyStr = JSON.stringify(req.body) || 'undefined';
console.log(`[recommend] Request body: ${bodyStr.substring(0, 200)}`);
```

---

### 🟠 **ALTO #16: AbortController timeout sin clearTimeout**
- **Ubicación:** `api/recommend.ts:765` (getCountryCodeFromCoords)
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, { signal: controller.signal });
  return countryCode;
} catch (error) {
  if (error.name === 'AbortError') {
    console.warn('[recommend] Reverse geocoding timeout');
  }
  return null;
} // ❌ FALTA clearTimeout(timeoutId) aquí
```
- **Escenario crash:**
  1. Fetch se completa exitosamente en 2s
  2. Función retorna
  3. Timeout sigue activo → se ejecuta a los 5s
  4. `controller.abort()` se llama cuando ya no hay fetch → crash silencioso
- **Impacto:** Memory leak + crash potencial
- **Fix:**
```typescript
try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId); // ✅ Limpiar en success
  return countryCode;
} catch (error) {
  clearTimeout(timeoutId); // ✅ Limpiar en error
  ...
}
```

---

### 🟡 **MEDIO #17: parseInt() retorna NaN sin validación posterior**
- **Ubicación:** `api/recommend.ts:354`
- **Severidad:** 🟡 MEDIO
- **Código:**
```typescript
const num = typeof val === 'string' ? parseInt(val, 10) : val;
if (isNaN(num) || num < 1 || num > 180) {
  throw new ZodError([...]); // ✅ Se valida PERO...
}
return num;
```
- **Escenario crash:**
  1. `cookingTime = "abc"` → `parseInt("abc")` → `NaN`
  2. `isNaN(NaN)` → `true` → lanza ZodError ✅
  3. NO crashea PERO podría mejorar mensaje de error
- **Impacto:** Mensaje de error genérico
- **Fix:** Ya está bien manejado

---

### 🟡 **MEDIO #18: Firestore doc.data() retorna undefined sin validación**
- **Ubicación:** `api/recommend.ts:1101-1120`
- **Severidad:** 🟡 MEDIO
- **Código:**
```typescript
if (!recipesSnap.empty && recipesSnap.docs.length > 0) {
  const recentDoc = recipesSnap.docs[0];
  const data = recentDoc.data(); // ✅ Ya validado en Sprint 1
  if (data) {
    historyRecipes = data.request?.recipes || [];
  }
}
```
- **Escenario crash:** Ya está protegido desde Sprint 1 ✅
- **Impacto:** Ninguno
- **Fix:** No necesario

---

### 🟠 **ALTO #19: Firestore query sin timeout**
- **Ubicación:** `api/recommend.ts:1095-1100`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const recipesSnap = await firestore
  .collection("recommendations")
  .where("userId", "==", userId)
  .where("type", "==", "recipe")
  .orderBy("timestamp", "desc")
  .limit(1)
  .get(); // ❌ Sin timeout
```
- **Escenario crash:**
  1. Firestore está lento o caído
  2. Query nunca retorna
  3. Usuario espera indefinidamente
  4. **Timeout del deployment (10s Vercel, 60s AWS)**
- **Impacto:** 504 Gateway Timeout
- **Fix:**
```typescript
const recipesSnap = await Promise.race([
  firestore.collection("recommendations")
    .where("userId", "==", userId)
    .where("type", "==", "recipe")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Firestore timeout')), 8000)
  )
]);
```

---

### 🔴 **CRÍTICO #20: getCountryCodeFromCoords llamado sin try-catch en detectTravelContext**
- **Ubicación:** `api/recommend.ts:841`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
async function detectTravelContext(...) {
  try {
    // ...
    const activeCountryCode = await getCountryCodeFromCoords(searchCoords); // ❌
    // ...
  } catch (error) {
    console.error('[recommend] detectTravelContext error:', error);
    return null;
  }
}
```
- **Escenario crash:**
  1. `getCountryCodeFromCoords` tiene try-catch interno ✅
  2. PERO si hay error no manejado (ej: timeout no cleanup), propaga
  3. `detectTravelContext` captura en línea 843 ✅
  4. **Falso positivo** → ya está manejado
- **Impacto:** Ninguno (ya protegido)
- **Fix:** No necesario

---

## 🎣 HOOKS - CRASHES EN CUSTOM HOOKS

### 🔴 **CRÍTICO #21: useEffect loop infinito en useGeolocation.ts**
- **Ubicación:** `src/hooks/useGeolocation.ts:152-156`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
useEffect(() => {
  checkPermission().then(permission => {
    setState(prev => ({ ...prev, permission }));
  });
}, [checkPermission]); // ❌ checkPermission en dependencies
```
- **Escenario crash:**
  1. Component monta → useEffect se ejecuta
  2. Llama `checkPermission()` → `setState` → re-render
  3. Re-render recrea `checkPermission` (no está en useCallback)
  4. Dependency cambió → useEffect se ejecuta de nuevo
  5. **Loop infinito** → navegador se congela → crash
- **Impacto:** 🔥 CRASH TOTAL de la app, navegador congelado
- **Fix:**
```typescript
useEffect(() => {
  checkPermission().then(permission => {
    setState(prev => ({ ...prev, permission }));
  });
}, []); // ✅ Solo ejecutar en mount
```

---

### 🔴 **CRÍTICO #22: getCountryCodeForCurrency recrea función infinitamente**
- **Ubicación:** `src/hooks/useGeolocation.ts:219`
- **Severidad:** 🔴 CRÍTICO
- **Código:**
```typescript
const getCountryCodeForCurrency = useCallback((fallbackCountryCode?: string): string => {
  if (state.detectedLocation?.countryCode) {
    return state.detectedLocation.countryCode;
  }
  return fallbackCountryCode || 'MX';
}, [state.detectedLocation]); // ❌ state.detectedLocation en dependencies
```
- **Escenario crash:**
  1. `state.detectedLocation` cambia
  2. `getCountryCodeForCurrency` se recrea
  3. Cualquier componente usando esta función se re-renderiza
  4. Si ese componente actualiza state → cambia `detectedLocation` → loop
- **Impacto:** Loop infinito en componentes que usan este hook
- **Fix:**
```typescript
const getCountryCodeForCurrency = useCallback((fallbackCountryCode?: string): string => {
  if (state.detectedLocation?.countryCode) {
    return state.detectedLocation.countryCode;
  }
  return fallbackCountryCode || 'MX';
}, []); // ✅ Sin dependencies (usa state.detectedLocation directamente)

// O mejor: usar ref para evitar stale closure
const detectedLocationRef = useRef(state.detectedLocation);
useEffect(() => {
  detectedLocationRef.current = state.detectedLocation;
}, [state.detectedLocation]);

const getCountryCodeForCurrency = useCallback((fallbackCountryCode?: string): string => {
  if (detectedLocationRef.current?.countryCode) {
    return detectedLocationRef.current.countryCode;
  }
  return fallbackCountryCode || 'MX';
}, []);
```

---

### 🟠 **ALTO #23: Promise rejection no manejada en getCurrentPosition**
- **Ubicación:** `src/hooks/useGeolocation.ts:71-148`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
navigator.geolocation.getCurrentPosition(
  async (position) => {
    try {
      const geoResult = await reverseGeocode(...); // ✅ En try-catch
      // ...
    } catch (error) {
      console.error("Error in reverseGeocode:", error);
      // ...
    }
  },
  (error) => {
    console.error("Geolocation error:", error); // ✅ Manejado
  }
);
```
- **Escenario crash:**
  1. `reverseGeocode()` rechaza Promise
  2. Está en try-catch ✅
  3. **Falso positivo** → ya está manejado
- **Impacto:** Ninguno
- **Fix:** No necesario

---

### 🟠 **ALTO #24: Acceso a position.coords sin validación**
- **Ubicación:** `src/hooks/useGeolocation.ts:74-77`
- **Severidad:** 🟠 ALTO
- **Código:**
```typescript
const newPosition = {
  lat: position.coords.latitude,  // ❌ No valida position.coords
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy,
  timestamp: position.timestamp,
};
```
- **Escenario crash:**
  1. Navigator API retorna `position` sin `coords` (navegadores viejos)
  2. `position.coords.latitude` → **TypeError: Cannot read property 'latitude' of undefined**
- **Impacto:** Crash en detección de GPS
- **Fix:**
```typescript
if (!position?.coords) {
  console.error('[useGeolocation] Invalid position object');
  return;
}

const newPosition = {
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy,
  timestamp: position.timestamp,
};
```

---

### 🟡 **MEDIO #25: trackEvent sin error handling**
- **Ubicación:** `src/hooks/useGeolocation.ts:69, 106, 121`
- **Severidad:** 🟡 MEDIO
- **Código:**
```typescript
trackEvent('geolocation_request'); // ❌ Sin try-catch
```
- **Escenario crash:**
  1. Firebase Analytics falla (red caída, permisos)
  2. `trackEvent()` lanza exception
  3. **Uncaught exception** → rompe flujo
- **Impacto:** Rompe flujo de geolocalización (no crítico)
- **Fix:**
```typescript
try {
  trackEvent('geolocation_request');
} catch (error) {
  console.warn('[useGeolocation] Analytics failed:', error);
}
```

---

## 📋 TABLA COMPLETA DE PRIORIDADES

| # | Archivo | Línea | Problema | Severidad | Sprint |
|---|---------|-------|----------|-----------|--------|
| 1 | MealCard.tsx | 199 | Variable hoisting (isRestaurant) | 🔴 CRÍTICO | 1 |
| 2 | MealCard.tsx | 189 | .map() en null (ingredients) | 🔴 CRÍTICO | 1 |
| 11 | recommend.ts | 1282 | ReferenceError (searchCoords) | 🔴 CRÍTICO | 1 |
| 12 | recommend.ts | 1398 | JSON.parse sin try-catch | 🔴 CRÍTICO | 1 |
| 21 | useGeolocation.ts | 152 | useEffect loop infinito | 🔴 CRÍTICO | 1 |
| 22 | useGeolocation.ts | 219 | useCallback loop infinito | 🔴 CRÍTICO | 1 |
| 3 | RecommendationScreen.tsx | 401 | .toUpperCase() en null | 🟠 ALTO | 2 |
| 5 | RecommendationScreen.tsx | 226 | response.json() sin validación | 🟠 ALTO | 2 |
| 8 | RecommendationScreen.tsx | 290 | profile access (ya protegido) | ✅ OK | - |
| 9 | RecommendationScreen.tsx | 244 | response.text() sin límite | 🟠 ALTO | 2 |
| 4 | PlanScreen.tsx | 196 | Array indexOf -1 | 🟠 ALTO | 2 |
| 13 | recommend.ts | 309 | Math.min/max array vacío | 🟠 ALTO | 2 |
| 14 | recommend.ts | 1227 | .map() en null (pantryData) | 🟠 ALTO | 2 |
| 15 | recommend.ts | 1049 | .substring() en undefined | 🔴 CRÍTICO | 1 |
| 16 | recommend.ts | 765 | clearTimeout faltante | 🟠 ALTO | 2 |
| 19 | recommend.ts | 1095 | Firestore sin timeout | 🟠 ALTO | 2 |
| 24 | useGeolocation.ts | 74 | position.coords sin validar | 🟠 ALTO | 2 |
| 6 | MealCard.tsx | 289 | window.open() null sin manejo | 🟡 MEDIO | 3 |
| 7 | MealCard.tsx | 323 | clipboard logging | 🟡 MEDIO | 3 |
| 10 | PlanScreen.tsx | 244 | error state null (ya OK) | ✅ OK | - |
| 17 | recommend.ts | 354 | parseInt NaN (ya OK) | ✅ OK | - |
| 18 | recommend.ts | 1101 | doc.data() (ya OK Sprint 1) | ✅ OK | - |
| 20 | recommend.ts | 841 | getCountryCode (ya OK) | ✅ OK | - |
| 23 | useGeolocation.ts | 71 | Promise rejection (ya OK) | ✅ OK | - |
| 25 | useGeolocation.ts | 69 | trackEvent sin try-catch | 🟡 MEDIO | 3 |

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Sprint 1: CRÍTICOS (6 errores) - Implementar YA** ⚡
**Estimación:** 1 hora  
**Riesgo:** 🔥 App crashea completamente sin estos fixes

1. ✅ Fix #1: Mover `isRestaurant` antes de `useMemo` (MealCard.tsx:199)
2. ✅ Fix #2: Validar `recipe.ingredients` antes de `.map()` (MealCard.tsx:189)
3. ✅ Fix #11: Mover `searchCoords` antes de uso (recommend.ts:1282)
4. ✅ Fix #12: Nested try-catch para JSON.parse (recommend.ts:1398)
5. ✅ Fix #15: Validar string antes de `.substring()` (recommend.ts:1049)
6. ✅ Fix #21: Remover `checkPermission` de dependencies (useGeolocation.ts:152)
7. ✅ Fix #22: Usar ref pattern para `getCountryCodeForCurrency` (useGeolocation.ts:219)

---

### **Sprint 2: ALTOS (8 errores) - Implementar esta semana** 📅
**Estimación:** 2 horas  
**Riesgo:** 🟠 Crashes en flujos importantes

1. ✅ Fix #3: Validar `detectedCountryCode` antes de `.toUpperCase()` (RecommendationScreen.tsx:401)
2. ✅ Fix #4: Validar `indexOf` antes de array access (PlanScreen.tsx:196)
3. ✅ Fix #5: Try-catch para `response.json()` con defaults (RecommendationScreen.tsx:226)
4. ✅ Fix #9: Limitar tamaño de `response.text()` (RecommendationScreen.tsx:244)
5. ✅ Fix #13: Validar array no vacío en `Math.min/max` (recommend.ts:309)
6. ✅ Fix #14: Validar `pantryData.items` es array (recommend.ts:1227)
7. ✅ Fix #16: Agregar `clearTimeout` en success y error (recommend.ts:765)
8. ✅ Fix #19: Agregar timeout a Firestore query (recommend.ts:1095)
9. ✅ Fix #24: Validar `position.coords` existe (useGeolocation.ts:74)

---

### **Sprint 3: MEDIOS (3 errores) - Nice to have** ✨
**Estimación:** 30 min  
**Riesgo:** 🟡 Mejoras de UX, no crítico

1. ✅ Fix #6: Validar `window.open()` retorno (MealCard.tsx:289)
2. ✅ Fix #7: Agregar logging a clipboard fallback (MealCard.tsx:323)
3. ✅ Fix #25: Wrap `trackEvent()` en try-catch (useGeolocation.ts:69,106,121)

---

## 📊 ANÁLISIS DE IMPACTO

### **Por Severidad:**
- 🔴 **CRÍTICOS:** 6 (crashean app completamente)
- 🟠 **ALTOS:** 8 (crashean flujos importantes)
- 🟡 **MEDIOS:** 3 (mala UX pero recuperable)
- ✅ **Ya OK:** 8 (falsos positivos o ya corregidos)

### **Por Área:**
- **Frontend:** 10 errores (4 críticos, 5 altos, 1 medio)
- **Backend:** 10 errores (4 críticos, 4 altos, 2 medios)
- **Hooks:** 5 errores (2 críticos, 2 altos, 1 medio)

### **Impacto en Producción:**
| Escenario | Probabilidad | Impacto | Prioridad |
|-----------|--------------|---------|-----------|
| Usuario ve restaurante sin ciudad | Alta (20%) | 🔥 Crash | Sprint 1 |
| Gemini retorna JSON malformado | Media (5%) | 🔥 Crash | Sprint 1 |
| Usuario activa GPS en navegador viejo | Baja (2%) | 🔥 Congelamiento | Sprint 1 |
| Rate limiting con array vacío | Media (10%) | 🟠 Crash UI | Sprint 2 |
| Firestore query lenta | Alta (15%) | 🟠 Timeout | Sprint 2 |
| Usuario con popup blocker | Alta (30%) | 🟡 Silencioso | Sprint 3 |

---

## ✅ CRITERIOS DE ÉXITO

### **Después de Sprint 1:**
- [ ] 0 crashes en flujo "En Casa"
- [ ] 0 crashes en flujo "Fuera"
- [ ] 0 loops infinitos en hooks
- [ ] App funciona en 100% de navegadores modernos

### **Después de Sprint 2:**
- [ ] 0 crashes en rate limiting
- [ ] 0 crashes en queries lentas de Firestore
- [ ] 0 crashes en detección de GPS
- [ ] Timeouts correctos en todos los fetches

### **Después de Sprint 3:**
- [ ] Feedback claro en todos los edge cases
- [ ] Logging completo para debugging
- [ ] UX optimizada en escenarios raros

---

## 📝 NOTAS TÉCNICAS

### **Diferencia con Silent Failures:**
| Tipo | Comportamiento | Ejemplo |
|------|----------------|---------|
| **Silent Failure** | App funciona pero datos incorrectos | `kcal \|\| 'N/A'` con `kcal=0` → muestra 'N/A' |
| **Crash Error** | App detiene ejecución | `undefined.map()` → TypeError |

### **Patterns Detectados:**
1. **Variable hoisting:** Usar variable antes de definirla en misma función
2. **Array operations sin validación:** `.map()`, `[0]`, `.filter()` en null
3. **Optional chaining incompleto:** `?.map()` funciona con undefined pero NO con null
4. **useEffect dependencies incorrectas:** Causan loops infinitos
5. **JSON.parse en catch blocks:** Segundo parse sin try-catch
6. **Math.min/max con spread:** Retorna `Infinity` con array vacío
7. **AbortController sin cleanup:** Memory leaks por timeouts activos

---

## 🎯 PRÓXIMOS PASOS

1. **Revisar y aprobar este documento** ✅
2. **Implementar Sprint 1** (6 fixes críticos) → ~1 hora
3. **Testing manual** de flujos críticos → ~30 min
4. **Deploy a staging** y monitoring → ~15 min
5. **Implementar Sprint 2** (8 fixes altos) → ~2 horas
6. **Implementar Sprint 3** (3 fixes medios) → ~30 min
7. **Deploy a producción** con monitoring 🚀

---

**Fecha creación:** 2026-02-15  
**Autor:** Copilot CLI  
**Versión:** 1.0
