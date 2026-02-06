// Datos que van a Firebase Auth (sensibles)
export interface AuthData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  confirmPassword?: string;
}

// Datos que van a Firestore (perfil sanitizado, NO sensibles)
export interface UserProfile {
  uid: string;                    // Referencia al UID de Auth
  gender: string;
  age: string;
  emailVerified?: boolean;
  weight?: string;
  height?: string;
  country: string;
  city: string;
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
  createdAt?: any;
  updatedAt?: any;
}

// Para el formulario completo (unión de ambos)
export interface FormData extends AuthData, Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'> {}

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