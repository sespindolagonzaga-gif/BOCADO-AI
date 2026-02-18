import React, { useState, useEffect } from 'react';
import BottomTabBar, { Tab } from './BottomTabBar';
import RecommendationScreen from './RecommendationScreen';
import PantryScreen from './PantryScreen';
import ProfileScreen from './ProfileScreen';
import SavedRecipesScreen from './SavedRecipesScreen';
import SavedRestaurantsScreen from './SavedRestaurantsScreen';
import TutorialModal from './TutorialModal';
import ErrorBoundary from './ErrorBoundary';
import { auth, trackEvent } from '../firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { useAuthStore } from '../stores/authStore';
import { useUserProfile } from '../hooks/useUser';
import { logger } from '../utils/logger';
import { useTranslation } from '../contexts/I18nContext';

interface MainAppProps {
  onPlanGenerated: (id: string) => void;
  showTutorial?: boolean;
  onTutorialFinished: () => void;
  onLogoutComplete: () => void;
  initialTab?: Tab;
}

const MainApp: React.FC<MainAppProps> = ({
  onPlanGenerated,
  showTutorial = false,
  onTutorialFinished,
  onLogoutComplete,
  initialTab = 'recommendation'
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [isTutorialOpen, setIsTutorialOpen] = useState(showTutorial);
  
  // Sincronizar estado del tutorial cuando cambia la prop
  useEffect(() => {
    setIsTutorialOpen(showTutorial);
  }, [showTutorial]);
  
  const { user, isLoading, isAuthenticated } = useAuthStore();
  useUserProfile(user?.uid);

  const userName = user?.displayName?.split(' ')[0] || '';
  const userUid = user?.uid || null;

  useEffect(() => {
    trackEvent('tab_changed', { tab_name: activeTab });
  }, [activeTab]);

  const handleTutorialClose = () => {
    trackEvent('tutorial_closed');
    setIsTutorialOpen(false);
    onTutorialFinished(); 
  };

  const handleLogout = async () => {
    try {
      trackEvent('logout_started', { userId: userUid });
      await auth.signOut();
      onLogoutComplete();
    } catch (error) {
      logger.error("Error al cerrar sesión:", error);
      trackEvent('logout_error');
    }
  };
  
  const handleProfileUpdate = async (newFirstName: string) => {
    if (user) {
      try {
        await updateProfile(user, {
          displayName: `${newFirstName} ${user.displayName?.split(' ').slice(1).join(' ') || ''}`
        });
        useAuthStore.getState().setUser(user);
        trackEvent('display_name_updated');
      } catch (error) {
        logger.error("Error actualizando nombre:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bocado-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-bocado-green font-bold animate-pulse">{t('mainApp.loading')}</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated || !userUid) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bocado-background p-4">
        <div className="text-center">
          <p className="text-bocado-gray mb-4">{t('mainApp.sessionInvalid')}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-bocado-green text-white px-6 py-3 rounded-full font-bold"
          >
            {t('mainApp.reload')}
          </button>
        </div>
      </div>
    );
  }

  return (
    // ✅ h-full para ocupar todo el espacio del contenedor padre
    <div className="h-full w-full flex flex-col bg-bocado-background overflow-visible pt-safe">
      
      {isTutorialOpen && (
        <TutorialModal onClose={handleTutorialClose} userName={userName} />
      )}

      {/* Contenido - ocupa todo el espacio restante */}
      <main className="flex-1 overflow-y-auto min-h-0 pb-20 flex flex-col no-scrollbar">
        <div className="min-h-full max-w-md md:max-w-lg mx-auto flex flex-col">
          <ErrorBoundary>
            {activeTab === 'recommendation' && (
              <RecommendationScreen 
                key={userUid}
                userName={userName}
                onPlanGenerated={onPlanGenerated}
                isNewUser={showTutorial}
              />
            )}
            {activeTab === 'pantry' && (
              <div className="p-4 animate-fade-in flex-1 flex flex-col min-h-0">
                <PantryScreen userUid={userUid} />
              </div>
            )}
            {activeTab === 'saved' && (
              <div className="p-4 animate-fade-in flex-1 flex flex-col min-h-0">
                <SavedRecipesScreen />
              </div>
            )}
            {activeTab === 'restaurants' && (
              <div className="p-4 animate-fade-in flex-1 flex flex-col min-h-0">
                <SavedRestaurantsScreen />
              </div>
            )}
            {activeTab === 'profile' && (
              <div className="p-4 animate-fade-in flex-1 flex flex-col min-h-0">
                <ProfileScreen 
                  userUid={userUid}
                  onLogout={handleLogout}
                  onProfileUpdate={handleProfileUpdate}
                />
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>

      {/* BottomTabBar - siempre visible abajo */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default MainApp;
