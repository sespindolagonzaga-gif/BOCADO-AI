/**
 * 🔄 Middleware de Traducción Entrada/Salida
 * 
 * Responsable de:
 * 1. MIDDLEWARE DE ESCRITURA (Inbound): Traducir datos de UI Inglés → Español antes de Firebase
 * 2. MIDDLEWARE DE LECTURA (Outbound): Traducir datos de Firebase Español → UI Inglés
 * 
 * REGLA: Firebase SIEMPRE almacena en español, pero la UI puede mostrar en inglés
 */

import { translateOption, diseaseKeys, allergyKeys, goalKeys, activityKeys, frequencyKeys, cravingKeys, mealKeys } from './translationHelpers';

/**
 * Mapeo inverso: de clave de traducción al español
 * Usado para LECTURA (convertir valores españoles a UI)
 */
const translationKeyToSpanish: Record<string, Record<string, string>> = {
  'options.diseases': {
    hypertension: 'Hipertensión',
    diabetes: 'Diabetes',
    hypothyroidism: 'Hipotiroidismo',
    hyperthyroidism: 'Hipertiroidismo',
    cholesterol: 'Colesterol',
    ibs: 'Intestino irritable',
  },
  'options.allergies': {
    lactose: 'Intolerante a la lactosa',
    nuts: 'Alergia a frutos secos',
    celiac: 'Celíaco',
    vegan: 'Vegano',
    vegetarian: 'Vegetariano',
  },
  'options.goals': {
    loseWeight: 'Bajar de peso',
    gainWeight: 'Subir de peso',
    buildMuscle: 'Generar músculo',
    wellness: 'Salud y bienestar',
  },
  'options.activity': {
    sedentary: '🪑 Sedentario',
    light: '🚶‍♂️ Activo ligero',
    strength: '🏋️‍♀️ Fuerza',
    cardio: '🏃‍♂️ Cardio',
    sports: '⚽ Deportivo',
    athlete: '🥇 Atleta',
  },
  'options.frequency': {
    daily: 'Diario',
    frequent: '3-5 veces por semana',
    occasional: '1-2 veces',
    rarely: 'Rara vez',
  },
  'options.cravings': {
    italian: '🍕 Italiana / Pizza',
    japanese: '🍣 Japonesa / Sushi',
    healthy: '🥗 Saludable o fit',
    asian: '🍜 Asiática / China',
    mexican: '🌮 Mexicana',
    american: '🍔 Americana / Fast food',
    mediterranean: '🥘 Mediterránea',
  },
  'options.meals': {
    breakfast: '🥞 Desayuno',
    lunch: '🥗 Comida',
    dinner: '🥙 Cena',
    snack: '🍎 Snack',
  },
};

/**
 * ✅ MIDDLEWARE DE LECTURA (Outbound)
 * 
 * Convierte datos de Firebase (español) a la UI (en el idioma del usuario)
 * 
 * Ejemplo:
 * ```typescript
 * const { t } = useTranslation();
 * const diseases = ['Hipertensión', 'Diabetes'];
 * const displayDiseases = translateForUI(diseases, diseaseKeys, t);
 * // Si UI está en inglés: ['Hypertension', 'Diabetes']
 * // Si UI está en español: ['Hipertensión', 'Diabetes']
 * ```
 */
export function translateForUI(
  values: string[],
  mapping: Record<string, string>,
  t: (key: string) => string
): string[] {
  return values.map(value => translateOption(value, mapping, t));
}

/**
 * ✅ MIDDLEWARE DE ESCRITURA (Inbound)
 * 
 * No hace nada - Los datos siempre se guardan tal como vienen de Firebase
 * porque ya están en español en la base de datos
 * 
 * IMPORTANTE: En los formularios, SIEMPRE guardar los valores en español
 * (directamente de constants.ts)
 */
export function translateForStorage(value: string): string {
  // Los datos ya están en español - no hacer nada
  return value;
}

/**
 * Helper para traducir strings dinámicos de texto libre
 * (descripciones, notas, etc.)
 * 
 * EN DESARROLLO: Requeriría una API de traducción externa
 * Por ahora, solo retorna el valor original
 */
export async function translateFreeText(
  text: string,
  targetLanguage: 'es' | 'en'
): Promise<string> {
  // TODO: Integrar con servicio de traducción (Google Translate API, DeepL, etc.)
  // Por ahora, retornar el texto original
  console.warn('Free text translation not implemented yet');
  return text;
}

/**
 * Preparar datos de perfil para mostrar en UI
 * Traduce opciones pero mantiene valores puros
 */
export function prepareProfileForDisplay(
  profile: any,
  t: (key: string) => string
) {
  return {
    ...profile,
    diseases: translateForUI(profile.diseases || [], diseaseKeys, t),
    allergies: translateForUI(profile.allergies || [], allergyKeys, t),
    nutritionalGoal: translateForUI(profile.nutritionalGoal || [], goalKeys, t),
    activityLevel: profile.activityLevel ? translateOption(profile.activityLevel, activityKeys, t) : '',
    activityFrequency: profile.activityFrequency ? translateOption(profile.activityFrequency, frequencyKeys, t) : '',
  };
}

/**
 * Convertir datos de formulario de UI (potencialmente en inglés) a Firebase (español)
 * 
 * NOTA: Si el usuario llena el formulario en inglés, necesitaría traducción
 * Por ahora, asumimos que constants.ts siempre tiene valores en español
 */
export function prepareProfileForStorage(profile: any) {
  // Los datos ya están en español de constants.ts
  return profile;
}
