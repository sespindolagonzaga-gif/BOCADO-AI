// hooks/useProfileDraft.ts - Hooks de integración para el ProfileDraft store
// 
// Estos hooks fueron movidos desde stores/profileDraftStore.ts para evitar
// dependencias circulares entre stores y hooks.

import { useEffect, useMemo, useCallback } from 'react';
import { useUserProfile, useUpdateUserProfile } from './useUser';
import { useProfileDraftStore } from '../stores/profileDraftStore';

// ============================================
// HOOK DE INTEGRACIÓN: Draft + Perfil Real
// ============================================

interface UseProfileDraftWithDataOptions {
  userId: string | undefined;
  resetOnMount?: boolean;
}

/**
 * Hook que combina el borrador del formulario con los datos reales del perfil.
 * 
 * Los datos del perfil (useUserProfile) son la fuente de verdad.
 * El borrador (profileDraftStore) solo almacena cambios temporales.
 * 
 * Ejemplo:
 * ```tsx
 * const { formData, updateField, isDirty, resetForm } = useProfileDraftWithData({ userId });
 * ```
 */
export const useProfileDraftWithData = (options: UseProfileDraftWithDataOptions) => {
  const { userId, resetOnMount = true } = options;
  
  const { data: profile, isLoading: isProfileLoading } = useUserProfile(userId);
  const draft = useProfileDraftStore();
  
  // Resetear borrador al montar (opcional)
  useEffect(() => {
    if (resetOnMount && userId) {
      draft.resetForm();
    }
  }, [userId, resetOnMount, draft]);
  
  // Merge: Perfil real + cambios del borrador
  const mergedData = useMemo(() => {
    if (!profile) return draft.formData;
    
    // El borrador tiene prioridad sobre el perfil (cambios sin guardar)
    return {
      ...profile,
      ...draft.formData,
    };
  }, [profile, draft.formData]);
  
  return {
    // Datos combinados (para el formulario)
    formData: mergedData,
    
    // Estado del perfil original
    profile,
    isProfileLoading,
    
    // Estado del borrador
    currentStep: draft.currentStep,
    isDirty: draft.isDirty,
    lastSavedAt: draft.lastSavedAt,
    
    // Actions
    setCurrentStep: draft.setCurrentStep,
    updateField: draft.updateFormField,
    updateData: draft.updateFormData,
    markDirty: draft.markDirty,
    saveDraft: draft.saveDraft,
    clearDraft: draft.clearDraft,
    resetForm: draft.resetForm,
    
    // Helper: ¿Hay cambios sin guardar?
    hasUnsavedChanges: draft.isDirty && Object.keys(draft.formData).length > 0,
  };
};

// ============================================
// HOOK PARA FORMULARIOS DE EDICIÓN
// ============================================

interface UseEditableProfileOptions {
  userId: string | undefined;
  onSave?: () => void;
}

/**
 * Hook completo para editar el perfil con persistencia temporal.
 * 
 * Combina:
 * - Carga del perfil actual (TanStack Query)
 * - Borrador temporal (Zustand)
 * - Guardado en Firestore (Mutation)
 * 
 * Ejemplo:
 * ```tsx
 * const {
 *   formData,
 *   updateField,
 *   saveChanges,
 *   isSaving,
 *   hasUnsavedChanges
 * } = useEditableProfile({ userId });
 * ```
 */
export const useEditableProfile = (options: UseEditableProfileOptions) => {
  const { userId, onSave } = options;
  
  const draft = useProfileDraftWithData({ userId, resetOnMount: true });
  const updateMutation = useUpdateUserProfile();
  
  const saveChanges = useCallback(async () => {
    if (!userId || !draft.hasUnsavedChanges) return;
    
    // Filtrar solo los campos que cambiaron
    const changedFields = Object.entries(draft.formData).reduce(
      (acc, [key, value]) => {
        if (draft.profile && (draft.profile as any)[key] !== value) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>
    );
    
    if (Object.keys(changedFields).length === 0) {
      draft.clearDraft();
      return;
    }
    
    await updateMutation.mutateAsync({
      userId,
      data: changedFields,
    });
    
    draft.clearDraft();
    onSave?.();
  }, [userId, draft, updateMutation, onSave]);
  
  const discardChanges = useCallback(() => {
    draft.resetForm();
  }, [draft]);
  
  return {
    // Datos
    formData: draft.formData,
    profile: draft.profile,
    isLoading: draft.isProfileLoading,
    
    // Estado
    isSaving: updateMutation.isPending,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isError: updateMutation.isError,
    error: updateMutation.error,
    
    // Actions
    updateField: draft.updateField,
    updateData: draft.updateData,
    saveChanges,
    discardChanges,
  };
};
