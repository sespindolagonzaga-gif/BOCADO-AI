
import React, { useState, useEffect, useMemo } from 'react';
import { db, serverTimestamp } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { KitchenItem, Zone, Freshness } from '../types';
import { RestaurantIcon } from './icons/RestaurantIcon';

interface PantryScreenProps {
  userUid: string;
}

// --- CONSTANTS & HELPERS ---
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

const ZONE_CATEGORIES: Record<Zone, string[]> = {
  'Despensa': [
    'Todos', 
    'Especias 🌶️', 'Latas 🥫', 'Granos 🍚', 'Bebidas 🥤', 'Snacks 🍪', 
    'Verduras 🥦', 'Frutas 🍎', 'Proteínas 🥩', 'Lácteos 🧀'
  ],
  'Nevera': [
    'Todos', 
    'Proteínas 🥩', 'Lácteos 🧀', 'Verduras 🥦', 'Frutas 🍎', 'Bebidas 🥤', 
    'Snacks 🍪', 'Latas 🥫', 'Granos 🍚', 'Especias 🌶️'
  ],
  'Congelador': [
    'Todos', 
    'Proteínas 🥩', 'Verduras 🥦', 'Frutas 🍎', 'Snacks 🍪', 'Granos 🍚', 
    'Lácteos 🧀', 'Latas 🥫', 'Bebidas 🥤', 'Especias 🌶️'
  ]
};

const COMMON_INGREDIENTS_DB: Record<Zone, Record<string, { name: string; emoji: string }[]>> = {
  'Despensa': {
    'Verduras 🥦': [
      { name: 'Papa', emoji: '🥔' }, { name: 'Cebolla', emoji: '🧅' }, { name: 'Ajo', emoji: '🧄' }, { name: 'Camote', emoji: '🍠' }
    ],
    'Frutas 🍎': [
      { name: 'Plátano', emoji: '🍌' }, { name: 'Manzana', emoji: '🍎' }, { name: 'Naranja', emoji: '🍊' }
    ],
    'Granos 🍚': [
      { name: 'Arroz', emoji: '🍚' }, { name: 'Pasta', emoji: '🍝' }, { name: 'Pan', emoji: '🍞' }, 
      { name: 'Avena', emoji: '🥣' }, { name: 'Harina', emoji: '🥡' }, { name: 'Lentejas', emoji: '🥘' }, { name: 'Frijoles', emoji: '🫘' }
    ],
    'Latas 🥫': [
      { name: 'Atún', emoji: '🐟' }, { name: 'Tomate Frito', emoji: '🥫' }, { name: 'Maíz', emoji: '🌽' }, { name: 'Sardinas', emoji: '🐟' }
    ],
    'Especias 🌶️': [
      { name: 'Sal', emoji: '🧂' }, { name: 'Pimienta', emoji: '⚫' }, { name: 'Aceite', emoji: '🫒' }, 
      { name: 'Vinagre', emoji: '🍾' }, { name: 'Azúcar', emoji: '🍬' }, { name: 'Café', emoji: '☕' },
      { name: 'Orégano', emoji: '🌿' }, { name: 'Comino', emoji: '🍂' }
    ],
    'Snacks 🍪': [
      { name: 'Galletas', emoji: '🍪' }, { name: 'Nueces', emoji: '🥜' }, { name: 'Chocolate', emoji: '🍫' }, { name: 'Papas Fritas', emoji: '🍟' }
    ],
    'Bebidas 🥤': [
      { name: 'Agua', emoji: '💧' }, { name: 'Té', emoji: '🍵' }, { name: 'Vino', emoji: '🍷' }
    ],
    'Proteínas 🥩': [], 'Lácteos 🧀': []
  },
  'Nevera': {
    'Verduras 🥦': [
      { name: 'Lechuga', emoji: '🥬' }, { name: 'Tomate', emoji: '🍅' }, { name: 'Zanahoria', emoji: '🥕' }, 
      { name: 'Pepino', emoji: '🥒' }, { name: 'Espinaca', emoji: '🍃' }, { name: 'Pimiento', emoji: '🫑' },
      { name: 'Brocoli', emoji: '🥦' }, { name: 'Calabacín', emoji: '🥒' }
    ],
    'Frutas 🍎': [
      { name: 'Uvas', emoji: '🍇' }, { name: 'Fresas', emoji: '🍓' }, { name: 'Limón', emoji: '🍋' }, 
      { name: 'Aguacate', emoji: '🥑' }, { name: 'Sandía', emoji: '🍉' }
    ],
    'Proteínas 🥩': [
      { name: 'Huevos', emoji: '🥚' }, { name: 'Pollo', emoji: '🍗' }, { name: 'Carne Molida', emoji: '🥩' }, 
      { name: 'Jamón', emoji: '🥓' }, { name: 'Salchichas', emoji: '🌭' }
    ],
    'Lácteos 🧀': [
      { name: 'Leche', emoji: '🥛' }, { name: 'Queso', emoji: '🧀' }, { name: 'Yogur', emoji: '🍦' }, 
      { name: 'Mantequilla', emoji: '🧈' }, { name: 'Crema', emoji: '🥣' }
    ],
    'Bebidas 🥤': [
      { name: 'Jugo', emoji: '🧃' }, { name: 'Refresco', emoji: '🥤' }, { name: 'Cerveza', emoji: '🍺' }
    ],
    'Snacks 🍪': [
      { name: 'Hummus', emoji: '🥣' }, { name: 'Aceitunas', emoji: '🫒' }
    ],
    'Granos 🍚': [], 'Latas 🥫': [], 'Especias 🌶️': []
  },
  'Congelador': {
    'Proteínas 🥩': [
      { name: 'Pollo Cong.', emoji: '🍗' }, { name: 'Pescado', emoji: '🐟' }, { name: 'Carne', emoji: '🥩' }, { name: 'Mariscos', emoji: '🦐' }
    ],
    'Verduras 🥦': [
      { name: 'Verduras Cong.', emoji: '🥦' }, { name: 'Papas Cong.', emoji: '🍟' }, { name: 'Chícharos', emoji: '🟢' }
    ],
    'Frutas 🍎': [
      { name: 'Frutos Rojos', emoji: '🍒' }, { name: 'Mango Cong.', emoji: '🥭' }
    ],
    'Snacks 🍪': [
      { name: 'Helado', emoji: '🍨' }, { name: 'Hielos', emoji: '🧊' }
    ],
    'Granos 🍚': [
       { name: 'Pan Cong.', emoji: '🍞' }
    ],
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

// --- COMPONENT ---

const PantryScreen: React.FC<PantryScreenProps> = ({ userUid }) => {
  // Data State
  const [inventory, setInventory] = useState<KitchenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // View State
  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [newItemName, setNewItemName] = useState('');

  // Fetch Data
  useEffect(() => {
    const fetchPantry = async () => {
      try {
        const docRef = doc(db, 'user_pantry', userUid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.items && Array.isArray(data.items)) {
            setInventory(data.items);
          }
        }
      } catch (error) {
        console.error("Error fetching pantry:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userUid) fetchPantry();
  }, [userUid]);

  // Save Data Helper
  const saveInventory = async (newInventory: KitchenItem[]) => {
    setInventory(newInventory); 
    try {
      const docRef = doc(db, 'user_pantry', userUid);
      await setDoc(docRef, {
        items: newInventory,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving inventory:", error);
    }
  };

  // --- ACTIONS ---

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeZone) return;

    const cleanName = newItemName.trim();
    const detectedEmoji = getEmoji(cleanName);

    addKitchenItem(cleanName, detectedEmoji);
    setNewItemName('');
  };

  const addKitchenItem = (name: string, emoji: string) => {
      if (!activeZone) return;
      
      const exists = inventory.some(i => 
          i.name.toLowerCase() === name.toLowerCase() && 
          i.zone === activeZone
      );
      
      if (exists) return; 

      const newItem: KitchenItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: name,
        emoji: emoji,
        zone: activeZone,
        category: activeCategory === 'Todos' ? 'Varios' : activeCategory.split(' ')[0],
        freshness: 'fresh',
        addedAt: Date.now()
      };

      saveInventory([...inventory, newItem]);
  };

  const toggleFreshness = (id: string) => {
    const newInv = inventory.map(item => {
      if (item.id === id) {
        const nextStatus: Record<Freshness, Freshness> = {
          'fresh': 'soon',
          'soon': 'expired',
          'expired': 'fresh'
        };
        return { ...item, freshness: nextStatus[item.freshness] };
      }
      return item;
    });
    saveInventory(newInv);
  };

  const deleteItem = (id: string) => {
    const newInv = inventory.filter(item => item.id !== id);
    saveInventory(newInv);
  };

  // --- COMPUTED DATA ---

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

  if (isLoading) {
    return <div className="p-10 text-center text-gray-400">Cargando tu cocina...</div>;
  }

  if (!activeZone) {
    return (
      <div className="animate-fade-in pb-24 px-4">
        <div className="flex items-center justify-center gap-2 mb-2">
             <RestaurantIcon className="w-8 h-8 text-bocado-dark-green" />
             <h1 className="text-2xl font-bold text-bocado-dark-green text-center">Mi Cocina</h1>
        </div>
        <p className="text-center text-bocado-gray text-sm mb-8">Lleva el control de los ingredientes que tienes en casa</p>

        <div className="space-y-4">
          {(Object.keys(ZONES) as Zone[]).map(zone => (
            <button
              key={zone}
              onClick={() => { setActiveZone(zone); setActiveCategory('Todos'); }}
              className={`w-full relative p-6 rounded-3xl border transition-all duration-200 transform hover:scale-[1.02] shadow-sm ${ZONES[zone].color}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-5xl filter drop-shadow-sm">{ZONES[zone].emoji}</span>
                  <span className="text-xl font-bold text-gray-700">{ZONES[zone].label}</span>
                </div>
                <div className="text-2xl text-gray-400/50">›</div>
              </div>
              
              {getBadgeCount(zone) > 0 && (
                <div className="absolute top-4 right-4 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shadow-md animate-pulse">
                  {getBadgeCount(zone)}
                </div>
              )}
            </button>
          ))}
        </div>

        {urgentItems.length > 0 && (
          <div className="fixed bottom-20 left-4 right-4 bg-white/90 backdrop-blur-md border border-red-100 rounded-2xl p-3 shadow-lg z-40 animate-slide-up">
            <div className="flex items-center gap-2 mb-2 border-b border-red-50 pb-1">
                <span className="text-lg">🚨</span>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-wide">Urgentes</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {urgentItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex flex-col items-center min-w-[60px]">
                  <div className={`w-9 h-9 flex items-center justify-center rounded-full border ${getFreshnessColor(item.freshness)}`}>
                    <span className="text-lg">{item.emoji}</span>
                  </div>
                  <span className="text-[10px] text-gray-600 truncate w-full text-center mt-1">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-24 min-h-screen relative bg-white">
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 pb-2 pt-2 border-b border-gray-50">
        <div className="flex items-center gap-3 mb-3 px-4">
            <button 
            onClick={() => setActiveZone(null)} 
            className="w-8 h-8 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-full text-gray-500 font-bold hover:bg-gray-100"
            >
            ←
            </button>
            <h1 className="text-xl font-bold text-bocado-dark-green flex items-center gap-2">
                {ZONES[activeZone].emoji} {ZONES[activeZone].label}
            </h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-4">
            {ZONE_CATEGORIES[activeZone].map(cat => (
            <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat 
                    ? 'bg-bocado-dark-green text-white shadow-sm' 
                    : 'bg-gray-50 text-gray-500 border border-gray-100'
                }`}
            >
                {cat}
            </button>
            ))}
        </div>
      </div>

      <div className="px-4 mt-4">
        {suggestedItems.length > 0 && (
            <div className="mb-6 animate-fade-in">
                <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Sugerencias rápidas</p>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {suggestedItems.map(item => (
                        <button
                            key={item.name}
                            onClick={() => addKitchenItem(item.name, item.emoji)}
                            className="flex items-center gap-1.5 bg-white border border-bocado-green/20 hover:border-bocado-green hover:bg-green-50/50 rounded-full px-3 py-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                        >
                            <span className="text-base">{item.emoji}</span>
                            <span className="text-xs font-medium text-gray-700">{item.name}</span>
                            <span className="text-bocado-green font-bold ml-0.5 text-xs">+</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        <form onSubmit={handleAddItem} className="mb-6">
            <div className="relative group">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={activeCategory === 'Todos' ? `Agregar ingrediente...` : `Agregar en ${activeCategory}...`}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-bocado-green/20 focus:bg-white focus:border-bocado-green outline-none transition-all"
                />
                <button 
                    type="submit"
                    disabled={!newItemName.trim()}
                    className="absolute right-1.5 top-1.5 bg-bocado-green text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold disabled:opacity-50 text-sm"
                >
                    +
                </button>
            </div>
        </form>

        {zoneItems.length === 0 ? (
            <div className="text-center py-12 text-gray-300 flex flex-col items-center">
                <span className="text-3xl mb-2 opacity-30">🕸️</span>
                <p className="text-sm">Está vacío.</p>
            </div>
        ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pb-8">
                {zoneItems.map(item => (
                    <div 
                        key={item.id}
                        onClick={() => toggleFreshness(item.id)}
                        className={`relative rounded-xl p-2 aspect-square flex flex-col items-center justify-center gap-1 shadow-sm border-2 transition-all duration-150 active:scale-95 cursor-pointer ${getFreshnessColor(item.freshness)}`}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full border border-gray-100 text-gray-300 hover:text-red-400 flex items-center justify-center shadow-sm z-10"
                        >
                            <span className="text-xs">×</span>
                        </button>
                        
                        <span className="text-3xl filter drop-shadow-sm select-none leading-none mt-1">
                            {item.emoji}
                        </span>
                        
                        <span className="font-medium text-gray-600 text-[10px] text-center leading-tight line-clamp-2 w-full px-1">
                            {item.name}
                        </span>
                        
                        <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${getFreshnessRing(item.freshness)}`} />
                    </div>
                ))}
            </div>
        )}
      </div>

      {urgentItems.length > 0 && (
          <div className="fixed bottom-20 left-4 right-4 bg-white/95 backdrop-blur-md border-t-2 border-red-400 rounded-xl p-2 shadow-xl z-40 flex items-center justify-between animate-slide-up">
            <div className="flex flex-col pl-2">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Caducidad</span>
                <span className="text-xs font-bold text-gray-800">{urgentItems.length} ítems</span>
            </div>
            <div className="flex -space-x-2 pr-2">
                {urgentItems.slice(0,4).map(i => (
                    <div key={i.id} className="w-7 h-7 rounded-full bg-gray-50 border-2 border-white flex items-center justify-center text-xs shadow-sm" title={i.name}>
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
