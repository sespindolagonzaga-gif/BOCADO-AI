// ⚠️ IMPORTANTE: Estas constantes están en ESPAÑOL y se guardan así en Firebase.
// NUNCA traduzcas estos valores al guardarlos en la base de datos.
// Solo la UI debe traducirse, los datos siempre en español.
// Ver: docs/i18n-architecture.md

export const EATING_HABITS = ['En casa', 'Fuera'];
export const CRAVINGS = [
  '🍕 Italiana / Pizza',
  '🍣 Japonesa / Sushi',
  '🥗 Saludable o fit',
  '🍜 Asiática / China',
  '🌮 Mexicana',
  '🍔 Americana / Fast food',
  '🥘 Mediterránea',
  '🥡 Otros'
];
export const MEALS = ['🥞 Desayuno', '🥗 Comida', '🥙 Cena', '🍎 Snack'];
export const DISEASES = ['Hipertensión', 'Diabetes', 'Hipotiroidismo', 'Hipertiroidismo', 'Colesterol', 'Intestino irritable'];
export const ALLERGIES = ['Intolerante a la lactosa', 'Alergia a frutos secos', 'Celíaco', 'Vegano', 'Vegetariano', 'Otro'];
export const ACTIVITY_LEVELS = ['🪑 Sedentario', '🚶‍♂️ Activo ligero', '🏋️‍♀️ Fuerza', '🏃‍♂️ Cardio', '⚽ Deportivo', '🥇 Atleta', 'Otro'];
export const ACTIVITY_FREQUENCIES = ['Diario', '3-5 veces por semana', '1-2 veces', 'Rara vez'];
export const GOALS = ['Bajar de peso', 'Subir de peso', 'Generar músculo', 'Salud y bienestar'];
export const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
export const FOOD_CATEGORIES: Record<string, Array<{key: string, default: string}>> = {
  'meatPoultry': [
    { key: 'beef', default: 'Res' },
    { key: 'pork', default: 'Cerdo' },
    { key: 'chicken', default: 'Pollo' },
    { key: 'turkey', default: 'Pavo' },
    { key: 'lamb', default: 'Cordero' },
    { key: 'liverOrgans', default: 'Hígado/Vísceras' }
  ],
  'seafood': [
    { key: 'whiteFish', default: 'Pescado Blanco (Merluza/Bacalao)' },
    { key: 'fattyFish', default: 'Pescado Graso (Salmón/Atún)' },
    { key: 'shrimp', default: 'Camarones' },
    { key: 'shellfish', default: 'Almejas/Mejillones' },
    { key: 'squidOctopus', default: 'Calamar/Pulpo' },
    { key: 'anchovies', default: 'Anchoas' }
  ],
  'dairyEggs': [
    { key: 'egg', default: 'Huevo' },
    { key: 'milk', default: 'Leche' },
    { key: 'yogurt', default: 'Yogur' },
    { key: 'cheeseGeneric', default: 'Queso (Genérico)' },
    { key: 'strongCheeses', default: 'Quesos Fuertes (Azul, Cabra, Feta)' }
  ],
  'vegetables': [
    { key: 'mushrooms', default: 'Champiñones' },
    { key: 'onion', default: 'Cebolla' },
    { key: 'garlic', default: 'Ajo' },
    { key: 'pepper', default: 'Pimiento' },
    { key: 'tomato', default: 'Tomate' },
    { key: 'broccoli', default: 'Brócoli' },
    { key: 'cauliflower', default: 'Coliflor' },
    { key: 'spinach', default: 'Espinaca' },
    { key: 'eggplant', default: 'Berenjena' },
    { key: 'zucchini', default: 'Calabacín' },
    { key: 'celery', default: 'Apio' },
    { key: 'olives', default: 'Aceitunas' }
  ],
  'fruits': [
    { key: 'avocado', default: 'Aguacate' },
    { key: 'banana', default: 'Plátano' },
    { key: 'berries', default: 'Frutos Rojos (Fresas)' },
    { key: 'pineapple', default: 'Piña' },
    { key: 'mango', default: 'Mango' },
    { key: 'raisins', default: 'Uvas Pasas' }
  ],
  'legumesGrains': [
    { key: 'beans', default: 'Frijoles' },
    { key: 'lentils', default: 'Lentejas' },
    { key: 'chickpeas', default: 'Garbanzos' },
    { key: 'corn', default: 'Maíz' },
    { key: 'soyTofu', default: 'Soya/Tofu' },
    { key: 'potato', default: 'Papa' }
  ],
  'nutsSeeeds': [
    { key: 'peanut', default: 'Cacahuete/Maní' },
    { key: 'almonds', default: 'Almendras' },
    { key: 'walnuts', default: 'Nueces' },
    { key: 'sesame', default: 'Sésamo' }
  ],
  'herbsSpices': [
    { key: 'cilantro', default: 'Cilantro' },
    { key: 'parsley', default: 'Perejil' },
    { key: 'basil', default: 'Albahaca' },
    { key: 'mint', default: 'Menta' },
    { key: 'ginger', default: 'Jengibre' },
    { key: 'cumin', default: 'Comino' },
    { key: 'spicy', default: 'Picante (Chile/Ají)' },
    { key: 'mayonnaise', default: 'Mayonesa' },
    { key: 'mustard', default: 'Mostaza' }
  ],
};