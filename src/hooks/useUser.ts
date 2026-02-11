// hooks/useUser.ts - V2: Fuente única de verdad para datos de usuario
//
// PRINCIPIO: Todos los datos del perfil vienen de aquí.
// NO usar stores para datos de servidor.
// TanStack Query es el único caché de datos de Firestore.

import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserProfile } from '../types';
import { useEffect } from 'react';

// Helper para convertir undefined a null antes de guardar en Firestore
const cleanForFirestore = <T extends Record<string, any>>(obj: T): T => {
  const cleanValue = (value: any): any => {
    if (value === undefined) return null;
    if (value === null) return null;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const cleanedObj: any = {};
      Object.keys(value).forEach(k => {
        cleanedObj[k] = cleanValue(value[k]);
      });
      return cleanedObj;
    }
    return value;
  };

  const cleaned = { ...obj };
  Object.keys(cleaned).forEach(key => {
    cleaned[key] = cleanValue(cleaned[key]);
  });
  return cleaned;
};

// ============================================
// KEYS DE QUERY (centralizadas para consistencia)
// ============================================

export const USER_PROFILE_KEY = 'userProfile';
export const USER_PREFERENCES_KEY = 'userPreferences';

// ============================================
// FETCH: Perfil de Usuario
// ============================================

const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!userId) return null;
  
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { 
    uid: userId, 
    ...docSnap.data() 
  } as UserProfile;
};

// ============================================
// HOOK: Perfil de Usuario (Fuente única de verdad)
// ============================================

interface UseUserProfileOptions {
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Hook principal para obtener el perfil del usuario.
 * 
 * Este es el ÚNICO lugar donde los componentes deben obtener datos del perfil.
 * NO usar stores para datos del perfil.
 * 
 * Ejemplo:
 * ```tsx
 * const { data: profile, isLoading } = useUserProfile(user?.uid);
 * ```
 */
export const useUserProfile = (
  userId: string | undefined,
  options: UseUserProfileOptions = {}
): UseQueryResult<UserProfile | null, Error> => {
  const { enabled = true, staleTime = 1000 * 30 } = options; // Reducido a 30s para detectar cambios rápido
  
  return useQuery({
    queryKey: [USER_PROFILE_KEY, userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId && enabled,
    staleTime, 
    gcTime: 1000 * 60 * 5, // Reducido a 5 minutos
    retry: 3, // Aumentado a 3 reintentos
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    // Si no hay perfil, no considerarlo como error, pero sí reintentar
    select: (data) => data,
  });
};

// ============================================
// MUTATION: Actualizar Perfil
// ============================================

const updateUserProfile = async (
  userId: string, 
  data: Partial<UserProfile>
): Promise<void> => {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, { 
    ...cleanForFirestore(data), 
    updatedAt: serverTimestamp() 
  }, { merge: true });
};

/**
 * Hook para actualizar el perfil del usuario.
 * 
 * Automáticamente invalida la caché y refresca los datos.
 * 
 * Ejemplo:
 * ```tsx
 * const updateProfile = useUpdateUserProfile();
 * updateProfile.mutate({ userId: 'xxx', data: { city: 'Madrid' } });
 * ```
 */
export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<UserProfile> }) => 
      updateUserProfile(userId, data),
    
    // Optimistic update
    onMutate: async ({ userId, data }) => {
      await queryClient.cancelQueries({ queryKey: [USER_PROFILE_KEY, userId] });
      
      const previousProfile = queryClient.getQueryData<UserProfile>(
        [USER_PROFILE_KEY, userId]
      );
      
      queryClient.setQueryData(
        [USER_PROFILE_KEY, userId],
        (old: UserProfile | undefined) => old ? { ...old, ...data } : undefined
      );
      
      return { previousProfile };
    },
    
    onError: (err, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          [USER_PROFILE_KEY, variables.userId],
          context.previousProfile
        );
      }
    },
    
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [USER_PROFILE_KEY, variables.userId] 
      });
    },
  });
};

// ============================================
// HOOK: Prefetch de Perfil (para navegación)
// ============================================

/**
 * Prefetch del perfil cuando se anticipa que el usuario lo necesitará.
 * 
 * Ejemplo: Al hacer login, prefetch del perfil para navegación rápida.
 */
export const usePrefetchUserProfile = () => {
  const queryClient = useQueryClient();
  
  return (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: [USER_PROFILE_KEY, userId],
      queryFn: () => fetchUserProfile(userId),
      staleTime: 1000 * 60 * 5,
    });
  };
};

// ============================================
// HOOK: Suscripción a cambios del perfil
// ============================================

/**
 * Hook que refetch automáticamente cuando cambia el userId.
 * Útil para componentes que necesitan reaccionar a cambios de usuario.
 */
export const useUserProfileSubscription = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!userId) return;
    
    // Refetch inmediato cuando cambia el userId
    queryClient.refetchQueries({ 
      queryKey: [USER_PROFILE_KEY, userId],
      exact: true 
    });
  }, [userId, queryClient]);
  
  return useUserProfile(userId);
};

// ============================================
// UTILIDADES
// ============================================

/**
 * Invalida todas las queries relacionadas con un usuario.
 * Útil al hacer logout o cuando se sabe que los datos cambiaron externamente.
 */
export const invalidateUserQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
) => {
  queryClient.invalidateQueries({ 
    queryKey: [USER_PROFILE_KEY, userId] 
  });
  queryClient.invalidateQueries({ 
    queryKey: ['savedRecipes', userId] 
  });
  queryClient.invalidateQueries({ 
    queryKey: ['savedRestaurants', userId] 
  });
  queryClient.invalidateQueries({ 
    queryKey: ['pantry', userId] 
  });
};
