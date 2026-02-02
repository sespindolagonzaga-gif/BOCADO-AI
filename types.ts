
export interface FormData {
  firstName: string;
  lastName: string;
  gender: string;
  age: string;
  country: string;
  city: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  diseases: string[];
  allergies: string[];
  otherAllergies: string;
  eatingHabit: string;
  activityLevel: string;
  otherActivityLevel: string;
  activityFrequency: string;
  nutritionalGoal: string[];
  cookingAffinity: string;
  dislikedFoods: string[];
}

// Updated to support simple string ingredients from the new structure
export type Ingredient = string; 

export interface Nutrition {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export interface Recipe {
  title: string;
  description?: string;
  time: string;       // tiempo_estimado
  difficulty: string; // dificultad
  calories: string | number; // macros_por_porcion.kcal
  savingsMatch: string; // coincidencia_despensa
  ingredients: string[];
  instructions: string[];
  cuisine?: string; // Nuevo campo para Tipo de Comida (Restaurantes)
}

export interface Meal {
  mealType: string;
  recipe: Recipe;
}

export interface Plan {
  planTitle: string;
  greeting: string; // saludo_personalizado
  meals: Meal[];
  _id?: string;
  _createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
  interaction_id?: string;
}

export type Freshness = 'fresh' | 'soon' | 'expired';
export type Zone = 'Despensa' | 'Nevera' | 'Congelador';

export interface KitchenItem {
  id: string;
  name: string;
  emoji: string;
  zone: Zone;
  category: string;
  freshness: Freshness;
  addedAt: number;
}

export interface PantryDocument {
  items: KitchenItem[]; // Changed from ingredients string[] to object array
  lastUpdated?: any;
}