const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Color de tema de la app
const THEME_COLOR = '#4A7C59';
const BACKGROUND_COLOR = '#FAFAF5';

// Tamaños de iconos PWA estándar
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Directorio de salida
const outputDir = path.join(__dirname, '..', 'public', 'icons');

// Crear SVG del icono - un diseño simple y elegante con una "B" estilizada
// representando "Bocado" con elementos de comida
function createIconSVG(size) {
  const isMaskable = size >= 192; // Iconos grandes con área segura para máscaras
  const padding = isMaskable ? size * 0.1 : 0; // 10% de padding para maskable
  const effectiveSize = size - (padding * 2);
  const center = size / 2;
  
  // Radio del círculo principal
  const circleRadius = effectiveSize * 0.4;
  
  // Color del tema
  const fillColor = THEME_COLOR;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#5A8C69;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#3A6C49;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Fondo -->
    <rect width="${size}" height="${size}" fill="${BACKGROUND_COLOR}"/>
    
    <!-- Círculo principal con gradiente -->
    <circle cx="${center}" cy="${center}" r="${circleRadius}" fill="url(#grad${size})"/>
    
    <!-- Letra B estilizada -->
    <text x="${center}" y="${center}" 
          font-family="Arial, sans-serif" 
          font-size="${effectiveSize * 0.5}" 
          font-weight="bold" 
          fill="white" 
          text-anchor="middle" 
          dominant-baseline="central">B</text>
    
    <!-- Pequeño elemento decorativo - hoja/tenedor estilizado -->
    <circle cx="${center + effectiveSize * 0.25}" cy="${center - effectiveSize * 0.15}" r="${effectiveSize * 0.06}" fill="#7BC67E" opacity="0.9"/>
  </svg>`;
}

async function generateIcons() {
  console.log('Generando iconos PWA para Bocado...\n');
  
  // Asegurar que el directorio existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (const size of sizes) {
    const svg = createIconSVG(size);
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      console.log(`✓ icon-${size}x${size}.png - ${(stats.size / 1024).toFixed(1)} KB`);
    } catch (error) {
      console.error(`✗ Error generando icon-${size}x${size}.png:`, error.message);
    }
  }
  
  console.log('\n✅ Iconos generados correctamente en:', outputDir);
}

generateIcons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
