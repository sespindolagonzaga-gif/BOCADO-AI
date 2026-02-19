/**
 * 🔄 Cache Invalidation Utilities
 * 
 * Maneja la invalidación de caché entre Zustand (auth) y TanStack Query (profile data)
 * cuando los datos del usuario cambien.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

/**
 *
 * Hook para invalidar datos en caché cuando el usuario actualiza su perfil
 */
export const useCacheInvalidation = () => {
  const queryClient = useQueryClient();

  return {
    /**
     * Invalida el perfil del usuario en TanStack Query
     * Se ejecuta cuando el usuario edita su perfil
     */
    invalidateUserProfile: (userId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['userProfile', userId],
      });
    },

    /**
     * Invalida la pantalla del usuario cuando actualiza su pantry
     */
    invalidatePantry: (userId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['pantry', userId],
      });
    },

    /**
     * Invalida recetas guardadas
     */
    invalidateSavedRecipes: (userId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['savedRecipes', userId],
      });
    },

    /**
     * Invalida recomendaciones guardadas
     */
    invalidateSavedRestaurants: (userId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['savedRestaurants', userId],
      });
    },

    /**
     * Invalida TODOS los datos del usuario (logout, cambio de usuario, etc)
     */
    invalidateAll: (userId?: string | null) => {
      if (userId) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            // Invalida todas las queries que contengan el userId
            const key = query.queryKey;
            return Array.isArray(key) && key.includes(userId);
          },
        });
      } else {
        // Si no hay userId, invalida TODO
        queryClient.clear();
      }
    },

    /**
     * Invalida y limpia el caché (para logout)
     */
    clearAllCaches: () => {
      queryClient.clear();
      useAuthStore.getState().logout();
    },
  };
};

/**
 * Hook que se ejecuta automáticamente cuando el usuario cambia
 * (ej: login, logout, cambio de usuario)
 */
export const useAutoInvalidateOnUserChange = () => {
  const uid = useAuthStore((state) => state.user?.uid);
  const { invalidateAll } = useCacheInvalidation();

  // Invalidar datos cuando el UID cambia
  React.useEffect(() => {
    if (uid) {
      invalidateAll(uid);
    }
  }, [uid, invalidateAll]);
};

// Para usar en servicios no-React (como en API calls)
export const createCacheInvalidator = (queryClient: any) => ({
  invalidateUserProfile: (userId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['userProfile', userId],
    });
  },
  invalidatePantry: (userId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['pantry', userId],
    });
  },
});

import React from 'react';
