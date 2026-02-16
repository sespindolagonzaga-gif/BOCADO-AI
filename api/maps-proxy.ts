/**
 * Maps API Proxy - Protege la API key de Google Maps
 * 
 * TODAS las llamadas a Google Maps deben pasar por este proxy.
 * El frontend NUNCA debe tener acceso directo a la API key.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// ============================================
// INICIALIZACIÓN DE FIREBASE
// ============================================
if (!getApps().length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no definida');
  }
  const serviceAccount = JSON.parse(serviceAccountKey.trim());
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// ============================================
// CONFIGURACIÓN
// ============================================
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ GOOGLE_MAPS_API_KEY no está configurada');
}

// Rate limiting simple por IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests por minuto

// ============================================
// DETECCIÓN DE UBICACIÓN POR IP
// ============================================

interface IPLocationResult {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  timezone: string;
  isp: string;
}

/**
 * Detecta la ubicación aproximada del usuario basada en su IP.
 * Usa ipapi.co como servicio gratuito (10,000 requests/mes gratis)
 */
async function detectLocationByIP(ip: string): Promise<IPLocationResult | null> {
  // Ignorar IPs privadas/locales
  if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    console.log('[IP Detection] IP local detectada, no se puede geolocalizar');
    return null;
  }

  // Limpiar IP (quitar prefijo IPv6 si existe)
  const cleanIP = ip.replace(/^::ffff:/, '');
  
  try {
    // Usar ipapi.co (gratuito, no requiere API key para uso básico)
    const response = await fetch(`https://ipapi.co/${cleanIP}/json/`, {
      headers: {
        'User-Agent': 'BocadoApp/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`[IP Detection] Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.warn('[IP Detection] API error:', data.error);
      return null;
    }

    return {
      country: data.country_name || '',
      countryCode: data.country_code || '',
      city: data.city || '',
      lat: data.latitude,
      lng: data.longitude,
      timezone: data.timezone || '',
      isp: data.org || '',
    };
  } catch (error) {
    console.error('[IP Detection] Error:', error);
    return null;
  }
}

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const AutocompleteSchema = z.object({
  query: z.string().min(2).max(100),
  countryCode: z.string().length(2).optional(),
});

const PlaceDetailsSchema = z.object({
  placeId: z.string().min(5).max(100),
});

const GeocodeSchema = z.object({
  address: z.string().min(3).max(200),
});

const ReverseGeocodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// ============================================
// RATE LIMITING POR IP
// ============================================

interface RateLimitRecord {
  requests: number[];
  updatedAt: FirebaseFirestore.Timestamp;
}

// Límites de rate limiting
// Autenticados: más permisivos
// No autenticados: más restrictivos pero suficientes para búsqueda
const RATE_LIMITS = {
  authenticated: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 50,     // 50 requests por minuto
  },
  unauthenticated: {
    windowMs: 60 * 1000, // 1 minuto  
    maxRequests: 20,     // 20 requests por minuto (suficiente para typing)
  }
};

async function checkRateLimit(ip: string, isAuthenticated: boolean = false): Promise<{ allowed: boolean; retryAfter?: number }> {
  const docRef = db.collection('maps_proxy_rate_limits').doc(ip);
  const now = Date.now();
  
  // Usar colección diferente para autenticados vs no autenticados
  const limits = isAuthenticated ? RATE_LIMITS.authenticated : RATE_LIMITS.unauthenticated;

  try {
    return await db.runTransaction(async (t) => {
      const doc = await t.get(docRef);
      const data = doc.exists ? doc.data() as RateLimitRecord : null;

      const validRequests = (data?.requests || [])
        .filter((ts) => now - ts < limits.windowMs);

      if (validRequests.length >= limits.maxRequests) {
        const oldestRequest = Math.min(...validRequests);
        const retryAfter = Math.ceil((oldestRequest + limits.windowMs - now) / 1000);
        return { allowed: false, retryAfter };
      }

      t.set(docRef, {
        requests: [...validRequests, now],
        updatedAt: FieldValue.serverTimestamp(),
        isAuthenticated, // Guardar estado para debugging
      });

      return { allowed: true };
    });
  } catch (error) {
    console.error('Error en rate limit:', error);
    // Fail-closed: rechazar si hay error
    return { allowed: false, retryAfter: 60 };
  }
}

// ============================================
// CACHE SIMPLE (Firestore)
// ============================================

async function getCachedResponse(cacheKey: string): Promise<any | null> {
  try {
    const docRef = db.collection('maps_proxy_cache').doc(cacheKey);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    const data = doc.data();
    const expiresAt = data?.expiresAt?.toMillis?.() || 0;
    
    if (Date.now() > expiresAt) {
      // Cache expirado, eliminar
      await docRef.delete();
      return null;
    }
    
    return data?.response || null;
  } catch (error) {
    return null;
  }
}

async function setCachedResponse(cacheKey: string, response: any, ttlMinutes: number = 60): Promise<void> {
  try {
    const docRef = db.collection('maps_proxy_cache').doc(cacheKey);
    
    // ✅ FIX: Calcular expiresAt correctamente sumando el TTL
    const now = Date.now();
    const expiresAt = new Date(now + ttlMinutes * 60 * 1000);
    
    await docRef.set({
      response,
      expiresAt: expiresAt,  // Timestamp futuro calculado
      createdAt: FieldValue.serverTimestamp(),
      ttlMinutes: ttlMinutes, // Guardar para debugging
    });
  } catch (error) {
    // Silenciar errores de cache
  }
}

function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `${prefix}_${Buffer.from(sortedParams).toString('base64').substring(0, 50)}`;
}

// ============================================
// CORS CONFIGURATION
// ============================================

const ALLOWED_ORIGINS = [
  // Producción
  'https://bocado-ai.vercel.app',
  'https://bocado.app',
  'https://www.bocado.app',
  'https://app.bocado.app',
  // Desarrollo
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Permitir peticiones sin origin (same-origin requests, mobile apps, etc.)
  if (!origin) return true;
  // Permitir localhost en desarrollo
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  return ALLOWED_ORIGINS.includes(origin);
};

// ============================================
// HANDLER PRINCIPAL
// ============================================

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  
  // CORS
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  // Si no hay origin (same-origin), usar wildcard
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verificar API key configurada
  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'Maps API not configured' });
  }

  // Rate limiting por IP
  const clientIP = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
  
  // Obtener la acción antes del rate limiting para aplicar límites diferentes
  const { action, ...params } = req.body;
  
  // Autocomplete puede funcionar sin auth (para flujo de registro)
  // Pero con rate limiting más estricto
  const isPublicAction = action === 'autocomplete';
  
  // Verificar autenticación (requerida para todo excepto autocomplete)
  let isAuthenticated = false;
  const authHeader = req.headers?.authorization || '';
  const tokenMatch = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const idToken = tokenMatch?.[1];

  if (idToken) {
    try {
      await getAuth().verifyIdToken(idToken);
      isAuthenticated = true;
    } catch (err) {
      if (!isPublicAction) {
        return res.status(401).json({ error: 'Invalid auth token' });
      }
    }
  } else if (!isPublicAction) {
    return res.status(401).json({ error: 'Auth token required' });
  }
  
  // Rate limiting: más estricto para requests públicos
  const rateCheck = await checkRateLimit(clientIP, isAuthenticated);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: rateCheck.retryAfter,
    });
  }

  try {
    switch (action) {
      case 'autocomplete': {
        const validated = AutocompleteSchema.parse(params);
        return await handleAutocomplete(res, validated);
      }
      case 'placeDetails': {
        const validated = PlaceDetailsSchema.parse(params);
        return await handlePlaceDetails(res, validated);
      }
      case 'geocode': {
        const validated = GeocodeSchema.parse(params);
        return await handleGeocode(res, validated);
      }
      case 'reverseGeocode': {
        const validated = ReverseGeocodeSchema.parse(params);
        return await handleReverseGeocode(res, validated);
      }
      case 'detectLocation': {
        // Detectar ubicación por IP
        const clientIP = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
          .toString().split(',')[0].trim();
        const location = await detectLocationByIP(clientIP);
        
        if (!location) {
          return res.status(404).json({ 
            error: 'No se pudo detectar la ubicación',
            fallback: true 
          });
        }
        
        return res.status(200).json(location);
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.issues.map(i => i.message),
      });
    }
    console.error('Maps proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================
// HANDLERS ESPECÍFICOS
// ============================================

async function handleAutocomplete(res: any, params: z.infer<typeof AutocompleteSchema>) {
  const cacheKey = generateCacheKey('ac', params);
  const cached = await getCachedResponse(cacheKey);
  
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  const components = params.countryCode ? `&components=country:${params.countryCode.toLowerCase()}` : '';
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    params.query
  )}&types=(cities)&language=es${components}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Google Places API error:', {
      status: data.status,
      error_message: data.error_message,
      query: params.query,
    });
    return res.status(500).json({ 
      error: 'Maps API error', 
      details: data.status,
      debug: data.error_message || 'No additional info'
    });
  }

  const result = {
    predictions: (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || '',
      secondaryText: p.structured_formatting?.secondary_text || '',
    })),
  };

  // Cachear por 24 horas (datos de lugares no cambian mucho)
  await setCachedResponse(cacheKey, result, 24 * 60);
  
  return res.status(200).json(result);
}

async function handlePlaceDetails(res: any, params: z.infer<typeof PlaceDetailsSchema>) {
  const cacheKey = generateCacheKey('pd', params);
  const cached = await getCachedResponse(cacheKey);
  
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${params.placeId}&fields=geometry,formatted_address,address_components&language=es&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.result) {
    return res.status(404).json({ error: 'Place not found' });
  }

  const result = data.result;
  const location = result.geometry?.location;

  // Extraer ciudad y país
  let city = '';
  let country = '';
  let countryCode = '';

  for (const component of result.address_components || []) {
    const types = component.types;
    if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      city = component.long_name;
    }
    if (types.includes('country')) {
      country = component.long_name;
      countryCode = component.short_name;
    }
  }

  const output = {
    location: { lat: location.lat, lng: location.lng },
    formattedAddress: result.formatted_address,
    city,
    country,
    countryCode,
  };

  // Cachear por 7 días
  await setCachedResponse(cacheKey, output, 7 * 24 * 60);
  
  return res.status(200).json(output);
}

async function handleGeocode(res: any, params: z.infer<typeof GeocodeSchema>) {
  const cacheKey = generateCacheKey('geo', params);
  const cached = await getCachedResponse(cacheKey);
  
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    params.address
  )}&language=es&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.[0]) {
    return res.status(404).json({ error: 'Address not found' });
  }

  const result = data.results[0];
  const location = result.geometry?.location;

  let city = '';
  let country = '';
  let countryCode = '';

  for (const component of result.address_components) {
    const types = component.types;
    if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      city = component.long_name;
    }
    if (types.includes('country')) {
      country = component.long_name;
      countryCode = component.short_name;
    }
  }

  const output = {
    location: { lat: location.lat, lng: location.lng },
    formattedAddress: result.formatted_address,
    city,
    country,
    countryCode,
  };

  // Cachear por 7 días
  await setCachedResponse(cacheKey, output, 7 * 24 * 60);
  
  return res.status(200).json(output);
}

async function handleReverseGeocode(res: any, params: z.infer<typeof ReverseGeocodeSchema>) {
  // No cacheamos reverse geocode (coordenadas son únicas)
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${params.lat},${params.lng}&language=es&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.[0]) {
    console.error('Reverse geocode no results:', {
      status: data.status,
      error_message: data.error_message || 'No error_message',
      lat: params.lat,
      lng: params.lng,
      hasResults: Array.isArray(data.results) ? data.results.length : 0,
    });
    return res.status(404).json({ error: 'Location not found' });
  }

  const result = data.results[0];

  let city = '';
  let country = '';
  let countryCode = '';

  for (const component of result.address_components) {
    const types = component.types;
    if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      city = component.long_name;
    }
    if (types.includes('country')) {
      country = component.long_name;
      countryCode = component.short_name;
    }
  }

  return res.status(200).json({
    location: { lat: params.lat, lng: params.lng },
    formattedAddress: result.formatted_address,
    city,
    country,
    countryCode,
  });
}
