import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useCallback, useRef, useState, useEffect } from 'react';
import { logger } from '../utils/logger';

// ============================================
// PAGINACIÓN INTELIGENTE PARA FIRESTORE
// ============================================

// Límite máximo de items para prevenir memory leaks
// Si un usuario tiene miles de items, limitamos a este número
const MAX_ITEMS = 500;

export interface PaginationState {
  currentPage: number;
  hasMore: boolean;
  isFetchingNextPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: any;
  hasMore: boolean;
}

interface UsePaginatedFirestoreQueryOptions<T> {
  queryKey: string[];
  fetchPage: (cursor?: any, limit?: number) => Promise<PaginatedResult<T>>;
  pageSize?: number;
  enabled?: boolean;
  // Polling configuration
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  // Cache configuration
  staleTime?: number;
  gcTime?: number;
}

/**
 * Hook para paginación de Firestore con polling en lugar de realtime
 * 
 * Características:
 * - Paginación con cursor (eficiente en Firestore)
 * - Polling configurable en lugar de onSnapshot
 * - Prefetching de siguiente página
 * - Integración con React Query para cache
 */
export function usePaginatedFirestoreQuery<T>({
  queryKey,
  fetchPage,
  pageSize = 20,
  enabled = true,
  refetchInterval = 30000, // Default: 30 segundos
  refetchOnWindowFocus = true,
  staleTime = 60000, // 1 minuto
  gcTime = 300000, // 5 minutos
}: UsePaginatedFirestoreQueryOptions<T>) {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    hasMore: true,
    isFetchingNextPage: false,
  });
  
  // Cache de cursores para navegación
  const cursorsRef = useRef<Map<number, any>>(new Map([[0, undefined]]));
  const allItemsRef = useRef<T[]>([]);

  // Query para la página actual
  const query = useQuery({
    queryKey: [...queryKey, 'page', pagination.currentPage],
    queryFn: async () => {
      const cursor = cursorsRef.current.get(pagination.currentPage - 1);
      const result = await fetchPage(cursor, pageSize);
      
      // Guardar cursor para siguiente página
      if (result.nextCursor) {
        cursorsRef.current.set(pagination.currentPage, result.nextCursor);
      }
      
      return result;
    },
    enabled,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnWindowFocus,
  });

  // Actualizar lista acumulada cuando cambia la data
  useEffect(() => {
    if (query.data) {
      // Reconstruir lista desde todas las páginas cargadas
      const currentPage = pagination.currentPage;
      const newItems = query.data.items;
      
      // Reemplazar items de la página actual
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + newItems.length;
      
      allItemsRef.current = [
        ...allItemsRef.current.slice(0, startIndex),
        ...newItems,
        ...allItemsRef.current.slice(endIndex),
      ].slice(0, MAX_ITEMS); // Prevenir memory leaks
      
      setPagination(prev => ({
        ...prev,
        hasMore: query.data.hasMore,
      }));
    }
  }, [query.data, pagination.currentPage, pageSize]);

  // Cargar siguiente página
  const fetchNextPage = useCallback(async () => {
    if (!pagination.hasMore || pagination.isFetchingNextPage) return;
    
    setPagination(prev => ({ ...prev, isFetchingNextPage: true }));
    
    try {
      const nextPage = pagination.currentPage + 1;
      const cursor = cursorsRef.current.get(pagination.currentPage);
      
      const result = await fetchPage(cursor, pageSize);
      
      // Agregar a cache de React Query
      queryClient.setQueryData(
        [...queryKey, 'page', nextPage],
        result
      );
      
      if (result.nextCursor) {
        cursorsRef.current.set(nextPage, result.nextCursor);
      }
      
      allItemsRef.current = [...allItemsRef.current, ...result.items].slice(0, MAX_ITEMS);
      
      setPagination({
        currentPage: nextPage,
        hasMore: result.hasMore,
        isFetchingNextPage: false,
      });
    } catch (error) {
      setPagination(prev => ({ ...prev, isFetchingNextPage: false }));
      throw error;
    }
  }, [pagination, fetchPage, pageSize, queryClient, queryKey]);

  // Reset a página 1
  const reset = useCallback(() => {
    cursorsRef.current.clear();
    cursorsRef.current.set(0, undefined);
    allItemsRef.current = [];
    setPagination({
      currentPage: 1,
      hasMore: true,
      isFetchingNextPage: false,
    });
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Verificar si se alcanzó el límite máximo
  const hasReachedMaxItems = allItemsRef.current.length >= MAX_ITEMS;

  return {
    ...query,
    items: allItemsRef.current,
    pagination: {
      ...pagination,
      hasMore: pagination.hasMore && !hasReachedMaxItems,
    },
    fetchNextPage,
    reset,
    totalLoaded: allItemsRef.current.length,
    hasReachedMaxItems,
    maxItems: MAX_ITEMS,
  };
}

// ============================================
// HOOK: QUERY CON AWARENESS DE VISIBILIDAD
// ============================================

interface UseVisibilityAwareQueryOptions {
  refetchInterval?: number;
  refetchIntervalInBackground?: number;
  enabled?: boolean;
}

/**
 * Hook que pausa el polling cuando la pestaña no está visible
 * Usa Page Visibility API para ahorrar recursos
 */
export function useVisibilityAwarePolling({
  refetchInterval = 30000,
  refetchIntervalInBackground = 300000, // 5 minutos en background
  enabled = true,
}: UseVisibilityAwareQueryOptions = {}) {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [effectiveInterval, setEffectiveInterval] = useState(refetchInterval);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      setEffectiveInterval(visible ? refetchInterval : refetchIntervalInBackground);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchInterval, refetchIntervalInBackground]);

  const result: { 
    isVisible: boolean; 
    refetchInterval: number | false; 
    isPollingInBackground: boolean;
  } = {
    isVisible,
    refetchInterval: enabled ? effectiveInterval : false,
    isPollingInBackground: !isVisible && enabled,
  };
  
  return result;
}

// ============================================
// HOOK: DETECTAR CAMBIOS SIN ONSNAPSHOT
// ============================================

interface UseChangeDetectionOptions {
  queryKey: string[];
  lastModifiedField?: string; // Campo para comparar (ej: 'updatedAt', 'lastUpdated')
  checkInterval?: number;
  enabled?: boolean;
}

/**
 * Detecta cambios en Firestore sin usar onSnapshot
 * Útil para notificar al usuario de nuevos datos disponibles
 */
export function useChangeDetection<T extends { [key: string]: any }>({
  queryKey,
  lastModifiedField = 'updatedAt',
  checkInterval = 60000, // 1 minuto
  enabled = true,
}: UseChangeDetectionOptions) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const lastKnownTimestampRef = useRef<number>(Date.now());

  const checkForChanges = useCallback(async () => {
    if (!enabled) return;

    try {
      // Obtener el dato actual de la caché
      const currentData = queryClient.getQueryData<T>(queryKey);
      if (!currentData) return;

      // Extraer timestamp más reciente
      let currentTimestamp = 0;
      
      if (Array.isArray(currentData)) {
        currentTimestamp = currentData.reduce((max, item) => {
          const itemTime = item[lastModifiedField]?.toMillis?.() || 
                          item[lastModifiedField]?.getTime?.() || 
                          item[lastModifiedField] || 0;
          return Math.max(max, itemTime);
        }, 0);
      } else {
        currentTimestamp = currentData[lastModifiedField]?.toMillis?.() || 
                          currentData[lastModifiedField]?.getTime?.() || 
                          currentData[lastModifiedField] || 0;
      }

      // Comparar con último conocido
      if (currentTimestamp > lastKnownTimestampRef.current) {
        setHasChanges(true);
      }

      lastKnownTimestampRef.current = Math.max(
        lastKnownTimestampRef.current,
        currentTimestamp
      );
    } catch (error) {
      logger.error('Error checking for changes:', error);
    }
  }, [queryClient, queryKey, lastModifiedField, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(checkForChanges, checkInterval);
    return () => clearInterval(interval);
  }, [checkForChanges, checkInterval, enabled]);

  // Función para aceptar cambios y resetear notificación
  const acknowledgeChanges = useCallback(() => {
    setHasChanges(false);
  }, []);

  // Refetch manual y resetear
  const refetchAndAcknowledge = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    setHasChanges(false);
  }, [queryClient, queryKey]);

  return {
    hasChanges,
    acknowledgeChanges,
    refetchAndAcknowledge,
    lastChecked: lastKnownTimestampRef.current,
  };
}
