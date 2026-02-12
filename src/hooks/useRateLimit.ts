import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { env } from '../environment/env';

interface RateLimitStatus {
  requestsInWindow: number;
  currentProcess?: { startedAt: number; interactionId: string };
  canRequest: boolean;
  nextAvailableAt?: number;
  nextAvailableIn: number;
  remainingRequests?: number;
}

const DEFAULT_STATUS: RateLimitStatus = {
  requestsInWindow: 0,
  canRequest: true,
  nextAvailableIn: 0,
  remainingRequests: 5,
};

/**
 * Hook para consultar el estado del rate limit del usuario
 * Permite mostrar al usuario cuándo puede hacer su siguiente request
 */
export const useRateLimit = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: status = DEFAULT_STATUS, isLoading } = useQuery({
    queryKey: ['rateLimit', userId],
    queryFn: async (): Promise<RateLimitStatus> => {
      if (!userId) return DEFAULT_STATUS;
      const token = await fetchAuthToken();
      if (!token) return DEFAULT_STATUS;
      const response = await fetch(`${env.api.recommendationUrl}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        // Si falla, asumir que puede hacer request (fail-open)
        return DEFAULT_STATUS;
      }
      
      return response.json();
    },
    enabled: !!userId,
    // Refrescar cada 10 segundos para mantener el contador actualizado
    refetchInterval: 1000 * 10,
    // No considerar stale para evitar flashes
    staleTime: 1000 * 5,
  });

  /**
   * Invalida la caché del rate limit
   * Útil después de iniciar una generación
   */
  const refreshStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rateLimit', userId] });
  }, [queryClient, userId]);

  /**
   * Formatea el tiempo restante para mostrar al usuario
   */
  const formatTimeLeft = useCallback((seconds: number): string => {
    if (seconds <= 0) return 'Ahora';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }, []);

  // Memoizar el tiempo formateado para evitar cálculos innecesarios
  const formattedTimeLeft = useMemo(() => 
    formatTimeLeft(status.nextAvailableIn),
    [formatTimeLeft, status.nextAvailableIn]
  );

  // Memoizar el mensaje
  const message = useMemo(() => {
    if (!status.canRequest) {
      return `Espera ${formatTimeLeft(status.nextAvailableIn)}`;
    }
    // Cuando puede hacer requests, mostrar info util
    const remaining = status.remainingRequests ?? 5;
    return remaining <= 2
      ? `⚠️ ${remaining} recomendación${remaining === 1 ? '' : 'es'} disponible${remaining === 1 ? '' : 's'}`
      : `${remaining} recomendaciones en esta sesión`;
  }, [formatTimeLeft, status.canRequest, status.nextAvailableIn, status.remainingRequests]);

  return {
    ...status,
    isLoading,
    refreshStatus,
    formattedTimeLeft,
    // Helper para deshabilitar botón
    isDisabled: !status.canRequest || isLoading,
    // Mensaje para mostrar al usuario
    message,
  };
};

const fetchAuthToken = async (): Promise<string | null> => {
  try {
    const { auth } = await import('../firebaseConfig');
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
};

export default useRateLimit;
