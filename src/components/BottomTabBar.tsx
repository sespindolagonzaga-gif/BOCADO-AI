import React from 'react';
import { UtensilsCrossed, User, BookOpen, MapPin, Home } from './icons';
import { useTranslation } from '../contexts/I18nContext';

export type Tab = 'recommendation' | 'pantry' | 'saved' | 'restaurants' | 'profile';

interface BottomTabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const isActive = (id: Tab) => activeTab === id;
  const { t } = useTranslation();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 px-safe pb-safe bg-bocado-background dark:bg-gray-800 border-t border-bocado-border/30 dark:border-gray-700"
      aria-label="Bottom navigation"
      style={{
        // ✅ FIX #8: Better iOS keyboard handling
        position: 'fixed',
        bottom: 0,
        // On iOS, fixed bottom elements can shift when keyboard appears
        // This keeps navbar stable
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      <div className="mx-auto max-w-md md:max-w-lg bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] overflow-visible">
        
        {/* Contenedor flex simple: 5 elementos, mismo tamaño, centrados verticalmente */}
        <div className="flex items-center justify-between h-16 px-2 relative" role="tablist" aria-label="Primary">
          
          {/* 1. Guardados (Recetas) */}
          <button
            data-testid="nav-saved"
            onClick={() => onTabChange('saved')}
            role="tab"
            aria-label={t('tabs.recipes')}
            aria-current={isActive('saved') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 min-h-[48px] touch-manipulation ${isActive('saved') ? 'text-bocado-green' : 'text-bocado-gray dark:text-gray-400'}`}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <BookOpen className="w-5 h-5" strokeWidth={isActive('saved') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">{t('tabs.recipes')}</span>
          </button>

          {/* 2. Favoritos (Lugares) */}
          <button
            data-testid="nav-restaurants"
            onClick={() => onTabChange('restaurants')}
            role="tab"
            aria-label={t('tabs.restaurants')}
            aria-current={isActive('restaurants') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 min-h-[48px] touch-manipulation ${isActive('restaurants') ? 'text-bocado-green' : 'text-bocado-gray dark:text-gray-400'}`}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <MapPin className="w-5 h-5" strokeWidth={isActive('restaurants') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">{t('tabs.restaurants')}</span>
          </button>

          {/* 3. Inicio (Centro) - más grande y elevado */}
          <div className="flex flex-col items-center justify-center flex-1 h-full relative">
            <button
              data-testid="nav-recommendation"
              onClick={() => onTabChange('recommendation')}
              role="tab"
              aria-label={t('tabs.home')}
              aria-current={isActive('recommendation') ? 'page' : undefined}
              className={`w-14 h-14 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-md -mt-4 transition-transform touch-manipulation ${isActive('recommendation') ? 'bg-bocado-green text-white scale-110' : 'bg-bocado-dark-green text-white'}`}
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                minWidth: '56px',
                minHeight: '56px',
              }}
            >
              <Home className="w-6 h-6" strokeWidth={2.5} />
            </button>
            <span className={`text-2xs font-bold mt-1 ${isActive('recommendation') ? 'text-bocado-green' : 'text-bocado-gray dark:text-gray-400'}`}>
              {t('tabs.home')}
            </span>
          </div>

          {/* 4. Mi Cocina */}
          <button
            data-testid="nav-pantry"
            onClick={() => onTabChange('pantry')}
            role="tab"
            aria-label={t('tabs.pantry')}
            aria-current={isActive('pantry') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 min-h-[48px] touch-manipulation ${isActive('pantry') ? 'text-bocado-green' : 'text-bocado-gray dark:text-gray-400'}`}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <UtensilsCrossed className="w-5 h-5" strokeWidth={isActive('pantry') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">{t('tabs.pantry')}</span>
          </button>

          {/* 5. Perfil */}
          <button
            data-testid="nav-profile"
            onClick={() => onTabChange('profile')}
            role="tab"
            aria-label={t('tabs.profile')}
            aria-current={isActive('profile') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 min-h-[48px] touch-manipulation ${isActive('profile') ? 'text-bocado-green' : 'text-bocado-gray dark:text-gray-400'}`}
            style={{ 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <User className="w-5 h-5" strokeWidth={isActive('profile') ? 2.5 : 1.5} />
            <span className="text-2xs font-medium whitespace-nowrap">{t('tabs.profile')}</span>
          </button>

        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
