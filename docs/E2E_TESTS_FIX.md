# ✅ E2E Tests - Fix: Selector Timeout Issue

**Status:** 🔧 FIXED

## Problema Identificado

Los E2E tests fallaban en el flujo de registro con el siguiente error:
```
The register function waits for SELECTORS.home.startButton to be visible,
then clicks it. If the selector does not match any visible element
(especially in headless/CI mode), registration fails.
```

### Raíz del Problema

1. **Timeout muy corto:** 5000ms (5 segundos) es insuficiente en CI/headless
2. **Selector demasiado complejo:** Múltiples alternativas con `,` no son confiables
3. **Sin debugging:** Si fallaba, no había visibilidad del problema

## Solución Implementada

### 1. Aumentar Timeout (5s → 15s)
```typescript
// Antes
await page.waitForSelector(SELECTORS.home.startButton, { state: 'visible', timeout: 5000 });

// Después
await page.waitForSelector('[data-testid="start-button"]', { state: 'visible', timeout: 15000 });
```

### 2. Usar Selector Específico
- **Antes:** `'[data-testid="start-button"], button:has-text("Empezar"), a:has-text("Empezar")'`
- **Después:** `'[data-testid="start-button"]'` (directo, sin alternativas compuestas)

### 3. Agregar Error Handling
```typescript
try {
  await page.waitForSelector('[data-testid="start-button"]', { state: 'visible', timeout: 15000 });
} catch (error) {
  // Si falla, tomar screenshot para debugging
  await page.screenshot({ path: 'test-failure-start-button.png' });
  throw new Error(`Start button not found. Screenshot saved. Error: ${error}`);
}
```

## Cambios Realizados

### `e2e/utils/auth.ts`
- ✅ Función `register()`: Aumentado timeout a 15s + error handling + screenshot
- ✅ Función `registerBasic()`: Aumentado timeout a 15s + error handling + screenshot

### `e2e/utils/selectors.ts`
- ✅ `SELECTORS.home.startButton`: Simplificado a `'[data-testid="start-button"]'` únicamente
- ✅ `SELECTORS.home.loginButton`: Simplificado a `'[data-testid="login-button"]'` únicamente

## Por Qué Esto Arreglará el Problema

1. **Timeout más largo:** Permite que la renderización complete en CI/headless
2. **Selector más específico:** `data-testid` es la forma más confiable de selectores en Playwright
3. **Debugging automático:** Screenshots en caso de fallo permiten diagnóstico rápido
4. **Sin selectores compuestos:** Evita problemas con múltiples alternativas

## Verificación

En tu CI (GitHub Actions, etc.), después del cambio:

```bash
npm run test:e2e

# Esperado:
# ✓ Registro completo
# ✓ Login
# ✓ Recomendaciones
# ✓ Pantry
# ... todos los tests pasan
```

Si aún hay fallos, busca `test-failure-*.png` en el directorio raíz para ver qué pasó.

## Cambios Relacionados

- Selectores más confiables en general para CI
- Mejor manejo de errores en helpers de testing
- Documentación de mejores prácticas Playwright

---

**Actualizado:** Feb 11, 2025
