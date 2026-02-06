import { UserProfile, FormData, AuthData } from '../types';

export const sanitizeProfileData = (data: any): UserProfile => {
  if (!data) {
    return {
      uid: '',
      gender: 'Hombre',
      age: '10',
      weight: '',
      height: '',
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

  const sanitizeOptionalNumber = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    return isNaN(num) ? '' : num.toString();
  };

  return {
    uid: data.uid || '',
    gender: data.gender || 'Hombre',
    age: (data.age || '10').toString(),
    weight: sanitizeOptionalNumber(data.weight),
    height: sanitizeOptionalNumber(data.height),
    country: data.country || '',
    city: data.city || '',
    activityLevel: data.activityLevel || 'Sedentario',
    eatingHabit: data.eatingHabit || '',
    allergies: (Array.isArray(data.allergies) && data.allergies.length > 0) ? data.allergies : ['Ninguna'],
    diseases: (Array.isArray(data.diseases) && data.diseases.length > 0) ? data.diseases : ['Ninguna'],
    dislikedFoods: (Array.isArray(data.dislikedFoods) && data.dislikedFoods.length > 0) ? data.dislikedFoods : ['Ninguno'],
    nutritionalGoal: (Array.isArray(data.nutritionalGoal) && data.nutritionalGoal.length > 0) ? data.nutritionalGoal : ['Sin especificar'],
    otherAllergies: data.otherAllergies || '',
    otherActivityLevel: data.otherActivityLevel || '',
    activityFrequency: data.activityFrequency || '',
    cookingAffinity: data.cookingAffinity || '',
  };
};

// Helper para separar datos de auth vs perfil
export const separateUserData = (formData: FormData): { auth: AuthData; profile: Omit<UserProfile, 'uid'> } => {
  const { firstName, lastName, email, password, confirmPassword, ...profileData } = formData;
  
  return {
    auth: {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    },
    profile: profileData as Omit<UserProfile, 'uid'>,
  };
};