import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import { db, trackEvent } from '../firebaseConfig';
import { Recipe, SavedItem, SavedItemType, FeedbackType, FeedbackData } from '../types';
import { useVisibilityAwarePolling } from './usePaginatedFirestoreQuery';

const SAVED_RECIPES_KEY = 'savedRecipes';
const SAVED_RESTAURANTS_KEY = 'savedRestaurants';

// ============================================
// CONFIGURACIÓN DE PAGINACIÓN
// ============================================

const PAGE_SIZE = 20; // Número de items por página

// ============================================
// FETCH CON PAGINACIÓN
// ============================================

interface FetchSavedItemsResult {
  items: SavedItem[];
  nextCursor?: Timestamp;
  hasMore: boolean;
}

const fetchSavedItems = async (
  userId: string, 
  type: SavedItemType,
  cursor?: Timestamp,
  pageSize: number = PAGE_SIZE
): Promise<FetchSavedItemsResult> => {
  const collectionName = type === 'recipe' ? 'saved_recipes' : 'saved_restaurants';
  
  // Construir query base con ordenamiento
  let q = query(
    collection(db, collectionName),
    where('user_id', '==', userId),
    orderBy('savedAt', 'desc'),
    limit(pageSize + 1) // +1 para detectar si hay más
  );
  
  // Agregar cursor si existe (para paginación)
  if (cursor) {
    q = query(q, startAfter(cursor));
  }
  
  const snapshot = await getDocs(q);
  
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  
  // Si hay más, quitar el último (era el +1)
  const itemsToReturn = hasMore ? docs.slice(0, pageSize) : docs;
  
  const items: SavedItem[] = itemsToReturn.map((docSnap): SavedItem => ({
    id: docSnap.id,
    type,
    recipe: docSnap.data().recipe as Recipe,
    mealType: docSnap.data().mealType || 'Guardado',
    userId: docSnap.data().user_id,
    savedAt: docSnap.data().savedAt?.toMillis?.() || Date.now(),
  }));
  
  // El cursor para la siguiente página es el último savedAt
  const nextCursor = hasMore && itemsToReturn.length > 0
    ? docs[docs.length - 1].data().savedAt
    : undefined;
  
  return {
    items,
    nextCursor,
    hasMore,
  };
};

// ============================================
// HOOK PRINCIPAL: USE SAVED ITEMS
// ============================================

interface UseSavedItemsReturn {
  data: SavedItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: () => Promise<void>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  totalLoaded: number;
  refetch: () => void;
}

export const useSavedItems = (
  userId: string | undefined, 
  type: SavedItemType
): UseSavedItemsReturn => {
  const queryClient = useQueryClient();
  const key = type === 'recipe' ? SAVED_RECIPES_KEY : SAVED_RESTAURANTS_KEY;
  
  // Estado de paginación
  const [paginationState, setPaginationState] = useState<{
    currentPage: number;
    hasMore: boolean;
    isFetchingNextPage: boolean;
    cursors: (Timestamp | undefined)[];
  }>({
    currentPage: 1,
    hasMore: true,
    isFetchingNextPage: false,
    cursors: [undefined],
  });

  // Configurar polling basado en visibilidad de pestaña
  const { refetchInterval } = useVisibilityAwarePolling({
    refetchInterval: 30000,      // 30s cuando visible
    refetchIntervalInBackground: 300000, // 5min cuando oculto
    enabled: !!userId,
  });

  // Query principal - Solo para la primera página
  const queryResult = useQuery<FetchSavedItemsResult>({
    queryKey: [key, userId, 'page', 1],
    queryFn: async () => {
      if (!userId) return { items: [], hasMore: false };
      return fetchSavedItems(userId, type, undefined);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchInterval: refetchInterval as number | false,
    refetchOnWindowFocus: true,
    placeholderData: (previousData: FetchSavedItemsResult | undefined) => previousData,
  });

  // Acumular items de todas las páginas cargadas
  const [allItems, setAllItems] = useState<SavedItem[]>([]);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  
  // Efecto para manejar la primera página
  useEffect(() => {
    if (queryResult.data && !loadedPages.has(1)) {
      setAllItems(queryResult.data.items);
      setPaginationState(prev => ({
        ...prev,
        hasMore: queryResult.data.hasMore,
        cursors: [undefined, queryResult.data.nextCursor].filter(Boolean) as (Timestamp | undefined)[],
      }));
      setLoadedPages(new Set([1]));
    }
  }, [queryResult.data, loadedPages]);

  // Función para cargar siguiente página
  const fetchNextPage = useCallback(async () => {
    if (!paginationState.hasMore || paginationState.isFetchingNextPage || !userId) return;
    
    const nextPageNum = paginationState.currentPage + 1;
    
    // Verificar si ya cargamos esta página
    if (loadedPages.has(nextPageNum)) return;
    
    setPaginationState(prev => ({ ...prev, isFetchingNextPage: true }));
    
    try {
      const cursor = paginationState.cursors[paginationState.currentPage];
      
      const result = await fetchSavedItems(userId, type, cursor);
      
      // Agregar nuevos items a la lista acumulada
      setAllItems(prev => [...prev, ...result.items]);
      
      setPaginationState(prev => ({
        currentPage: nextPageNum,
        hasMore: result.hasMore,
        isFetchingNextPage: false,
        cursors: [...prev.cursors, result.nextCursor],
      }));
      
      setLoadedPages(prev => new Set([...prev, nextPageNum]));
      
    } catch (error) {
      console.error('Error fetching next page:', error);
      setPaginationState(prev => ({ ...prev, isFetchingNextPage: false }));
    }
  }, [paginationState, userId, type, loadedPages]);

  // Resetear estado cuando cambia el usuario o tipo
  useEffect(() => {
    setAllItems([]);
    setLoadedPages(new Set());
    setPaginationState({
      currentPage: 1,
      hasMore: true,
      isFetchingNextPage: false,
      cursors: [undefined],
    });
  }, [userId, type, key]);

  return {
    data: allItems,
    isLoading: queryResult.isLoading && allItems.length === 0,
    isError: queryResult.isError,
    error: queryResult.error,
    fetchNextPage,
    hasNextPage: paginationState.hasMore,
    isFetchingNextPage: paginationState.isFetchingNextPage,
    totalLoaded: allItems.length,
    refetch: queryResult.refetch,
  };
};

// ============================================
// MUTATIONS
// ============================================

export const useToggleSavedItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      type,
      recipe,
      mealType,
      isSaved
    }: {
      userId: string;
      type: SavedItemType;
      recipe: Recipe;
      mealType: string;
      isSaved: boolean;
    }) => {
      const collectionName = type === 'recipe' ? 'saved_recipes' : 'saved_restaurants';
      const docId = `${userId}_${recipe.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      const docRef = doc(db, collectionName, docId);

      if (isSaved) {
        await deleteDoc(docRef);
        return { action: 'removed' as const, type, recipe };
      } else {
        await setDoc(docRef, {
          user_id: userId,
          recipe,
          mealType,
          savedAt: serverTimestamp(),
        });
        return { action: 'added' as const, type, recipe };
      }
    },
    
    onMutate: async ({ userId, type, recipe, isSaved }) => {
      const key = type === 'recipe' ? SAVED_RECIPES_KEY : SAVED_RESTAURANTS_KEY;
      
      // Cancelar queries pendientes
      await queryClient.cancelQueries({ queryKey: [key, userId] });
      
      const previousItems = queryClient.getQueryData<SavedItem[]>([key, userId]) || [];
      
      if (isSaved) {
        // Optimistic remove
        queryClient.setQueryData<SavedItem[]>(
          [key, userId],
          previousItems.filter((item: SavedItem) => item.recipe.title !== recipe.title)
        );
      } else {
        // Optimistic add
        const newItem: SavedItem = {
          id: `temp-${Date.now()}`,
          type,
          recipe,
          mealType: 'Guardado',
          userId,
          savedAt: Date.now(),
        };
        queryClient.setQueryData<SavedItem[]>([key, userId], [newItem, ...previousItems]);
      }
      
      return { previousItems };
    },
    
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        const key = variables.type === 'recipe' ? SAVED_RECIPES_KEY : SAVED_RESTAURANTS_KEY;
        queryClient.setQueryData([key, variables.userId], context.previousItems);
      }
    },
    
    onSettled: (data, error, variables) => {
      const key = variables.type === 'recipe' ? SAVED_RECIPES_KEY : SAVED_RESTAURANTS_KEY;
      // Invalidar para refetch con datos frescos (pero sin onSnapshot)
      queryClient.invalidateQueries({ queryKey: [key, variables.userId] });
    },
  });
};

// ============================================
// CHECK IF SAVED (helper) - Usa el mismo caché que useSavedItems
// ============================================

export const useIsItemSaved = (
  userId: string | undefined,
  type: SavedItemType,
  title: string
): boolean => {
  const key = type === 'recipe' ? SAVED_RECIPES_KEY : SAVED_RESTAURANTS_KEY;
  
  // Usar el mismo queryKey que useSavedItems para compartir el caché
  const { data: result } = useQuery<FetchSavedItemsResult>({
    queryKey: [key, userId, 'page', 1],
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!userId) return { items: [], hasMore: false };
      return fetchSavedItems(userId, type, undefined);
    },
  });
  
  return (result?.items || []).some((item: SavedItem) => item.recipe.title === title);
};

// ============================================
// HOOK SIMPLE: LISTA COMPLETA (para compatibilidad)
// ============================================

export const useAllSavedItems = (
  userId: string | undefined,
  type: SavedItemType
): UseQueryResult<SavedItem[], Error> => {
  const { refetchInterval } = useVisibilityAwarePolling({
    refetchInterval: 60000,
    enabled: !!userId,
  });
  
  const key = type === 'recipe' ? SAVED_RECIPES_KEY : SAVED_RESTAURANTS_KEY;

  return useQuery<SavedItem[]>({
    queryKey: [key, userId, 'all'],
    queryFn: async () => {
      if (!userId) return [];
      const result = await fetchSavedItems(userId, type, undefined, 1000);
      return result.items;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchInterval: refetchInterval as number | false,
  });
};

// ============================================
// FEEDBACK / CALIFICACIÓN CON OPTIMISTIC UPDATES
// ============================================

const FEEDBACK_KEY = 'feedback';
const USER_HISTORY_KEY = 'user_history';

interface FeedbackMutationVariables {
  userId: string;
  itemTitle: string;
  type: FeedbackType;
  rating: number;
  comment: string;
  originalData: Recipe;
}

interface FeedbackMutationContext {
  previousFeedback: FeedbackData[] | undefined;
  optimisticId: string;
}

/**
 * Hook para enviar feedback con actualizaciones optimistas.
 * Proporciona feedback instantáneo al usuario mientras se sincroniza con Firestore.
 */
export const useFeedbackMutation = () => {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup de timeouts pendientes
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const mutation = useMutation({
    mutationFn: async ({
      userId,
      itemTitle,
      type,
      rating,
      comment,
      originalData,
    }: FeedbackMutationVariables): Promise<FeedbackData> => {
      const feedbackData: Omit<FeedbackData, 'createdAt'> = {
        userId,
        itemId: itemTitle,
        type,
        rating,
        comment,
        metadata: {
          title: originalData?.title || itemTitle,
          timestamp: new Date().toISOString(),
        },
      };

      const docRef = await addDoc(collection(db, USER_HISTORY_KEY), {
        ...feedbackData,
        createdAt: serverTimestamp(),
      });

      // Analytics tracking (no bloqueante)
      trackEvent('submit_feedback', {
        item_title: itemTitle,
        rating,
        type,
        has_comment: comment.trim().length > 0,
        userId,
      });

      return {
        ...feedbackData,
        createdAt: new Date().toISOString(),
      };
    },

    // OPTIMISTIC UPDATE: Actualiza la UI inmediatamente antes de la respuesta del servidor
    onMutate: async (variables): Promise<FeedbackMutationContext> => {
      const { userId, itemTitle, type, rating, comment, originalData } = variables;
      
      // Cancelar cualquier refetch pendiente para evitar sobreescrituras
      await queryClient.cancelQueries({ queryKey: [FEEDBACK_KEY, userId] });
      await queryClient.cancelQueries({ queryKey: [USER_HISTORY_KEY, userId] });

      // Snapshot del estado anterior para rollback en caso de error
      const previousFeedback = queryClient.getQueryData<FeedbackData[]>([FEEDBACK_KEY, userId]);
      
      // Crear ID único para el item optimista
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Crear el feedback optimista
      const optimisticFeedback: FeedbackData = {
        userId,
        itemId: itemTitle,
        type,
        rating,
        comment,
        metadata: {
          title: originalData?.title || itemTitle,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(), // Fecha local mientras se confirma
      };

      // Actualizar el cache inmediatamente (optimistic update)
      queryClient.setQueryData<FeedbackData[]>(
        [FEEDBACK_KEY, userId],
        (old = []) => [optimisticFeedback, ...old]
      );

      return { previousFeedback, optimisticId };
    },

    // ROLLBACK: Si hay error, revertir al estado anterior
    onError: (err, variables, context) => {
      if (context?.previousFeedback) {
        queryClient.setQueryData(
          [FEEDBACK_KEY, variables.userId],
          context.previousFeedback
        );
      }

      // Analytics tracking de error (no bloqueante)
      trackEvent('feedback_error', {
        item_title: variables.itemTitle,
        error: err instanceof Error ? err.message : 'unknown_error',
        userId: variables.userId,
      });
    },

    // INVALIDACIÓN: Refetch en background para sincronizar con servidor
    onSettled: (_data, _error, variables) => {
      // Invalidar queries para sincronizar datos del servidor
      queryClient.invalidateQueries({ 
        queryKey: [FEEDBACK_KEY, variables.userId],
        refetchType: 'active',
      });
    },
  });

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  return {
    ...mutation,
    clearPendingTimeout,
  };
};

/**
 * Hook para obtener el historial de feedback del usuario
 * Útil para mostrar calificaciones previas o análisis
 */
export const useUserFeedback = (
  userId: string | undefined,
  options?: { limit?: number }
) => {
  const { refetchInterval } = useVisibilityAwarePolling({
    refetchInterval: 60000, // 1 minuto cuando visible
    refetchIntervalInBackground: 300000, // 5 minutos en background
    enabled: !!userId,
  });

  return useQuery<FeedbackData[]>({
    queryKey: [FEEDBACK_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const q = query(
        collection(db, USER_HISTORY_KEY),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(options?.limit || 100)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as unknown as FeedbackData));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
    refetchInterval: refetchInterval as number | false,
    refetchOnWindowFocus: true,
  });
};


