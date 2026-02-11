// stores/profileDraftStore.ts - V2: Solo UI state, NO datos del perfil
//
// PRINCIPIO: Este store solo maneja estado TRANSITORIO de la UI.
// Los datos del formulario vienen de defaultValues (perfil real).
// NO es una copia del perfil, es solo estado de edición temporal.
//
// CAMBIOS V2:
// - Eliminado: Campos duplicados del perfil
// - Agregado: Solo estado de navegación/formulario
// - Los datos iniciales vienen de useUserProfile + defaultValues
//
// IMPORTANTE: No importar hooks aquí para evitar dependencias circulares.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/encryptedStorage';

// ============================================
// ESTADO DE UI PARA FORMULARIOS MULTI-PASO
// ============================================

interface ProfileDraftState {
  // Metadatos del formulario (UI state)
  currentStep: number;
  isHydrated: boolean;
  isDirty: boolean;
  lastSavedAt: number | null;
  
  // Datos temporales del formulario (solo mientras edita)
  // NOTA: Estos NO reemplazan el perfil, son solo borrador temporal
  formData: Record<string, any>;
  
  // Actions
  setCurrentStep: (step: number) => void;
  updateFormField: (field: string, value: any) => void;
  updateFormData: (data: Partial<Record<string, any>>) => void;
  markDirty: (dirty: boolean) => void;
  saveDraft: () => void;
  clearDraft: () => void;
  resetForm: () => void;
}

const INITIAL_STATE = {
  currentStep: 1,
  isHydrated: false,
  isDirty: false,
  lastSavedAt: null,
  formData: {},
};

export const useProfileDraftStore = create<ProfileDraftState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      
      setCurrentStep: (step) => set({ currentStep: step }),
      
      updateFormField: (field, value) => set((state) => ({
        formData: { ...state.formData, [field]: value },
        isDirty: true,
      })),
      
      updateFormData: (data) => set((state) => ({
        formData: { ...state.formData, ...data },
        isDirty: true,
      })),
      
      markDirty: (dirty) => set({ isDirty: dirty }),
      
      saveDraft: () => set({ 
        lastSavedAt: Date.now(),
        isDirty: true,
      }),
      
      clearDraft: () => set({
        ...INITIAL_STATE,
        isHydrated: true,
      }),
      
      resetForm: () => set({
        formData: {},
        isDirty: false,
        currentStep: 1,
        lastSavedAt: null,
      }),
    }),
    {
      name: 'bocado-form-draft-v2',
      storage: createJSONStorage(() => safeStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('[ProfileDraftStore] Error rehydrating storage:', error);
        }
        if (state) state.isHydrated = true;
      },
      // Solo persistir el borrador temporal, no datos del perfil
      partialize: (state) => ({
        currentStep: state.currentStep,
        formData: state.formData,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
);

// ============================================
// HOOKS DE INTEGRACIÓN
// ============================================
// Estos hooks se exportan desde hooks/useProfileDraft.ts para evitar
// dependencias circulares. No usar directamente desde este archivo.
//
// import { useProfileDraftWithData, useEditableProfile } from '../hooks/useProfileDraft';
