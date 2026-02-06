import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { usePantryStore } from '../stores/pantryStore';
import { KitchenItem, Zone, Freshness } from '../types';

const PANTRY_KEY = 'pantry';

// Tipo para el contexto de rollback
interface MutationContext {
  previousItems: KitchenItem[];
}

export const usePantrySync = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const { 
    items: localItems, 
    setItems, 
    addItem: addLocalItem, 
    removeItem: removeLocalItem,
    updateItem: updateLocalItem 
  } = usePantryStore();

  // Query: Obtener datos de Firebase
  const { isLoading, error } = useQuery({
    queryKey: [PANTRY_KEY, userId],
    queryFn: () => {
      return new Promise<KitchenItem[]>((resolve) => {
        if (!userId) {
          resolve([]);
          return;
        }
        
        const unsubscribe = onSnapshot(
          collection(db, 'users', userId, 'pantry'),
          (snapshot) => {
            const items = snapshot.docs.map(doc => ({
              id: doc.id,
              name: doc.data().name || '',
              emoji: doc.data().emoji || '',
              zone: doc.data().zone as Zone,
              category: doc.data().category || '',
              freshness: doc.data().freshness as Freshness,
              addedAt: doc.data().addedAt || Date.now(),
            })) as KitchenItem[];
            
            // Solo actualiza Zustand si hay diferencias
            if (JSON.stringify(items) !== JSON.stringify(localItems)) {
              setItems(items);
            }
            resolve(items);
          },
          (error) => {
            console.error('Error fetching pantry:', error);
            resolve(localItems);
          }
        );
        
        return () => unsubscribe();
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Mutation: Agregar item
  const addItem = useMutation<KitchenItem, Error, Omit<KitchenItem, 'id'>, MutationContext>({
    mutationFn: async (newItem: Omit<KitchenItem, 'id'>) => {
      if (!userId) throw new Error('No user');
      const docRef = await addDoc(
        collection(db, 'users', userId, 'pantry'), 
        newItem
      );
      return { id: docRef.id, ...newItem } as KitchenItem;
    },
    onMutate: async (newItem: Omit<KitchenItem, 'id'>) => {
      await queryClient.cancelQueries({ queryKey: [PANTRY_KEY, userId] });
      const previousItems = localItems;
      
      const optimisticItem: KitchenItem = { 
        ...newItem, 
        id: `temp-${Date.now()}` 
      };
      addLocalItem(optimisticItem);
      
      return { previousItems };
    },
    onError: (err: Error, newItem: Omit<KitchenItem, 'id'>, context?: MutationContext) => {
      if (context) {
        setItems(context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [PANTRY_KEY, userId] });
    },
  });

  // Mutation: Eliminar item
  const removeItem = useMutation<string, Error, string, MutationContext>({
    mutationFn: async (itemId: string) => {
      if (!userId) throw new Error('No user');
      await deleteDoc(doc(db, 'users', userId, 'pantry', itemId));
      return itemId;
    },
    onMutate: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey: [PANTRY_KEY, userId] });
      const previousItems = localItems;
      removeLocalItem(itemId);
      return { previousItems };
    },
    onError: (err: Error, itemId: string, context?: MutationContext) => {
      if (context) {
        setItems(context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [PANTRY_KEY, userId] });
    },
  });

  // Mutation: Actualizar item
  const updateItem = useMutation<
    { id: string; updates: Partial<KitchenItem> }, 
    Error, 
    { id: string; updates: Partial<KitchenItem> }, 
    MutationContext
  >({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<KitchenItem> }) => {
      if (!userId) throw new Error('No user');
      await updateDoc(doc(db, 'users', userId, 'pantry', id), updates);
      return { id, updates };
    },
    onMutate: async ({ id, updates }: { id: string; updates: Partial<KitchenItem> }) => {
      await queryClient.cancelQueries({ queryKey: [PANTRY_KEY, userId] });
      const previousItems = localItems;
      updateLocalItem(id, updates);
      return { previousItems };
    },
    onError: (err: Error, vars: { id: string; updates: Partial<KitchenItem> }, context?: MutationContext) => {
      if (context) {
        setItems(context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [PANTRY_KEY, userId] });
    },
  });

  return {
    items: localItems,
    isLoading,
    error,
    addItem: addItem.mutate,
    removeItem: removeItem.mutate,
    updateItem: updateItem.mutate,
    isSyncing: addItem.isPending || removeItem.isPending || updateItem.isPending,
  };
};