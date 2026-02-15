# 🚨 AUDITORÍA DE SILENT FAILURES Y ERRORES DE FLUJO

**Fecha:** 2026-02-15  
**Auditor:** Senior QA Engineer  
**Alcance:** Análisis exhaustivo de patrones que causan silent failures

---

## 📊 **RESUMEN EJECUTIVO**

**Total de problemas detectados:** 16  
**Severidad Alta (🔴):** 4  
**Severidad Media (🟠):** 9  
**Severidad Baja (🟡):** 3

### **Definición de Silent Failure:**
> Error que NO detiene la ejecución pero produce datos incorrectos, incompletos o basura, deteriorando la UX sin notificación visible al usuario.

---

## 🔴 **PROBLEMAS CRÍTICOS (Alta Prioridad)**

### **#1: API sin Timeout - RecommendationScreen.tsx:204**

**Código actual:**
```typescript
const response = await fetch(env.api.recommendationUrl, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(requestBody),
  signal: abortControllerRef.current.signal
});
```

**Problema:**
- No hay timeout explícito
- Si el servidor no responde, el usuario espera indefinidamente
- El `AbortController` solo funciona si se llama manualmente `.abort()`

**Impacto UX:**
- Usuario ve loading eterno
- No puede reintentar
- No sabe si hay error de red o servidor

**Fix recomendado:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
  setError('La solicitud tardó demasiado. Por favor intenta de nuevo.');
}, 30000); // 30 segundos

try {
  const response = await fetch(env.api.recommendationUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  // ... resto del código
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('Timeout: La solicitud tardó demasiado');
  }
  throw error;
}
```

---

### **#2: .filter() sobre null - recommend.ts:176**

**Código actual:**
```typescript
const validRequests = data?.requests?.filter(
  (ts) => now - ts < this.config.windowMs
) || [];
```

**Problema:**
- Si `data.requests` es `null` (no undefined), `.filter()` crashea
- Comportamiento inconsistente: undefined funciona, null no

**Ejemplo de falla:**
```javascript
const data = { requests: null };
data.requests.filter(...)  // ❌ TypeError: Cannot read property 'filter' of null
```

**Fix:**
```typescript
const validRequests = (data?.requests || []).filter(
  (ts) => now - ts < this.config.windowMs
);
```

---

### **#3: .map() sobre array no validado - recommend.ts:1089**

**Código actual:**
```typescript
const recent = historySnap.docs.map((doc: any) => {
  const d = doc.data();
  return type === 'En casa' 
    ? d.receta?.recetas?.map((r: any) => r.titulo)
    : d.recomendaciones?.map((r: any) => r.nombre_restaurante);
}).flat().filter(Boolean);
```

**Problemas:**
1. `doc.data()` puede retornar `undefined` si el documento no existe
2. `d.receta?.recetas` puede ser `null` → `.map()` crashea
3. `.flat()` sobre undefined falla

**Escenario real:**
```javascript
// Documento borrado pero ref existe
doc.data()  // undefined
undefined.receta  // ❌ TypeError
```

**Fix:**
```typescript
const recent = historySnap.docs
  .map((doc: any) => {
    const d = doc.data();
    if (!d) return null;
    
    const items = type === 'En casa' 
      ? (d.receta?.recetas || [])
      : (d.recomendaciones || []);
    
    return items.map((item: any) => 
      type === 'En casa' ? item.titulo : item.nombre_restaurante
    );
  })
  .filter(Boolean)
  .flat();
```

---

### **#4: Nuevo código de GPS sin timeout - recommend.ts:746**

**Código implementado recientemente:**
```typescript
async function getCountryCodeFromCoords(coords: Coordinates): Promise<string | null> {
  try {
    const response = await fetch(MAPS_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reverseGeocode',
        lat: coords.lat,
        lng: coords.lng
      })
    });
    // ... sin timeout
```

**Problema:**
- Reverse geocoding puede tardar >5s en zonas remotas
- Bloquea todo el flujo de recomendación
- Usuario no sabe que está esperando geocoding

**Impacto:**
- Latencia de 5-15s adicionales en países con mala conectividad
- No hay fallback si la API no responde

**Fix:**
```typescript
async function getCountryCodeFromCoords(
  coords: Coordinates,
  timeoutMs: number = 5000
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(MAPS_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reverseGeocode',
        lat: coords.lat,
        lng: coords.lng
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      safeLog('warn', `⚠️ Reverse geocode falló: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.countryCode || null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      safeLog('warn', '⚠️ Reverse geocode timeout (5s)');
      return null;
    }
    safeLog('error', '❌ Error en reverse geocoding:', error);
    return null;
  }
}
```

---

## 🟠 **PROBLEMAS MEDIOS (Media Prioridad)**

### **#5: JSON.parse con fallback inseguro - RecommendationScreen.tsx:216**

**Código:**
```typescript
const errorData = await response.json().catch(() => ({}));
```

**Problema:**
- Si `response.json()` falla, devuelve `{}` vacío
- Código posterior accede a `errorData.retryAfter` esperando un número
- Resulta en `undefined` → `NaN` en cálculos de tiempo

**Ejemplo:**
```javascript
const fallbackSeconds = typeof errorData.retryAfter === 'number' 
  ? errorData.retryAfter 
  : 30;
```
✅ Está protegido PERO el patrón es frágil.

**Mejor práctica:**
```typescript
let errorData = {};
try {
  errorData = await response.json();
} catch (jsonError) {
  logger.warn('Failed to parse error response:', jsonError);
  errorData = { message: 'Unknown error', retryAfter: 30 };
}
```

---

### **#6: Optional chaining con null - PlanScreen.tsx:51**

**Código:**
```typescript
calories: rec.macros_por_porcion?.kcal || rec.kcal || 'N/A',
```

**Problema:**
- Si `rec.macros_por_porcion` es `null` (no undefined):
  ```javascript
  null?.kcal  // undefined (ok)
  ```
  ✅ Funciona pero...
  
- Si es `0` (valor válido):
  ```javascript
  0 || rec.kcal || 'N/A'  // Salta al siguiente
  ```
  ❌ Pérdida de datos

**Fix:**
```typescript
calories: rec.macros_por_porcion?.kcal ?? rec.kcal ?? 'N/A',
```

**Diferencia:**
```javascript
// Operador ||
0 || 'fallback'      // 'fallback' ❌
false || 'fallback'  // 'fallback' ❌

// Operador ??
0 ?? 'fallback'      // 0 ✅
false ?? 'fallback'  // false ✅
null ?? 'fallback'   // 'fallback' ✅
```

---

### **#7: document.execCommand deprecated - MealCard.tsx:334**

**Código:**
```typescript
const textArea = document.createElement("textarea");
textArea.value = textToCopy;
document.body.appendChild(textArea);
textArea.select();
document.execCommand("copy");  // ⚠️ DEPRECATED
document.body.removeChild(textArea);
setCopiedAddress(true);
```

**Problemas:**
1. `document.execCommand()` está deprecated desde 2018
2. Retorna `false` silenciosamente en algunos navegadores
3. No valida el resultado
4. Usuario ve "¡Copiado!" pero puede no haberse copiado

**Fix moderno:**
```typescript
try {
  // Intento 1: Clipboard API (moderno)
  await navigator.clipboard.writeText(textToCopy);
  setCopiedAddress(true);
} catch (clipboardError) {
  // Fallback: método tradicional
  try {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    
    if (success) {
      setCopiedAddress(true);
    } else {
      throw new Error('Copy command failed');
    }
  } catch (fallbackError) {
    logger.error('Failed to copy:', fallbackError);
    // Mostrar toast de error al usuario
    alert('No se pudo copiar. Por favor copia manualmente.');
  }
}
```

---

### **#8: hasMacros sin validar recipe - MealCard.tsx:198**

**Código:**
```typescript
const hasMacros = useMemo(() => 
  !isRestaurant && recipe.protein_g && recipe.carbs_g && recipe.fat_g,
  [isRestaurant, recipe.protein_g, recipe.carbs_g, recipe.fat_g]
);
```

**Problema:**
- Si `recipe` es `undefined`, accede a propiedades de undefined
- Dependencias incluyen `recipe.protein_g` pero no `recipe`

**Fix:**
```typescript
const hasMacros = useMemo(() => 
  recipe && !isRestaurant && 
  recipe.protein_g !== undefined && 
  recipe.carbs_g !== undefined && 
  recipe.fat_g !== undefined,
  [recipe, isRestaurant]
);
```

---

### **#9: Array access sin validación - PlanScreen.tsx:131**

**Código:**
```typescript
const docSnap = recipesSnap.docs[0];
const plan = processFirestoreDoc(docSnap);
```

**Problema:**
- Si `recipesSnap.docs` es `[]` (vacío), `docs[0]` es `undefined`
- `processFirestoreDoc(undefined)` puede fallar silenciosamente

**Fix:**
```typescript
if (recipesSnap.empty || recipesSnap.docs.length === 0) {
  return null;
}
const docSnap = recipesSnap.docs[0];
const plan = processFirestoreDoc(docSnap);
```

---

### **#10: JSON.parse anidado sin validación - recommend.ts:1318**

**Código:**
```typescript
try {
  parsedData = JSON.parse(responseText);
} catch (e) {
  const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                    responseText.match(/{[\s\S]*}/);
  if (jsonMatch) {
    parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);  // ⚠️
  } else {
    throw new Error("No se pudo parsear la respuesta de Gemini");
  }
}
```

**Problema:**
- `JSON.parse()` en línea 1318 puede fallar si el regex matchea JSON inválido
- Error se pierde en el catch padre

**Ejemplo:**
```javascript
const responseText = "Aquí está: {incomplete: true";
responseText.match(/{[\s\S]*}/)  // Matchea "{incomplete: true"
JSON.parse("{incomplete: true")  // ❌ SyntaxError (pero catch solo dice "No se pudo parsear")
```

**Fix:**
```typescript
try {
  parsedData = JSON.parse(responseText);
} catch (e) {
  const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                    responseText.match(/{[\s\S]*}/);
  if (jsonMatch) {
    try {
      parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (innerError) {
      safeLog('error', '❌ JSON extraído inválido:', jsonMatch[0]);
      throw new Error(`Invalid JSON in response: ${innerError.message}`);
    }
  } else {
    throw new Error("No se pudo parsear la respuesta de Gemini");
  }
}
```

---

### **#11: Optional chaining en detectTravelContext - recommend.ts:787**

**Código:**
```typescript
const homeCountryCode = user.country || 'MX';
```

**Problema:**
- Si `user.country` es `""` (string vacío), se considera falsy
- Pero `""` es un valor válido en edge cases de migración de datos
- Mejor usar nullish coalescing

**Fix:**
```typescript
const homeCountryCode = user.country ?? 'MX';
```

---

### **#12: COUNTRY_TO_CURRENCY sin validación - recommend.ts:788**

**Código:**
```typescript
const homeCurrency = COUNTRY_TO_CURRENCY[homeCountryCode] || 'USD';
```

**Problema:**
- Si `homeCountryCode` viene corrupto o es código no soportado:
  ```javascript
  COUNTRY_TO_CURRENCY['XX']  // undefined
  ```
  ✅ Fallback a 'USD' funciona PERO...
  
- Si alguien edita budgets.ts y borra entradas, silent failure

**Mejor logging:**
```typescript
const homeCurrency = COUNTRY_TO_CURRENCY[homeCountryCode];
if (!homeCurrency) {
  safeLog('warn', `⚠️ Country code not found: ${homeCountryCode}, fallback to USD`);
}
return homeCurrency || 'USD';
```

---

### **#13: user.city puede ser undefined - recommend.ts:798**

**Código:**
```typescript
locationLabel: `en ${user.city || 'tu ciudad'}`
```

**Problema:**
- Si `user.city` es `undefined`, output: "en tu ciudad"
- Prompt a Gemini: "Eres guía gastronómico en tu ciudad"
- Gemini no sabe qué ciudad usar → recomendaciones genéricas

**Impacto UX:**
- Restaurantes sin ubicación específica
- Direcciones inventadas

**Fix:**
```typescript
if (!user.city) {
  safeLog('warn', `⚠️ User ${user.uid} has no city in profile`);
  throw new Error('Tu perfil no tiene ciudad configurada. Por favor actualiza tu ubicación.');
}
```

---

## 🟡 **PROBLEMAS MENORES (Baja Prioridad)**

### **#14: Zod schema permite strings inválidos - recommend.ts:343**

**Código:**
```typescript
cookingTime: z.union([z.string(), z.number()]).optional().nullable(),
```

**Problema:**
- Permite `"abc"` como tiempo de cocina
- Después se usa en prompt: `${request.cookingTime || '30'}min`
- Output: "abcmin"

**Fix:**
```typescript
cookingTime: z.union([
  z.string().regex(/^\d+$/, 'Debe ser número en string'),
  z.number().int().min(1).max(180)
]).optional().nullable(),
```

---

### **#15: parseInt/Number sin validar NaN - (Implícito)**

**Problema general:**
```javascript
const servings = Number(input);  // Si input = "abc", servings = NaN
// Luego se usa en cálculos:
const totalCalories = baseCalories * servings;  // NaN * 500 = NaN
```

**Patrón a buscar:**
```typescript
// ❌ MAL
const num = Number(input);

// ✅ BIEN
const num = Number(input);
if (isNaN(num)) {
  throw new Error('Invalid number');
}
```

---

### **#16: IP detection sin validación de estructura - useGeolocation.ts:159**

**Código:**
```typescript
const ipLocation = await detectLocationByIP();
if (ipLocation) {
  dispatch({ 
    type: 'SET_DETECTED', 
    payload: ipLocation 
  });
}
```

**Problema:**
- No valida que `ipLocation` tenga estructura completa
- Si API retorna `{ country: "MX" }` sin `city`, silent failure

**Fix:**
```typescript
if (ipLocation?.city && ipLocation?.country && ipLocation?.lat && ipLocation?.lng) {
  dispatch({ type: 'SET_DETECTED', payload: ipLocation });
} else {
  logger.warn('Incomplete IP location data:', ipLocation);
}
```

---

## 📋 **PLAN DE ACCIÓN PRIORITARIO**

### **Sprint 1 (Crítico - 1 día):**
- [ ] #1: Agregar timeout a fetch en RecommendationScreen (30s)
- [ ] #2: Fix `.filter()` sobre null en recommend.ts:176
- [ ] #3: Validar `doc.data()` antes de `.map()` en recommend.ts:1089
- [ ] #4: Agregar timeout a `getCountryCodeFromCoords()` (5s)

### **Sprint 2 (Importante - 2 días):**
- [ ] #5: Fix JSON.parse fallback en RecommendationScreen
- [ ] #6: Cambiar `||` a `??` en PlanScreen (5 ocurrencias)
- [ ] #7: Modernizar copy to clipboard en MealCard
- [ ] #8: Validar `recipe` en hasMacros
- [ ] #13: Validar `user.city` antes de generar prompt

### **Sprint 3 (Mejoras - 1 día):**
- [ ] #9-12: Logging mejorado en casos edge
- [ ] #14-16: Validaciones de Zod más estrictas
- [ ] Agregar tests E2E para escenarios de falla

---

## 🧪 **CASOS DE PRUEBA RECOMENDADOS**

### **Test Suite 1: API Failures**
```typescript
describe('Silent Failures - API', () => {
  test('Timeout en recommend API después de 30s', async () => {
    // Mock API que no responde
    mockFetch.mockImplementation(() => new Promise(() => {}));
    
    await expect(makeRecommendation()).rejects.toThrow('Timeout');
  });
  
  test('Reverse geocoding timeout no bloquea flujo', async () => {
    // Mock geocoding que tarda 10s
    mockFetch.mockDelay(10000);
    
    const result = await detectTravelContext(coords, request, user);
    expect(result.isTraveling).toBe(false); // Fallback
  });
});
```

### **Test Suite 2: Data Validation**
```typescript
describe('Silent Failures - Data', () => {
  test('user.city undefined lanza error descriptivo', () => {
    const user = { country: 'MX', city: undefined };
    expect(() => buildPrompt(user)).toThrow('ciudad configurada');
  });
  
  test('macros con valor 0 se preserva', () => {
    const recipe = { protein_g: 0, carbs_g: 10, fat_g: 5 };
    const result = hasMacros(recipe);
    expect(result).toBe(true);  // 0 es válido
  });
});
```

### **Test Suite 3: Edge Cases**
```typescript
describe('Silent Failures - Edge Cases', () => {
  test('Empty array en historySnap no causa crash', () => {
    const historySnap = { docs: [] };
    const recent = extractRecentMeals(historySnap);
    expect(recent).toEqual([]);
  });
  
  test('COUNTRY_TO_CURRENCY con código inválido fallback', () => {
    const currency = getCurrency('XX');  // País no existente
    expect(currency).toBe('USD');
  });
});
```

---

## 📊 **MÉTRICAS DE ÉXITO**

### **Antes de fixes:**
- ❌ 16 puntos de falla silenciosa detectados
- ❌ 0 validaciones de timeout
- ❌ 8 accesos a propiedades sin optional chaining
- ❌ 4 `.map()/.filter()` sobre undefined

### **Después de fixes (objetivo):**
- ✅ 0 puntos de falla sin manejo
- ✅ 100% de APIs con timeout
- ✅ 100% de accesos con `?.` o validación previa
- ✅ 100% de métodos de array con validación

---

## 🔒 **PRINCIPIOS DE DEFENSIVE PROGRAMMING**

### **1. Nunca confíes en datos externos**
```typescript
// ❌ MAL
const data = await api.getData();
data.items.map(...)

// ✅ BIEN
const data = await api.getData();
const items = Array.isArray(data?.items) ? data.items : [];
items.map(...)
```

### **2. Valida antes de transformar**
```typescript
// ❌ MAL
const total = items.reduce((sum, item) => sum + item.price, 0);

// ✅ BIEN
if (!Array.isArray(items)) throw new Error('Items must be array');
const total = items.reduce((sum, item) => {
  const price = Number(item.price);
  if (isNaN(price)) return sum;
  return sum + price;
}, 0);
```

### **3. Usa ?? en lugar de ||**
```typescript
// ❌ MAL: 0, false, "" son válidos pero se pierden
const value = userInput || 'default';

// ✅ BIEN: Solo null/undefined usan default
const value = userInput ?? 'default';
```

### **4. Timeout en TODAS las operaciones I/O**
```typescript
// ❌ MAL
await fetch(url);

// ✅ BIEN
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
try {
  await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

### **5. Log antes de throw**
```typescript
// ❌ MAL
throw new Error('Failed');

// ✅ BIEN
logger.error('Operation failed:', { user, context });
throw new Error('Failed to process request');
```

---

## ✅ **SIGUIENTE ACCIÓN**

1. **Revisar con el equipo** los 4 problemas críticos
2. **Priorizar Sprint 1** (1 día de desarrollo)
3. **Implementar fixes** con tests
4. **Desplegar a staging** para QA
5. **Monitorear logs** durante 48h
6. **Desplegar a producción**

---

**Estado:** 🔴 **ACCIÓN REQUERIDA**  
**Prioridad:** ALTA  
**Estimación:** 4 días de desarrollo + testing
