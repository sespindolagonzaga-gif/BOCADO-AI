import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, serverTimestamp } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { KitchenItem, Zone, Freshness } from '../types';
import { RestaurantIcon } from './icons/RestaurantIcon';

interface PantryScreenProps {
  userUid: string;
}

const ZONES: Record<Zone, { emoji: string; label: string; color: string }> = {
  'Despensa': { 
    emoji: '🧺', 
    label: 'Despensa', 
    color: 'bg-[#F5F2EB] border-[#E6E0D4]' 
  },
  'Nevera': { 
    emoji: '❄️', 
    label: 'Nevera', 
    color: 'bg-[#EFF5F3] border-[#D8E6E2]' 
  },
  'Congelador': { 
    emoji: '🧊', 
    label: 'Congelador', 
    color: 'bg-[#F0F4F6] border-[#DAE3E8]' 
  },
};

// ... (mantener ZONE_CATEGORIES, COMMON_INGREDIENTS_DB, EMOJI_MAP igual que antes)
const ZONE_CATEGORIES: Record<Zone, string[]> = {
  'Despensa': [
    'Todos', 'Especias 🌶️', 'Latas 🥫', 'Granos 🍚', 'Bebidas 🥤', 'Snacks 🍪', 
    'Verduras 🥦', 'Frutas 🍎', 'Proteínas 🥩', 'Lácteos 🧀'
  ],
  'Nevera': [
    'Todos', 'Proteínas 🥩', 'Lácteos 🧀', 'Verduras 🥦', 'Frutas 🍎', 
    'Bebidas 🥤', 'Snacks 🍪', 'Latas 🥫', 'Granos 🍚', 'Especias 🌶️'
  ],
  'Congelador': [
    'Todos', 'Proteínas 🥩', 'Verduras 🥦', 'Frutas 🍎', 'Snacks 🍪', 
    'Granos 🍚', 'Lácteos 🧀', 'Latas 🥫', 'Bebidas 🥤', 'Especias 🌶️'
  ]
};

const COMMON_INGREDIENTS_DB: Record<Zone, Record<string, { name: string; emoji: string }[]>> = {
  'Despensa': {
    'Verduras 🥦': [{ name: 'Papa', emoji: '🥔' }, { name: 'Cebolla', emoji: '🧅' }, { name: 'Ajo', emoji: '🧄' }, { name: 'Camote', emoji: '🍠' }],
    'Frutas 🍎': [{ name: 'Plátano', emoji: '🍌' }, { name: 'Manzana', emoji: '🍎' }, { name: 'Naranja', emoji: '🍊' }],
    'Granos 🍚': [{ name: 'Arroz', emoji: '🍚' }, { name: 'Pasta', emoji: '🍝' }, { name: 'Pan', emoji: '🍞' }, { name: 'Avena', emoji: '🥣' }, { name: 'Harina', emoji: '🥡' }, { name: 'Lentejas', emoji: '🥘' }, { name: 'Frijoles', emoji: '🫘' }],
    'Latas 🥫': [{ name: 'Atún', emoji: '🐟' }, { name: 'Tomate Frito', emoji: '🥫' }, { name: 'Maíz', emoji: '🌽' }, { name: 'Sardinas', emoji: '🐟' }],
    'Especias 🌶️': [{ name: 'Sal', emoji: '🧂' }, { name: 'Pimienta', emoji: '⚫' }, { name: 'Aceite', emoji: '🫒' }, { name: 'Vinagre', emoji: '🍾' }, { name: 'Azúcar', emoji: '🍬' }, { name: 'Café', emoji: '☕' }, { name: 'Orégano', emoji: '🌿' }, { name: 'Comino', emoji: '🍂' }],
    'Snacks 🍪': [{ name: 'Galletas', emoji: '🍪' }, { name: 'Nueces', emoji: '🥜' }, { name: 'Chocolate', emoji: '🍫' }, { name: 'Papas Fritas', emoji: '🍟' }],
    'Bebidas 🥤': [{ name: 'Agua', emoji: '💧' }, { name: 'Té', emoji: '🍵' }, { name: 'Vino', emoji: '🍷' }],
    'Proteínas 🥩': [], 'Lácteos 🧀': []
  },
  'Nevera': {
    'Verduras 🥦': [{ name: 'Lechuga', emoji: '🥬' }, { name: 'Tomate', emoji: '🍅' }, { name: 'Zanahoria', emoji: '🥕' }, { name: 'Pepino', emoji: '🥒' }, { name: 'Espinaca', emoji: '🍃' }, { name: 'Pimiento', emoji: '🫑' }, { name: 'Brocoli', emoji: '🥦' }, { name: 'Calabacín', emoji: '🥒' }],
    'Frutas 🍎': [{ name: 'Uvas', emoji: '🍇' }, { name: 'Fresas', emoji: '🍓' }, { name: 'Limón', emoji: '🍋' }, { name: 'Aguacate', emoji: '🥑' }, { name: 'Sandía', emoji: '🍉' }],
    'Proteínas 🥩': [{ name: 'Huevos', emoji: '🥚' }, { name: 'Pollo', emoji: '🍗' }, { name: 'Carne Molida', emoji: '🥩' }, { name: 'Jamón', emoji: '🥓' }, { name: 'Salchichas', emoji: '🌭' }],
    'Lácteos 🧀': [{ name: 'Leche', emoji: '🥛' }, { name: 'Queso', emoji: '🧀' }, { name: 'Yogur', emoji: '🍦' }, { name: 'Mantequilla', emoji: '🧈' }, { name: 'Crema', emoji: '🥣' }],
    'Bebidas 🥤': [{ name: 'Jugo', emoji: '🧃' }, { name: 'Refresco', emoji: '🥤' }, { name: 'Cerveza', emoji: '🍺' }],
    'Snacks 🍪': [{ name: 'Hummus', emoji: '🥣' }, { name: 'Aceitunas', emoji: '🫒' }],
    'Granos 🍚': [], 'Latas 🥫': [], 'Especias 🌶️': []
  },
  'Congelador': {
    'Proteínas 🥩': [{ name: 'Pollo Cong.', emoji: '🍗' }, { name: 'Pescado', emoji: '🐟' }, { name: 'Carne', emoji: '🥩' }, { name: 'Mariscos', emoji: '🦐' }],
    'Verduras 🥦': [{ name: 'Verduras Cong.', emoji: '🥦' }, { name: 'Papas Cong.', emoji: '🍟' }, { name: 'Chícharos', emoji: '🟢' }],
    'Frutas 🍎': [{ name: 'Frutos Rojos', emoji: '🍒' }, { name: 'Mango Cong.', emoji: '🥭' }],
    'Snacks 🍪': [{ name: 'Helado', emoji: '🍨' }, { name: 'Hielos', emoji: '🧊' }],
    'Granos 🍚': [{ name: 'Pan Cong.', emoji: '🍞' }],
    'Lácteos 🧀': [], 'Latas 🥫': [], 'Bebidas 🥤': [], 'Especias 🌶️': []
  }
};

const EMOJI_MAP: Record<string, string> = {
  'tomate': '🍅', 'cebolla': '🧅', 'zanahoria': '🥕', 'lechuga': '🥬', 'papa': '🥔',
  'ajo': '🧄', 'manzana': '🍎', 'plátano': '🍌', 'naranja': '🍊', 'huevo': '🥚',
  'pollo': '🍗', 'carne': '🥩', 'pescado': '🐟', 'leche': '🥛', 'queso': '🧀',
  'arroz': '🍚', 'pasta': '🍝', 'pan': '🍞', 'agua': '💧', 'cafe': '☕',
  'sal': '🧂', 'aceite': '🫒', 'atun': '🐟', 'yogur': '🍦', 'limon': '🍋',
  'aguacate': '🥑', 'vino': '🍷', 'cerveza': '🍺', 'refresco': '🥤', 'jugo': '🧃',
  'mantequilla': '🧈', 'crema': '🥣', 'jamon': '🥓', 'salchicha': '🌭',
  'uvas': '🍇', 'fresas': '🍓', 'sandia': '🍉', 'mango': '🥭', 'cerezas': '🍒',
  'pepino': '🥒', 'pimiento': '🫑', 'espinaca': '🍃', 'brocoli': '🥦',
  'maiz': '🌽', 'lentejas': '🥘', 'frijoles': '🫘', 'harina': '🥡',
  'azucar': '🍬', 'pimienta': '⚫', 'oregano': '🌿', 'comino': '🍂',
  'galletas': '🍪', 'nueces': '🥜', 'chocolate': '🍫', 'helado': '🍨', 'hielo': '🧊'
};

const getEmoji = (name: string): string => {
  const lower = name.toLowerCase();
  const found = Object.keys(EMOJI_MAP).find(k => lower.includes(k));
  return found ? EMOJI_MAP[found] : '📦';
};

// Hook personalizado con TanStack Query
const usePantry = (userUid: string) => {
  const queryClient = useQueryClient();
  
  // Query: Obtener datos
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['pantry', userUid],
    queryFn: async () => {
      const docRef = doc(db, 'user_pantry', userUid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return (data.items || []) as KitchenItem[];
      }
      return [];
    },
    enabled: !!userUid,
    staleTime: 1000 * 60 * 5,
  });

  // Mutation: Guardar cambios
  const saveMutation = useMutation({
    mutationFn: async (newInventory: KitchenItem[]) => {
      const docRef = doc(db, 'user_pantry', userUid);
      await setDoc(docRef, {
        items: newInventory,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      return newInventory;
    },
    onSuccess: (newInventory) => {
      // Actualizar caché inmediatamente
      queryClient.setQueryData(['pantry', userUid], newInventory);
    },
  });

  const addItem = (item: KitchenItem) => {
    const exists = inventory.some(i => 
      i.name.toLowerCase() === item.name.toLowerCase() && 
      i.zone === item.zone
    );
    
    if (!exists) {
      const newInventory = [...inventory, item];
      saveMutation.mutate(newInventory);
    }
  };

  const updateItem = (id: string, updates: Partial<KitchenItem>) => {
    const newInventory = inventory.map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    saveMutation.mutate(newInventory);
  };

  const deleteItem = (id: string) => {
    const newInventory = inventory.filter(item => item.id !== id);
    saveMutation.mutate(newInventory);
  };

  const toggleFreshness = (id: string) => {
    const nextStatus: Record<Freshness, Freshness> = {
      'fresh': 'soon',
      'soon': 'expired',
      'expired': 'fresh'
    };
    
    const newInventory = inventory.map(item => {
      if (item.id === id) {
        return { ...item, freshness: nextStatus[item.freshness] };
      }
      return item;
    });
    saveMutation.mutate(newInventory);
  };

  return {
    inventory,
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    toggleFreshness,
    isSaving: saveMutation.isPending
  };
};

const PantryScreen: React.FC<PantryScreenProps> = ({ userUid }) => {
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [newItemName, setNewItemName] = useState('');
  
  // ✅ TANSTACK QUERY: Hook personalizado
  const { inventory, isLoading, addItem, deleteItem, toggleFreshness, isSaving } = usePantry(userUid);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeZone) return;

    const cleanName = newItemName.trim();
    const detectedEmoji = getEmoji(cleanName);

    const newItem: KitchenItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: cleanName,
      emoji: detectedEmoji,
      zone: activeZone,
      category: activeCategory === 'Todos' ? 'Varios' : activeCategory.split(' ')[0],
      freshness: 'fresh',
      addedAt: Date.now()
    };

    addItem(newItem);
    setNewItemName('');
  };

  // ... resto de helpers (getFreshnessColor, getFreshnessRing, etc.) igual que antes
  const getFreshnessColor = (status: Freshness) => {
    switch(status) {
      case 'fresh': return 'border-green-400/50 bg-green-50/30';
      case 'soon': return 'border-yellow-400/50 bg-yellow-50/30';
      case 'expired': return 'border-red-500/50 bg-red-50/30';
    }
  };

  const getFreshnessRing = (status: Freshness) => {
    switch(status) {
      case 'fresh': return 'bg-green-400';
      case 'soon': return 'bg-yellow-400';
      case 'expired': return 'bg-red-500';
    }
  };

  const urgentItems = useMemo(() => {
    return inventory.filter(i => i.freshness === 'expired' || i.freshness === 'soon');
  }, [inventory]);

  const zoneItems = useMemo(() => {
    if (!activeZone) return [];
    let filtered = inventory.filter(i => i.zone === activeZone);
    if (activeCategory !== 'Todos') {
      filtered = filtered.filter(i => i.category.includes(activeCategory.split(' ')[0]) || i.category === 'Varios'); 
    }
    return filtered;
  }, [inventory, activeZone, activeCategory]);

  const getBadgeCount = (zone: Zone) => {
    return inventory.filter(i => i.zone === zone && (i.freshness === 'expired' || i.freshness === 'soon')).length;
  };

  const suggestedItems = useMemo(() => {
    if (!activeZone) return [];
    
    let candidates: { name: string; emoji: string }[] = [];
    
    if (activeCategory === 'Todos') {
      const priorityCategories = ZONE_CATEGORIES[activeZone].filter(c => c !== 'Todos');
      priorityCategories.forEach(cat => {
        const items = COMMON_INGREDIENTS_DB[activeZone]?.[cat];
        if (Array.isArray(items)) {
          candidates.push(...items.slice(0, 2));
        }
      });
    } else {
      candidates = COMMON_INGREDIENTS_DB[activeZone]?.[activeCategory] || [];
    }

    return candidates.filter(c => 
      !inventory.some(i => i.name.toLowerCase() === c.name.toLowerCase() && i.zone === activeZone)
    );
  }, [activeZone, activeCategory, inventory]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-bocado-gray text-sm">Cargando tu cocina...</p>
        </div>
      </div>
    );
  }

  if (!activeZone) {
    return (
      <div className="flex-1 px-4 pt-4 pb-24 overflow-y-auto">
        <div className="flex items-center justify-center gap-2 mb-1">
          <RestaurantIcon className="w-7 h-7 text-bocado-dark-green" />
          <h1 className="text-xl font-bold text-bocado-dark-green">Mi Cocina</h1>
        </div>
        <p className="text-center text-bocado-gray text-xs mb-6">Control de ingredientes</p>

        <div className="space-y-3">
          {(Object.keys(ZONES) as Zone[]).map(zone => (
            <button
              key={zone}
              onClick={() => { setActiveZone(zone); setActiveCategory('Todos'); }}
              className={`w-full relative p-5 rounded-2xl border transition-all duration-200 active:scale-[0.98] shadow-sm ${ZONES[zone].color}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{ZONES[zone].emoji}</span>
                  <span className="text-lg font-bold text-bocado-text">{ZONES[zone].label}</span>
                </div>
                <div className="text-xl text-bocado-gray">›</div>
              </div>
              
              {getBadgeCount(zone) > 0 && (
                <div className="absolute top-3 right-3 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md animate-pulse">
                  {getBadgeCount(zone)}
                </div>
              )}
            </button>
          ))}
        </div>

        {urgentItems.length > 0 && (
          <div className="mt-6 bg-white border border-red-100 rounded-2xl p-3 shadow-bocado">
            <div className="flex items-center gap-2 mb-2 border-b border-red-50 pb-2">
              <span className="text-base">🚨</span>
              <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Por caducar</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {urgentItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex flex-col items-center min-w-[50px]">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full border ${getFreshnessColor(item.freshness)}`}>
                    <span className="text-base">{item.emoji}</span>
                  </div>
                  <span className="text-[9px] text-bocado-dark-gray truncate w-full text-center mt-1">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header sticky */}
      <div className="sticky top-0 bg-white z-20 border-b border-bocado-border/50 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setActiveZone(null)} 
            className="w-8 h-8 flex items-center justify-center bg-bocado-background rounded-full text-bocado-dark-gray font-bold active:scale-95 transition-transform"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-bocado-dark-green flex items-center gap-2">
            {ZONES[activeZone].emoji} {ZONES[activeZone].label}
          </h1>
          {isSaving && <span className="text-xs text-bocado-gray animate-pulse">Guardando...</span>}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ZONE_CATEGORIES[activeZone].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                activeCategory === cat 
                  ? 'bg-bocado-green text-white shadow-sm' 
                  : 'bg-bocado-background text-bocado-dark-gray'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {suggestedItems.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-bocado-gray mb-2 uppercase tracking-wider">Sugerencias</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {suggestedItems.map(item => (
                <button
                  key={item.name}
                  onClick={() => {
                    const newItem: KitchenItem = {
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                      name: item.name,
                      emoji: item.emoji,
                      zone: activeZone,
                      category: activeCategory === 'Todos' ? 'Varios' : activeCategory.split(' ')[0],
                      freshness: 'fresh',
                      addedAt: Date.now()
                    };
                    addItem(newItem);
                  }}
                  className="flex items-center gap-1.5 bg-white border border-bocado-border hover:border-bocado-green hover:bg-bocado-green/5 rounded-full px-3 py-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-xs font-medium text-bocado-text">{item.name}</span>
                  <span className="text-bocado-green font-bold text-xs">+</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleAddItem} className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={activeCategory === 'Todos' ? `Agregar ingrediente...` : `Agregar en ${activeCategory}...`}
              className="w-full pl-4 pr-10 py-3 rounded-xl border border-bocado-border bg-bocado-background text-sm text-bocado-text placeholder-bocado-gray/50 focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20 transition-all"
            />
            <button 
              type="submit"
              disabled={!newItemName.trim()}
              className="absolute right-1.5 top-1.5 bg-bocado-green text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold disabled:opacity-50 active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </form>

        {zoneItems.length === 0 ? (
          <div className="text-center py-12 text-bocado-gray flex flex-col items-center">
            <span className="text-3xl mb-2 opacity-30">🕸️</span>
            <p className="text-sm">Está vacío</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {zoneItems.map(item => (
              <div 
                key={item.id}
                onClick={() => toggleFreshness(item.id)}
                className={`relative rounded-xl p-2 aspect-square flex flex-col items-center justify-center gap-1 shadow-sm border-2 transition-all active:scale-95 cursor-pointer ${getFreshnessColor(item.freshness)}`}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full border border-bocado-border text-bocado-gray hover:text-red-400 flex items-center justify-center shadow-sm z-10 active:scale-90"
                >
                  <span className="text-xs">×</span>
                </button>
                
                <span className="text-2xl select-none leading-none mt-1">
                  {item.emoji}
                </span>
                
                <span className="font-medium text-bocado-text text-[10px] text-center leading-tight line-clamp-2 w-full px-1">
                  {item.name}
                </span>
                
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${getFreshnessRing(item.freshness)}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Banner urgente fijo abajo */}
      {urgentItems.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 bg-white border-t-2 border-red-400 rounded-xl p-3 shadow-bocado-lg z-30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Caducidad</span>
            <span className="text-xs font-bold text-bocado-text">{urgentItems.length} ítems</span>
          </div>
          <div className="flex -space-x-2">
            {urgentItems.slice(0,4).map(i => (
              <div key={i.id} className="w-7 h-7 rounded-full bg-bocado-background border-2 border-white flex items-center justify-center text-xs shadow-sm">
                {i.emoji}
              </div>
            ))}
            {urgentItems.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-red-50 border-2 border-white flex items-center justify-center text-[9px] font-bold text-red-500">
                +{urgentItems.length - 4}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PantryScreen;
