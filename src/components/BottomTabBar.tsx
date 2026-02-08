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
  
  const renderTabButton = (id: Tab, label: string, Icon: React.FC<React.SVGProps<SVGSVGElement>>) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => onTabChange(id)}
        className={`flex flex-col items-center justify-center space-y-1 w-16 ${
          isActive ? 'text-bocado-green' : 'text-bocado-gray hover:text-bocado-dark-gray'
        }`}
      >
        <Icon 
          className={`w-5 h-5 transition-all duration-200 ${isActive ? 'scale-110' : ''}`} 
          strokeWidth={isActive ? 2.5 : 1.5}
        />
        <span className={`text-[10px] font-medium whitespace-nowrap ${isActive ? 'font-bold' : ''}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-safe">
      <div className="mx-auto max-w-md relative">
        
        {/* Barra glassmorphism más baja y compacta */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_-2px_16px_rgba(0,0,0,0.08)] rounded-3xl mb-3 px-6 py-3">
          <div className="flex items-center justify-between h-12">
            
            {/* IZQUIERDA - Recetas y Lugares */}
            <div className="flex items-center gap-6">
              {renderTabButton('saved', 'Recetas', BookIcon)}
              {renderTabButton('restaurants', 'Lugares', LocationIcon)}
            </div>

            {/* CENTRO - Inicio (más bajito, apenas sobresale) */}
            <div className="relative -mt-2">
              <button
                onClick={() => onTabChange('recommendation')}
                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg border-[2.5px] border-white transition-all duration-200 ${
                  activeTab === 'recommendation' 
                    ? 'bg-bocado-green text-white scale-110' 
                    : 'bg-bocado-dark-green/90 text-white hover:scale-105'
                }`}
              >
                <HomeIcon className="w-5 h-5" strokeWidth={2.5} />
              </button>
              {/* Label debajo del círculo, no afuera */}
              <span className={`block text-center text-[9px] font-bold mt-0.5 ${
                activeTab === 'recommendation' ? 'text-bocado-green' : 'text-bocado-gray'
              }`}>
                Inicio
              </span>
            </div>

            {/* DERECHA - Mi Cocina y Perfil */}
            <div className="flex items-center gap-6">
              {renderTabButton('pantry', 'Mi Cocina', RestaurantIcon)}
              {renderTabButton('profile', 'Perfil', UserIcon)}
            </div>

          </div>
        </div>

      </div>
    </nav>
  );
};

export default BottomTabBar;