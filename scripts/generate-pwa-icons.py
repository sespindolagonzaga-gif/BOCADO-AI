#!/usr/bin/env python3
"""
Script para generar iconos PWA desde un logo PNG
Requiere: pip install Pillow
"""

from PIL import Image, ImageDraw
import os

# Configuración
LOGO_PATH = "path/to/your/logo.png"  # Cambia esto por la ruta de tu logo
OUTPUT_DIR = "public/icons"
BG_COLOR = "#316559"  # Verde Bocado
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

def hex_to_rgb(hex_color):
    """Convierte color hex a RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def generate_icon(logo_path, size, output_path, bg_color):
    """Genera un icono con logo centrado y fondo de color"""
    # Crear canvas con fondo verde
    bg_rgb = hex_to_rgb(bg_color)
    icon = Image.new('RGB', (size, size), bg_rgb)
    
    # Cargar logo
    logo = Image.open(logo_path)
    
    # Si el logo tiene transparencia, convertirlo
    if logo.mode in ('RGBA', 'LA'):
        # Crear una nueva imagen sin transparencia
        background = Image.new('RGB', logo.size, bg_rgb)
        if logo.mode == 'RGBA':
            background.paste(logo, mask=logo.split()[3])  # Alpha channel
        else:
            background.paste(logo, mask=logo.split()[1])
        logo = background
    
    # Redimensionar logo manteniendo aspecto (80% del tamaño del icono)
    logo_size = int(size * 0.8)
    logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Centrar logo en el canvas
    logo_x = (size - logo.width) // 2
    logo_y = (size - logo.height) // 2
    icon.paste(logo, (logo_x, logo_y))
    
    # Guardar
    icon.save(output_path, 'PNG', optimize=True)
    print(f"✓ Generado: {output_path}")

def main():
    # Crear directorio si no existe
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("🎨 Generando iconos PWA...")
    print(f"Logo: {LOGO_PATH}")
    print(f"Color de fondo: {BG_COLOR}")
    print(f"Tamaños: {SIZES}")
    print()
    
    for size in SIZES:
        output_path = os.path.join(OUTPUT_DIR, f"icon-{size}x{size}.png")
        generate_icon(LOGO_PATH, size, output_path, BG_COLOR)
    
    print()
    print("✅ Todos los iconos generados exitosamente!")
    print(f"📁 Ubicación: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
