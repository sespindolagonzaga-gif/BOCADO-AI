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

const FATSECRET_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function getFatSecretIngredientsWithCache(
  db: any,
  user: any,
  language: string = 'es',
  safeLog: (...args: any[]) => void = () => {}
): Promise<{ priorityList: string; marketList: string; hasPantryItems: boolean }> {
  const searchTerms = buildFatSecretSearchTerms(user, language);
  const cacheKey = `fatsecret_${crypto.createHash('md5').update(searchTerms.join('|') + (user.eatingHabit || '')).digest('hex').substring(0, 16)}`;
  const cacheRef = db.collection('fatsecret_cache').doc(cacheKey); // caché propia de FatSecret
  // Intentar leer caché (TTL: 24h)
  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() as any;
      const age = Date.now() - (data?.cachedAt?.toMillis?.() || 0);
      if (age < FATSECRET_CACHE_TTL_MS) {
        safeLog('log', `[FatSecret] Cache HIT: ${cacheKey.substring(0, 20)}...`);
        return data.result;
      }
    }
  } catch (e) {
    safeLog('warn', '[FatSecret] Error leyendo caché', e);
  }

  // Buscar múltiples términos en paralelo
  const allFoods: string[] = [];
  try {
    const token = await getFatSecretToken();
    const searches = searchTerms.map(term => searchFatSecretFoods(token, term, user, safeLog));
    const results = await Promise.allSettled(searches);
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allFoods.push(...result.value);
      }
    });
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
