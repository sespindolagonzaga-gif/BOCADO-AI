export const GENDERS = ['Mujer', 'Hombre', 'Otro'];
export const AGES = Array.from({ length: 83 }, (_, i) => (i + 18).toString());
export const COUNTRIES = [
  'Alemania',
  'Argentina',
  'Australia',
  'Brasil',
  'Canadá',
  'Chile',
  'China',
  'Colombia',
  'Corea del Sur',
  'España',
  'Estados Unidos',
  'Francia',
  'India',
  'Italia',
  'Japón',
  'México',
  'Nigeria',
  'Perú',
  'Reino Unido',
  'Sudáfrica',
  'Venezuela',
  'Otro'
];

export const EATING_HABITS = ['En casa', 'Fuera'];
export const COOKING_AFFINITY = ['Sí', 'No', 'A veces'];

export const CRAVINGS = [
  '🍕 Italiana / Pizza',
  '🍣 Japonesa / Sushi',
  '🥗 Saludable o fit',
  '🍜 Asiática / China',
  '🌮 Mexicana',
  '🍔 Americana / fast food',
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

export const FOOD_CATEGORIES: Record<string, string[]> = {
  'Carnes y Aves': ['Res', 'Cerdo', 'Pollo', 'Pavo', 'Cordero', 'Hígado/Vísceras'],
  'Pescados y Mariscos': ['Pescado Blanco (Merluza/Bacalao)', 'Pescado Graso (Salmón/Atún)', 'Camarones', 'Almejas/Mejillones', 'Calamar/Pulpo', 'Anchoas'],
  'Lácteos y Huevos': ['Huevo', 'Leche', 'Yogur', 'Queso (Genérico)', 'Quesos Fuertes (Azul, Cabra, Feta)'],
  'Vegetales y Hortalizas': ['Champiñones', 'Cebolla', 'Ajo', 'Pimiento', 'Tomate', 'Brócoli', 'Coliflor', 'Espinaca', 'Berenjena', 'Calabacín', 'Apio', 'Aceitunas'],
  'Frutas': ['Aguacate', 'Plátano', 'Frutos Rojos (Fresas)', 'Piña', 'Mango', 'Uvas Pasas'],
  'Legumbres, Granos y Tubérculos': ['Frijoles', 'Lentejas', 'Garbanzos', 'Maíz', 'Soya/Tofu', 'Papa'],
  'Frutos Secos y Semillas': ['Cacahuete/Maní', 'Almendras', 'Nueces', 'Sésamo'],
  'Hierbas, Especias y Condimentos': ['Cilantro', 'Perejil', 'Albahaca', 'Menta', 'Jengibre', 'Comino', 'Picante (Chile/Ají)', 'Mayonesa', 'Mostaza'],
};
