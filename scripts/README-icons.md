# 📱 Guía para Generar Iconos PWA

## Pasos Rápidos

### Opción 1: Herramienta Online (Recomendado)

1. Ve a: https://www.pwabuilder.com/imageGenerator
2. Sube tu logo PNG (con letras blancas)
3. Configura:
   - **Background Color**: `#316559` (verde Bocado)
   - **Padding**: 10-15% (para que el logo no toque los bordes)
4. Click en "Generate"
5. Descarga el ZIP
6. Reemplaza los archivos en `public/icons/`

### Opción 2: Script Python

```bash
# 1. Instalar dependencias
pip install Pillow

# 2. Editar el script
# Abre scripts/generate-pwa-icons.py
# Cambia: LOGO_PATH = "path/to/your/logo.png"

# 3. Ejecutar
python scripts/generate-pwa-icons.py
```

### Opción 3: Photoshop/GIMP/Figma

Para cada tamaño (72, 96, 128, 144, 152, 192, 384, 512):

1. Crear canvas cuadrado del tamaño necesario
2. Rellenar con `#316559`
3. Importar tu logo PNG
4. Centrar y redimensionar al 80% del canvas
5. Exportar como PNG: `icon-{tamaño}x{tamaño}.png`
6. Guardar en `public/icons/`

## Tamaños Necesarios

- ✅ `icon-72x72.png` - Android
- ✅ `icon-96x96.png` - Android
- ✅ `icon-128x128.png` - Chrome Web Store
- ✅ `icon-144x144.png` - Microsoft
- ✅ `icon-152x152.png` - iOS Safari
- ✅ `icon-192x192.png` - Android (principal)
- ✅ `icon-384x384.png` - Android
- ✅ `icon-512x512.png` - Android, Chrome (principal)

## Verificar

Después de generar:

```bash
npm run build
# Los iconos se copian automáticamente a dist/icons/
```

## Tips

- **Padding**: Deja 10-15% de espacio alrededor del logo
- **Legibilidad**: Verifica que las letras blancas se vean bien en el verde
- **Formato**: PNG optimizado (no usar transparencia, ya tiene fondo verde)
- **Redondeo**: Los iconos se redondean automáticamente en Android

## Color Oficial

```
Verde Bocado: #316559
RGB: (49, 101, 89)
```
