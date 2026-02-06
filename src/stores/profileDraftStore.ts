import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FormData } from '../types';

// Initial state basado exactamente en tu FormData
const initialFormData: FormData = {
  // AuthData
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  
  // UserProfile (sin uid, createdAt, updatedAt)
  gender: '',
  age: '',
  weight: '',
  height: '',
  country: '',
  city: '',
  diseases: [],
  allergies: [],
  otherAllergies: '',
  eatingHabit: '',
  activityLevel: '',
  otherActivityLevel: '',
  activityFrequency: '',
  nutritionalGoal: [],
  cookingAffinity: '',
  dislikedFoods: [],
};

interface ProfileDraftState extends FormData {
  isHydrated: boolean;
  isDirty: boolean;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  updateProfile: (data: Partial<FormData>) => void;
  clearDraft: () => void;
  markDirty: (dirty: boolean) => void;
}

export const useProfileDraftStore = create<ProfileDraftState>()(
  persist(
    (set) => ({
      ...initialFormData,
      isHydrated: false,
      isDirty: false,
      
      updateField: (field, value) => set((state) => ({ 
        ...state, 
        [field]: value,
        isDirty: true 
      })),
      
      updateProfile: (data) => set((state) => ({ 
        ...state, 
        ...data,
        isDirty: true 
      })),
      
      clearDraft: () => set({ ...initialFormData, isHydrated: true, isDirty: false }),
      markDirty: (dirty) => set({ isDirty: dirty }),
    }),
    {
      name: 'bocado-form-draft',
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);