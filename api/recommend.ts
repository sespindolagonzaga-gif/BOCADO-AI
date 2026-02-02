import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Manejo de CORS para desarrollo local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { userId, type, context } = req.body;
    
    // Log para ver que los datos llegan bien a Vercel
    console.log(`Solicitud de ${type} para usuario: ${userId}`);

    // Aquí es donde en el siguiente paso meteremos a Gemini
    return res.status(200).json({ 
      success: true, 
      message: "Conexión exitosa con el backend de Bocado",
      received: { userId, type } 
    });
  } catch (error) {
    console.error("Error en API:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
