# Corrección de Notificaciones - BOCADO-AI

## Problema Identificado

Las notificaciones mostraban las claves de traducción literalmente (ej: "notificacions.breakfast.title") en lugar del texto traducido. Esto ocurría porque:

1. **Inicialización temprana**: Los hooks de notificaciones se inicializaban antes de que las traducciones estuvieran completamente cargadas
2. **Persistencia en localStorage**: Las claves de traducción se guardaban en localStorage y se reutilizaban
3. **Falta de sincronización**: No había un mecanismo para actualizar las traducciones cuando cambiaba el idioma

## Soluciones Implementadas

### 1. Sincronización Automática de Traducciones

Se agregaron efectos en ambos hooks de notificaciones que:
- Detectan cambios en el contexto de traducción
- Actualizan automáticamente los títulos y cuerpos de las notificaciones
- Mantienen las configuraciones del usuario (horarios, estados enabled/disabled)

**Archivos modificados:**
- [src/hooks/useSmartNotifications.ts](src/hooks/useSmartNotifications.ts)
- [src/hooks/useNotifications.ts](src/hooks/useNotifications.ts)

### 2. Limpieza Automática de Datos Corruptos

Se implementó una verificación al inicio que:
- Detecta si hay claves de traducción guardadas en localStorage
- Limpia automáticamente los datos corruptos
- Regenera las notificaciones con traducciones correctas

### 3. Utilidades de Diagnóstico

Se creó un archivo de utilidades disponible en la consola del navegador:

**Funciones disponibles:**

```javascript
// Verificar el estado de las notificaciones
window.bocadoNotifications.diagnose()

// Limpiar datos corruptos
window.bocadoNotifications.clean()

// Resetear historial completo de notificaciones
window.bocadoNotifications.reset()
```

**Archivo creado:**
- [src/utils/cleanNotifications.ts](src/utils/cleanNotifications.ts)

## Cambios Técnicos Detallados

### useSmartNotifications.ts

```typescript
// Nuevo efecto de limpieza al inicio
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    const hasCorruptedData = parsed.some((item: any) => 
      item.title?.includes('notifications.') || 
      item.title?.includes('notificacions.')
    );
    
    if (hasCorruptedData) {
      localStorage.removeItem(STORAGE_KEY);
      setReminders(createDefaultReminders(t));
    }
  }
}, []);

// Nuevo efecto de sincronización de traducciones
useEffect(() => {
  setReminders(prev => {
    const defaultReminders = createDefaultReminders(t);
    return prev.map(reminder => {
      const defaultRem = defaultReminders.find(dr => dr.id === reminder.id);
      if (defaultRem) {
        return {
          ...reminder,
          title: defaultRem.title,
          body: defaultRem.body,
        };
      }
      return reminder;
    });
  });
}, [t]);
```

### useNotifications.ts

Se aplicaron los mismos cambios que en useSmartNotifications.ts

## Cómo Probar

### 1. Limpiar Datos Existentes

En la consola del navegador:
```javascript
window.bocadoNotifications.diagnose()
window.bocadoNotifications.clean()
```

### 2. Verificar Notificaciones

1. Ir a Perfil → Configuración → Notificaciones
2. Activar las notificaciones
3. Verificar que los títulos y cuerpos se muestren en el idioma correcto
4. Cambiar el idioma y verificar que se actualicen automáticamente

### 3. Probar Notificación de Prueba

1. En la configuración de notificaciones, hacer clic en "Probar"
2. Verificar que aparezca: "🧪 Notificación de prueba" (o "Test notification" en inglés)
3. No debe mostrar claves como "notifications.testNotification.title"

## Prevención de Problemas Futuros

### Buenas Prácticas

1. **Siempre usar el hook `useTranslation`** para obtener traducciones
2. **No guardar traducciones en localStorage** - solo guardar identificadores y configuraciones
3. **Regenerar traducciones dinámicamente** cuando cambie el idioma o contexto

### Monitoreo

Las utilidades de diagnóstico están disponibles permanentemente en:
- Consola del navegador → `window.bocadoNotifications`
- Logs automáticos cuando se detectan y limpian datos corruptos

## Notas Adicionales

### Claves de Traducción Correctas

Todas las notificaciones usan las siguientes claves del archivo de traducciones:

**Comidas:**
- `notifications.breakfast.title` / `notifications.breakfast.titleSimple`
- `notifications.breakfast.body` / `notifications.breakfast.bodySimple`
- `notifications.lunch.title`
- `notifications.lunch.body`
- `notifications.dinner.title`
- `notifications.dinner.body`

**Inteligentes:**
- `notifications.pantryUpdate.title`
- `notifications.pantryUpdate.body`
- `notifications.rateRecipes.title`
- `notifications.rateRecipes.body`
- `notifications.comeBack.title`
- `notifications.comeBack.body`

**Prueba:**
- `notifications.testNotification.title`
- `notifications.testNotification.body`

### Persistencia

Los datos de notificaciones se guardan en:
- **localStorage**: `bocado_notification_schedules`, `bocado_smart_reminders`
- **Firestore**: `notification_settings/{userId}`

Las traducciones siempre se regeneran dinámicamente desde los archivos JSON, no se persisten.

## Solución de Problemas

### Si las notificaciones aún muestran claves

1. Abrir consola del navegador (F12)
2. Ejecutar: `window.bocadoNotifications.clean()`
3. Recargar la página
4. Verificar de nuevo

### Si la notificación de prueba no aparece

1. Verificar que los permisos de notificación estén concedidos
2. Verificar que no esté activado "No molestar" en el dispositivo
3. Revisar la consola por errores
4. Intentar desde una ventana de incógnito

### Si las traducciones no se actualizan al cambiar idioma

1. Verificar que el contexto I18n esté correctamente configurado
2. Revisar que `I18nProvider` envuelva la aplicación
3. Verificar logs en consola

## Archivos Modificados

- ✅ [src/hooks/useSmartNotifications.ts](src/hooks/useSmartNotifications.ts) - Sincronización y limpieza
- ✅ [src/hooks/useNotifications.ts](src/hooks/useNotifications.ts) - Sincronización y limpieza
- ✅ [src/utils/cleanNotifications.ts](src/utils/cleanNotifications.ts) - Utilidades de diagnóstico (nuevo)
- ✅ [src/index.tsx](src/index.tsx) - Importación de utilidades

## Testing

Para ejecutar pruebas:

```bash
# Pruebas unitarias
npm test

# Pruebas e2e de notificaciones
npm run test:e2e -- --grep "notification"
```
