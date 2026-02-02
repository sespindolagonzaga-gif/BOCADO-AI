
import { FormData } from '../types';

/**
 * Normaliza un objeto de perfil de usuario crudo de Firestore o localStorage
 * para que coincida con las reglas de negocio de Bocado AI.
 * Aplica valores predeterminados a campos nulos, vacíos o faltantes.
 */
export const sanitizeProfileData = (data: any): FormData => {
  if (!data) {
    // Devuelve un objeto FormData completamente predeterminado si no hay datos de entrada.
    return {
      firstName: '',
      lastName: '',
      email: '',
      age: '10',
      gender: 'Hombre',
      country: '',
      city: '',
      activityLevel: 'Sedentario',
      eatingHabit: '',
      allergies: ['Ninguna'],
      diseases: ['Ninguna'],
      dislikedFoods: ['Ninguno'],
      nutritionalGoal: ['Sin especificar'],
      otherAllergies: '',
      otherActivityLevel: '',
      activityFrequency: '',
      cookingAffinity: '',
    };
  }

  // Aplica las reglas de normalización campo por campo.
  return {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    
    // Regla 1: Interpretación de Perfiles de Usuario
    age: (data.age || '10').toString(), // Si es nulo o vacío, asume 10.
    gender: data.gender || 'Hombre', // Valor por defecto: "Hombre".
    activityLevel: data.activityLevel || 'Sedentario', // Valor por defecto: "Sedentario".
    eatingHabit: data.eatingHabit || '', // Si es nulo/vacío, se interpreta como no existente.
    
    // Regla 3: Regla de Listas y Arrays
    allergies: (Array.isArray(data.allergies) && data.allergies.length > 0) ? data.allergies : ['Ninguna'],
    diseases: (Array.isArray(data.diseases) && data.diseases.length > 0) ? data.diseases : ['Ninguna'],
    dislikedFoods: (Array.isArray(data.dislikedFoods) && data.dislikedFoods.length > 0) ? data.dislikedFoods : ['Ninguno'],
    nutritionalGoal: (Array.isArray(data.nutritionalGoal) && data.nutritionalGoal.length > 0) ? data.nutritionalGoal : ['Sin especificar'],

    // Campos restantes que no tienen reglas de normalización específicas
    country: data.country || '',
    city: data.city || '',
    otherAllergies: data.otherAllergies || '',
    otherActivityLevel: data.otherActivityLevel || '',
    activityFrequency: data.activityFrequency || '',
    cookingAffinity: data.cookingAffinity || '',
  };
};
