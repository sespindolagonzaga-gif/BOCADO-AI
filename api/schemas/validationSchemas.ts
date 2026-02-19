/**
 * 🔍 Zod Schemas para Validación de API
 * 
 * Validación en runtime de todos los requests/responses
 * - Tipado automático con TypeScript
 * - Errores claros si los datos no coinciden
 * - Documentación integrada
 */

import { z } from 'zod';

// ============================================
// USER PROFILE SCHEMA
// ============================================

export const GeoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  timestamp: z.number().optional(),
});

export const UserProfileSchema = z.object({
  uid: z.string().min(1),
  gender: z.string().optional(),
  age: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  country: z.string(),
  city: z.string(),
  location: GeoLocationSchema.optional(),
  locationEnabled: z.boolean().optional(),
  diseases: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  otherAllergies: z.string().optional(),
  eatingHabit: z.string().optional(),
  activityLevel: z.string().optional(),
  activityFrequency: z.string().optional(),
  nutritionalGoal: z.array(z.string()).optional(),
  cookingAffinity: z.string().optional(),
  dislikedFoods: z.array(z.string()).optional(),
  language: z.enum(['es', 'en']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// ============================================
// RECOMMENDATION REQUEST/RESPONSE
// ============================================

export const RecommendationRequestSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  type: z.enum(['home', 'restaurant']).describe('Type must be "home" or "restaurant"'),
  dietary: z.object({
    vegetarian: z.boolean().optional(),
    vegan: z.boolean().optional(),
    glutenFree: z.boolean().optional(),
    dairyFree: z.boolean().optional(),
  }).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
});

export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

export const RecipeSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1),
  tiempo: z.string(),
  dificultad: z.enum(['Fácil', 'Media', 'Difícil']),
  coincidencia: z.string().optional(),
  ingredientes: z.array(z.string()),
  pasos_preparacion: z.array(z.string()),
  macros_por_porcion: z.object({
    kcal: z.number().positive().optional(),
    proteinas_g: z.number().nonnegative().optional(),
    carbohidratos_g: z.number().nonnegative().optional(),
    grasas_g: z.number().nonnegative().optional(),
  }).optional(),
});

export const RestaurantRecommendationSchema = z.object({
  id: z.number().optional(),
  nombre_restaurante: z.string().min(1),
  tipo_comida: z.string(),
  direccion_aproximada: z.string(),
  plato_sugerido: z.string(),
  por_que_es_bueno: z.string(),
  hack_saludable: z.string().optional(),
});

export const RecommendationResponseSchema = z.object({
  saludo_personalizado: z.string(),
  receta: z.object({
    recetas: z.array(RecipeSchema),
  }).optional(),
  recomendaciones: z.array(RestaurantRecommendationSchema).optional(),
});

export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

// ============================================
// MAPS API SCHEMA
// ============================================

export const MapsProxyRequestSchema = z.object({
  query: z.string().min(1, 'Search query required'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  radius: z.number().positive().default(5000),
  type: z.string().optional(),
});

export type MapsProxyRequest = z.infer<typeof MapsProxyRequestSchema>;

// ============================================
// GENERIC VALIDATION RESULT
// ============================================

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

/**
 * Helper para validar datos con manejo de errores
 */
export const validate = <T>(
  schema: z.ZodSchema,
  data: unknown
): ValidationResult<T> => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result as T };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((err: z.ZodIssue) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    return {
      success: false,
      errors: { general: 'Validation error' },
    };
  }
};

/**
 * Middleware para validar request body
 */
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    const result = validate(schema, req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: result.errors,
      });
    }
    req.validatedBody = result.data;
    next();
  };
};
