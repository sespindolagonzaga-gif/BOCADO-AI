import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { COUNTRY_TO_CURRENCY, CURRENCY_CONFIG } from '../src/data/budgets.js';
import { profileCache, pantryCache, historyCache } from './utils/cache.js';
// 📝 FatSecret integración (opcional - requiere API key premium free)
// Para habilitar: descomenta y configura FATSECRET_KEY & FATSECRET_SECRET
import { getFatSecretIngredientsWithCache } from './utils/fatsecret-logic.js';
import { searchFatSecretIngredients } from './utils/fatsecret.js';

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
    console.log("✅ Firebase inicializado correctamente");
  } catch (error) {
    console.error("❌ Error Firebase Init:", error);
    throw error;
  }
}

const db = getFirestore();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ============================================
// 💰 FINOPS: JSON TEMPLATES (AHORRO DE TOKENS)
// ============================================
// Extraídos como constantes para evitar repetirlos en cada prompt (~40 tokens ahorrados por request)

const RECIPE_JSON_TEMPLATE = `{"saludo_personalizado":"msg motivador","receta":{"recetas":[{"id":1,"titulo":"nombre","tiempo":"XX min","dificultad":"Fácil|Media|Difícil","coincidencia":"ingrediente casa o Ninguno","ingredientes":["cantidad+ingrediente"],"pasos_preparacion":["paso 1","paso 2"],"macros_por_porcion":{"kcal":0,"proteinas_g":0,"carbohidratos_g":0,"grasas_g":0}}]}}`;

const RESTAURANT_JSON_TEMPLATE = `{"saludo_personalizado":"msg motivador","recomendaciones":[{"id":1,"nombre_restaurante":"nombre real","tipo_comida":"ej: Italiana","direccion_aproximada":"Calle Número, Colonia","plato_sugerido":"nombre plato","por_que_es_bueno":"explicar por qué","hack_saludable":"consejo práctico"}]}`;

// ============================================
// 💰 FINOPS: CACHED USER PROFILE RETRIEVAL
// ============================================

interface UserProfile {
  userId: string;
  eatingHabit?: string;
  age?: number | string;
  sex?: string;
  gender?: string;
  weight?: string;
  height?: string;
  activityLevel?: string;
  activityFrequency?: string;
  nutritionalGoal?: string;
  diseases?: string[];
  allergies?: string[];
  dislikedFoods?: string[];
  cookingAffinity?: string;
  city?: string;
  country?: string;
  location?: { lat: number; lng: number };
  locationEnabled?: boolean;
  [key: string]: any;
}

/**
 * Obtiene perfil del usuario con cache en memoria
 * TTL: 10 minutos
 * Fallback: Firestore directo si cache falla
 * Ahorro: 1 read de Firestore por cada cache hit
 */
async function getUserProfileCached(userId: string): Promise<UserProfile> {
  // Layer 1: Intentar memoria cache
  try {
    const cached = profileCache.get<UserProfile>(userId);
    if (cached) {
      safeLog("log", `[Cache] Profile HIT: ${userId.substring(0, 8)}...`);
      return cached;
    }
  } catch (cacheError) {
    safeLog(
      "warn",
      "[Cache] Profile read error, falling back to Firestore:",
      cacheError,
    );
  }

  // Layer 2: Fallback a Firestore
  safeLog(
    "log",
    `[Cache] Profile MISS: fetching from Firestore ${userId.substring(0, 8)}...`,
  );

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    throw new Error("Usuario no encontrado");
  }

  const profile = userSnap.data() as UserProfile;

  // Guardar en cache (no throw si falla)
  try {
    profileCache.set(userId, profile);
  } catch (cacheError) {
    safeLog("warn", "[Cache] Profile write error:", cacheError);
  }

  return profile;
}

/**
 * Obtiene items de despensa con cache en memoria
 * TTL: 5 minutos
 * Fallback graceful: [] si falla (no crítico)
 */
async function getPantryItemsCached(userId: string): Promise<string[]> {
  // Layer 1: Memoria cache
  try {
    const cached = pantryCache.get<string[]>(userId);
    if (cached) {
      safeLog("log", `[Cache] Pantry HIT: ${userId.substring(0, 8)}...`);
      return cached;
    }
  } catch (cacheError) {
    safeLog("warn", "[Cache] Pantry read error:", cacheError);
  }

  // Layer 2: Fallback a Firestore
  try {
    safeLog(
      "log",
      `[Cache] Pantry MISS: fetching from Firestore ${userId.substring(0, 8)}...`,
    );
    const pantryDoc = await db.collection("user_pantry").doc(userId).get();
    const pantryData = pantryDoc.exists ? pantryDoc.data() : null;

    // Transformar items (igual que antes)
    const items: string[] =
      pantryData?.items && Array.isArray(pantryData.items)
        ? pantryData.items.map((item: any) => item.name || "").filter(Boolean)
        : [];

    // Guardar en cache
    try {
      pantryCache.set(userId, items);
    } catch (cacheError) {
      safeLog("warn", "[Cache] Pantry write error:", cacheError);
    }

    return items;
  } catch (error) {
    // Graceful degradation: despensa no es crítica
    safeLog("warn", "[Cache] Pantry fetch failed, using empty array:", error);
    return [];
  }
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
  windowMs: 10 * 60 * 1000, // 10 minutos
  maxRequests: 5, // 5 requests por ventana
  cooldownMs: 30 * 1000, // 30 segundos entre requests
  stuckThresholdMs: 2 * 60 * 1000, // 2 minutos para cleanup
};

class DistributedRateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const counterRef = db.collection("rate_limit_v2").doc(userId);
    const now = Date.now();

    try {
      return await db.runTransaction<RateLimitResult>(async (t) => {
        const doc = await t.get(counterRef);
        const data = doc.exists ? (doc.data() as RateLimitRecord) : null;

        if (data?.currentProcess) {
          const processAge = now - data.currentProcess.startedAt;

          if (processAge > this.config.stuckThresholdMs) {
            safeLog(
              "log",
              `🧹 Limpiando proceso atascado para ${userId?.substring(0, 8)}... (${Math.round(processAge / 1000)}s)`,
            );
            t.update(counterRef, {
              currentProcess: null,
              "metadata.cleanedAt": FieldValue.serverTimestamp(),
              "metadata.cleanReason": "stuck_timeout",
            });
          } else {
            const secondsLeft = Math.ceil(
              (this.config.cooldownMs - (now - data.currentProcess.startedAt)) /
                1000,
            );
            return {
              allowed: false,
              secondsLeft: Math.max(1, secondsLeft),
              error: "Ya estás generando una recomendación. Espera un momento.",
              remainingRequests: 0,
            };
          }
        }

        // ✅ FIX: Proteger contra null/undefined en array
        const validRequests = (data?.requests || []).filter(
          (ts) => now - ts < this.config.windowMs,
        );

        if (validRequests.length >= this.config.maxRequests) {
          const oldestRequest = Math.min(...validRequests);
          const retryAfter = Math.ceil(
            (oldestRequest + this.config.windowMs - now) / 1000,
          );

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
            const secondsLeft = Math.ceil(
              (this.config.cooldownMs - timeSinceLastRequest) / 1000,
            );

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
      safeLog("error", "❌ Error en rate limit transaction", error);
      // FAIL-CLOSED: Si no podemos verificar rate limit, rechazar la request
      return {
        allowed: false,
        error:
          "Error de seguridad: no se pudo verificar el límite de uso. Intenta de nuevo en unos momentos.",
      };
    }
  }

  async completeProcess(userId: string): Promise<void> {
    const counterRef = db.collection("rate_limit_v2").doc(userId);
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
      safeLog("error", "❌ Error marcando proceso como completado", error);
    }
  }

  async failProcess(userId: string, errorInfo?: string): Promise<void> {
    const counterRef = db.collection("rate_limit_v2").doc(userId);

    try {
      await counterRef.update({
        currentProcess: null,
        lastError: {
          message: errorInfo || "Unknown error",
          at: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      safeLog("error", "❌ Error marcando proceso como fallido", error);
    }
  }

  async getStatus(userId: string): Promise<{
    requestsInWindow: number;
    currentProcess?: { startedAt: number; interactionId: string };
    canRequest: boolean;
    nextAvailableAt?: number;
  } | null> {
    const counterRef = db.collection("rate_limit_v2").doc(userId);
    const now = Date.now();

    try {
      const doc = await counterRef.get();
      if (!doc.exists) return null;

      const data = doc.data() as RateLimitRecord;
      const validRequests = (data.requests || []).filter(
        (ts) => now - ts < this.config.windowMs,
      );

      let nextAvailableAt: number | undefined;

      // 🟠 FIX #13: Validar que validRequests no esté vacío antes de Math.min/max
      if (data.currentProcess) {
        nextAvailableAt =
          data.currentProcess.startedAt + this.config.cooldownMs;
      } else if (validRequests.length >= this.config.maxRequests) {
        const oldestRequest =
          validRequests.length > 0 ? Math.min(...validRequests) : now;
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
        canRequest:
          !data.currentProcess &&
          validRequests.length < this.config.maxRequests,
        nextAvailableAt,
      };
    } catch (error) {
      safeLog("error", "Error obteniendo status", error);
      return null;
    }
  }
}

const rateLimiter = new DistributedRateLimiter();

// ============================================
// 2. VALIDACIÓN CON ZOD
// ============================================

import { z } from "zod";

// ✅ FIX: Schema más estricto para validar datos
const RequestBodySchema = z.object({
  userId: z.string().min(1).max(128),
  type: z.enum(["En casa", "Fuera"]),
  mealType: z.string().max(50).optional().nullable(),
  // ✅ Validación estricta: solo números o strings numéricos
  cookingTime: z
    .union([
      z.string().regex(/^\d+$/, "Cooking time debe ser un número válido"),
      z.number().int().min(1).max(180),
    ])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return isNaN(num) ? null : num;
    }),
  cravings: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable(),
  // ✅ Validación de budget: solo valores específicos o 'sin límite'
  budget: z
    .string()
    .max(50)
    .refine(
      (val) =>
        !val || val === "sin límite" || ["low", "medium", "high"].includes(val),
      { message: "Budget debe ser low, medium, high o sin límite" },
    )
    .optional()
    .nullable(),
  // ✅ Validación de currency: códigos ISO válidos
  currency: z
    .string()
    .max(10)
    .regex(
      /^[A-Z]{3}$/,
      "Currency debe ser código ISO de 3 letras (ej: USD, EUR, MXN)",
    )
    .optional()
    .nullable(),
  dislikedFoods: z.array(z.string().max(100)).max(50).optional().default([]),
  onlyPantryIngredients: z.boolean().optional().default(false),
  _id: z.string().max(128).optional(),
  // Idioma para las recomendaciones
  language: z.enum(["es", "en"]).optional().default("es"),
  // Ubicación del usuario (opcional - geolocalización del navegador)
  userLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().positive().optional(),
    })
    .optional()
    .nullable(),
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
  dificultad: z.enum(["Fácil", "Media", "Difícil"]).optional(),
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



// ============================================
// 3. FUNCIONES DE UTILIDAD
// ============================================

// Sanitiza errores para no exponer datos sensibles en logs
const sanitizeError = (
  error: any,
): { message: string; code?: string; safeToLog: boolean } => {
  const errorMessage = error?.message || String(error);

  // Detectar errores que pueden contener datos sensibles
  const sensitivePatterns = [
    /api[_-]?key/i,
    /token/i,
    /password/i,
    /secret/i,
    /credential/i,
    /firebase/i,
  ];

  const hasSensitiveData = sensitivePatterns.some((pattern) =>
    pattern.test(errorMessage),
  );

  if (hasSensitiveData) {
    return {
      message: "Error sanitizado: contiene datos sensibles",
      code: error?.code,
      safeToLog: false,
    };
  }

  return {
    message: errorMessage.substring(0, 500), // Limitar longitud
    code: error?.code,
    safeToLog: true,
  };
};

// Logger seguro que respeta el entorno
const safeLog = (
  level: "log" | "error" | "warn",
  message: string,
  error?: any,
) => {
  const isDev = process.env.NODE_ENV === "development";

  if (error) {
    const sanitized = sanitizeError(error);
    if (sanitized.safeToLog || isDev) {
      console[level](message, isDev ? error : sanitized.message);
    } else {
      console[level](message, "[Error sanitizado - ver logs seguros]");
    }
  } else {
    console[level](message);
  }
};

const normalizeText = (text: string): string =>
  text
    ? text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
    : "";

const getRootWord = (text: string): string => {
  let clean = normalizeText(text);
  if (clean.length <= 3) return clean;
  if (clean.endsWith("ces")) return clean.slice(0, -3) + "z";
  if (clean.endsWith("es")) return clean.slice(0, -2);
  if (clean.endsWith("s")) return clean.slice(0, -1);
  return clean;
};

const createRegexPattern = (text: string): string => {
  const root = getRootWord(text);
  return root
    .replace(/a/g, "[aáàäâ]")
    .replace(/e/g, "[eéèëê]")
    .replace(/i/g, "[iíìïî]")
    .replace(/o/g, "[oóòöô]")
    .replace(/u/g, "[uúùüû]");
};

const ensureArray = (input: any): string[] => {
  if (!input) return [];
  if (Array.isArray(input))
    return input.filter((i): i is string => typeof i === "string");
  if (typeof input === "string")
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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


// ============================================
// 5. SISTEMA DE SCORING
// ============================================

const scoreIngredients = (
  filteredItems: FirestoreIngredient[],
  pantryItems: string[],
): { priorityList: string; marketList: string; hasPantryItems: boolean } => {
  const pantryRoots = pantryItems
    .map((item) => getRootWord(item))
    .filter((root) => root && root.length > 2);

  const genericWords = [
    "aceite",
    "sal",
    "leche",
    "pan",
    "harina",
    "agua",
    "mantequilla",
    "crema",
    "salsa",
  ];

  const scoredItems = filteredItems
    .map((item) => {
      const rawName = item.regional.mx || item.name || item.regional.es || "";
      if (!rawName) return { name: "", score: 0 };

      const norm = normalizeText(rawName);
      const root = getRootWord(rawName);
      let score = 1;

      pantryRoots.forEach((pantryRoot) => {
        if (root === pantryRoot) {
          score = 50;
        } else if (new RegExp(`\\b${pantryRoot}\\b`, "i").test(norm)) {
          if (
            !(norm.split(/\s+/).length > 2 && genericWords.includes(pantryRoot))
          ) {
            score = 20;
          }
        }
      });

      return { name: rawName, score };
    })
    .filter((item) => item.name);

  scoredItems.sort((a, b) => b.score - a.score);

  const priorityList = scoredItems
    .filter((i) => i.score >= 20)
    .map((i) => i.name)
    .join(", ");
  const marketList = scoredItems
    .filter((i) => i.score < 20)
    .map((i) => i.name)
    .join(", ");

  return { priorityList, marketList, hasPantryItems: priorityList.length > 0 };
};

// ============================================
// TIPOS PARA INGREDIENTES
// ============================================

interface FirestoreIngredient {
  id: string;
  name: string;
  category: string;
  regional: {
    es?: string;
    mx?: string;
    en?: string;
  };
  nutrients?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

// ============================================
// 5B. OBTENER Y FILTRAR INGREDIENTES
// ============================================

/**
 * 🔍 Obtiene todos los ingredientes disponibles de Firestore
 * 
 * Fuentes (en orden de preferencia):
 * 1. google_ingredients collection (base de datos local)
 * 2. FatSecret (si está habilitado y tienen credenciales premium)
 * 
 * @returns Array de ingredientes disponibles
 */
async function getAllIngredientes(): Promise<FirestoreIngredient[]> {
  try {
    // Layer 1: Intentar base de datos local (más rápido)
    const localSnap = await db
      .collection("ingredients")
      .limit(1000) // Máximo ingredientes a cargar
      .get();

    if (!localSnap.empty) {
      safeLog("log", `[Ingredients] Loaded ${localSnap.size} from local DB`);
      return localSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as FirestoreIngredient));
    }

    // Layer 2: FatSecret (si está habilitado - requiere FATSECRET_KEY & FATSECRET_SECRET)
    if (process.env.FATSECRET_KEY && process.env.FATSECRET_SECRET) {
      try {
        safeLog("log", "[Ingredients] Local DB empty, trying FatSecret...");
        const fatsecretResults = await searchFatSecretIngredients("*", 500); // Buscar alimentos comunes
        
        if (fatsecretResults && Array.isArray(fatsecretResults) && fatsecretResults.length > 0) {
          const items: FirestoreIngredient[] = fatsecretResults.map((fs: any) => ({
            id: `fs_${fs.food_id}`,
            name: fs.food_name,
            category: fs.food_type || "Generic",
            regional: { 
              es: fs.food_name,
              mx: fs.food_name 
            },
          }));
          
          safeLog("log", `[Ingredients] Loaded ${items.length} from FatSecret`);
          return items;
        }
      } catch (fatsecretError) {
        safeLog("warn", "[Ingredients] FatSecret error, using fallback", fatsecretError);
      }
    } else {
      safeLog("log", "[Ingredients] FatSecret not configured (FATSECRET_KEY/SECRET missing)");
    }

    // Fallback: ingredientes básicos
    safeLog("warn", "[Ingredients] No ingredients found, using basic fallback");
    return [
      { id: "1", name: "Pollo pechuga", category: "proteína", regional: { es: "Pollo pechuga", mx: "Pechuga de pollo" } },
      { id: "2", name: "Arroz integral", category: "grano", regional: { es: "Arroz integral", mx: "Arroz integral" } },
      { id: "3", name: "Brócoli", category: "verdura", regional: { es: "Brócoli", mx: "Brócoli" } },
      { id: "4", name: "Huevo", category: "proteína", regional: { es: "Huevo", mx: "Huevo" } },
      { id: "5", name: "Tomate", category: "verdura", regional: { es: "Tomate", mx: "Tomate" } },
    ];
  } catch (error) {
    safeLog("error", "[Ingredients] Fatal error loading", error);
    return [];
  }
}

/**
 * 🧹 Filtra ingredientes según restricciones del usuario
 * 
 * Excluye:
 * - Alimentos alérgenos
 * - Alimentos no deseados
 * - Ingredientes incompatibles con dieta (vegano, vegetariano, etc)
 * - Alimentos incompatibles con enfermedades (diabetes, etc)
 */
/**
 * Filtra ingredientes según alergias, dieta, enfermedades y preferencias del usuario
 * 
 * Casa: alergias -> dieta -> enfermedades -> preferencias
 * 
 * @performance O(n*m) donde n=ingredientes, m=criterios (acepta <5000 items)
 * @security Todos los parámetros se normalizan antes de comparar
 */
function filterIngredientes(
  allIngredients: FirestoreIngredient[],
  user: UserProfile
): FirestoreIngredient[] {
  const allergies = (user.allergies || []).map(a => a.toLowerCase());
  const dislikedFoods = (user.dislikedFoods || []).map(d => d.toLowerCase());
  const eatingHabit = (user.eatingHabit || "").toLowerCase();
  const diseases = (user.diseases || []).map(d => d.toLowerCase());

  // Mapeo detallado de alérgenos (coverage completa)
  const allergenMap: Record<string, string[]> = {
    "alergia a frutos secos": ["nuez", "almendra", "cacahuate", "pistacho", "avellana", "semilla", "pecan"],
    "celíaco": ["trigo", "cebada", "centeno", "gluten", "pan", "pasta", "galleta"],
    "alergia a mariscos": ["camarón", "langosta", "cangrejo", "mejillón", "ostra", "camarones", "pulpo"],
    "alergia a cacahuates": ["cacahuate", "maní", "mantequilla de maní"],
    "intolerancia a la lactosa": ["leche", "queso", "yogur", "mantequilla", "crema", "nata", "helado"],
    "alergia al huevo": ["huevo", "clara", "yema"],
  };

  return allIngredients.filter(ingredient => {
    const name = ingredient.name.toLowerCase();
    const regional = ingredient.regional.es?.toLowerCase() || "";
    const mx = ingredient.regional.mx?.toLowerCase() || "";
    const combinedText = `${name} ${regional} ${mx}`;

    // 1️⃣ PRIORIDAD CRÍTICA: Excluir alimentos no deseados
    if (dislikedFoods.some(d => {
      const pattern = createRegexPattern(d);
      return new RegExp(pattern, 'i').test(combinedText);
    })) {
      return false;
    }

    // 2️⃣ Excluir alérgenos (high priority)
    for (const allergyKey of allergies) {
      const allergens = allergenMap[allergyKey] || [allergyKey];
      if (allergens.some(a => 
        new RegExp(`\\b${a}\\b`, 'i').test(combinedText)
      )) {
        return false;
      }
    }

    // 3️⃣ Filtrar por dieta (vegano/vegetariano)
    if (eatingHabit.includes("vegano")) {
      const animalProducts = ["carne", "pollo", "pavo", "res", "cerdo", "cordero", "pescado", "camarón", "huevo", "leche", "queso", "miel"];
      if (animalProducts.some(m => new RegExp(`\\b${m}\\b`, 'i').test(combinedText))) {
        return false;
      }
    } else if (eatingHabit.includes("vegetariano")) {
      const meats = ["carne", "pollo", "pavo", "res", "cerdo", "cordero", "pescado", "camarón"];
      if (meats.some(m => new RegExp(`\\b${m}\\b`, 'i').test(combinedText))) {
        return false;
      }
    }

    // 4️⃣ Filtrar según enfermedades crónicas
    for (const disease of diseases) {
      // 🩺 DIABETES: Evitar alimentos altos en azúcar
      if (disease.includes("diabetes")) {
        const highSugar = ["azúcar", "dulce", "postre", "chocolate", "refresco", "jugo de", "miel", "caramelo"];
        if (highSugar.some(s => combinedText.includes(s))) {
          return false;
        }
      }

      // 🩺 HIPERTENSIÓN: Evitar alimentos salados
      if (disease.includes("hipertensión")) {
        const saltyFoods = ["sal", "embutido", "jamón", "tocino", "salchicha", "conserva", "enlatado"];
        if (saltyFoods.some(s => combinedText.includes(s))) {
          return false;
        }
      }

      // 🩺 COLESTEROL: Evitar grasas saturadas
      if (disease.includes("colesterol")) {
        const fattyFoods = ["manteca", "mantequilla", "chicharrón", "grasa animal", "crema"];
        if (fattyFoods.some(f => combinedText.includes(f))) {
          return false;
        }
      }

      // 🩺 HIPOTIROIDISMO: Necesita más yodo (preservar lácteos, pescados, algas)
      // En DB: marcar ingredientes altos en yodo, aquí simplemente NO excluir
      if (disease.includes("hipotiroidismo")) {
        const lowIodine = ["agua destilada"];
        if (lowIodine.some(l => combinedText.includes(l))) {
          return false;
        }
        // Nota: El algoritmo debería dar MEJOR SCORING a alimentos con yodo
        // pero por ahora solo excluir los claramente deficientes
      }

      // 🩺 HIPERTIROIDISMO: Evitar exceso de yodo (algas, mucho pescado)
      if (disease.includes("hipertiroidismo")) {
        const highIodine = ["alga", "nori", "kombu"];
        if (highIodine.some(h => combinedText.includes(h))) {
          return false;
        }
      }

      // 🩺 SÍNDROME DE INTESTINO IRRITABLE: Evitar irritantes
      if (disease.includes("intestino irritable") || disease.includes("ibs")) {
        const irritants = ["picante", "chile", "ají", "curry", "café"];
        if (irritants.some(i => combinedText.includes(i))) {
          return false;
        }
      }
    }

    return true;
  });
}

// ============================================
// 6. RATE LIMITING POR IP (Protección contra abuso)
// ============================================

class IPRateLimiter {
  private config = {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30, // 30 requests por minuto por IP
    blockDurationMs: 5 * 60 * 1000, // 5 minutos de bloqueo si excede
  };

  async checkIPLimit(
    ip: string,
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const docRef = db.collection("ip_rate_limits").doc(ip);
    const now = Date.now();

    try {
      return await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        const data = doc.exists ? (doc.data() as any) : null;

        // Si está bloqueado
        if (data?.blockedUntil && data.blockedUntil > now) {
          return {
            allowed: false,
            retryAfter: Math.ceil((data.blockedUntil - now) / 1000),
          };
        }

        const requests = (data?.requests || []).filter(
          (ts: number) => now - ts < this.config.windowMs,
        );

        // Si excede el límite, bloquear
        if (requests.length >= this.config.maxRequests) {
          t.set(docRef, {
            requests: [...requests, now],
            blockedUntil: now + this.config.blockDurationMs,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return {
            allowed: false,
            retryAfter: Math.ceil(this.config.blockDurationMs / 1000),
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
      safeLog("error", "Error en IP rate limit", error);
      // FAIL-CLOSED: Si no podemos verificar IP rate limit, rechazar por seguridad
      return {
        allowed: false,
        retryAfter: 60, // Bloquear 1 minuto como precaución
      };
    }
  }
}

const ipRateLimiter = new IPRateLimiter();

// ============================================
// 7. CONFIGURACIÓN DE BÚSQUEDA DE RESTAURANTES
// ============================================

// Rango de búsqueda en metros (8km)
const SEARCH_RADIUS_METERS = 8000;

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Determina las coordenadas a usar para la búsqueda de restaurantes
 * Prioridad: 1) userLocation del request, 2) location del perfil, 3) null
 */
function getSearchCoordinates(
  request: RequestBody,
  user: UserProfile,
): Coordinates | null {
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

/**
 * Obtiene el código de país desde coordenadas GPS usando reverse geocoding
 * Llama al proxy interno de Google Maps con timeout de 5s
 */
async function getCountryCodeFromCoords(
  coords: Coordinates,
): Promise<string | null> {
  // ✅ FIX: Timeout para evitar bloqueo indefinido
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos

  try {
    if (!GOOGLE_MAPS_API_KEY) {
      safeLog(
        "warn",
        "⚠️ GOOGLE_MAPS_API_KEY no configurada para reverse geocode",
      );
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&language=es&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url, { signal: controller.signal });

    clearTimeout(timeoutId);

    if (!response.ok) {
      safeLog("warn", `⚠️ Reverse geocode HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status !== "OK" || !data.results?.[0]) {
      safeLog(
        "warn",
        `⚠️ Reverse geocode sin resultados: ${data.status || "unknown"}`,
      );
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];
    const countryComponent = components.find(
      (component: any) =>
        Array.isArray(component.types) && component.types.includes("country"),
    );
    return countryComponent?.short_name || null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      safeLog("warn", "⚠️ Reverse geocode timeout (5s) - usando fallback");
      return null;
    }
    safeLog("error", "❌ Error en reverse geocoding:", error);
    return null;
  }
}

/**
 * Detecta si el usuario está viajando (GPS location != perfil location)
 * Considera que está viajando si las ciudades son diferentes
 */
interface LocationContext {
  isTraveling: boolean;
  homeCurrency: string;
  activeCurrency: string;
  homeCountryCode: string;
  activeCountryCode: string | null;
  locationLabel: string; // "en Madrid" o "aprovechando que estás en Tokio"
}

async function detectTravelContext(
  searchCoords: Coordinates | null,
  request: RequestBody,
  user: UserProfile,
): Promise<LocationContext> {
  // ✅ FIX: Usar ?? para preservar strings vacíos válidos
  const homeCountryCode = user.country ?? "MX"; // fallback a México
  const homeCurrency = COUNTRY_TO_CURRENCY[homeCountryCode] ?? "USD";

  // Si no hay GPS activo, usar ubicación de casa
  if (!request.userLocation || !searchCoords) {
    return {
      isTraveling: false,
      homeCurrency,
      activeCurrency: homeCurrency,
      homeCountryCode,
      activeCountryCode: null,
      locationLabel: `en ${user.city ?? "tu ciudad"}`,
    };
  }

  // Detectar país desde coordenadas GPS
  const activeCountryCode = await getCountryCodeFromCoords(searchCoords);

  if (!activeCountryCode) {
    // Si falla reverse geocoding, asumir que está en casa
    return {
      isTraveling: false,
      homeCurrency,
      activeCurrency: homeCurrency,
      homeCountryCode,
      activeCountryCode: null,
      locationLabel: `en ${user.city ?? "tu ciudad"}`,
    };
  }

  // ✅ FIX: Usar ?? con logging si no se encuentra moneda
  const activeCurrency = COUNTRY_TO_CURRENCY[activeCountryCode];
  if (!activeCurrency) {
    safeLog(
      "warn",
      `⚠️ Currency not found for country: ${activeCountryCode}, fallback to home currency`,
    );
  }
  const finalActiveCurrency = activeCurrency ?? homeCurrency;

  const isTraveling = activeCountryCode !== homeCountryCode;

  return {
    isTraveling,
    homeCurrency,
    activeCurrency: finalActiveCurrency,
    homeCountryCode,
    activeCountryCode,
    locationLabel: isTraveling
      ? `aprovechando que estás de visita`
      : `en ${user.city ?? "tu ciudad"}`,
  };
}

/**
 * Genera instrucción de presupuesto con conversión de moneda si es necesario
 */
function getBudgetInstruction(
  request: RequestBody,
  context: LocationContext,
): string {
  const budgetValue = request.budget ?? "sin límite";
  const requestCurrency = request.currency ?? context.homeCurrency;

  // Si no está viajando o no hay presupuesto, devolver normal
  if (!context.isTraveling || budgetValue === "sin límite") {
    return `PRESUPUESTO: ${budgetValue} ${requestCurrency}`;
  }

  // Si está viajando, mostrar ambas monedas
  const homeConfig =
    CURRENCY_CONFIG[context.homeCurrency] || CURRENCY_CONFIG.DEFAULT;
  const activeConfig =
    CURRENCY_CONFIG[context.activeCurrency] || CURRENCY_CONFIG.DEFAULT;

  return `PRESUPUESTO: ${budgetValue} ${requestCurrency} (equivalente aproximado en ${activeConfig.code} - ajustar recomendaciones a precios locales)`;
}

// ============================================
// 8. GOOGLE PLACES API - BÚSQUEDA DE RESTAURANTES REALES
// ============================================

interface PlaceResult {
  name: string;
  formatted_address: string;
  place_id: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number; // 0-4
  types?: string[];
  business_status?: string;
  opening_hours?: { open_now?: boolean };
  geometry?: { location: { lat: number; lng: number } };
}

interface PlacesSearchResult {
  restaurants: PlaceResult[];
  searchQuery: string;
  cached: boolean;
}

/**
 * Mapea price_level de Google Places (0-4) al budget del usuario
 */
function priceLevelToBudget(priceLevel: number | undefined): string {
  if (priceLevel === undefined || priceLevel === null) return "medium";
  if (priceLevel <= 1) return "low";
  if (priceLevel === 2) return "medium";
  return "high";
}

/**
 * Mapea budget del usuario a price_level máximo de Google Places
 */
function budgetToMaxPriceLevel(budget: string | null | undefined): number {
  switch (budget) {
    case "low":
      return 2; // Solo $ y $$
    case "medium":
      return 3; // Hasta $$$
    case "high":
      return 4; // Sin límite
    default:
      return 4; // sin límite
  }
}

/**
 * Busca restaurantes REALES usando Google Places Text Search API.
 * Retorna datos verificados: nombre, dirección, place_id, rating, precio.
 *
 * Usa caché en Firestore (TTL: 2 horas) para reducir costos.
 *
 * @param coords - Coordenadas de búsqueda
 * @param query - Término de búsqueda (ej: "restaurante vegano", "sushi")
 * @param budget - Nivel de presupuesto del usuario
 * @param radius - Radio de búsqueda en metros
 * @param language - Idioma para resultados
 */
async function searchNearbyRestaurants(
  coords: Coordinates,
  query: string,
  budget: string | null | undefined,
  radius: number = SEARCH_RADIUS_METERS,
  language: string = "es",
): Promise<PlacesSearchResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    safeLog("warn", "⚠️ GOOGLE_MAPS_API_KEY no configurada para Places Search");
    return { restaurants: [], searchQuery: query, cached: false };
  }

  // Normalizar query para cache
  const normalizedQuery = normalizeText(query || "restaurante saludable");
  const cacheKey = `places_${crypto
    .createHash("md5")
    .update(
      `${coords.lat.toFixed(3)}_${coords.lng.toFixed(3)}_${normalizedQuery}_${budget || "any"}_${radius}`,
    )
    .digest("hex")
    .substring(0, 20)}`;

  // 1. Intentar caché (TTL: 2 horas)
  const PLACES_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
  try {
    const cacheRef = db.collection("places_search_cache").doc(cacheKey);
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data();
      const age = Date.now() - (data?.cachedAt?.toMillis?.() || 0);
      if (age < PLACES_CACHE_TTL_MS) {
        safeLog(
          "log",
          `[Places] Cache HIT: ${cacheKey.substring(0, 15)}... (${Math.round(age / 1000 / 60)}m old)`,
        );
        return {
          restaurants: data?.restaurants || [],
          searchQuery: normalizedQuery,
          cached: true,
        };
      }
    }
  } catch (cacheError) {
    safeLog(
      "warn",
      "[Places] Cache read error, continuando con fetch",
      cacheError,
    );
  }

  // 2. Construir búsqueda con Text Search (más flexible que Nearby Search)
  const maxPrice = budgetToMaxPriceLevel(budget);
  const searchText = `restaurante ${normalizedQuery}`;

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", searchText);
  url.searchParams.set("location", `${coords.lat},${coords.lng}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("type", "restaurant");
  url.searchParams.set("language", language);
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
  // maxprice filtra restaurantes demasiado caros para el budget
  if (maxPrice < 4) {
    url.searchParams.set("maxprice", String(maxPrice));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    safeLog(
      "log",
      `[Places] Searching: "${searchText}" near ${coords.lat.toFixed(3)},${coords.lng.toFixed(3)} (${radius}m, maxPrice=${maxPrice})`,
    );

    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      safeLog("warn", `[Places] HTTP ${response.status}`);
      return { restaurants: [], searchQuery: normalizedQuery, cached: false };
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      safeLog(
        "warn",
        `[Places] API status: ${data.status} - ${data.error_message || ""}`,
      );
      return { restaurants: [], searchQuery: normalizedQuery, cached: false };
    }

    // 3. Filtrar y procesar resultados
    const restaurants: PlaceResult[] = (data.results || [])
      .filter((place: any) => {
        // Solo restaurantes con status operacional
        if (place.business_status && place.business_status !== "OPERATIONAL")
          return false;
        // Filtrar lugares sin nombre
        if (!place.name) return false;
        // Filtrar resultados genéricos (cadenas de supermercados, etc.)
        const lowName = (place.name || "").toLowerCase();
        const isGeneric = [
          "walmart",
          "costco",
          "carrefour",
          "oxxo",
          "seven eleven",
          "7-eleven",
          "am pm",
        ].some((g) => lowName.includes(g));
        if (isGeneric) return false;
        return true;
      })
      .slice(0, 15) // Máximo 15 resultados para el prompt
      .map(
        (place: any): PlaceResult => ({
          name: place.name,
          formatted_address: place.formatted_address || "",
          place_id: place.place_id || "",
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          price_level: place.price_level,
          types: place.types || [],
          business_status: place.business_status,
          opening_hours: place.opening_hours,
          geometry: place.geometry,
        }),
      );

    safeLog("log", `[Places] Found ${restaurants.length} restaurants`);

    // 4. Guardar en caché
    try {
      const cacheRef = db.collection("places_search_cache").doc(cacheKey);
      await cacheRef.set({
        restaurants,
        searchQuery: normalizedQuery,
        coords: { lat: coords.lat, lng: coords.lng },
        cachedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + PLACES_CACHE_TTL_MS + 60 * 60 * 1000), // +1h buffer
      });
    } catch (cacheError) {
      safeLog("warn", "[Places] Cache write error", cacheError);
    }

    return { restaurants, searchQuery: normalizedQuery, cached: false };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      safeLog("warn", "⚠️ Places search timeout (8s)");
    } else {
      safeLog("error", "❌ Places search error:", error);
    }
    return { restaurants: [], searchQuery: normalizedQuery, cached: false };
  }
}

/**
 * Formatea resultados de Places para inyectar en el prompt de Gemini.
 * Solo datos factuales: nombre, dirección, rating, precio.
 */
function formatPlacesForPrompt(places: PlaceResult[]): string {
  if (places.length === 0) return "";

  return places
    .map((p, i) => {
      const priceStr =
        p.price_level !== undefined ? "$".repeat(p.price_level || 1) : "?";
      const ratingStr = p.rating ? `★${p.rating}` : "";
      const reviewsStr = p.user_ratings_total
        ? `(${p.user_ratings_total} reseñas)`
        : "";

      return `${i + 1}. "${p.name}" | ${p.formatted_address} | ${priceStr} ${ratingStr} ${reviewsStr}`.trim();
    })
    .join("\n");
}

/**
 * Genera link de Google Maps usando place_id (100% preciso) o fallback a query.
 */
const generateMapsLinkFromPlaceId = (
  placeId: string,
  restaurantName: string,
  address: string,
): string => {
  if (placeId) {
    // Place ID link: siempre lleva al lugar exacto
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }
  // Fallback: búsqueda por nombre + dirección
  const searchQuery = `${restaurantName} ${address}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
};

// ============================================
// 9. UTILIDAD PARA GENERAR LINKS DE MAPS (LEGACY)
// ============================================

const generateMapsLink = (
  restaurantName: string,
  address: string,
  city: string,
): string => {
  // Limpiar caracteres especiales pero mantener espacios para la query
  const cleanName = restaurantName.replace(/[^\w\s\-&,]/g, "").trim();
  const cleanAddress = (address || "").replace(/[^\w\s\-&,]/g, "").trim();
  const cleanCity = (city || "").replace(/[^\w\s\-&]/g, "").trim();

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
    const address = rec.direccion_aproximada || "";
    rec.link_maps = generateMapsLink(rec.nombre_restaurante, address, city);
  }

  // Asegurar que no haya campos undefined
  rec.direccion_aproximada = rec.direccion_aproximada || `En ${city}`;
  rec.por_que_es_bueno = rec.por_que_es_bueno || "Opción saludable disponible";
  rec.plato_sugerido = rec.plato_sugerido || "Consulta el menú saludable";
  rec.hack_saludable = rec.hack_saludable || "Pide porciones pequeñas";

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
  "https://bocado-ai.vercel.app",
  "https://bocado.app",
  "https://www.bocado.app",
  "https://app.bocado.app",
  // Desarrollo
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Permitir peticiones sin origin (same-origin requests, mobile apps, etc.)
  if (!origin) return true;
  // Permitir localhost en desarrollo
  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
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
    return res.status(403).json({ error: "Origin not allowed" });
  }

  // Si no hay origin (same-origin), usar el primer origen de producción
  // NOTA: wildcard '*' es incompatible con credentials: true según spec CORS
  const allowedOrigin = origin || ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ============================================
  // RATE LIMITING POR IP (anti-abuso)
  // ============================================
  const clientIP = (
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown"
  )
    .toString()
    .split(",")[0]
    .trim();
  const ipCheck = await ipRateLimiter.checkIPLimit(clientIP);

  if (!ipCheck.allowed) {
    return res.status(429).json({
      error: "Demasiadas solicitudes desde esta IP. Inténtalo más tarde.",
      retryAfter: ipCheck.retryAfter,
      code: "IP_RATE_LIMITED",
    });
  }

  const authHeader =
    req.headers?.authorization || req.headers?.Authorization || "";
  const tokenMatch =
    typeof authHeader === "string"
      ? authHeader.match(/^Bearer\s+(.+)$/i)
      : null;
  const idToken = tokenMatch?.[1];

  if (!idToken) {
    return res.status(401).json({ error: "Auth token requerido" });
  }

  let authUserId: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    authUserId = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: "Auth token inválido" });
  }

  // ============================================
  // GET /api/recommend?userId=xxx - Status del rate limit
  // ============================================
  if (req.method === "GET") {
    const status = await rateLimiter.getStatus(authUserId);
    if (!status) {
      return res.status(200).json({
        canRequest: true,
        requestsInWindow: 0,
        remainingRequests: 5,
      });
    }

    return res.status(200).json({
      ...status,
      nextAvailableIn: status.nextAvailableAt
        ? Math.max(0, Math.ceil((status.nextAvailableAt - Date.now()) / 1000))
        : 0,
    });
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Método no permitido" });

  let interactionRef: FirebaseFirestore.DocumentReference | null = null;
  let userId: string | null = null;

  try {
    // Validar body con Zod
    const parseResult = RequestBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      // ✅ FIX: Log de errores de validación para debugging
      // 🔴 FIX #15: Validar JSON.stringify antes de .substring()
      const bodyStr = req.body ? JSON.stringify(req.body) : "undefined";
      safeLog("warn", "⚠️ Request validation failed:", {
        userId: authUserId,
        issues,
        body: bodyStr.substring(0, 200),
      });
      return res
        .status(400)
        .json({ error: "Invalid request body", details: issues });
    }

    const request: RequestBody = parseResult.data;

    // ✅ FIX: Log de requests exitosos (solo campos clave)

    userId = authUserId;
    if (request.userId && request.userId !== authUserId) {
      return res.status(403).json({ error: "userId no coincide con el token" });
    }
    const { type, _id } = request;
    const interactionId = _id || `int_${Date.now()}`;

    safeLog(
      "log",
      `🚀 Nueva solicitud: type=${type}, userId=${userId?.substring(0, 8)}...`,
    );

    if (!userId) return res.status(400).json({ error: "userId requerido" });

    // ============================================
    // RATE LIMITING V2 - Transacción atómica
    // ============================================
    const rateCheck = await rateLimiter.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.error,
        retryAfter: rateCheck.secondsLeft,
        remainingRequests: rateCheck.remainingRequests,
      });
    }

    interactionRef = db.collection("user_interactions").doc(interactionId);
    await interactionRef.set({
      userId,
      interaction_id: interactionId,
      createdAt: FieldValue.serverTimestamp(),
      status: "processing",
      tipo: type,
    });

    const historyCol =
      type === "En casa" ? "historial_recetas" : "historial_recomendaciones";

    // 💰 FINOPS: Usar cache de perfil en lugar de lectura directa
    const user = await getUserProfileCached(userId);

    let historyContext = "";
    try {
      // 💰 FINOPS FIX #4: Query sin orderBy y sort en memoria (deduplica read)
      // Antes: 2 queries si falta índice (con orderBy + fallback sin orderBy)
      // Después: 1 query siempre (sin orderBy + sort en memoria)
      const firestoreTimeout = (ms: number) =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firestore timeout")), ms),
        );

      // Query única sin orderBy (más rápido, no requiere índice)
      const historySnap = (await Promise.race([
        db
          .collection(historyCol)
          .where("user_id", "==", userId)
          .limit(20) // Traer más para compensar el sort en memoria
          .get(),
        firestoreTimeout(8000), // 8 segundos timeout
      ])) as FirebaseFirestore.QuerySnapshot;

      if (!historySnap.empty) {
        // Sort en memoria por fecha_creacion
        interface HistoryDoc {
          id: string;
          data: any;
          timestamp: number;
        }
        const sortedDocs: HistoryDoc[] = historySnap.docs
          .map((doc: any) => {
            const data = doc.data();
            const timestamp = data?.fecha_creacion?.toMillis?.() || 0;
            return { id: doc.id, data, timestamp };
          })
          .sort((a, b) => b.timestamp - a.timestamp) // Desc (más recientes primero)
          .slice(0, 5); // Top 5

        // ✅ FIX: Validar doc.data() antes de acceder a propiedades
        const recent = sortedDocs
          .map((doc: HistoryDoc) => {
            const d = doc.data;
            if (!d) return null; // Documento borrado o sin data

            if (type === "En casa") {
              const recetas = d.receta?.recetas || [];
              return Array.isArray(recetas)
                ? recetas.map((r: any) => r?.titulo).filter(Boolean)
                : [];
            } else {
              const recs = d.recomendaciones || [];
              return Array.isArray(recs)
                ? recs.map((r: any) => r?.nombre_restaurante).filter(Boolean)
                : [];
            }
          })
          .filter(Boolean)
          .flat();

        if (recent.length > 0) {
          historyContext = `### 🧠 MEMORIA (NO REPETIR): Recientemente recomendaste: ${recent.join(", ")}. INTENTA VARIAR Y NO REPETIR ESTOS NOMBRES.`;
        }
      }
    } catch (e: any) {
      safeLog("log", "No se pudo obtener historial", e);
    }

    let feedbackContext = "";
    try {
      const feedbackSnap = await db
        .collection("user_history")
        .where("userId", "==", userId)
        .limit(5)
        .get();

      if (!feedbackSnap.empty) {
        const logs = feedbackSnap.docs
          .map((d) => d.data())
          .sort(
            (a: any, b: any) =>
              (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
          )
          .map(
            (data: any) =>
              `- ${data.itemId}: ${data.rating}/5${data.comment ? ` - "${data.comment}"` : ""}`,
          )
          .join("\n");
        feedbackContext = `### ⭐️ PREFERENCIAS BASADAS EN FEEDBACK PREVIO:\n${logs}\nUsa esto para entender qué le gusta o no al usuario.`;
      }
    } catch (e) {
      safeLog("log", "No se pudo obtener feedback", e);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    let finalPrompt = "";
    let parsedData: any;

    if (type === "En casa") {
      // ✅ Obtener ingredientes de Firestore (reemplaza Airtable)
      let filteredItems: FirestoreIngredient[] = [];
      try {
        const allIngredients = await getAllIngredientes();
        filteredItems = filterIngredientes(allIngredients, user);
        safeLog(
          "log",
          `[Ingredients] ${filteredItems.length}/${allIngredients.length} passed filters`,
        );
      } catch (ingredientError: any) {
        safeLog("error", "❌ Ingredients Fetch Failed", ingredientError);
        filteredItems = [];
      }

      // 💰 FINOPS: Usar cache de pantry en lugar de lectura directa
      const pantryItems = await getPantryItemsCached(userId);

      const { priorityList, marketList, hasPantryItems } = scoreIngredients(
        filteredItems,
        pantryItems,
      );

      // ✅ OPTIMIZACIÓN: Prompt conciso para reducir tokens (~30% menos)
      const pantryRule = request.onlyPantryIngredients
        ? "usar SOLO ingredientes de la despensa (sin excepciones, sin básicos)"
        : "usar despensa primero, respetar restricciones. Opcionales: básicos (aceite, sal, especias)";

      // Contexto demográfico relevante (solo si está disponible)
      const demographicParts = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : "",
        user.age ? `${user.age} años` : "",
        user.activityLevel && user.activityLevel !== "Sedentario"
          ? user.activityLevel
          : "",
      ].filter(Boolean);
      const demographicContext =
        demographicParts.length > 0 ? demographicParts.join(", ") : "";

      // Restricciones médicas (solo mostrar si existen)
      const diseases = ensureArray(user.diseases);
      const allergies = ensureArray(user.allergies);
      const medicalRestrictions = [...diseases, ...allergies].filter(Boolean);
      const medicalContext =
        medicalRestrictions.length > 0
          ? `Restricciones: ${medicalRestrictions.join(", ")}`
          : "";

      // Alimentos no deseados
      const allDislikedFoods = [
        ...ensureArray(user.dislikedFoods),
        ...ensureArray(request.dislikedFoods),
      ].filter(Boolean);
      const dislikedContext =
        allDislikedFoods.length > 0
          ? `NO usar: ${allDislikedFoods.join(", ")}`
          : "";

      // Construir línea de perfil limpia
      const profileParts = [
        demographicContext,
        medicalContext,
        dislikedContext,
      ].filter(Boolean);
      const profileLine = profileParts.join(" | ");

      // Ajuste de dificultad según experiencia culinaria
      const difficultyHint =
        user.cookingAffinity === "Novato" ||
        user.cookingAffinity === "No me gusta cocinar"
          ? ", dificultad máxima: Fácil"
          : "";

      finalPrompt = `Eres nutricionista. Genera 3 recetas para: ${user.nutritionalGoal || "comer saludable"}

PERFIL: ${profileLine || "Sin restricciones"} | Ubic: ${user.city || "su ciudad"}
SOLICITUD: ${request.mealType || "Comida"}, ${request.cookingTime || "30"}min, ${request.budget || "sin límite"} ${request.currency || ""}
${historyContext ? "\nMEMORIA: " + historyContext.slice(30, 200) : ""}
${feedbackContext ? "\nFEEDBACK: " + feedbackContext.slice(30, 150) : ""}
${hasPantryItems ? `\nDESPENSA: ${priorityList.slice(0, 200)}` : ""}
${marketList && !request.onlyPantryIngredients ? `\nDISPONIBLE: ${marketList.slice(0, 150)}` : ""}

REGLAS ESTRICTAS:
1. Exactamente 3 recetas, tiempo ≤${request.cookingTime || "30"}min${difficultyHint}
2. ${pantryRule}
3. USA EXCLUSIVAMENTE ingredientes de las listas DESPENSA y DISPONIBLE proporcionadas arriba. Si no hay lista, usa solo ingredientes COMUNES y FÁCILES de encontrar en supermercados de ${user.city || user.country || "la región del usuario"}.
4. PROHIBIDO inventar ingredientes exóticos, raros o difíciles de conseguir. Cada ingrediente debe poder comprarse en un supermercado normal de la zona.
5. Si mencionas un ingrediente que NO está en las listas, debe ser un básico universal (sal, aceite, agua, pimienta).
6. Las cantidades deben ser realistas y en unidades estándar (gramos, ml, cucharadas, unidades).

Responde EXCLUSIVAMENTE en ${request.language === "en" ? "INGLÉS." : "ESPAÑOL."}
Responde en formato JSON usando esta estructura exacta:
${RECIPE_JSON_TEMPLATE}

Personaliza el saludo_personalizado usando${demographicParts.length > 0 ? " el perfil del usuario" : " un mensaje motivador"}.`;
    } else {
      // 🔴 FIX #11: Mover searchCoords ANTES de usarlo en validación
      // Determinar coordenadas para búsqueda de restaurantes
      const searchCoords = getSearchCoordinates(request, user);

      // ✅ FIX: Validar ciudad antes de generar prompt de restaurantes
      if (!user.city && !searchCoords) {
        throw new Error(
          "No se pudo determinar tu ubicación. Por favor actualiza tu perfil o activa el GPS.",
        );
      }

      // ✨ NUEVA LÓGICA: Detectar si está viajando y qué moneda usar
      const travelContext = await detectTravelContext(
        searchCoords,
        request,
        user,
      );

      // Logging detallado para debugging de ubicación

      const locationContext = searchCoords
        ? `Coordenadas de referencia: ${formatCoordinates(searchCoords)}`
        : `Ciudad: ${user.city || "su ciudad"}`;

      const locationInstruction = searchCoords
        ? `**IMPORTANTE - RANGO DE BÚSQUEDA**: Busca restaurantes DENTRO de un radio de ${SEARCH_RADIUS_METERS / 1000}km desde las coordenadas ${formatCoordinates(searchCoords)}. Prioriza lugares cercanos a esta ubicación.`
        : `**IMPORTANTE**: Busca restaurantes en ${user.city || "su ciudad"} que sean accesibles y no muy alejados del centro.`;

      // Contexto demográfico relevante (solo si está disponible)
      const demographicPartsOut = [
        user.eatingHabit ? `Dieta: ${user.eatingHabit}` : "",
        user.age ? `${user.age} años` : "",
        user.activityLevel && user.activityLevel !== "Sedentario"
          ? user.activityLevel
          : "",
      ].filter(Boolean);
      const demographicContextOut =
        demographicPartsOut.length > 0 ? demographicPartsOut.join(", ") : "";

      // Restricciones médicas (solo mostrar si existen)
      const diseasesOut = ensureArray(user.diseases);
      const allergiesOut = ensureArray(user.allergies);
      const medicalRestrictionsOut = [...diseasesOut, ...allergiesOut].filter(
        Boolean,
      );
      const medicalContextOut =
        medicalRestrictionsOut.length > 0
          ? `Restricciones: ${medicalRestrictionsOut.join(", ")}`
          : "";

      // Alimentos no deseados
      const allDislikedFoodsOut = [
        ...ensureArray(user.dislikedFoods),
        ...ensureArray(request.dislikedFoods),
      ].filter(Boolean);
      const dislikedContextOut =
        allDislikedFoodsOut.length > 0
          ? `NO: ${allDislikedFoodsOut.join(", ")}`
          : "";

      // Construir línea de perfil limpia
      const profilePartsOut = [
        demographicContextOut,
        user.nutritionalGoal || "saludable",
        medicalContextOut,
        dislikedContextOut,
      ].filter(Boolean);
      const profileLineOut = profilePartsOut.join(" | ");

      // ✨ Instrucción de presupuesto con conversión de moneda
      const budgetInstruction = getBudgetInstruction(request, travelContext);

      // ✨ Mensaje personalizado para viajeros
      const travelTone = travelContext.isTraveling
        ? `${travelContext.locationLabel}. Adapta tono amigable para turista. Menciona precios en ${travelContext.activeCurrency}.`
        : "";

      // ✅ OPTIMIZACIÓN: Prompt conciso para restaurantes (~40% menos tokens)
      finalPrompt = `Eres guía gastronómico ${travelContext.locationLabel}. Recomienda 5 restaurantes reales.

PERFIL: ${profileLineOut || "Sin restricciones"}
UBICACIÓN: ${locationContext} | RANGO: ${SEARCH_RADIUS_METERS / 1000}km
SOLICITUD: ${request.cravings || "saludable"}, ${budgetInstruction}
${travelTone ? "\nCONTEXTO: " + travelTone : ""}
${historyContext ? "\nMEMORIA: " + historyContext.slice(30, 200) : ""}
${feedbackContext ? "\nFEEDBACK: " + feedbackContext.slice(30, 150) : ""}

REGLAS CRÍTICAS:
1. Nombres reales de restaurantes existentes ${travelContext.isTraveling ? "cerca de tu ubicación actual" : `en ${user.city || "su ciudad"}`}
2. DIRECCIONES EXACTAS: Calle Número, Colonia (ej: "Calle Arturo Soria 126, Chamartín")
3. Si no sabes dirección exacta: usa centro comercial específico
4. NO uses "por el centro" o direcciones vagas
5. Rango máximo: ${SEARCH_RADIUS_METERS / 1000}km
${user.eatingHabit && (user.eatingHabit.includes("Vegano") || user.eatingHabit.includes("Vegetariano")) ? `\n6. CRÍTICO: SOLO restaurantes con opciones ${user.eatingHabit.toLowerCase()} certificadas` : ""}
${travelContext.isTraveling ? `\n7. Menciona precios aproximados en ${travelContext.activeCurrency} (moneda local)` : ""}

Responde EXCLUSIVAMENTE en ${request.language === "en" ? "INGLÉS." : "ESPAÑOL."}
Responde en formato JSON usando esta estructura exacta:
${RESTAURANT_JSON_TEMPLATE}

Personaliza el saludo_personalizado${travelContext.isTraveling ? " mencionando exploración de la zona" : demographicPartsOut.length > 0 ? " usando perfil" : " con mensaje motivador"}.
En por_que_es_bueno${medicalRestrictionsOut.length > 0 || demographicPartsOut.length > 0 ? " explica cómo se ajusta al perfil" : " explica por qué es buena opción"}.
En hack_saludable${medicalRestrictionsOut.length > 0 ? " personaliza para sus condiciones" : " da consejo práctico"}.`;
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      generationConfig: {
        // ✅ ANTI-ALUCINACIÓN: temperature baja = respuestas más precisas y factuales
        temperature: type === "En casa" ? 0.4 : 0.2,
        // ✅ OPTIMIZACIÓN: Reducir tokens máximos según tipo (ahorro ~20%)
        maxOutputTokens: type === "En casa" ? 2800 : 2200,
        responseMimeType: "application/json",
        // ✅ ANTI-ALUCINACIÓN: topP más bajo para restaurantes (más determinístico)
        topP: type === "En casa" ? 0.9 : 0.8,
        topK: 30,
      },
    });

    const responseText = result.response.text();

    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      // ✅ FIX: Intentar extraer JSON de markdown o texto
      const jsonMatch =
        responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
        responseText.match(/{[\s\S]*}/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[1] || jsonMatch[0];
        try {
          // 🔴 FIX #12: Nested try-catch para JSON extraído (ya estaba implementado)
          parsedData = JSON.parse(extractedJson);
        } catch (innerError: any) {
          // 🔴 FIX #15: Validar extractedJson antes de .substring()
          const preview = extractedJson
            ? String(extractedJson).substring(0, 200)
            : "undefined";
          safeLog("error", "❌ JSON extraído es inválido:", preview);
          throw new Error(
            `Invalid JSON extracted from response: ${innerError.message}`,
          );
        }
      } else {
        // 🔴 FIX #15: Validar responseText antes de .substring()
        const preview = responseText
          ? String(responseText).substring(0, 200)
          : "undefined";
        safeLog("error", "❌ No se encontró JSON en respuesta:", preview);
        throw new Error("No se pudo parsear la respuesta de Gemini");
      }
    }

    // ============================================
    // VALIDACIÓN ESTRUCTURAL DE LA RESPUESTA
    // ============================================
    try {
      if (type === "En casa") {
        parsedData = RecipeResponseSchema.parse(parsedData);
      } else {
        parsedData = RestaurantResponseSchema.parse(parsedData);
      }
    } catch (validationError: any) {
      safeLog("error", "❌ Respuesta de Gemini inválida", validationError);
      throw new Error(
        "La respuesta del modelo no cumple con el formato esperado",
      );
    }

    // ============================================
    // POST-PROCESAMIENTO PARA LINKS CLICKEABLES
    // ============================================
    if (type === "Fuera" && parsedData.recomendaciones) {
      // Generar links válidos en el backend usando nombre + dirección + ciudad
      parsedData.recomendaciones = parsedData.recomendaciones.map((rec: any) =>
        sanitizeRecommendation(rec, user.city || ""),
      );
    }

    const batch = db.batch();

    const historyRef = db.collection(historyCol).doc();
    batch.set(historyRef, {
      user_id: userId,
      interaction_id: interactionId,
      fecha_creacion: FieldValue.serverTimestamp(),
      tipo: type,
      ...parsedData,
    });

    batch.update(interactionRef, {
      procesado: true,
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      historyDocId: historyRef.id,
    });

    await batch.commit();

    // ============================================
    // ÉXITO: Marcar proceso como completado
    // ============================================
    await rateLimiter.completeProcess(userId);

    return res.status(200).json(parsedData);
  } catch (error: any) {
    safeLog("error", "❌ Error completo en API", error);
    // Stack trace solo en desarrollo
    if (process.env.NODE_ENV === "development") {
      console.error("Stack trace:", error.stack);
    }

    // Identificar tipo de error para mejor diagnóstico
    let errorMessage = error.message || "Error interno del servidor";
    let statusCode = 500;

    if (
      error?.message?.includes("index") ||
      error?.code === "failed-precondition"
    ) {
      errorMessage =
        "Error de configuración de base de datos. Contacta al administrador.";
      statusCode = 500;
    } else if (
      error?.message?.includes("timeout") ||
      error?.code === "deadline-exceeded"
    ) {
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
        safeLog("error", "Error actualizando rate limit", rlError);
      }
    }

    if (interactionRef) {
      try {
        await interactionRef.update({
          status: "error",
          error: error.message,
          errorDetails: error.stack?.substring(0, 1000) || "",
          errorAt: FieldValue.serverTimestamp(),
        });
      } catch (e) {
        safeLog("error", "No se pudo actualizar el estado de error", e);
      }
    }

    return res.status(statusCode).json({
      error: errorMessage,
      code: error?.code || "UNKNOWN_ERROR",
    });
  }
}
