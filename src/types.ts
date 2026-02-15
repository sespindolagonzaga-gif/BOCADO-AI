import type { Timestamp } from 'firebase/firestore';

// Datos que van a Firebase Auth (sensibles)
export interface AuthData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  confirmPassword?: string;
}

// Coordenadas de ubicación
export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
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
  // Coordenadas de ubicación del usuario (opcional, requiere permiso)
  location?: GeoLocation;
  locationEnabled?: boolean;
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
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// Para el formulario completo (unión de ambos)
export interface FormData extends AuthData, Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'> {
  // Campo temporal para almacenar el placeId de Google Places al seleccionar ciudad
  cityPlaceId?: string;
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
  cuisine?: string; // Tipo de Comida (Restaurantes)
  
  // ✅ MACROS COMPLETOS (disponibles para recetas En Casa)
  protein_g?: number;      // macros_por_porcion.proteinas_g
  carbs_g?: number;        // macros_por_porcion.carbohidratos_g
  fat_g?: number;          // macros_por_porcion.grasas_g
  
  // ✅ CAMPOS ESPECÍFICOS PARA RESTAURANTES (opcionales)
  link_maps?: string;                    // URL de Google Maps
  direccion_aproximada?: string;         // Dirección del lugar
  plato_sugerido?: string;              // Plato recomendado
  por_que_es_bueno?: string;            // Descripción por qué encaja con el perfil
  hack_saludable?: string;              // Tip para pedir saludable
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
  items: KitchenItem[];
  lastUpdated?: Timestamp | Date;
}

export type SavedItemType = 'recipe' | 'restaurant';

export interface SavedItem {
  id: string;
  type: SavedItemType;
  recipe: Recipe;
  mealType: string;
  userId: string;
  savedAt: number | Timestamp; // number en frontend (ms), Timestamp en Firestore
  folder?: string;
  notes?: string;
  rating?: number;
}

// ============================================
// FEEDBACK / CALIFICACIÓN
// ============================================

export type FeedbackType = 'home' | 'away';

export interface FeedbackData {
  userId: string;
  itemId: string;
  type: FeedbackType;
  rating: number;
  comment: string;
  metadata: {
    title: string;
    timestamp: string;
  };
  createdAt?: Timestamp | Date | string;
}

export interface FeedbackSubmission {
  itemTitle: string;
  type: FeedbackType;
  rating: number;
  comment: string;
  originalData: Recipe;
}