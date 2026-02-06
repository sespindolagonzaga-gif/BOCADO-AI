// stores/pantryStore.ts
import { create } from 'zustand';
import { KitchenItem, Freshness, Zone } from '../types';

interface PantryState {
  items: KitchenItem[];
  isLoading: boolean;
  lastUpdated: number | null;
  activeZone: Zone | null;
  
  setItems: (items: KitchenItem[]) => void;
  addItem: (item: KitchenItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<KitchenItem>) => void;
  toggleFreshness: (id: string) => void;
  setActiveZone: (zone: Zone | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Selectores computados
  getItemsByZone: (zone: Zone) => KitchenItem[];
  getUrgentItems: () => KitchenItem[];
}

const freshnessCycle: Record<Freshness, Freshness> = {
  'fresh': 'soon',
  'soon': 'expired',
  'expired': 'fresh'
};

export const usePantryStore = create<PantryState>((set, get) => ({
  items: [],
  isLoading: false,
  lastUpdated: null,
  activeZone: null,
  
  setItems: (items) => set({ items, lastUpdated: Date.now() }),
  
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item],
    lastUpdated: Date.now() 
  })),
  
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter((item) => item.id !== id),
    lastUpdated: Date.now() 
  })),
  
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) => 
      item.id === id ? { ...item, ...updates } : item
    ),
    lastUpdated: Date.now(),
  })),
  
  toggleFreshness: (id) => set((state) => ({
    items: state.items.map((item) => {
      if (item.id !== id) return item;
      return { 
        ...item, 
        freshness: freshnessCycle[item.freshness] 
      };
    }),
    lastUpdated: Date.now(),
  })),
  
  setActiveZone: (zone) => set({ activeZone: zone }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  getItemsByZone: (zone) => get().items.filter(item => item.zone === zone),
  getUrgentItems: () => get().items.filter(item => 
    item.freshness === 'expired' || item.freshness === 'soon'
  ),
}));