
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
  
  // Función auxiliar para renderizar botones
  const renderTabButton = (id: Tab, label: string, Icon: React.FC<React.SVGProps<SVGSVGElement>>) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => onTabChange(id)}
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
          isActive ? 'text-bocado-green' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Icon 
          className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} 
          strokeWidth={isActive ? 2.5 : 1.5}
        />
        <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 z-50">
      <div className="max-w-2xl mx-auto h-full flex justify-between items-center px-2">
        
        {/* IZQUIERDA */}
        <div className="flex flex-1 justify-around">
            {renderTabButton('saved', 'Recetas', BookIcon)}
            {renderTabButton('restaurants', 'Lugares', LocationIcon)}
        </div>

        {/* CENTRO (INICIO) */}
        <div className="flex-shrink-0 mx-2 relative -top-5">
            <button
                onClick={() => onTabChange('recommendation')}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-gray-50 transition-all duration-300 ${
                    activeTab === 'recommendation' 
                    ? 'bg-bocado-green text-white scale-110' 
                    : 'bg-white text-gray-400 hover:text-bocado-green'
                }`}
            >
                <HomeIcon className="w-7 h-7" />
            </button>
            <span className={`absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] font-bold ${activeTab === 'recommendation' ? 'text-bocado-green' : 'text-gray-400'}`}>
                Inicio
            </span>
        </div>

        {/* DERECHA */}
        <div className="flex flex-1 justify-around">
            {renderTabButton('pantry', 'Mi Cocina', RestaurantIcon)}
            {renderTabButton('profile', 'Perfil', UserIcon)}
        </div>

      </div>
    </div>
  );
};

export default BottomTabBar;
