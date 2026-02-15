# 📚 Documentación BOCADO AI

> **Última actualización:** 2026-02-15  
> **Estado:** Documentación activa y sincronizada con Notion

## 📁 Estructura

```
docs/
├── 01-producto/          # Visión, roadmap, métricas
│   ├── metricas.md
│   ├── roadmap.md
│   ├── vision.md
│   └── ROADMAP-MEJORAS.md
├── 02-disenio/           # Sistema de diseño, UI/UX
│   ├── sistema-diseno.md
│   └── UI_COMPONENTS.md
├── 03-tecnico/           # Arquitectura, implementación técnica
│   ├── arquitectura.md
│   ├── modelo-datos.md
│   ├── CACHE_ARCHITECTURE.md
│   ├── FEATURE_FLAGS.md
│   ├── PWA_OFFLINE_SETUP.md
│   ├── RATE_LIMITING_VERIFICATION.md
│   ├── gps-currency-conversion.md
│   └── schema-validation.md
├── 04-features/          # Documentación de features principales
│   ├── despensa.md
│   ├── generacion-recetas.md
│   └── onboarding.md
├── 05-ops/               # Deploy, bugs, operaciones, FinOps
│   ├── bugs.md
│   ├── deploy-checklist.md
│   └── FINOPS_ANALYSIS.md
└── 06-recursos/          # Links útiles, notas, guías
    ├── links-utiles.md
    ├── notas-diarias.md
    ├── notion-export-guide.md
    ├── MIGRACION-ICONOS.md
    ├── NOTION_MIGRATION.md
    └── archived/
        └── FINOPS_IMPLEMENTATION.md
```

## 📄 Documentos Principales

### 01-producto/ - Producto & Roadmap
- **vision.md** - Visión del producto
- **roadmap.md** - Roadmap de producto
- **metricas.md** - Métricas y KPIs
- **ROADMAP-MEJORAS.md** - Roadmap técnico y mejoras

### 02-disenio/ - Diseño & UI
- **sistema-diseno.md** - Sistema de diseño
- **UI_COMPONENTS.md** - Catálogo de componentes UI

### 03-tecnico/ - Arquitectura & Core
- **arquitectura.md** - Arquitectura general del sistema
- **modelo-datos.md** - Modelo de datos Firestore
- **CACHE_ARCHITECTURE.md** - Estrategia de caché
- **FEATURE_FLAGS.md** - Sistema de feature flags
- **PWA_OFFLINE_SETUP.md** - Configuración PWA y offline
- **RATE_LIMITING_VERIFICATION.md** - Sistema de rate limiting
- **gps-currency-conversion.md** - Conversión de moneda y GPS
- **schema-validation.md** - Validación Gemini ↔ UI

### 04-features/ - Features Específicas
- **despensa.md** - Feature de despensa virtual
- **generacion-recetas.md** - Feature de generación de recetas
- **onboarding.md** - Feature de onboarding

### 05-ops/ - Operaciones & FinOps
- **bugs.md** - Tracking de bugs
- **deploy-checklist.md** - Checklist de deploy
- **FINOPS_ANALYSIS.md** - Análisis de costos y optimizaciones

### 06-recursos/ - Recursos & Guías
- **links-utiles.md** - Links y recursos útiles
- **notas-diarias.md** - Notas de desarrollo
- **notion-export-guide.md** - Guía de export de Notion
- **MIGRACION-ICONOS.md** - Historia de migración de iconos
- **NOTION_MIGRATION.md** - Guía de migración a Notion
- **archived/** - Documentos históricos

## 🔄 Sincronización con Notion

La documentación está sincronizada con Notion. Para migrar nuevos docs:

```bash
export NOTION_TOKEN="tu_token"
npm run migrate-to-notion
```

Ver **NOTION_MIGRATION.md** para detalles.

## 📋 Historial de Limpieza

**2026-02-15:**
- ✅ Eliminados 10 docs obsoletos (sprints, auditorías completadas)
- ✅ Actualizados ROADMAP-MEJORAS.md y FINOPS_ANALYSIS.md
- ✅ Archivado FINOPS_IMPLEMENTATION.md
- ✅ 26 documentos activos mantenidos

## 🎯 Convenciones

- **MAYÚSCULAS.md** - Documentos técnicos generales
- **kebab-case.md** - Features específicas
- **01-XX/** - Directorios organizados por categoría
- **archived/** - Documentos históricos (mantener por referencia)

## 📝 Contribuir

Al agregar documentación nueva:
1. Usa la estructura de carpetas existente
2. Nombra archivos descriptivamente
3. Incluye fecha de creación/última actualización
4. Considera migrar a Notion si es documentación permanente
