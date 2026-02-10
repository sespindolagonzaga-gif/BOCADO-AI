import React from 'react';
import { RestaurantIcon } from './icons/RestaurantIcon';
import { UserIcon } from './icons/UserIcon';
import { BookIcon } from './icons/BookIcon';
import { LocationIcon } from './icons/LocationIcon';
import { HomeIcon } from './icons/HomeIcon';

export type Tab = 'recommendation' | 'pantry' | 'saved' | 'restaurants' | 'profile';

interface BottomTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const isActive = (id: Tab) => activeTab === id;

  return (
    <nav className="flex-shrink-0 z-50 px-safe pb-safe bg-bocado-background border-t border-bocado-border/30">
      <div className="mx-auto max-w-md md:max-w-lg bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] overflow-visible">
        
        {/* Contenedor flex simple: 5 elementos, mismo tamaño, centrados verticalmente */}
        <div className="flex items-center justify-between h-16 px-2 relative">
          
          {/* 1. Recetas */}
          <button
            onClick={() => onTabChange('saved')}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${isActive('saved') ? 'text-bocado-green' : 'text-bocado-gray'}`}
          >
            <BookIcon className="w-5 h-5" strokeWidth={isActive('saved') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">Recetas</span>
          </button>

          {/* 2. Lugares */}
          <button
            onClick={() => onTabChange('restaurants')}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${isActive('restaurants') ? 'text-bocado-green' : 'text-bocado-gray'}`}
          >
            <LocationIcon className="w-5 h-5" strokeWidth={isActive('restaurants') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">Lugares</span>
          </button>

          {/* 3. Inicio (Centro) - más grande y elevado */}
          <div className="flex flex-col items-center justify-center flex-1 h-full relative">
            <button
              onClick={() => onTabChange('recommendation')}
              className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-white shadow-md -mt-4 transition-transform ${isActive('recommendation') ? 'bg-bocado-green text-white scale-110' : 'bg-bocado-dark-green text-white'}`}
            >
              <HomeIcon className="w-6 h-6" strokeWidth={2.5} />
            </button>
            <span className={`text-2xs font-bold mt-1 ${isActive('recommendation') ? 'text-bocado-green' : 'text-bocado-gray'}`}>
              Inicio
            </span>
          </div>

          {/* 4. Mi Cocina */}
          <button
            onClick={() => onTabChange('pantry')}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${isActive('pantry') ? 'text-bocado-green' : 'text-bocado-gray'}`}
          >
            <RestaurantIcon className="w-5 h-5" strokeWidth={isActive('pantry') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">Mi Cocina</span>
          </button>

          {/* 5. Perfil */}
          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${isActive('profile') ? 'text-bocado-green' : 'text-bocado-gray'}`}
          >
            <UserIcon className="w-5 h-5" strokeWidth={isActive('profile') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">Perfil</span>
          </button>

        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
