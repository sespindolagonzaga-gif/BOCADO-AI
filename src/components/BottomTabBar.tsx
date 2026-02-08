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
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
          isActive ? 'text-bocado-green' : 'text-bocado-gray hover:text-bocado-dark-gray'
        }`}
      >
        <Icon 
          className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} 
          strokeWidth={isActive ? 2.5 : 1.5}
        />
        <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe">
      <div className="mx-auto max-w-md relative">
        
        {/* Fondo glassmorphism - más compacto */}
        <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] rounded-2xl mb-3 pt-5 pb-3 px-2 mt-4">
          <div className="flex justify-between items-end h-14">
            
            {/* IZQUIERDA */}
            <div className="flex flex-1 justify-around items-center h-full">
              {renderTabButton('saved', 'Recetas', BookIcon)}
              {renderTabButton('restaurants', 'Lugares', LocationIcon)}
            </div>

            {/* Espacio reducido para el botón central */}
            <div className="w-12 flex-shrink-0" />

            {/* DERECHA */}
            <div className="flex flex-1 justify-around items-center h-full">
              {renderTabButton('pantry', 'Mi Cocina', RestaurantIcon)}
              {renderTabButton('profile', 'Perfil', UserIcon)}
            </div>

          </div>
        </div>

        {/* Botón CENTRAL (Inicio) - más pequeño pero destacado */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
          <button
            onClick={() => onTabChange('recommendation')}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border-[3px] border-white transition-all duration-200 ${
              activeTab === 'recommendation' 
                ? 'bg-bocado-green text-white scale-110' 
                : 'bg-white text-bocado-gray hover:text-bocado-green'
            }`}
          >
            <HomeIcon className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <span className={`block text-center text-[10px] font-bold mt-0.5 ${
            activeTab === 'recommendation' ? 'text-bocado-green' : 'text-bocado-gray'
          }`}>
            Inicio
          </span>
        </div>

      </div>
    </nav>
  );
};

export default BottomTabBar;