# 🧪 PLAN DE TESTING MANUAL COMPLETO - SESIÓN COMPLETA

**Fecha:** 2026-02-15  
**Duración estimada:** 30-40 minutos  
**Objetivo:** Validar TODAS las funcionalidades implementadas en esta sesión

---

## 📋 ÍNDICE DE FUNCIONALIDADES A TESTEAR

### **PARTE 1: GPS + CONVERSIÓN DE MONEDA** (Sesión previa)
1. Detección de viaje automática
2. Conversión de moneda por país
3. Tono adaptativo en recomendaciones
4. Fallback a ubicación de registro

### **PARTE 2: FIXES DE CRASHES CRÍTICOS** (Sprint 1)
5. Variable hoisting en MealCard
6. Array .map() con null
7. ReferenceError searchCoords
8. .substring() en undefined
9. useEffect loop infinito
10. useCallback loop infinito

### **PARTE 3: FIXES DE CRASHES ALTOS** (Sprint 2)
11. .toUpperCase() en null
12. indexOf -1 en array
13. response.json() sin validación
14. response.text() sin límite
15. Math.min/max array vacío
16. pantryData.items null
17. Firestore timeout
18. position.coords sin validar

### **PARTE 4: MEJORAS DE UX** (Sprint 3)
19. window.open() popup blocker
20. Clipboard fallback
21. Analytics error handling

---

## 🧪 CASOS DE PRUEBA DETALLADOS

---

### **TEST 1: GPS + DETECCIÓN DE VIAJE** 🌍

**Funcionalidad:** Sistema detecta cuando usuario está viajando y adapta moneda/tono

#### **Caso 1.1: Usuario viajando (GPS activo)**
**Precondiciones:**
- Usuario registrado con ciudad en perfil (ej: Ciudad de México)
- Navegador con permisos GPS activos

**Pasos:**
1. Abrir app en dispositivo móvil o usar Chrome DevTools para simular ubicación
2. Cambiar ubicación GPS a otro país (ej: Madrid, España)
3. Ir a "Fuera" → Generar recomendación de restaurantes
4. Observar la recomendación generada

**Resultado esperado:** ✅
- Saludo menciona "Aprovechando que estás de visita en Madrid..." o similar
- Presupuesto mostrado en Euros (€)
- Restaurantes son de Madrid, NO de Ciudad de México
- No crashea ni muestra ubicación incorrecta

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 1.2: Usuario en casa (sin GPS activo)**
**Precondiciones:**
- Usuario registrado con ciudad en perfil
- GPS desactivado o sin permisos

**Pasos:**
1. Desactivar permisos GPS en navegador
2. Ir a "Fuera" → Generar recomendación
3. Observar ubicación y moneda usadas

**Resultado esperado:** ✅
- Usa ciudad de registro del perfil
- Usa moneda del país de registro
- Tono normal (sin mencionar viaje)
- No crashea por falta de GPS

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 1.3: Usuario sin ciudad en perfil + GPS activo**
**Precondiciones:**
- Usuario con perfil SIN ciudad registrada
- GPS activo

**Pasos:**
1. Activar GPS
2. Ir a "Fuera" → Generar recomendación
3. Verificar que usa ubicación GPS

**Resultado esperado:** ✅
- Usa coordenadas GPS para búsqueda
- No crashea por falta de ciudad en perfil (Fix #11 Sprint 2)
- Muestra restaurantes de ubicación GPS

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 2: CRASHES CRÍTICOS - MEALCARD** 💳

**Funcionalidad:** MealCard renderiza sin crashes con datos malformados

#### **Caso 2.1: Restaurante sin campo ingredients**
**Precondiciones:**
- Usuario con recomendación de restaurante guardada

**Pasos:**
1. Ir a "Guardados" → Restaurantes
2. Hacer clic en cualquier restaurante
3. Observar que la card renderiza correctamente

**Resultado esperado:** ✅
- Card se renderiza sin crash (Fix #2 Sprint 1)
- No aparece error en consola
- `isRestaurant` definido antes de usarse (Fix #1 Sprint 1)

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 2.2: Copiar dirección de restaurante**
**Precondiciones:**
- Usuario con restaurante que tiene dirección

**Pasos:**
1. Abrir card de restaurante
2. Hacer clic en botón "Copiar dirección"
3. Observar feedback visual
4. Pegar en un editor de texto (Ctrl+V)

**Resultado esperado:** ✅
- Dirección se copia correctamente
- Mensaje "Copiado" aparece 2 segundos
- Si falla Clipboard API, intenta execCommand (Fix #7 Sprint 3)
- Si todo falla, muestra alert con texto (Fix #7 Sprint 3)
- En consola: logging si falla (Fix #7 Sprint 3)

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 2.3: Abrir Google Maps con popup blocker**
**Precondiciones:**
- Navegador con popup blocker activo
- Restaurante con link de Google Maps

**Pasos:**
1. Activar popup blocker en navegador (Chrome: Settings → Site Settings → Pop-ups)
2. Abrir card de restaurante
3. Hacer clic en "Abrir en Google Maps"
4. Observar comportamiento

**Resultado esperado:** ✅
- Si popup bloqueado: alert dice "Por favor permite ventanas emergentes..." (Fix #6 Sprint 3)
- No crashea silenciosamente
- Usuario tiene feedback claro

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 3: CRASHES CRÍTICOS - BACKEND** 🔧

**Funcionalidad:** Endpoint /api/recommend maneja errores sin crashear

#### **Caso 3.1: Usuario sin ciudad en perfil busca restaurantes**
**Precondiciones:**
- Usuario SIN ciudad en perfil
- GPS desactivado

**Pasos:**
1. Desactivar GPS
2. Asegurar que perfil no tiene ciudad
3. Ir a "Fuera" → Intentar generar recomendación

**Resultado esperado:** ✅
- Muestra error claro: "No se pudo determinar tu ubicación..."
- NO crashea con ReferenceError (Fix #11 Sprint 1)
- No muestra pantalla blanca
- Botón vuelve a estado normal

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 3.2: Gemini retorna JSON malformado**
**Escenario:** Simular respuesta malformada (difícil de testear manualmente)

**Validación alternativa:**
1. Revisar logs en Vercel/Firebase después de 100 requests
2. Verificar que no hay crashes por JSON.parse (Fix #12 Sprint 1)
3. Verificar logging de `.substring()` funciona (Fix #15 Sprint 1)

**Resultado esperado:** ✅
- Logs muestran errores sin crashear servidor
- Nested try-catch captura errores de JSON extraído
- Strings validados antes de .substring()

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 4: GPS Y GEOLOCALIZACIÓN** 📍

**Funcionalidad:** GPS maneja errores sin loops infinitos ni crashes

#### **Caso 4.1: Activar GPS primera vez (sin loops)**
**Precondiciones:**
- App abierta, GPS no solicitado aún
- Navegador moderno (Chrome/Firefox)

**Pasos:**
1. Ir a "Fuera"
2. Hacer clic en "Usar mi ubicación actual"
3. Permitir GPS cuando navegador solicite
4. Observar comportamiento por 10 segundos
5. Abrir DevTools Console → verificar no hay loop de logs

**Resultado esperado:** ✅
- Permiso se solicita UNA vez
- NO hay loop infinito de `checkPermission()` (Fix #21 Sprint 1)
- Estado de GPS se actualiza correctamente
- Componente NO se re-renderiza infinitamente (Fix #22 Sprint 1)
- Analytics se ejecuta sin crashear (Fix #25 Sprint 3)

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 4.2: GPS en navegador antiguo (IE11 simulator)**
**Precondiciones:**
- Chrome DevTools → F12 → Console
- Ejecutar: `delete navigator.geolocation` (simula navegador sin GPS)

**Pasos:**
1. Recargar app
2. Intentar usar GPS
3. Observar error handling

**Resultado esperado:** ✅
- Muestra error claro: "Tu navegador no soporta geolocalización"
- NO crashea con `undefined.latitude` (Fix #24 Sprint 2)
- Fallback a ubicación de perfil funciona

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 5: RATE LIMITING Y ERRORES DE API** ⏱️

**Funcionalidad:** Rate limiting maneja edge cases sin crashes

#### **Caso 5.1: Rate limiting edge case (ventana expirada)**
**Precondiciones:**
- Usuario con 3 requests previas (cerca del límite)
- Esperar 60 segundos sin hacer requests

**Pasos:**
1. Hacer 3 requests rápidas
2. Esperar 65 segundos (ventana expira)
3. Hacer nueva request
4. Observar countdown timer

**Resultado esperado:** ✅
- Timer NO muestra "Infinity" (Fix #13 Sprint 2)
- Array vacío de requests se maneja correctamente
- Math.min/max con fallback a `now` funciona
- Request se procesa normalmente

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 5.2: Error 429 con body inválido**
**Escenario:** Simular (difícil manualmente)

**Validación alternativa:**
1. Hacer 10 requests MUY rápidas (forzar 429)
2. Observar mensaje de error mostrado
3. Verificar que NO dice "undefined segundos"

**Resultado esperado:** ✅
- Mensaje claro con tiempo de espera (Fix #5 Sprint 2)
- Default a 60s si JSON inválido
- No crashea por `.retryAfter undefined`

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

#### **Caso 5.3: API retorna error HTML gigante (>10MB)**
**Escenario:** Simular (muy difícil manualmente)

**Validación teórica:**
- Código trunca a 10KB (Fix #9 Sprint 2)
- Móviles no sufren OOM
- Error se muestra sin crashear

**Resultado real:** [ ] ⚠️ SKIP (validar en staging)  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 6: FIRESTORE QUERIES Y TIMEOUTS** 🔥

**Funcionalidad:** Firestore queries tienen timeout de 8s

#### **Caso 6.1: Generar recomendación con historial**
**Precondiciones:**
- Usuario con 3+ recomendaciones previas en historial

**Pasos:**
1. Ir a "En casa" o "Fuera"
2. Generar nueva recomendación
3. Observar que tarda <10 segundos
4. Verificar en DevTools Network que no hay timeout 504

**Resultado esperado:** ✅
- Request completa en <10s (timeout 8s configurado) (Fix #19 Sprint 2)
- Si Firestore lento, falla rápido con mensaje claro
- No espera indefinidamente
- Historial se carga correctamente

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 7: PANTRY Y INGREDIENTES** 🥕

**Funcionalidad:** Pantry con datos corruptos no crashea

#### **Caso 7.1: Generar receta con pantry**
**Precondiciones:**
- Usuario con items en despensa
- Modo "Solo ingredientes de mi cocina" activado

**Pasos:**
1. Ir a "En casa"
2. Activar toggle "Solo ingredientes en mi cocina"
3. Generar recomendación
4. Verificar que receta usa solo ingredientes de pantry

**Resultado esperado:** ✅
- Receta generada con ingredientes de pantry
- Si `pantryData.items` es null, no crashea (Fix #14 Sprint 2)
- Array vacío como fallback funciona
- Receta es generada exitosamente

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 8: LOADING MESSAGES Y UI** 💬

**Funcionalidad:** Loading messages rotan sin crashes

#### **Caso 8.1: Generar recomendación y observar loading**
**Precondiciones:**
- Ninguna precondición especial

**Pasos:**
1. Ir a "En casa"
2. Generar recomendación
3. Observar mensajes de carga durante 20+ segundos
4. Verificar que rotan cada 4 segundos

**Resultado esperado:** ✅
- Mensajes rotan: "Analizando perfil..." → "Buscando recetas..." → etc.
- NO crashea con indexOf -1 (Fix #4 Sprint 2)
- Si array vacío, muestra "Cargando..." como fallback
- No hay undefined en pantalla

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 9: USUARIO SIN DATOS EN PERFIL** 👤

**Funcionalidad:** App maneja perfiles incompletos sin crashes

#### **Caso 9.1: Usuario sin país en perfil**
**Precondiciones:**
- Usuario con perfil SIN país configurado

**Pasos:**
1. Asegurar que `profile.country` está vacío
2. Ir a "Fuera" → Generar recomendación
3. Observar que no crashea

**Resultado esperado:** ✅
- Fallback a 'MX' como país default (Fix #3 Sprint 2)
- NO crashea con `.toUpperCase() of null`
- Moneda mostrada es MXN (peso mexicano)
- Budget options se cargan correctamente

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### **TEST 10: ANALYTICS Y LOGGING** 📊

**Funcionalidad:** Analytics no rompe funcionalidad principal

#### **Caso 10.1: Firebase Analytics caído (simular)**
**Precondiciones:**
- Abrir DevTools → Network → Block request pattern "firebaseapp.com"

**Pasos:**
1. Bloquear requests de Firebase
2. Hacer acciones que disparan analytics:
   - Solicitar GPS
   - Generar recomendación
   - Guardar item
3. Verificar que funcionalidad principal sigue trabajando

**Resultado esperado:** ✅
- GPS funciona aunque trackEvent() falle (Fix #25 Sprint 3)
- Try-catch captura errores de analytics
- Warnings en consola pero NO crashes
- Usuario no nota diferencia

**Resultado real:** [ ] ✅ PASS  [ ] ❌ FAIL  
**Notas:**
```
_________________________________________________________________
_________________________________________________________________
```

---

## 📊 RESUMEN DE TESTING

### **Checklist General**

**Funcionalidades Core:**
- [ ] GPS + detección de viaje (3 casos)
- [ ] Generación "En Casa" (recetas)
- [ ] Generación "Fuera" (restaurantes)
- [ ] Guardado de items
- [ ] Pantry con toggle "Solo ingredientes"
- [ ] Rate limiting visible

**Crashes Críticos Evitados:**
- [ ] No hay loops infinitos en GPS
- [ ] MealCard renderiza con datos incompletos
- [ ] Backend no crashea con perfiles incompletos
- [ ] Firestore queries tienen timeout

**UX Mejorada:**
- [ ] Popup blocker da feedback
- [ ] Clipboard funciona o da fallback
- [ ] Loading messages rotan correctamente
- [ ] Errores de API son claros

**Edge Cases:**
- [ ] Usuario sin ciudad + sin GPS
- [ ] Usuario viajando (GPS diferente de registro)
- [ ] Rate limiting con ventana expirada
- [ ] Pantry corrupta (items null)

---

## 📝 REPORTE DE BUGS ENCONTRADOS

### **Bug #1:**
**Descripción:**
```
_________________________________________________________________
```
**Severidad:** [ ] Crítico  [ ] Alto  [ ] Medio  [ ] Bajo  
**Pasos para reproducir:**
```
_________________________________________________________________
```

### **Bug #2:**
**Descripción:**
```
_________________________________________________________________
```
**Severidad:** [ ] Crítico  [ ] Alto  [ ] Medio  [ ] Bajo  
**Pasos para reproducir:**
```
_________________________________________________________________
```

### **Bug #3:**
**Descripción:**
```
_________________________________________________________________
```
**Severidad:** [ ] Crítico  [ ] Alto  [ ] Medio  [ ] Bajo  
**Pasos para reproducir:**
```
_________________________________________________________________
```

---

## ✅ CRITERIOS DE APROBACIÓN

Para considerar el testing exitoso, DEBE cumplirse:

1. ✅ **0 crashes críticos** en flujos principales
2. ✅ **0 loops infinitos** detectados
3. ✅ **GPS funciona** con y sin permisos
4. ✅ **Detección de viaje** funciona con GPS activo
5. ✅ **Rate limiting** maneja ventana expirada
6. ✅ **Firestore** no causa timeouts 504
7. ✅ **Errores de API** muestran mensajes claros
8. ✅ **Loading messages** rotan sin crashes
9. ✅ **Analytics** no rompe funcionalidad core
10. ✅ **Perfiles incompletos** no crashean app

**Bugs aceptables (NO bloquean deploy):**
- Warnings en consola que no afectan funcionalidad
- Edge cases muy raros (<1% de usuarios)
- Mejoras de UI/UX menores

**Bugs que SÍ bloquean deploy:**
- Crashes en flujos principales (generar, guardar, GPS)
- Loops infinitos
- Errores 500/504 en endpoints
- Datos incorrectos mostrados (país wrong, moneda wrong)

---

## 🚀 SIGUIENTES PASOS POST-TESTING

### **Si TODO PASA (0 bugs críticos):**
1. ✅ Commit cambios con mensaje descriptivo
2. ✅ Push a rama main
3. ✅ Deploy a staging
4. ✅ Smoke test en staging (5 min)
5. ✅ Deploy a producción
6. ✅ Monitor Sentry/logs por 24h

### **Si HAY BUGS CRÍTICOS:**
1. ❌ Documentar bugs encontrados
2. 🔧 Crear sprint de fixes urgentes
3. 🧪 Re-testing después de fixes
4. 🚀 Repetir proceso de deploy

---

**Tiempo estimado total:** 30-40 minutos  
**Tester:** _______________  
**Fecha inicio:** _______________  
**Fecha fin:** _______________  
**Resultado:** [ ] ✅ APROBADO  [ ] ❌ BLOQUEADO  [ ] ⚠️ APROBADO CON OBSERVACIONES
