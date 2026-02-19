# 🍎 Guía: Probar FatSecret API en BOCADO-AI

## ✅ Pasos para Habilitar FatSecret

### 1. Obtener Credenciales (5 minutos)

1. Ve a https://platform.fatsecret.com/api/
2. Sign Up (si no tienes cuenta)
3. En "My Apps" → Create New App
4. Llena el formulario:
   - App Name: `BOCADO AI Testing`
   - Description: `Food recommendation app`
5. Verás:
   - **Consumer Key** (FATSECRET_KEY)
   - **Consumer Secret** (FATSECRET_SECRET)

### 2. Configurar Variables de Entorno

**Opción A: Desarrollo Local (.env.local)**
```bash
# Agregar a .env.local
FATSECRET_KEY=tu_consumer_key_aqui
FATSECRET_SECRET=tu_consumer_secret_aqui
```

**Opción B: Vercel (Production)**
```bash
# Desde CLI
vercel env add FATSECRET_KEY
vercel env add FATSECRET_SECRET
# O en Vercel Dashboard → Settings → Environment Variables
```

### 3. Reiniciar Dev Server
```bash
npm run dev
```

---

## 🧪 Probar FatSecret

### Opción 1: Endpoint de Debug (Más Fácil)

**URL:** http://localhost:5173/api/debug-fatsecret?query=pollo

**Ejemplos:**
```
# Búsqueda simple
http://localhost:5173/api/debug-fatsecret?query=pollo

# Búsqueda con límite
http://localhost:5173/api/debug-fatsecret?query=arroz&limit=5

# Búsqueda en español
http://localhost:5173/api/debug-fatsecret?query=espinaca
```

**Respuesta esperada:**
```json
{
  "success": true,
  "query": "pollo",
  "duration_ms": 234,
  "count": 145,
  "results": [
    {
      "food_id": 12345,
      "food_name": "Pollo Asado",
      "brand_name": "Generic",
      "food_type": "Generic",
      "score": 95
    },
    {
      "food_id": 12346,
      "food_name": "Pollo Frito",
      "brand_name": "Generic",
      "food_type": "Generic",
      "score": 92
    }
    // ... más resultados
  ]
}
```

### Opción 2: Habilitar en API Principal (recommend.ts)

**Descomentar importación:**
```typescript
// ANTES (línea 11)
// import { getFatSecretIngredientsWithCache } from './utils/fatsecret-logic';

// DESPUÉS
import { getFatSecretIngredientsWithCache } from './utils/fatsecret-logic';
```

**Luego, en `getAllIngredientes()` (línea ~730):**
```typescript
// Layer 1: Firestore local (PRIMARY)
const localSnap = await db.collection("ingredients").limit(1000).get();
if (!localSnap.empty) {
  return localSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Layer 2: FatSecret (si habilitado)
if (process.env.FATSECRET_KEY && process.env.FATSECRET_SECRET) {
  const fsResult = await getFatSecretIngredientsWithCache(
    "all",  // o la búsqueda específica
    "system"
  );
  if (fsResult.length > 0) {
    return fsResult.map(fs => ({
      id: fs.food_id,
      name: fs.food_name,
      category: fs.food_type,
      regional: { es: fs.food_name, mx: fs.food_name }
    }));
  }
}

// Layer 3: Fallback básico
return [];
```

---

## 📊 Monitorear Uso de FatSecret

### Ver Límites de Rate Limit

El plan **Premium Free** tiene:
- **100 requests/hora**
- **3000 requests/día**

Cada búsqueda de ingrediente = 1 request

**Monitoreo en vivo:**
```bash
# Ver logs de FatSecret en Vercel
vercel logs api/recommend | grep FatSecret
```

### Cache Strategy (Ya Implementado)

```typescript
// FatSecret cache: 7 days (optimizado para no gastar quota)
// 100 req/hora ÷ 24 horas = ~4 req/hora sostenible
// 4 req/hora × 24 horas = 96 req/día (dentro del límite)
```

---

## 🔍 Ejemplos de Búsquedas para Probar

### Búsquedas Básicas:
```
- pollo
- arroz
- tomate
- espinaca
- manzana
```

### Búsquedas Complejas:
```
- pollo asado
- arroz integral
- espinaca fresh
- tomate cherry
```

### Casos Edge:
```
- xyz123 (no existe - error graceful)
- 你好 (caracteres especiales)
- a (muy corto)
```

---

## 📋 Checklist de Verificación

```
✅ Credenciales obtenidas (FATSECRET_KEY, SECRET)
✅ Variables de entorno configuradas
✅ Dev server reiniciado
✅ Endpoint /api/debug-fatsecret responde OK
✅ Búsquedas simples funcionan (ej: "pollo")
✅ Respuesta incluye: food_id, food_name, score
✅ Cache funciona (2ª búsqueda es más rápida)
✅ Límites de rate tidak excedidos
```

---

## 🚨 Troubleshooting

| Problema | Solución |
|----------|----------|
| 503 - Credentials not configured | Agrega FATSECRET_KEY y SECRET a .env.local |
| 500 - API failed | Verifica que las credenciales sean correctas |
| Resultados vacíos | La búsqueda no existe en FatSecret |
| Muy lento (>2s) | Normal en primera búsqueda, cache ayuda después |
| Rate limit exceeded | Espera 1 hora o actualiza a plan pagado |

---

## 💡 Próximos Pasos (Después de Confirmar Funcionamiento)

1. **Integrar en recomendaciones**: Descomentar importación
2. **Mejorar scoring**: Dar peso a score de FatSecret
3. **Fallback automático**: Si Firestore vacío → FatSecret
4. **Monitoreo en Sentry**: Tracking de errores y usage
5. **Admin dashboard**: Ver stats de qué búsquedas se hacen

---

## 📞 Soporte

- FatSecret API Docs: https://platform.fatsecret.com/api/Default.aspx?screen=rapiref
- Issues: Revisar console.log en dev y logs de Vercel en prod
- Cache ubicación: Firestore collection `fatsecret_cache`

**Happy Testing! 🚀**
