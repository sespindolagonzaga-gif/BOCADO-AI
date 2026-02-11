import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

// ============================================
// 1. INICIALIZACIÓN DE FIREBASE
// ============================================
if (!getApps().length) {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no definida");
    }
    const serviceAccount = JSON.parse(serviceAccountKey.trim());
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase inicializado correctamente');
  } catch (error) {
    console.error("❌ Error Firebase Init:", error);
    throw error;
  }
}

const db = getFirestore();

// ============================================
// AIRTABLE CACHE (6 horas TTL) - Evita rate limits de Airtable
// ============================================

const AIRTABLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

interface AirtableCacheEntry {
  items: any[];
  formula: string;
  cachedAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
}

/**
 * Obtiene ingredientes de Airtable con caché de 6 horas.
 * Reduce drásticamente las llamadas a la API de Airtable.
 */
async function getAirtableIngredientsWithCache(
  formula: string, 
  baseId: string, 
  tableName: string, 
  apiKey: string
): Promise<any[]> {
  // Cache key basado en el hash de la fórmula (no del userId)
  const cacheKey = `airtable_${crypto.createHash('md5').update(formula).digest('hex').substring(0, 16)}`;
  const cacheRef = db.collection('airtable_cache').doc(cacheKey);
  
  try {
    // 1. Intentar leer caché
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() as AirtableCacheEntry;
      const age = Date.now() - (data?.cachedAt?.toMillis?.() || 0);
      
      if (age < AIRTABLE_CACHE_TTL_MS) {
        safeLog('log', `[Airtable] Cache HIT: ${cacheKey.substring(0, 20)}... (${Math.round(age / 1000 / 60)}m old)`);
        return data.items || [];
      }
    }
  } catch (cacheError) {
    safeLog('warn', '[Airtable] Error leyendo caché, continuando con fetch', cacheError);
  }
  
  // 2. Fetch de Airtable
  const airtableUrl = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=100`;
  
  const airtableRes = await fetch(airtableUrl, {
    headers: { 
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!airtableRes.ok) {
    const errorText = await airtableRes.text();
    throw new Error(`Airtable HTTP ${airtableRes.status}: ${errorText}`);
  }
  
  const airtableData = await airtableRes.json();
  const items = airtableData.records || [];
  
  // 3. Guardar en caché (con expiresAt para el cleanup job)
  try {
    await cacheRef.set({
      items,
      formula, // Guardar fórmula para debugging
      cachedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + AIRTABLE_CACHE_TTL_MS + 24 * 60 * 60 * 1000), // 30h total (6h útil + 24h buffer)
    });
    safeLog('log', `[Airtable] Cache MISS: guardados ${items.length} items`);
  } catch (cacheError) {
    safeLog('warn', '[Airtable] Error guardando caché', cacheError);
  }
  
  return items;
}

// ============================================
// RATE LIMITING DISTRIBUIDO (INLINE - después de inicializar Firebase)
// ============================================

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  cooldownMs: number;
  stuckThresholdMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  secondsLeft?: number;
  error?: string;
  remainingRequests?: number;
}

interface RateLimitRecord {
  requests: number[];
  currentProcess?: {
    startedAt: number;
    interactionId: string;
  };
  updatedAt: FirebaseFirestore.Timestamp;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 10 * 60 * 1000,    // 10 minutos
  maxRequests: 5,               // 5 requests por ventana
  cooldownMs: 30 * 1000,        // 30 segundos entre requests
  stuckThresholdMs: 2 * 60 * 1000, // 2 minutos para cleanup
};

class DistributedRateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const counterRef = db.collection('rate_limit_v2').doc(userId);
    const now = Date.now();

    try {
      return await db.runTransaction<RateLimitResult>(async (t) => {
        const doc = await t.get(counterRef);
        const data = doc.exists ? doc.data() as RateLimitRecord : null;

        if (data?.currentProcess) {
          const processAge = now - data.currentProcess.startedAt;
          
          if (processAge > this.config.stuckThresholdMs) {
            safeLog('log', `🧹 Limpiando proceso atascado para ${userId?.substring(0, 8)}... (${Math.round(processAge / 1000)}s)`);
            t.update(counterRef, {
              currentProcess: null,
              'metadata.cleanedAt': FieldValue.serverTimestamp(),
              'metadata.cleanReason': 'stuck_timeout',
            });
          } else {
            const secondsLeft = Math.ceil((this.config.cooldownMs - (now - data.currentProcess.startedAt)) / 1000);
            return {
              allowed: false,
              secondsLeft: Math.max(1, secondsLeft),
              error: 'Ya estás generando una recomendación. Espera un momento.',
              remainingRequests: 0,
            };
          }
        }

        const validRequests = data?.requests?.filter(
          (ts) => now - ts < this.config.windowMs
        ) || [];

        if (validRequests.length >= this.config.maxRequests) {
          const oldestRequest = Math.min(...validRequests);
          const retryAfter = Math.ceil((oldestRequest + this.config.windowMs - now) / 1000);

          return {
            allowed: false,
            secondsLeft: Math.max(1, retryAfter),
            error: `Límite de ${this.config.maxRequests} recomendaciones cada ${this.config.windowMs / 60000} minutos. Espera ${retryAfter} segundos.`,
            remainingRequests: 0,
          };
        }

        if (validRequests.length > 0) {
          const lastRequest = Math.max(...validRequests);
          const timeSinceLastRequest = now - lastRequest;

          if (timeSinceLastRequest < this.config.cooldownMs) {
            const secondsLeft = Math.ceil((this.config.cooldownMs - timeSinceLastRequest) / 1000);

            return {
              allowed: false,
              secondsLeft,
              error: `Espera ${secondsLeft} segundos antes de generar otra recomendación.`,
              remainingRequests: this.config.maxRequests - validRequests.length,
            };
          }
        }

        const newRecord: Partial<RateLimitRecord> = {
          requests: validRequests,
          currentProcess: {
            startedAt: now,
            interactionId: `proc_${now}`,
          },
          updatedAt: FieldValue.serverTimestamp() as any,
        };

        t.set(counterRef, newRecord, { merge: true });

        return {
          allowed: true,
          remainingRequests: this.config.maxRequests - validRequests.length - 1,
        };
      });
    } catch (error: any) {
      safeLog('error', '❌ Error en rate limit transaction', error);
      // FAIL-CLOSED: Si no podemos verificar rate limit, rechazar la request
      return { 
        allowed: false, 
        error: 'Error de seguridad: no se pudo verificar el límite de uso. Intenta de nuevo en unos momentos.' 
      };
    }
  }

  async completeProcess(userId: string): Promise<void> {
    const counterRef = db.collection('rate_limit_v2').doc(userId);
    const now = Date.now();

    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(counterRef);
        
        if (!doc.exists) {
          t.set(counterRef, {
            requests: [now],
            currentProcess: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        const data = doc.data() as RateLimitRecord;
        const validRequests = (data.requests || [])
          .filter((ts) => now - ts < this.config.windowMs)
          .concat(now)
          .slice(-this.config.maxRequests);

        t.update(counterRef, {
          requests: validRequests,
          currentProcess: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (error) {
      safeLog('error', '❌ Error marcando proceso como completado', error);
    }
  }

  async failProcess(userId: string, errorInfo?: string): Promise<void> {
    const counterRef = db.collection('rate_limit_v2').doc(userId);

    try {
      await counterRef.update({
        currentProcess: null,
        lastError: {
          message: errorInfo || 'Unknown error',
          at: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      safeLog('error', '❌ Error marcando proceso como fallido', error);
    }
  }

  async getStatus(userId: string): Promise<{
    requestsInWindow: number;
    currentProcess?: { startedAt: number; interactionId: string };
    canRequest: boolean;
    nextAvailableAt?: number;
  } | null> {
    const counterRef = db.collection('rate_limit_v2').doc(userId);
    const now = Date.now();

    try {
      const doc = await counterRef.get();
      if (!doc.exists) return null;

      const data = doc.data() as RateLimitRecord;
      const validRequests = (data.requests || []).filter(
        (ts) => now - ts < this.config.windowMs
      );

      let nextAvailableAt: number | undefined;

      if (data.currentProcess) {
        nextAvailableAt = data.currentProcess.startedAt + this.config.cooldownMs;
      } else if (validRequests.length >= this.config.maxRequests) {
        const oldestRequest = Math.min(...validRequests);
        nextAvailableAt = oldestRequest + this.config.windowMs;
      } else if (validRequests.length > 0) {
        const lastRequest = Math.max(...validRequests);
        const cooldownEnd = lastRequest + this.config.cooldownMs;
        if (cooldownEnd > now) {
          nextAvailableAt = cooldownEnd;
        }
      }

      return {
        requestsInWindow: validRequests.length,
        currentProcess: data.currentProcess,
        canRequest: !data.currentProcess && validRequests.length < this.config.maxRequests,
        nextAvailableAt,
      };
    } catch (error) {
      safeLog('error', 'Error obteniendo status', error);
      return null;
    }
  }
}

const rateLimiter = new DistributedRateLimiter();

// ============================================
// 2. VALIDACIÓN CON ZOD
// ============================================

import { z } from 'zod';

// Schema para validar el body de la request
const RequestBodySchema = z.object({
  userId: z.string().min(1).max(128),
  type: z.enum(['En casa', 'Fuera']),
  mealType: z.string().max(50).optional().nullable(),
  cookingTime: z.union([z.string(), z.number()]).optional().nullable(),
  cravings: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  budget: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  dislikedFoods: z.array(z.string().max(100)).max(50).optional().default([]),
  _id: z.string().max(128).optional(),
  // Ubicación del usuario (opcional - geolocalización del navegador)
  userLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
  }).optional().nullable(),
});

type RequestBody = z.infer<typeof RequestBodySchema>;

// Schemas para validar respuesta de Gemini
const MacroSchema = z.object({
  kcal: z.number().max(50000).default(0),
  proteinas_g: z.number().max(5000).default(0),
  carbohidratos_g: z.number().max(5000).default(0),
  grasas_g: z.number().max(5000).default(0),
});

const RecipeSchema = z.object({
  id: z.union([z.number(), z.string()]),
  titulo: z.string().max(200),
  tiempo_estimado: z.string().max(50).optional(),
  dificultad: z.enum(['Fácil', 'Media', 'Difícil']).optional(),
  coincidencia_despensa: z.string().max(100).optional(),
  ingredientes: z.array(z.string().max(200)).max(50),
  pasos_preparacion: z.array(z.string().max(1000)).max(50),
  macros_por_porcion: MacroSchema.optional(),
});

const RecipeResponseSchema = z.object({
  saludo_personalizado: z.string().max(1000),
  receta: z.object({
    recetas: z.array(RecipeSchema).max(10),
  }),
});

const RestaurantSchema = z.object({
  id: z.union([z.number(), z.string()]),
  nombre_restaurante: z.string().max(200),
  tipo_comida: z.string().max(100),
  direccion_aproximada: z.string().max(500),
  plato_sugerido: z.string().max(200),
  por_que_es_bueno: z.string().max(1000),
  hack_saludable: z.string().max(500),
});

const RestaurantResponseSchema = z.object({
  saludo_personalizado: z.string().max(1000),
  ubicacion_detectada: z.string().max(200).optional(),
  recomendaciones: z.array(RestaurantSchema).max(10),
});

interface UserProfile {
  nutritionalGoal?: string;
  allergies?: string[];
  diseases?: string[];
  dislikedFoods?: string[];
  city?: string;
  countryName?: string;
  gender?: string;
  age?: string;
  weight?: string;
  height?: string;
  activityLevel?: string;
  activityFrequency?: string;
  // Coordenadas guardadas del perfil (de la ciudad registrada)
  location?: {
    lat: number;
    lng: number;
  };
  locationEnabled?: boolean;
}

interface AirtableIngredient {
  id: string;
  fields: {
    México?: string;
    España?: string;
    EUA?: string;
    Nombre?: string;
    Ingrediente?: string;
    Vegano?: boolean;
    Vegetariano?: boolean;
    Celíaco?: boolean;
    Intolerancia_lactosa?: boolean;
    Alergia_frutos_secos?: boolean;
    Índice_glucémico?: number;
    Sodio_mg?: number;
    Colesterol_mg?: number;
    Yodo_µg?: number;
    Fibra_dietética_g?: number;
    Azúcares_totales_g?: number;
    Grasas_saturadas_g?: number;
  };
}

// ============================================
// 3. FUNCIONES DE UTILIDAD
// ============================================

// Sanitiza errores para no exponer datos sensibles en logs
const sanitizeError = (error: any): { message: string; code?: string; safeToLog: boolean } => {
  const errorMessage = error?.message || String(error);
  
  // Detectar errores que pueden contener datos sensibles
  const sensitivePatterns = [
    /api[_-]?key/i,
    /token/i,
    /password/i,
    /secret/i,
    /credential/i,
    /firebase/i,
    /airtable.*v0\/.*\//i, // URLs de Airtable con API key
  ];
  
  const hasSensitiveData = sensitivePatterns.some(pattern => pattern.test(errorMessage));
  
  if (hasSensitiveData) {
    return {
      message: 'Error sanitizado: contiene datos sensibles',
      code: error?.code,
      safeToLog: false
    };
  }
  
  return {
    message: errorMessage.substring(0, 500), // Limitar longitud
    code: error?.code,
    safeToLog: true
  };
};

// Logger seguro que respeta el entorno
const safeLog = (level: 'log' | 'error' | 'warn', message: string, error?: any) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (error) {
    const sanitized = sanitizeError(error);
    if (sanitized.safeToLog || isDev) {
      console[level](message, isDev ? error : sanitized.message);
    } else {
      console[level](message, '[Error sanitizado - ver logs seguros]');
    }
  } else {
    console[level](message);
  }
};

const normalizeText = (text: string): string => 
  text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

const getRootWord = (text: string): string => {
  let clean = normalizeText(text);
  if (clean.length <= 3) return clean;
  if (clean.endsWith('ces')) return clean.slice(0, -3) + 'z';
  if (clean.endsWith('es')) return clean.slice(0, -2);
  if (clean.endsWith('s')) return clean.slice(0, -1);
  return clean;
};

const createRegexPattern = (text: string): string => {
  const root = getRootWord(text);
  return root
    .replace(/a/g, '[aáàäâ]')
    .replace(/e/g, '[eéèëê]')
    .replace(/i/g, '[iíìïî]')
    .replace(/o/g, '[oóòöô]')
    .replace(/u/g, '[uúùüû]');
};

const ensureArray = (input: any): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter((i): i is string => typeof i === 'string');
  if (typeof input === 'string') return input.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const formatList = (data: any): string => {
  if (!data || (Array.isArray(data) && data.length === 0)) return "Ninguna";
  if (Array.isArray(data)) return data.join(", ");
  return String(data);
};

// ============================================
// 4. FILTROS DE SEGURIDAD ALIMENTARIA
// ============================================

const buildAirtableFormula = (user: UserProfile): string => {
  const conditions: string[] = [];
  
  const prefs = ensureArray(user.allergies);
  if (prefs.includes("Vegano")) conditions.push("{Vegano} = TRUE()");
  if (prefs.includes("Vegetariano")) conditions.push("{Vegetariano} = TRUE()");
  if (prefs.includes("Celíaco")) conditions.push("{Celíaco} = TRUE()");
  if (prefs.includes("Intolerante a la lactosa")) conditions.push("{Intolerancia_lactosa} = TRUE()");
  if (prefs.includes("Alergia a frutos secos")) conditions.push("{Alergia_frutos_secos} = TRUE()");
  
  const illnesses = ensureArray(user.diseases);
  if (illnesses.includes("Diabetes")) {
    conditions.push("AND({Índice_glucémico} < 55, {Azúcares_totales_g} < 10)");
  }
  if (illnesses.includes("Hipertensión")) conditions.push("{Sodio_mg} < 140");
  if (illnesses.includes("Colesterol")) {
    conditions.push("AND({Colesterol_mg} < 20, {Grasas_saturadas_g} < 1.5)");
  }
  if (illnesses.includes("Hipotiroidismo")) conditions.push("{Yodo_µg} > 10");
  if (illnesses.includes("Hipertiroidismo")) conditions.push("{Yodo_µg} < 50");
  if (illnesses.includes("Intestino irritable")) {
    conditions.push("AND({Fibra_dietética_g} > 1, {Fibra_dietética_g} < 10)");
  }
  
  const dislikes = ensureArray(user.dislikedFoods);
  if (dislikes.length > 0) {
    const searchTarget = 'CONCATENATE({Ingrediente}, " ", {México}, " ", {España}, " ", {EUA})';
    dislikes.forEach(foodItem => {
      const pattern = createRegexPattern(foodItem);
      conditions.push(`NOT(REGEX_MATCH(${searchTarget}, '(?i)${pattern}'))`);
    });
  }
  
  return conditions.length > 0 ? `AND(${conditions.join(", ")})` : "TRUE()";
};

// ============================================
// 5. SISTEMA DE SCORING
// ============================================

const scoreIngredients = (
  airtableItems: AirtableIngredient[],
  pantryItems: string[]
): { priorityList: string; marketList: string; hasPantryItems: boolean } => {
  
  const pantryRoots = pantryItems
    .map(item => getRootWord(item))
    .filter(root => root && root.length > 2);
  
  const genericWords = ["aceite", "sal", "leche", "pan", "harina", "agua", "mantequilla", "crema", "salsa"];
  
  const scoredItems = airtableItems.map(atItem => {
    const rawName = atItem.fields.México || atItem.fields.Ingrediente || atItem.fields.Nombre || atItem.fields.España || "";
    if (!rawName) return { name: "", score: 0 };
    
    const norm = normalizeText(rawName);
    const root = getRootWord(rawName);
    let score = 1;
    
    pantryRoots.forEach(pantryRoot => {
      if (root === pantryRoot) {
        score = 50;
      } else if (new RegExp(`\\b${pantryRoot}\\b`, 'i').test(norm)) {
        if (!(norm.split(/\s+/).length > 2 && genericWords.includes(pantryRoot))) {
          score = 20;
        }
      }
    });
    
    return { name: rawName, score };
  }).filter(item => item.name);
  
  scoredItems.sort((a, b) => b.score - a.score);
  
  const priorityList = scoredItems.filter(i => i.score >= 20).map(i => i.name).join(", ");
  const marketList = scoredItems.filter(i => i.score < 20).map(i => i.name).join(", ");
  
  return { priorityList, marketList, hasPantryItems: priorityList.length > 0 };
};

// ============================================
// 6. RATE LIMITING POR IP (Protección contra abuso)
// ============================================

class IPRateLimiter {
  private config = {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30,     // 30 requests por minuto por IP
    blockDurationMs: 5 * 60 * 1000, // 5 minutos de bloqueo si excede
  };

  async checkIPLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const docRef = db.collection('ip_rate_limits').doc(ip);
    const now = Date.now();

    try {
      return await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        const data = doc.exists ? doc.data() as any : null;

        // Si está bloqueado
        if (data?.blockedUntil && data.blockedUntil > now) {
          return { 
            allowed: false, 
            retryAfter: Math.ceil((data.blockedUntil - now) / 1000)
          };
        }

        const requests = (data?.requests || [])
          .filter((ts: number) => now - ts < this.config.windowMs);

        // Si excede el límite, bloquear
        if (requests.length >= this.config.maxRequests) {
          t.set(docRef, {
            requests: [...requests, now],
            blockedUntil: now + this.config.blockDurationMs,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return { 
            allowed: false, 
            retryAfter: Math.ceil(this.config.blockDurationMs / 1000)
          };
        }

        // Registrar request
        t.set(docRef, {
          requests: [...requests, now],
          blockedUntil: null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { allowed: true };
      });
    } catch (error) {
      safeLog('error', 'Error en IP rate limit', error);
      // FAIL-CLOSED: Si no podemos verificar IP rate limit, rechazar por seguridad
      return { 
        allowed: false, 
        retryAfter: 60 // Bloquear 1 minuto como precaución
      };
    }
  }
}

const ipRateLimiter = new IPRateLimiter();

// ============================================
// 7. CONFIGURACIÓN DE BÚSQUEDA DE RESTAURANTES
// ============================================

// Rango de búsqueda en metros (5km)
const SEARCH_RADIUS_METERS = 5000;

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Determina las coordenadas a usar para la búsqueda de restaurantes
 * Prioridad: 1) userLocation del request, 2) location del perfil, 3) null
 */
function getSearchCoordinates(request: RequestBody, user: UserProfile): Coordinates | null {
  // 1. Primero intentar usar la geolocalización del usuario (si dio permiso)
  if (request.userLocation?.lat && request.userLocation?.lng) {
    return {
      lat: request.userLocation.lat,
      lng: request.userLocation.lng,
    };
  }
  
  // 2. Fallback: usar la ubicación guardada del perfil (de la ciudad registrada)
  if (user.location?.lat && user.location?.lng) {
    return {
      lat: user.location.lat,
      lng: user.location.lng,
    };
  }
  
  return null;
}

/**
 * Formatea las coordenadas para mostrar en el prompt
 */
function formatCoordinates(coords: Coordinates): string {
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}

// ============================================
// 8. UTILIDAD PARA GENERAR LINKS DE MAPS
// ============================================

const generateMapsLink = (restaurantName: string, address: string, city: string): string => {
  // Limpiar caracteres especiales pero mantener espacios para la query
  const cleanName = restaurantName.replace(/[^\w\s\-&,]/g, '').trim();
  const cleanAddress = (address || '').replace(/[^\w\s\-&,]/g, '').trim();
  const cleanCity = (city || '').replace(/[^\w\s\-&]/g, '').trim();
  
  // Priorizar: Nombre + Dirección + Ciudad (más preciso)
  // Fallback: Nombre + Ciudad
  const searchQuery = cleanAddress 
    ? `${cleanName} ${cleanAddress} ${cleanCity}`
    : `${cleanName} ${cleanCity}`;
  
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
};

const sanitizeRecommendation = (rec: any, city: string) => {
  // Asegurar que el link de Maps sea válido y use dirección si existe
  if (rec.nombre_restaurante) {
    const address = rec.direccion_aproximada || '';
    rec.link_maps = generateMapsLink(rec.nombre_restaurante, address, city);
  }
  
  // Asegurar que no haya campos undefined
  rec.direccion_aproximada = rec.direccion_aproximada || `En ${city}`;
  rec.por_que_es_bueno = rec.por_que_es_bueno || 'Opción saludable disponible';
  rec.plato_sugerido = rec.plato_sugerido || 'Consulta el menú saludable';
  rec.hack_saludable = rec.hack_saludable || 'Pide porciones pequeñas';
  
  return rec;
};

// ============================================
// 8. HANDLER PRINCIPAL
// ============================================

// ============================================
// 8. CORS CONFIGURATION
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
// 9. HANDLER PRINCIPAL
// ============================================

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  
  // Verificar origen permitido
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  // Si no hay origin (same-origin), usar el primer origen permitido o wildcard
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ============================================
  // RATE LIMITING POR IP (anti-abuso)
  // ============================================
  const clientIP = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const ipCheck = await ipRateLimiter.checkIPLimit(clientIP);
  
  if (!ipCheck.allowed) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP. Inténtalo más tarde.',
      retryAfter: ipCheck.retryAfter,
      code: 'IP_RATE_LIMITED'
    });
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const tokenMatch = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const idToken = tokenMatch?.[1];

  if (!idToken) {
    return res.status(401).json({ error: 'Auth token requerido' });
  }

  let authUserId: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    authUserId = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: 'Auth token inválido' });
  }
  
  // ============================================
  // GET /api/recommend?userId=xxx - Status del rate limit
  // ============================================
  if (req.method === 'GET') {
    const status = await rateLimiter.getStatus(authUserId);
    if (!status) {
      return res.status(200).json({ 
        canRequest: true, 
        requestsInWindow: 0,
        remainingRequests: 5 
      });
    }
    
    return res.status(200).json({
      ...status,
      nextAvailableIn: status.nextAvailableAt 
        ? Math.max(0, Math.ceil((status.nextAvailableAt - Date.now()) / 1000))
        : 0,
    });
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let interactionRef: FirebaseFirestore.DocumentReference | null = null;
  let userId: string | null = null;

  try {
    // Validar body con Zod
    const parseResult = RequestBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return res.status(400).json({ error: 'Invalid request body', details: issues });
    }
    
    const request: RequestBody = parseResult.data;
    userId = authUserId;
    if (request.userId && request.userId !== authUserId) {
      return res.status(403).json({ error: 'userId no coincide con el token' });
    }
    const { type, _id } = request;
    const interactionId = _id || `int_${Date.now()}`;
    
    safeLog('log', `🚀 Nueva solicitud: type=${type}, userId=${userId?.substring(0, 8)}...`);

    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    // ============================================
    // RATE LIMITING V2 - Transacción atómica
    // ============================================
    const rateCheck = await rateLimiter.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ 
        error: rateCheck.error,
        retryAfter: rateCheck.secondsLeft,
        remainingRequests: rateCheck.remainingRequests 
      });
    }

    interactionRef = db.collection('user_interactions').doc(interactionId);
    await interactionRef.set({
      userId,
      interaction_id: interactionId,
      createdAt: FieldValue.serverTimestamp(),
      status: 'processing',
      tipo: type
    });

    const historyCol = type === 'En casa' ? 'historial_recetas' : 'historial_recomendaciones';

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      await interactionRef.update({ status: 'error', error: 'Usuario no encontrado' });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const user = userSnap.data() as UserProfile;

    let historyContext = "";
    try {
      // Intentar consulta con índice
      let historySnap;
      try {
        historySnap = await db.collection(historyCol)
          .where('user_id', '==', userId)
          .orderBy('fecha_creacion', 'desc')
          .limit(5)
          .get();
      } catch (indexError: any) {
        // En producción: fallar fuerte si falta el índice
        if (process.env.NODE_ENV === 'production') {
          safeLog('error', '❌ Índice de Firestore faltante en producción', indexError);
          throw new Error('Error de configuración: índice de base de datos requerido');
        }
        // En desarrollo: fallback sin orderBy (lento pero funcional)
        if (indexError?.message?.includes('index') || indexError?.code === 'failed-precondition') {
          safeLog('warn', '⚠️ Índice faltante en desarrollo, usando fallback');
          const allHistory = await db.collection(historyCol)
            .where('user_id', '==', userId)
            .limit(20)
            .get();
          interface HistoryDoc { id: string; data: any; }
          const sortedDocs: HistoryDoc[] = allHistory.docs
            .map((d: any) => ({ id: d.id, data: d.data() }))
            .sort((a: HistoryDoc, b: HistoryDoc) => {
              const aTime = a.data?.fecha_creacion?.toMillis?.() || 0;
              const bTime = b.data?.fecha_creacion?.toMillis?.() || 0;
              return bTime - aTime;
            })
            .slice(0, 5);
          historySnap = { 
            docs: sortedDocs.map(d => ({ ...d, data: () => d.data })), 
            empty: sortedDocs.length === 0 
          } as any;
        } else {
          throw indexError;
        }
      }
      
      if (!historySnap.empty) {
        const recent = historySnap.docs.map((doc: any) => {
          const d = doc.data();
          return type === 'En casa' 
            ? d.receta?.recetas?.map((r: any) => r.titulo)
            : d.recomendaciones?.map((r: any) => r.nombre_restaurante);
        }).flat().filter(Boolean);
        if (recent.length > 0) {
          historyContext = `### 🧠 MEMORIA (NO REPETIR): Recientemente recomendaste: ${recent.join(", ")}. INTENTA VARIAR Y NO REPETIR ESTOS NOMBRES.`;
        }
      }
    } catch (e: any) {
      safeLog('log', "No se pudo obtener historial", e);
    }

    let feedbackContext = "";
    try {
      const feedbackSnap = await db.collection('user_history')
        .where('userId', '==', userId)
        .limit(5)
        .get();
        
      if (!feedbackSnap.empty) {
        const logs = feedbackSnap.docs
          .map(d => d.data())
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .map((data: any) => `- ${data.itemId}: ${data.rating}/5${data.comment ? ` - "${data.comment}"` : ''}`)
          .join('\n');
        feedbackContext = `### ⭐️ PREFERENCIAS BASADAS EN FEEDBACK PREVIO:\n${logs}\nUsa esto para entender qué le gusta o no al usuario.`;
      }
    } catch (e) {
      safeLog('log', "No se pudo obtener feedback", e);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    let finalPrompt = "";
    let parsedData: any;

    if (type === 'En casa') {
      const formula = buildAirtableFormula(user);
      
      const baseId = process.env.AIRTABLE_BASE_ID?.trim();
      const tableName = process.env.AIRTABLE_TABLE_NAME?.trim();
      const apiKey = process.env.AIRTABLE_API_KEY?.trim();
      
      if (!baseId || !tableName || !apiKey) {
        throw new Error(`Missing Airtable config: BASE_ID=${!!baseId}, TABLE_NAME=${!!tableName}, API_KEY=${!!apiKey ? 'SET' : 'MISSING'}`);
      }
      
      // ✅ USAR CACHÉ: Obtener ingredientes con caché de 6 horas
      let airtableItems: AirtableIngredient[] = [];
      try {
        airtableItems = await getAirtableIngredientsWithCache(formula, baseId, tableName, apiKey);
      } catch (airtableError: any) {
        safeLog('error', "❌ Airtable Fetch Failed", airtableError);
        airtableItems = [];
      }

      // FIX: La despensa se guarda como un documento por usuario con array 'items'
      const pantryDoc = await db.collection('user_pantry').doc(userId).get();
      const pantryData = pantryDoc.exists ? pantryDoc.data() : null;
      const pantryItems: string[] = pantryData?.items?.map((item: any) => item.name || "").filter(Boolean) || [];
      
      const { priorityList, marketList, hasPantryItems } = scoreIngredients(airtableItems, pantryItems);
      
      // ✅ OPTIMIZACIÓN: Prompt conciso para reducir tokens (~30% menos)
      finalPrompt = `Eres nutricionista. Genera 3 recetas para: ${user.nutritionalGoal || 'comer saludable'}

PERFIL: ${formatList(user.diseases)}, ${formatList(user.allergies)} | NO usar: ${formatList([...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)])} | Ubic: ${user.city || 'su ciudad'}
SOLICITUD: ${request.mealType || 'Comida'}, ${request.cookingTime || '30'}min, ${request.budget || 'sin límite'} ${request.currency || ''}
${historyContext ? '\nMEMORIA: ' + historyContext.slice(30, 200) : ''}
${feedbackContext ? '\nFEEDBACK: ' + feedbackContext.slice(30, 150) : ''}
${hasPantryItems ? `\nDESPENSA: ${priorityList.slice(0, 200)}` : ''}
${marketList ? `\nDISPONIBLE: ${marketList.slice(0, 150)}` : ''}

REGLAS: 3 recetas creativas, tiempo ≤${request.cookingTime || '30'}min, usar despensa primero, respetar restricciones. Opcionales: básicos (aceite, sal, especias).

JSON:{"saludo_personalizado":"msg motivador","receta":{"recetas":[{"id":1,"titulo":"nombre","tiempo":"XX min","dificultad":"Fácil|Media|Difícil","coincidencia":"ingrediente casa o Ninguno","ingredientes":["cantidad+ingrediente"],"pasos_preparacion":["paso 1","paso 2"],"macros_por_porcion":{"kcal":0,"proteinas_g":0,"carbohidratos_g":0,"grasas_g":0}}]}}`;

    } else {
      // Determinar coordenadas para búsqueda de restaurantes
      const searchCoords = getSearchCoordinates(request, user);
      const locationContext = searchCoords 
        ? `Coordenadas de referencia: ${formatCoordinates(searchCoords)}`
        : `Ciudad: ${user.city || "su ciudad"}, ${user.countryName || ""}`;
      
      const locationInstruction = searchCoords
        ? `**IMPORTANTE - RANGO DE BÚSQUEDA**: Busca restaurantes DENTRO de un radio de ${SEARCH_RADIUS_METERS / 1000}km desde las coordenadas ${formatCoordinates(searchCoords)}. Prioriza lugares cercanos a esta ubicación.`
        : `**IMPORTANTE**: Busca restaurantes en ${user.city || "su ciudad"} que sean accesibles y no muy alejados del centro.`;
      
      // ✅ OPTIMIZACIÓN: Prompt conciso para restaurantes (~40% menos tokens)
      finalPrompt = `Eres guía gastronómico en ${user.city || 'su ciudad'}. Recomienda 5 restaurantes reales.

PERFIL: ${user.nutritionalGoal || 'saludable'} | ${formatList(user.diseases)}, ${formatList(user.allergies)} | NO: ${formatList([...ensureArray(user.dislikedFoods), ...ensureArray(request.dislikedFoods)])}
UBICACIÓN: ${locationContext} | RANGO: ${SEARCH_RADIUS_METERS / 1000}km
SOLICITUD: ${request.cravings || 'saludable'}, ${request.budget || 'sin límite'} ${request.currency || ''}
${historyContext ? '\nMEMORIA: ' + historyContext.slice(30, 200) : ''}
${feedbackContext ? '\nFEEDBACK: ' + feedbackContext.slice(30, 150) : ''}

REGLAS CRÍTICAS:
1. Nombres reales de restaurantes existentes en ${user.city || 'su ciudad'}
2. DIRECCIONES EXACTAS: Calle Número, Colonia (ej: "Calle Arturo Soria 126, Chamartín")
3. Si no sabes dirección exacta: usa centro comercial específico
4. NO uses "por el centro" o direcciones vagas
5. Rango máximo: ${SEARCH_RADIUS_METERS / 1000}km

JSON:{"saludo_personalizado":"msg corto","ubicacion_detectada":"${user.city || 'su ciudad'}","recomendaciones":[{"id":1,"nombre_restaurante":"nombre real","tipo_comida":"ej: Italiana","direccion_aproximada":"Calle Número, Colonia","plato_sugerido":"nombre plato","por_que_es_bueno":"explicación perfil","hack_saludable":"consejo práctico"}]}`;
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      generationConfig: { 
        temperature: 0.7, 
        // ✅ OPTIMIZACIÓN: Reducir tokens máximos según tipo (ahorro ~20%)
        maxOutputTokens: type === 'En casa' ? 2800 : 2200,
        responseMimeType: 'application/json',
        // ✅ OPTIMIZACIÓN: topP y topK mejoran eficiencia sin perder calidad
        topP: 0.95,
        topK: 40,
      },
    });

    const responseText = result.response.text();
    
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                        responseText.match(/{[\s\S]*}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error("No se pudo parsear la respuesta de Gemini");
      }
    }

    // ============================================
    // VALIDACIÓN ESTRUCTURAL DE LA RESPUESTA
    // ============================================
    try {
      if (type === 'En casa') {
        parsedData = RecipeResponseSchema.parse(parsedData);
      } else {
        parsedData = RestaurantResponseSchema.parse(parsedData);
      }
    } catch (validationError: any) {
      safeLog('error', '❌ Respuesta de Gemini inválida', validationError);
      throw new Error('La respuesta del modelo no cumple con el formato esperado');
    }

    // ============================================
    // POST-PROCESAMIENTO PARA LINKS CLICKEABLES
    // ============================================
    if (type === 'Fuera' && parsedData.recomendaciones) {
      // Generar links válidos en el backend usando nombre + dirección + ciudad
      parsedData.recomendaciones = parsedData.recomendaciones.map((rec: any) => 
        sanitizeRecommendation(rec, user.city || "")
      );
    }

    const batch = db.batch();
    
    const historyRef = db.collection(historyCol).doc();
    batch.set(historyRef, {
      user_id: userId,
      interaction_id: interactionId,
      fecha_creacion: FieldValue.serverTimestamp(),
      tipo: type,
      ...parsedData
    });
    
    batch.update(interactionRef, {
      procesado: true,
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      historyDocId: historyRef.id
    });
    
    await batch.commit();

    // ============================================
    // ÉXITO: Marcar proceso como completado
    // ============================================
    await rateLimiter.completeProcess(userId);

    return res.status(200).json(parsedData);

  } catch (error: any) {
    safeLog('error', "❌ Error completo en API", error);
    // Stack trace solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error("Stack trace:", error.stack);
    }
    
    // Identificar tipo de error para mejor diagnóstico
    let errorMessage = error.message || "Error interno del servidor";
    let statusCode = 500;
    
    if (error?.message?.includes('index') || error?.code === 'failed-precondition') {
      errorMessage = "Error de configuración de base de datos. Contacta al administrador.";
      statusCode = 500;
    } else if (error?.message?.includes('timeout') || error?.code === 'deadline-exceeded') {
      errorMessage = "La operación tomó demasiado tiempo. Intenta de nuevo.";
      statusCode = 504;
    }
    
    // ============================================
    // ERROR: Marcar proceso como fallido (no cuenta para rate limit)
    // ============================================
    if (userId) {
      try {
        await rateLimiter.failProcess(userId, error.message);
      } catch (rlError) {
        safeLog('error', "Error actualizando rate limit", rlError);
      }
    }
    
    if (interactionRef) {
      try {
        await interactionRef.update({
          status: 'error',
          error: error.message,
          errorDetails: error.stack?.substring(0, 1000) || '',
          errorAt: FieldValue.serverTimestamp()
        });
      } catch (e) {
        safeLog('error', "No se pudo actualizar el estado de error", e);
      }
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      code: error?.code || 'UNKNOWN_ERROR'
    });
  }
}
