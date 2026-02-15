# 🧪 QUICK TESTING CHECKLIST - SESIÓN COMPLETA

**Usa este checklist mientras testeas. Marca con X cuando completes cada item.**

---

## 📍 GPS + VIAJE (5 min)

- [ ] **Test 1.1:** Simular GPS en otro país → Ve presupuesto en moneda local
- [ ] **Test 1.2:** Sin GPS → Usa ciudad de perfil
- [ ] **Test 1.3:** Sin ciudad + GPS activo → No crashea

**Bugs encontrados:** ___________________________________________

---

## 💳 MEALCARD (5 min)

- [ ] **Test 2.1:** Ver restaurante guardado → Card renderiza OK
- [ ] **Test 2.2:** Copiar dirección → Funciona o muestra fallback
- [ ] **Test 2.3:** Con popup blocker → Alert claro al usuario

**Bugs encontrados:** ___________________________________________

---

## 🔧 BACKEND (5 min)

- [ ] **Test 3.1:** Usuario sin ciudad + sin GPS → Error claro (NO crash)
- [ ] **Verificar:** Logs en consola no muestran crashes

**Bugs encontrados:** ___________________________________________

---

## 📍 GPS LOOPS (5 min)

- [ ] **Test 4.1:** Activar GPS primera vez → NO loop infinito en console
- [ ] **Test 4.1b:** Observar por 10s → Componente NO re-renderiza infinitamente

**Bugs encontrados:** ___________________________________________

---

## ⏱️ RATE LIMIT (5 min)

- [ ] **Test 5.1:** Hacer 3 requests → Esperar 65s → Nueva request OK
- [ ] **Verificar:** Timer NO muestra "Infinity"
- [ ] **Test 5.2:** Forzar 429 (10+ requests rápidas) → Mensaje claro con tiempo

**Bugs encontrados:** ___________________________________________

---

## 🔥 FIRESTORE (2 min)

- [ ] **Test 6.1:** Generar recomendación → Tarda <10s (no 504)

**Bugs encontrados:** ___________________________________________

---

## 🥕 PANTRY (2 min)

- [ ] **Test 7.1:** Con pantry + toggle activo → Genera receta OK

**Bugs encontrados:** ___________________________________________

---

## 💬 LOADING (2 min)

- [ ] **Test 8.1:** Observar loading messages → Rotan cada 4s sin crashes

**Bugs encontrados:** ___________________________________________

---

## 👤 SIN PAÍS (2 min)

- [ ] **Test 9.1:** Usuario sin país → Fallback a MXN, no crashea

**Bugs encontrados:** ___________________________________________

---

## 📊 ANALYTICS (2 min)

- [ ] **Test 10.1:** Block Firebase → GPS sigue funcionando

**Bugs encontrados:** ___________________________________________

---

## ✅ RESULTADO FINAL

**Total PASS:** ___ / 13  
**Total FAIL:** ___ / 13  

**Crashes encontrados:** ___ (debe ser 0)  
**Loops infinitos:** ___ (debe ser 0)  

**Decisión:**
- [ ] ✅ APROBAR para deploy
- [ ] ❌ BLOQUEAR deploy (bugs críticos)
- [ ] ⚠️ APROBAR con observaciones menores

**Notas finales:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Tester:** _______________  
**Fecha:** _______________  
**Hora inicio:** _______  **Hora fin:** _______
