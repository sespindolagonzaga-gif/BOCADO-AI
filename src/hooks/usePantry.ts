// hooks/usePantry.ts - OPTIMIZADO: Polling en lugar de onSnapshot
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, serverTimestamp, trackEvent } from '../firebaseConfig';
import { KitchenItem } from '../types';
import { useVisibilityAwarePolling } from './usePaginatedFirestoreQuery';

const PANTRY_KEY = 'pantry';

// Fetch pantry items from Firebase
const fetchPantry = async (userUid: string): Promise<KitchenItem[]> => {
  const docRef = doc(db, 'user_pantry', userUid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return (docSnap.data().items || []) as KitchenItem[];
  }
  return [];
};

// Save pantry items to Firebase
const savePantry = async (userUid: string, items: KitchenItem[]): Promise<KitchenItem[]> => {
  const docRef = doc(db, 'user_pantry', userUid);
  await setDoc(docRef, {
    items,
    lastUpdated: serverTimestamp()
  }, { merge: true });
  return items;
};

export const usePantry = (userUid: string) => {
  const queryClient = useQueryClient();
  
  // Polling inteligente: frecuente cuando visible, lento en background
  const { refetchInterval, isVisible } = useVisibilityAwarePolling({
    refetchInterval: 30000,      // 30s cuando visible
    refetchIntervalInBackground: 300000, // 5min cuando oculto
    enabled: !!userUid,
  });

  const { data: inventory = [], isLoading, refetch } = useQuery<KitchenItem[]>({
    queryKey: [PANTRY_KEY, userUid],
    queryFn: () => fetchPantry(userUid),
    enabled: !!userUid,
    staleTime: 1000 * 30,       // 30s stale time
    gcTime: 1000 * 60 * 10,     // 10min cache
    refetchInterval: refetchInterval as number | false,
    refetchOnWindowFocus: true,
  });
  
  // Refetch manual cuando se agrega un item (para sincronización inmediata)
  const refetchPantry = () => {
    if (isVisible) {
      refetch();
    }
  };

  const saveMutation = useMutation({
    mutationFn: (items: KitchenItem[]) => savePantry(userUid, items),
    onSuccess: (items) => {
      queryClient.setQueryData([PANTRY_KEY, userUid], items);
      
      // 💰 FINOPS: Invalidar cache de pantry después de actualizarla
      fetch('/api/invalidate-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userUid, type: 'pantry' })
      }).catch(err => {
        // No crítico - solo log
        console.warn('Failed to invalidate pantry cache:', err);
      });
    },
  });

  const addItem = (item: KitchenItem) => {
    const exists = inventory.some((i: KitchenItem) => 
      i.name.toLowerCase() === item.name.toLowerCase() && i.zone === item.zone
    );
    
    if (!exists) {
      saveMutation.mutate([...inventory, item]);
      trackEvent('pantry_item_added', {
        item_name: item.name,
        zone: item.zone,
        category: item.category
      });
    }
  };

  const deleteItem = (id: string) => {
    const itemToDelete = inventory.find((i: KitchenItem) => i.id === id);
    saveMutation.mutate(inventory.filter((item: KitchenItem) => item.id !== id));

    if (itemToDelete) {
      trackEvent('pantry_item_removed', {
        item_name: itemToDelete.name,
        zone: itemToDelete.zone
      });
    }
  };

  const updateItem = (id: string, updates: Partial<KitchenItem>) => {
    const newInventory = inventory.map((item: KitchenItem) => 
      item.id === id ? { ...item, ...updates } : item
    );
    saveMutation.mutate(newInventory);
  };

  return {
    inventory,
    isLoading,
    isSaving: saveMutation.isPending,
    addItem,
    deleteItem,
    updateItem,
    refetch: refetchPantry, // Exponer refetch manual
    isPollingInBackground: !isVisible,
  };
};
