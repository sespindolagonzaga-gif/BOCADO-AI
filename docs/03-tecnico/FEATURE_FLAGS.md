# Sistema de Feature Flags - Bocado AI

Sistema completo para gestionar feature flags en la aplicación Bocado AI, permitiendo habilitar/deshabilitar funcionalidades de forma dinámica sin necesidad de nuevos despliegues.

## Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Esquema Firestore](#esquema-firestore)
3. [Uso Básico](#uso-básico)
4. [Hooks](#hooks)
5. [Componentes](#componentes)
6. [Configuración](#configuración)
7. [Mejores Prácticas](#mejores-prácticas)
8. [Ejemplos](#ejemplos)

---

## Arquitectura

### Flujo de Datos

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Firestore      │────▶│  Services       │────▶│  Hooks          │
│                 │     │  featureFlags   │     │  useFeatureFlag │
│ • global flags  │     │                 │     │                 │
│ • user flags    │     │ • fetch         │     │ • cache (RQ)    │
│                 │     │ • merge         │     │ • refetch       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                              ┌───────────────────────────┼───────────┐
                              ▼                           ▼           ▼
                       ┌──────────────┐          ┌──────────────┐  ┌──────────────┐
                       │ FeatureFlag  │          │ Condiciones  │  │ useFeatureFlag│
                       │ Component    │          │ en código    │  │ (hook)       │
                       └──────────────┘          └──────────────┘  └──────────────┘
```

### Orden de Precedencia

Cuando se evalúa un feature flag, se aplica el siguiente orden de prioridad:

1. **Flags de usuario** (mayor prioridad)
2. **Flags globales** 
3. **Valores por defecto** (menor prioridad)

```typescript
// Ejemplo de precedencia
const flagValue = userFlags.darkMode ?? globalFlags.darkMode ?? defaultFlags.darkMode;
```

---

## Esquema Firestore

### Colección: `feature_flags`

#### Documento Global

```
/feature_flags/global

{
  flags: {
    newRecommendationUI: true,
    pantryV2: false,
    darkMode: false,
    enableAnalytics: true,
    aiSuggestions: false,
    shareMealPlans: false,
    smartNotifications: true,
    wearableIntegration: false
  },
  updatedAt: Timestamp,
  updatedBy: "admin@bocado.ai"
}
```

#### Subcolección de Usuarios

```
/feature_flags/global/users/{userId}

{
  flags: {
    darkMode: true,        // Override para este usuario
    pantryV2: true         // Override para este usuario
  },
  updatedAt: Timestamp
}
```

### Reglas de Seguridad (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Feature Flags Globales - Solo lectura para usuarios autenticados
    match /feature_flags/global {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.admin == true; // Solo admins
    }
    
    // Feature Flags por Usuario - Usuario puede leer/escribir solo su propio doc
    match /feature_flags/global/users/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
  }
}
```

---

## Uso Básico

### 1. Verificar un Feature (Hook)

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const { enabled, isLoading } = useFeatureFlag('darkMode', { 
    userId: currentUser?.uid 
  });

  if (isLoading) return <Loading />;
  
  return (
    <div className={enabled ? 'dark' : 'light'}>
      <Content />
    </div>
  );
}
```

### 2. Verificar Múltiples Features

```tsx
import { useFeatureFlags } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const { flags, isEnabled } = useFeatureFlags({ userId: currentUser?.uid });

  return (
    <div>
      {isEnabled('newRecommendationUI') && <NewUI />}
      {isEnabled('pantryV2') && <PantryV2 />}
      {flags.enableAnalytics && <AnalyticsScript />}
    </div>
  );
}
```

### 3. Usar el Componente FeatureFlag

```tsx
import { FeatureFlag } from '@/components/FeatureFlag';

function App() {
  return (
    <FeatureFlag feature="newRecommendationUI" fallback={<OldScreen />}>
      <NewRecommendationScreen />
    </FeatureFlag>
  );
}
```

---

## Hooks

### `useFeatureFlag`

Hook para verificar un feature flag individual.

```typescript
function useFeatureFlag(
  featureName: keyof FeatureFlags,
  options?: { enabled?: boolean; userId?: string | null }
): {
  enabled: boolean;
  isLoading: boolean;
  error: Error | null;
  allFlags: FeatureFlags;
  refetch: () => Promise<void>;
}
```

**Ejemplo:**

```tsx
const { enabled, isLoading, refetch } = useFeatureFlag('pantryV2', {
  userId: currentUser?.uid
});

// Refetch manual si es necesario
<button onClick={() => refetch()}>Refresh Flags</button>
```

### `useFeatureFlags`

Hook para obtener todos los feature flags.

```typescript
function useFeatureFlags(
  options?: { enabled?: boolean; userId?: string | null }
): {
  flags: FeatureFlags;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: number | null;
  refetch: () => Promise<void>;
  isEnabled: (feature: keyof FeatureFlags) => boolean;
}
```

### `useMultipleFeatureFlags`

Hook optimizado para verificar múltiples flags.

```tsx
const flags = useMultipleFeatureFlags(
  ['darkMode', 'pantryV2', 'smartNotifications'],
  { userId: currentUser?.uid }
);

// flags.darkMode, flags.pantryV2, flags.smartNotifications
// flags.isLoading, flags.error
```

### `usePrefetchFeatureFlags`

Para precargar flags al iniciar sesión.

```tsx
const prefetchFeatureFlags = usePrefetchFeatureFlags();

// En el handler de login exitoso
prefetchFeatureFlags(currentUser.uid);
```

### `useFeatureFlagsSubscription`

Para reaccionar a cambios en los flags.

```tsx
useFeatureFlagsSubscription({
  userId: currentUser?.uid,
  onChange: (newFlags, oldFlags) => {
    if (newFlags.darkMode !== oldFlags.darkMode) {
      showToast('Modo oscuro actualizado');
    }
  }
});
```

---

## Componentes

### `<FeatureFlag />`

Componente principal que renderiza `children` solo si el feature está habilitado.

```tsx
<FeatureFlag 
  feature="newRecommendationUI"
  fallback={<OldScreen />}
  showLoader={true}
  loaderComponent={<CustomSpinner />}
>
  <NewScreen />
</FeatureFlag>
```

### `<FeatureFlag.All />`

Renderiza `children` solo si **TODOS** los features están habilitados.

```tsx
<FeatureFlag.All features={['darkMode', 'newRecommendationUI']}>
  <NewDarkUI />
</FeatureFlag.All>
```

### `<FeatureFlag.Any />`

Renderiza `children` si **AL MENOS UNO** de los features está habilitado.

```tsx
<FeatureFlag.Any features={['pantryV2', 'smartNotifications']}>
  <AdvancedFeatures />
</FeatureFlag.Any>
```

### `<FeatureFlag.Switch />`

Renderiza contenido diferente según el estado del feature.

```tsx
<FeatureFlag.Switch
  feature="darkMode"
  whenEnabled={<DarkThemeProvider />}
  whenDisabled={<LightThemeProvider />}
/>
```

### `<FeatureFlag.Lazy />`

Lazy loading condicional del componente.

```tsx
<FeatureFlag.Lazy
  feature="pantryV2"
  component={() => import('./PantryV2')}
  componentProps={{ userId: currentUser.uid }}
  loadingFallback={<Spinner />}
  disabledFallback={<PantryV1 />}
/>
```

### `<FeatureFlag.WithTracking />`

Con tracking de analytics.

```tsx
<FeatureFlag.WithTracking
  feature="newRecommendationUI"
  trackEventName="feature_view"
  trackProperties={{ source: 'home_screen' }}
>
  <NewUI />
</FeatureFlag.WithTracking>
```

---

## Configuración

### Valores por Defecto

```typescript
// src/config/featureFlags.ts
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  // UI Features
  newRecommendationUI: false,
  pantryV2: false,
  darkMode: false,
  
  // Analytics
  enableAnalytics: true,
  
  // Experimentales
  aiSuggestions: false,
  shareMealPlans: false,
  smartNotifications: false,
  wearableIntegration: false,
};
```

### Configuración de TanStack Query

```typescript
export const FEATURE_FLAGS_CONFIG = {
  staleTime: 1000 * 60 * 5,      // 5 minutos
  gcTime: 1000 * 60 * 30,        // 30 minutos
  refetchInterval: 1000 * 60 * 5, // 5 minutos
  retryCount: 3,
  retryDelay: 1000,
};
```

---

## Mejores Prácticas

### 1. Nuevos Features = `false` por defecto

Los features nuevos deben ser **opt-in** hasta que se prueben adecuadamente.

```typescript
// ✅ Correcto
newExperimentalFeature: false

// ❌ Incorrecto (puede romper producción)
newExperimentalFeature: true
```

### 2. Usar Componentes para UI Condicional

Prefiere el componente `FeatureFlag` sobre condicionales en el render.

```tsx
// ✅ Correcto - Declarativo y limpio
<FeatureFlag feature="newUI" fallback={<OldUI />}>
  <NewUI />
</FeatureFlag>

// ❌ Incorrecto - Verbos y menos mantenible
const { enabled } = useFeatureFlag('newUI');
return enabled ? <NewUI /> : <OldUI />;
```

### 3. Graceful Degradation

Siempre proporciona un fallback para cuando el feature esté deshabilitado.

```tsx
<FeatureFlag feature="pantryV2" fallback={<PantryV1 />}>
  <PantryV2 />
</FeatureFlag>
```

### 4. Prefetch al Iniciar Sesión

Precarga los flags cuando el usuario inicia sesión para evitar delays.

```tsx
// En el componente de autenticación
const prefetchFeatureFlags = usePrefetchFeatureFlags();

useEffect(() => {
  if (user?.uid) {
    prefetchFeatureFlags(user.uid);
  }
}, [user?.uid]);
```

### 5. No Usar Flags para Data Crítica

Los feature flags son para UI/UX, no para controlar acceso a datos sensibles.

```tsx
// ❌ Incorrecto - No uses flags para autorización
<FeatureFlag feature="canAccessBilling">
  <BillingData />
</FeatureFlag>

// ✅ Correcto - Usa reglas de Firestore para autorización
<BillingData /> // La protección viene de Firestore
```

---

## Ejemplos

### Feature Flag para Nuevo Flujo de Registro

```tsx
// RegistrationFlow.tsx
import { FeatureFlag } from '@/components/FeatureFlag';

export function RegistrationFlow() {
  return (
    <FeatureFlag 
      feature="newRegistrationFlow" 
      fallback={<OldRegistrationFlow />}
    >
      <NewRegistrationFlow />
    </FeatureFlag>
  );
}
```

### Feature Flag para Analytics Condicional

```tsx
// App.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function AnalyticsProvider({ children }) {
  const { enabled } = useFeatureFlag('enableAnalytics');
  
  return (
    <AnalyticsContext.Provider value={{ enabled }}>
      {enabled && <AnalyticsScript />}
      {children}
    </AnalyticsContext.Provider>
  );
}
```

### Feature Flag para A/B Testing

```tsx
// RecommendationScreen.tsx
import { useFeatureFlags } from '@/hooks/useFeatureFlag';

function RecommendationScreen() {
  const { isEnabled } = useFeatureFlags();
  
  return (
    <div>
      <FeatureFlag.Switch
        feature="newRecommendationUI"
        whenEnabled={<RecommendationUIVariantB />}
        whenDisabled={<RecommendationUIVariantA />}
      />
    </div>
  );
}
```

### Feature Flag para Rollout Gradual

```tsx
// PantryScreen.tsx
import { FeatureFlag } from '@/components/FeatureFlag';

function PantryScreen() {
  return (
    <div>
      <h1>Tu Despensa</h1>
      
      {/* Rollout gradual: primero beta testers, luego todos */}
      <FeatureFlag 
        feature="pantryV2" 
        fallback={<PantryV1 />}
        showLoader
      >
        <PantryV2 />
      </FeatureFlag>
    </div>
  );
}
```

---

## Troubleshooting

### Los flags no se actualizan

1. Verificar que el `userId` se pase correctamente
2. Revisar el intervalo de refetch (5 minutos por defecto)
3. Verificar la conexión a Firestore
4. Revisar reglas de seguridad

### Error "Feature flag not found"

El sistema usa valores por defecto si no encuentra un flag. Verifica que el flag esté definido en:
1. `src/types/featureFlags.ts` - Interface `FeatureFlags`
2. `src/config/featureFlags.ts` - `DEFAULT_FEATURE_FLAGS`

### Problemas de performance

Si notas muchos re-renders:
1. Usa `useMultipleFeatureFlags` en lugar de múltiples `useFeatureFlag`
2. Usa el patrón de selectores con `useFeatureFlags`
3. Considera aumentar el `staleTime` en la configuración

---

## Referencias

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Feature Flags Best Practices](https://martinfowler.com/articles/feature-toggles.html)
