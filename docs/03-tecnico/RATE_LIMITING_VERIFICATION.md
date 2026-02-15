# 🛡️ Verificación de Rate Limiting - Maps Proxy

**Estado:** ✅ **IMPLEMENTADO Y LISTO**

## Quick Facts

| Aspecto | Configuración | Ubicación |
|---------|---------------|-----------|
| **Implementación** | ✅ Activo en `maps-proxy.ts` | líneas 127-182 |
| **Storage** | ✅ Firestore (persistente) | `maps_proxy_rate_limits/{ip}` |
| **Rules** | ✅ Protegidas (Admin SDK only) | `firestore.rules:86` |
| **Índices** | ✅ Definido en `updatedAt` | `firestore.indexes.json` |
| **Cleanup** | ✅ Cada hora | `functions/index.js:269` |

---

## Límites de Rate Limiting

### Usuarios NO Autenticados (solo `autocomplete`)
```
- Ventana: 1 minuto
- Límite: 20 requests/minuto
- Suficiente para: búsqueda típica (typing ~3-5 caracteres = 5-10 requests)
```

### Usuarios Autenticados (todas las acciones)
```
- Ventana: 1 minuto
- Límite: 50 requests/minuto
- Útil para: búsquedas más intensivas, múltiples queries
```

### Respuesta HTTP cuando se excede
```
HTTP 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retryAfter": 45  // segundos hasta que pueda intentar de nuevo
}
```

---

## ✅ Cómo Verificar en Production

### 1. Test de Autocomplete (sin auth)
```bash
# Hacer 25 requests en < 1 minuto (debería fallar el #21+)
for i in {1..25}; do
  curl -X POST https://bocado-ai.vercel.app/api/maps-proxy \
    -H "Content-Type: application/json" \
    -d '{"action":"autocomplete","query":"Madrid"}'
  sleep 0.1
done

# Esperado: requests 1-20 → 200 OK
#           requests 21-25 → 429 Too Many Requests
```

### 2. Test Autenticado
```bash
# Con token de usuario, deberías poder hacer 50 requests en 1 minuto
for i in {1..60}; do
  curl -X POST https://bocado-ai.vercel.app/api/maps-proxy \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"action":"autocomplete","query":"Madrid"}'
  sleep 0.1
done

# Esperado: requests 1-50 → 200 OK
#           requests 51-60 → 429 Too Many Requests
```

### 3. Verificar en Firestore Console
```
Firebase Console > Firestore > Collections > maps_proxy_rate_limits

Verás documentos con:
- doc ID = IP del cliente (ej: "93.184.216.34")
- campos:
  - requests: [] (array de timestamps)
  - updatedAt: [timestamp]
  - isAuthenticated: boolean
```

### 4. Monitorear Cleanup
Las funciones de cleanup corren automáticamente:
```
- Cloud Functions > cleanupMapsProxyCache
  - Schedule: Cada hora (0 * * * *)
  - Limpia: entradas expiradas de maps_proxy_cache

- Cloud Functions > (cleanup de rate limits en el handler)
  - Se limpian automáticamente cuando expiresAt pasa
```

---

## 🔍 Detalles Técnicos

### Cómo funciona:

1. **Cliente hace request** → `/api/maps-proxy/`
2. **Handler extrae IP** → `x-forwarded-for` header (Vercel)
3. **Verifica autenticación** → La acción requiere token?
4. **Llama `checkRateLimit(ip, isAuthenticated)`:**
   - Lee `maps_proxy_rate_limits/{ip}` de Firestore
   - Filtra requests dentro de la ventana (últimos 60s)
   - Cuenta requests válidos
   - Si >= límite → rechaza (429)
   - Si < límite → agrega timestamp actual y permite
5. **Si permitido** → Ejecuta la acción (autocomplete, placeDetails, etc.)

### Persistencia en Firestore:

```typescript
// Documento en maps_proxy_rate_limits/93.184.216.34
{
  requests: [1707604200123, 1707604200435, 1707604200678, ...],  // últimos 60s
  updatedAt: Timestamp,
  isAuthenticated: false  // para debugging
}
```

### Cleanup automático:

Cada request calcula:
```typescript
const validRequests = data.requests
  .filter((ts) => now - ts < WINDOW_MS);  // 60s
```

Mantiene solo los últimos 60 segundos.

---

## 📊 Consideraciones de Costos

### Firestore Writes
- **Autocomplete write:** 1 write/request (Transacción)
- **Estimado:** Si 100 usuarios hacen 20 queries cada uno/día
  - 2000 writes/día * 30 días = 60,000 writes/mes
  - Costo: ~$0.24 USD/mes (muy bajo)

### Limpieza automática
- **cleanupMapsProxyCache:** Cada hora (eliminaciones)
- Costo negligible (< 1000 deletes/día)

---

## ⚠️ Casos Edge / Debugging

### Si ves muchos 429s sin razón:
1. Verifica que la IP se detecta correctamente:
   - `req.headers['x-forwarded-for']` en Vercel
   - Si está en localhost, usará `127.0.0.1`

2. Verifica el índice en Firestore:
   ```
   Firebase Console > Indexes > maps_proxy_rate_limits
   Debe tener índice en: updatedAt (ASCENDING)
   ```

3. Incrementa los límites si es necesario:
   ```typescript
   // En maps-proxy.ts líneas 137-146
   const RATE_LIMITS = {
     authenticated: { maxRequests: 100 },  // Aumentar a 100
     unauthenticated: { maxRequests: 50 },
   };
   ```

### Si quieres deshabilitar rate limiting temporalmente:
```typescript
// Línea 318, comentar:
// const rateCheck = await checkRateLimit(clientIP, isAuthenticated);
// if (!rateCheck.allowed) { ... }

// ⚠️ SOLO EN DESARROLLO. Nunca en production.
```

---

## ✅ Checklist Preproducción

- [x] Rate limiting implementado en maps-proxy.ts
- [x] Firestore rules configuradas (Admin SDK only)
- [x] Índices criados en Firestore
- [x] Límites diferenciados por autenticación
- [x] Cleanup automático (Cloud Functions)
- [x] Tests para validación de constantes
- [x] CORS configurado
- [ ] **Acción requerida:** Probar manualmente en staging/production
- [ ] Monitorear logs de 429s en primera semana
- [ ] Alertar si > 5% de requests son 429s

---

## Última Actualización

- **Fecha:** Feb 11, 2026
- **Verificado por:** Code Review
- **Status:** ✅ LISTO PARA PRODUCCIÓN
