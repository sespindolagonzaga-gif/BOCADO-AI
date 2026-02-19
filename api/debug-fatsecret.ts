/**
 * 🔍 DEBUG ENDPOINT: Probar FatSecret API
 * 
 * Por SEGURIDAD solo disponible en desarrollo
 * Uso: GET /api/debug-fatsecret?query=pollo
 * 
 * Requiere:
 * - FATSECRET_KEY
 * - FATSECRET_SECRET
 */

import { searchFatSecretIngredients } from './utils/fatsecret';

export default async function handler(req: any, res: any) {
  // 🔒 SEGURIDAD: Solo en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Debug endpoint not available in production',
      message: 'Este endpoint solo está disponible en desarrollo local',
    });
  }

  // CORS para desarrollo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      error: 'Missing query parameter',
      usage: 'GET /api/debug-fatsecret?query=pollo',
      example: 'GET /api/debug-fatsecret?query=pollo&limit=5',
    });
  }

  // Verificar credenciales
  if (!process.env.FATSECRET_KEY || !process.env.FATSECRET_SECRET) {
    return res.status(503).json({
      error: 'FatSecret credentials not configured',
      message: 'Configura FATSECRET_KEY y FATSECRET_SECRET en .env.local',
      instructions: `
1. Ve a https://platform.fatsecret.com/api/
2. Login/Signup
3. Copia: Consumer Key y Consumer Secret
4. Agrega a .env.local:
   FATSECRET_KEY=tu_key
   FATSECRET_SECRET=tu_secret
5. Reinicia dev server
      `.trim(),
    });
  }

  try {
    const startTime = Date.now();

    // Llamar FatSecret
    const results = await searchFatSecretIngredients(query, 10);

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      query,
      duration_ms: duration,
      count: results.length,
      results: results.slice(0, 10), // Primeros 10
      raw_results: results, // Todos para debugging
      help: {
        message: 'FatSecret funcionando correctamente ✅',
        what_is_this: 'Lista de ingredientes de FatSecret que matchean con tu búsqueda',
        structure: {
          food_id: 'ID en FatSecret',
          food_name: 'Nombre del ingrediente',
          brand_name: 'Marca (si aplica)',
          food_type: 'Tipo (Generic, Brand, Restaurant, etc)',
          score: 'Relevancia (0-100)',
        },
      },
    });
  } catch (error: any) {
    console.error('❌ FatSecret Error:', error);

    return res.status(500).json({
      error: 'FatSecret API failed',
      message: error.message,
      code: error.code,
      tips: [
        '¿Las credenciales son correctas?',
        '¿Ya usaste 100 requests/hora? (plan limited)',
        '¿La query tiene caracteres especiales?',
        'Revisa console.log para más detalles',
      ],
    });
  }
}
