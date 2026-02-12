// components/pantry/PantryZoneDetail.tsx
import React, { useState, useMemo } from 'react';
import { KitchenItem, Zone, Freshness } from '../../types';
import { ZONES, ZONE_CATEGORIES, COMMON_INGREDIENTS_DB, getEmoji } from './constants';
import { trackEvent } from '../../firebaseConfig';

interface PantryZoneDetailProps {
  zone: Zone;
  inventory: KitchenItem[];
  isSaving: boolean;
  onBack: () => void;
  onAddItem: (item: KitchenItem) => void;
  onDeleteItem: (id: string) => void;
  onToggleFreshness: (id: string, newStatus: Freshness) => void;
}

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

const freshnessCycle: Record<Freshness, Freshness> = {
  'fresh': 'soon',
  'soon': 'expired',
  'expired': 'fresh'
};

export const PantryZoneDetail: React.FC<PantryZoneDetailProps> = ({
  zone,
  inventory,
  isSaving,
  onBack,
  onAddItem,
  onDeleteItem,
  onToggleFreshness,
}) => {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [newItemName, setNewItemName] = useState('');

  const zoneItems = useMemo(() => {
    let filtered = inventory.filter(i => i.zone === zone);
    if (activeCategory !== 'Todos') {
      filtered = filtered.filter(i => 
        i.category.includes(activeCategory.split(' ')[0]) || i.category === 'Varios'
      );
    }
    return filtered;
  }, [inventory, zone, activeCategory]);

  const urgentItems = useMemo(() => 
    inventory.filter(i => i.freshness === 'expired' || i.freshness === 'soon'),
    [inventory]
  );

  const suggestedItems = useMemo(() => {
    let candidates: { name: string; emoji: string }[] = [];
    if (activeCategory === 'Todos') {
      const priorityCategories = ZONE_CATEGORIES[zone].filter(c => c !== 'Todos');
      priorityCategories.forEach(cat => {
        const items = COMMON_INGREDIENTS_DB[zone]?.[cat];
        if (Array.isArray(items)) candidates.push(...items.slice(0, 2));
      });
    } else {
      candidates = COMMON_INGREDIENTS_DB[zone]?.[activeCategory] || [];
    }
    return candidates.filter(c => 
      !inventory.some(i => i.name.toLowerCase() === c.name.toLowerCase() && i.zone === zone)
    );
  }, [zone, activeCategory, inventory]);

  const handleCategorySelect = (cat: string) => {
    trackEvent('pantry_category_selected', { category: cat });
    setActiveCategory(cat);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const cleanName = newItemName.trim();
    const newItem: KitchenItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: cleanName,
      emoji: getEmoji(cleanName),
      zone,
      category: activeCategory === 'Todos' ? 'Varios' : activeCategory.split(' ')[0],
      freshness: 'fresh',
      addedAt: Date.now()
    };

    onAddItem(newItem);
    setNewItemName('');
  };

  const handleSuggestedItemAdd = (item: { name: string; emoji: string }) => {
    const newItem: KitchenItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: item.name,
      emoji: item.emoji,
      zone,
      category: activeCategory === 'Todos' ? 'Varios' : activeCategory.split(' ')[0],
      freshness: 'fresh',
      addedAt: Date.now()
    };
    onAddItem(newItem);
    trackEvent('pantry_suggested_item_added', { item_name: item.name });
  };

  const handleToggleFreshness = (id: string, currentStatus: Freshness) => {
    const newStatus = freshnessCycle[currentStatus];
    onToggleFreshness(id, newStatus);
    trackEvent('pantry_item_freshness_toggle', { new_status: newStatus });
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="sticky top-0 bg-white z-20 border-b border-bocado-border/50 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center bg-bocado-background rounded-full text-bocado-dark-gray font-bold active:scale-95 transition-transform"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-bocado-dark-green flex items-center gap-2">
            {ZONES[zone].emoji} {ZONES[zone].label}
          </h1>
          {isSaving && <span className="text-xs text-bocado-gray animate-pulse">Guardando...</span>}
        </div>

        {/* Leyenda de frescura */}
        <div className="bg-bocado-background/50 rounded-lg p-3 mb-3 border border-bocado-border/30">
          <p className="text-2xs font-bold text-bocado-gray mb-2 uppercase tracking-wider">Estados</p>
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-2xs">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span className="font-medium text-bocado-text">Fresco</span>
            </div>
            <div className="flex items-center gap-2 text-2xs">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span className="font-medium text-bocado-text">Por caducar</span>
            </div>
            <div className="flex items-center gap-2 text-2xs">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="font-medium text-bocado-text">Urgente</span>
            </div>
          </div>
          <p className="text-2xs text-bocado-gray mt-2">👆 Toca un ingrediente para cambiar su estado</p>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ZONE_CATEGORIES[zone].map(cat => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-2xs font-bold transition-all active:scale-95 ${
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

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {suggestedItems.length > 0 && (
          <div className="mb-4">
            <p className="text-2xs font-bold text-bocado-gray mb-2 uppercase tracking-wider">Sugerencias</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {suggestedItems.map(item => (
                <button
                  key={item.name}
                  onClick={() => handleSuggestedItemAdd(item)}
                  className="flex items-center gap-1.5 bg-white border border-bocado-border hover:border-bocado-green hover:bg-bocado-green/5 rounded-full px-3 py-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-sm font-medium text-bocado-text">{item.name}</span>
                  <span className="text-bocado-green font-bold text-sm">+</span>
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
                onClick={() => handleToggleFreshness(item.id, item.freshness)}
                className={`relative rounded-xl p-2 aspect-square flex flex-col items-center justify-center gap-1 shadow-sm border-2 transition-all active:scale-95 cursor-pointer ${getFreshnessColor(item.freshness)}`}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full border border-bocado-border text-bocado-gray hover:text-red-400 flex items-center justify-center shadow-sm z-10 active:scale-90"
                >
                  <span className="text-xs">×</span>
                </button>
                <span className="text-2xl select-none leading-none mt-1">{item.emoji}</span>
                <span className="font-medium text-bocado-text text-2xs text-center leading-tight line-clamp-2 w-full px-1">{item.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${getFreshnessRing(item.freshness)}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {urgentItems.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 bg-white border-t-2 border-red-400 rounded-xl p-3 shadow-bocado-lg z-30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-2xs font-bold text-red-500 uppercase tracking-wider">Caducidad</span>
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
