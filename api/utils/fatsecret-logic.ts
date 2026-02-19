import * as crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { searchFatSecretIngredients, getFatSecretToken } from './fatsecret';

export interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_type: string;
  food_url: string;
  servings?: { serving: any };
}

// ============================================
// ⚠️ IMPORTANTE: LÍMITES DE FATSECRET PLAN PREMIUM FREE
// ============================================
// Max 100 requests/hora, 3000 requests/día
// Implementar rate limiting serializado (no paralelo)

const FATSECRET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días (optimizado)
const FATSECRET_REQUEST_DELAY_MS = 300; // 300ms entre requests (para evitar spike)
const MAX_SEARCHES_PER_CALL = 3; // Máximo 3 búsquedas por call (en lugar de 5)

/**
 * Espera N millisegundos (utility)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getFatSecretIngredientsWithCache(
  db: any,
  user: any,
  language: string = 'es',
  safeLog: (...args: any[]) => void = () => {}
): Promise<{ priorityList: string; marketList: string; hasPantryItems: boolean }> {
  const searchTerms = buildFatSecretSearchTerms(user, language);
  
  // Limitar a MAX_SEARCHES_PER_CALL para no exceder cuota
  const limitedTerms = searchTerms.slice(0, MAX_SEARCHES_PER_CALL);
  
  const cacheKey = `fatsecret_${crypto
    .createHash('md5')
    .update(limitedTerms.join('|') + (user.eatingHabit || ''))
    .digest('hex')
    .substring(0, 16)}`;
  
  const cacheRef = db.collection('fatsecret_cache').doc(cacheKey);
  
  // Layer 1: Intentar leer caché (TTL: 7 días)
  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() as any;
      const age = Date.now() - (data?.cachedAt?.toMillis?.() || 0);
      if (age < FATSECRET_CACHE_TTL_MS) {
        safeLog('log', `[FatSecret] Cache HIT: ${cacheKey.substring(0, 20)}... (age: ${Math.round(age / 1000 / 60)}min)`);
        return data.result;
      }
    }
  } catch (e) {
    safeLog('warn', '[FatSecret] Error leyendo caché', e);
  }

  // Layer 2: Buscar múltiples términos SERIALIZADOS (no paralelo)
  // Esto previene exceder el límite de 100 req/hora
  const allFoods: string[] = [];
  try {
    const token = await getFatSecretToken();
    
    // ✅ SERIALIZADO: Una búsqueda a la vez con delay
    safeLog('log', `[FatSecret] Iniciando ${limitedTerms.length} búsquedas serializadas...`);
    
    for (let i = 0; i < limitedTerms.length; i++) {
      const term = limitedTerms[i];
      
      try {
        const foods = await searchFatSecretFoods(token, term, user, safeLog);
        allFoods.push(...foods);
        
        // Delay entre requests para no spammear la API
        if (i < limitedTerms.length - 1) {
          await delay(FATSECRET_REQUEST_DELAY_MS);
        }
      } catch (searchError: any) {
        // Si una búsqueda falla, continuar con las siguientes
        safeLog('warn', `[FatSecret] Búsqueda "${term}" falló, continuando...`, searchError);
      }
    }
  } catch (error) {
    safeLog('error', '[FatSecret] Error en búsqueda', error);
  }
  // Deduplicar
  const uniqueFoods = [...new Set(allFoods)];
  const result = {
    priorityList: uniqueFoods.slice(0, 40).join(', '),
    marketList: uniqueFoods.slice(40, 80).join(', '),
    hasPantryItems: false, // FatSecret no sabe qué hay en despensa
  };
  // Guardar caché
  try {
    await cacheRef.set({
      result,
      cachedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    safeLog('warn', '[FatSecret] Error guardando caché', e);
  }
  return result;
}

export async function searchFatSecretFoods(
  token: string,
  query: string,
  user: any,
  safeLog: (...args: any[]) => void = () => {}
): Promise<string[]> {
  const params = new URLSearchParams({
    method: 'foods.search.v3',
    search_expression: query,
    format: 'json',
    max_results: '25',
    language: 'es',
    region: user.country || 'MX',
    ...(isVegan(user) && { food_type: 'Generic' }),
  });
  const response = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    safeLog('warn', `[FatSecret] Search failed for "${query}": ${response.status}`);
    return [];
  }
  const data = await response.json();
  const foods: FatSecretFood[] = data?.foods_search?.results?.food || [];
  // Filtrar por restricciones del usuario usando datos nutricionales
  return foods
    .filter(food => isFoodSafeForUser(food, user))
    .map(food => food.food_name)
    .filter(Boolean);
}

export function isVegan(user: any): boolean {
  return (user.allergies || []).includes('Vegano') || 
         (user.eatingHabit || '').includes('Vegano');
}

export function buildFatSecretSearchTerms(user: any, language: string): string[] {
  const eatingHabit = user.eatingHabit || '';
  const diseases = user.diseases || [];
  const baseTerms: string[] = [];
  const goalMap: Record<string, string[]> = {
    'Perder peso':    ['verduras bajas calorias', 'proteina magra', 'legumbres'],
    'Ganar músculo':  ['pollo pechuga', 'huevo', 'legumbres proteina', 'atun'],
    'Mantenimiento':  ['cereales integrales', 'frutas', 'verduras', 'proteinas'],
    'Energía':        ['avena', 'frutas energia', 'nueces semillas'],
  };
  const goal = user.nutritionalGoal || 'Mantenimiento';
  baseTerms.push(...(goalMap[goal] || goalMap['Mantenimiento']));
  if (eatingHabit.includes('Vegano')) {
    return ['tofu proteina vegana', 'legumbres vegano', 'verduras vegano', 'frutas frescas', 'semillas vegano'];
  }
  if (eatingHabit.includes('Vegetariano')) {
    return ['huevo vegetariano', 'lacteos vegetariano', 'legumbres vegetariano', ...baseTerms];
  }
  if (diseases.includes('Diabetes')) {
    baseTerms.push('bajo indice glucemico', 'fibra alta');
  }
  if (diseases.includes('Hipertensión')) {
    baseTerms.push('bajo sodio', 'potasio alto');
  }
  if (diseases.includes('Colesterol')) {
    baseTerms.push('bajo colesterol', 'omega 3');
  }
  return baseTerms.slice(0, 5); // Máx 5 búsquedas paralelas
}

export function isFoodSafeForUser(food: FatSecretFood, user: any): boolean {
  const name = (food.food_name || '').toLowerCase();
  const allergies = user.allergies || [];
  const dislikes = user.dislikedFoods || [];
  if (dislikes.some((d: string) => name.includes(d.toLowerCase()))) return false;
  if (allergies.includes('Alergia a frutos secos')) {
    const nuts = ['nuez', 'almendra', 'cacahuate', 'peanut', 'walnut', 'almond', 'hazelnut', 'avellana'];
    if (nuts.some(n => name.includes(n))) return false;
  }
  if (allergies.includes('Celíaco')) {
    const gluten = ['trigo', 'cebada', 'centeno', 'wheat', 'barley', 'rye'];
    if (gluten.some(g => name.includes(g))) return false;
  }
  return true;
}
