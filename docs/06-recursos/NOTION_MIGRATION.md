# Migración de Documentación a Notion

> **✅ MIGRACIÓN COMPLETADA** - 2026-02-15

Este proyecto incluye un script para migrar automáticamente toda la documentación del directorio `docs/` a Notion.

## Estado Actual

✅ **Migración completada exitosamente**
- 35 archivos markdown migrados a Notion
- 6 carpetas organizadas (01-producto, 02-diseño, 03-técnico, 04-features, 05-ops, 06-recursos)
- Estructura preservada con páginas padres

## Para ejecutar migraciones futuras

Si necesitas migrar nuevos documentos a Notion:

### 1. Configurar el token:
```bash
export NOTION_TOKEN="tu_token_aqui"
```

### 2. Ejecutar la migración:
```bash
npm run migrate-to-notion
```

## Qué hace el script

- ✅ Convierte archivos markdown a páginas de Notion
- ✅ Mantiene la estructura de directorios (crea páginas padres para carpetas)
- ✅ Preserva formato básico: headers, listas, código, párrafos
- ✅ Procesa todos los archivos `.md` recursivamente

## Estructura resultante en Notion

```
📄 Página Principal (ID: 303f9da95c18809c8c22c3ff972df25a)
  📁 01-producto/
    📄 roadmap
    📄 metricas
    📄 vision
  📁 02-disenio/
    📄 sistema-diseno
  📁 03-tecnico/
  📁 04-features/
    📄 despensa
    📄 onboarding
    📄 generacion-recetas
  📁 05-ops/
  📁 06-recursos/
  📄 CACHE_ARCHITECTURE
  📄 CRASH_ERRORS_AUDIT
  ... (todos los demás archivos .md)
```

## Limitaciones

- La API de Notion tiene un límite de 100 bloques por página
- El script incluye un delay de 300ms entre archivos para no sobrecargar la API
- Formato markdown complejo puede no convertirse perfectamente

## Troubleshooting

**Error: "NOTION_TOKEN no está configurado"**
- Asegúrate de exportar la variable de entorno antes de ejecutar

**Error: "Could not find page"**
- Verifica que compartiste la página con tu integración
- Confirma que el ID de la página es correcto

**Error: "Rate limited"**
- El script ya incluye delays, pero si es necesario puedes aumentar el timeout en `migrate-to-notion.js`
