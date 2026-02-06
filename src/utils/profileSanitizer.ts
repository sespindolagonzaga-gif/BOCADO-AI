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
      weight: '',        // <-- NUEVO: opcional, string vacío por defecto
      height: '',        // <-- NUEVO: opcional, string vacío por defecto
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
      password: '',      // <-- Añadido para completar el tipo (aunque no se use en perfil)
      confirmPassword: '', // <-- Añadido para completar el tipo
    };
  }

  // Helper para sanitizar números opcionales (peso/estatura)
  const sanitizeOptionalNumber = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    return isNaN(num) ? '' : num.toString();
  };

  // Helper para calcular IMC (opcional pero útil)
  const calculateBMI = (weight?: string, height?: string): number | null => {
    if (!weight || !height) return null;
    const w = parseFloat(weight);
    const h = parseInt(height) / 100; // cm a metros
    if (w > 0 && h > 0 && h < 3) { // Validación básica (altura < 3m)
      return parseFloat((w / (h * h)).toFixed(1));
    }
    return null;
  };

  // Aplica las reglas de normalización campo por campo.
  const sanitized: FormData = {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    
    // Regla 1: Interpretación de Perfiles de Usuario
    age: (data.age || '10').toString(),
    gender: data.gender || 'Hombre',
    activityLevel: data.activityLevel || 'Sedentario',
    eatingHabit: data.eatingHabit || '',
    
    // <-- NUEVO: Peso y estatura (opcionales, sanitizados)
    weight: sanitizeOptionalNumber(data.weight),
    height: sanitizeOptionalNumber(data.height),
    
    // Regla 3: Regla de Listas y Arrays
    allergies: (Array.isArray(data.allergies) && data.allergies.length > 0) ? data.allergies : ['Ninguna'],
    diseases: (Array.isArray(data.diseases) && data.diseases.length > 0) ? data.diseases : ['Ninguna'],
    dislikedFoods: (Array.isArray(data.dislikedFoods) && data.dislikedFoods.length > 0) ? data.dislikedFoods : ['Ninguno'],
    nutritionalGoal: (Array.isArray(data.nutritionalGoal) && data.nutritionalGoal.length > 0) ? data.nutritionalGoal : ['Sin especificar'],

    // Campos restantes
    country: data.country || '',
    city: data.city || '',
    otherAllergies: data.otherAllergies || '',
    otherActivityLevel: data.otherActivityLevel || '',
    activityFrequency: data.activityFrequency || '',
    cookingAffinity: data.cookingAffinity || '',
    
    // Campos de formulario (no se usan en perfil pero necesarios para el tipo)
    password: '',
    confirmPassword: '',
  };

  // Opcional: Calcular y guardar IMC como metadata adicional (no en FormData pero útil)
  // Esto lo puedes guardar en un campo separado si quieres mostrarlo en el perfil
  const bmi = calculateBMI(sanitized.weight, sanitized.height);
  if (bmi) {
    // Si quieres usar el IMC en algún lado, puedes retornarlo aparte o guardarlo en localStorage
    console.log('IMC calculado:', bmi);
  }

  return sanitized;
};