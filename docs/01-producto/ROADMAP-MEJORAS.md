# Roadmap de Mejoras Técnicas

> **Última actualización:** 2026-02-15  
> **Nota:** Items marcados ✅ están completados. Ver `/docs/MIGRACION-ICONOS.md`, `/docs/PWA_OFFLINE_SETUP.md` y `/docs/FEATURE_FLAGS.md` para detalles.

---

## 13. Service Worker / PWA ✅ **COMPLETADO**

### Estado Actual
- ✅ Firebase Messaging SW funciona (notificaciones push)
- ✅ Caching de assets para offline implementado
- ✅ Estrategia de red para API calls configurada
- ✅ Página offline creada
- ✅ Manifiesto PWA completo

**Ver documentación:** `/docs/PWA_OFFLINE_SETUP.md`

---

## 14. Feature Flags ✅ **COMPLETADO**

### Estado Actual
- ✅ Sistema de feature flags implementado
- ✅ Flags por entorno (env vars)
- ✅ Hook `useFeatureFlag()` disponible
- ✅ HOC `withFeatureFlag()` disponible

**Ver documentación:** `/docs/FEATURE_FLAGS.md`

---

## 16. Tree Shaking de Iconos ✅ **COMPLETADO**

### Estado Actual
- ✅ Iconos personalizados migrados a `lucide-react`
- ✅ Bundle size reducido significativamente
- ✅ Iconos custom preservados (DairyIcon, BocadoLogo, etc.)

**Ver documentación:** `/docs/MIGRACION-ICONOS.md`

---

## 17. CSS con Clases Arbitrarias (Prioridad: BAJA)

### Estado Actual
- ⚠️ Tailwind config tiene design system básico
- ❌ Muchas clases arbitrarias en componentes (ej: `pt-safe`, colores hardcodeados)

### Tareas
1. Estandarizar clases comunes:
   - Crear plugin Tailwind para `pt-safe`, `pb-safe`
   - Agregar colores faltantes al theme
   - Crear utilidades para sombras bocado
2. Crear componentes base:
   - `Button` con variantes (primary, secondary, ghost)
   - `Card` para contenedores
   - `Input` estandarizado
3. Documentar tokens de diseño

### Archivos a crear
- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Input.tsx`
- Actualizar `tailwind.config.js`

---

## 18. Storybook (Prioridad: BAJA)

### Estado Actual
- ❌ No instalado

### Tareas
1. Instalar Storybook con Vite
2. Configurar tema oscuro/claro
3. Crear stories para componentes UI base:
   - Button
   - Card
   - Input
   - Iconos
4. Documentar props con JSDoc

### Archivos a crear
- `.storybook/main.ts`
- `.storybook/preview.tsx`
- `src/components/**/*.stories.tsx`

---

## 19. Skeleton Screens (Prioridad: BAJA)

### Estado Actual
- ❌ Usando spinners de carga
- ⚠️ Pantallas en blanco mientras cargan datos

### Tareas
1. Crear componentes skeleton base:
   - `SkeletonText` (líneas de texto)
   - `SkeletonCard` (tarjetas de recetas)
   - `SkeletonAvatar` (fotos de perfil)
   - `SkeletonList` (listas)
2. Reemplazar spinners por skeletons en:
   - Pantalla de perfil
   - Lista de recetas guardadas
   - Historial
   - Pantalla de recomendación

### Archivos a crear
- `src/components/skeleton/SkeletonText.tsx`
- `src/components/skeleton/SkeletonCard.tsx`
- `src/components/skeleton/index.ts`

---

## 20. E2E Tests (Prioridad: BAJA)

### Estado Actual
- ✅ Tests unitarios con Vitest
- ❌ No hay tests E2E

### Tareas
1. Instalar Playwright
2. Crear tests para flujos críticos:
   - Registro completo
   - Login
   - Generar recomendación
   - Guardar receta
   - Actualizar perfil
3. Configurar CI/CD para correr tests
4. Mock de Firebase Auth para tests

### Archivos a crear
- `playwright.config.ts`
- `e2e/auth.spec.ts`
- `e2e/recommendation.spec.ts`
- `e2e/profile.spec.ts`

---

## Orden de Implementación Recomendado

1. **16. Tree Shaking de Iconos** - Fácil, reduce bundle size
2. **17. CSS con Clases Arbitrarias** - Mejora mantenibilidad
3. **19. Skeleton Screens** - Mejora UX inmediata
4. **13. Service Worker / PWA** - Feature importante para móviles
5. **14. Feature Flags** - Infraestructura para releases
6. **18. Storybook** - Documentación (baja prioridad)
7. **20. E2E Tests** - Calidad (baja prioridad)
