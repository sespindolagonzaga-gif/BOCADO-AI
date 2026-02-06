import React, { useState } from 'react';
import BottomTabBar, { Tab } from './BottomTabBar';
import RecommendationScreen from './RecommendationScreen';
import PantryScreen from './PantryScreen';
import ProfileScreen from './ProfileScreen';
import SavedRecipesScreen from './SavedRecipesScreen';
import SavedRestaurantsScreen from './SavedRestaurantsScreen';
import TutorialModal from './TutorialModal';
import { auth } from '../firebaseConfig';
import { updateProfile } from 'firebase/auth'; // ✅ Para actualizar nombre en Auth
import { useAuthStore } from '../stores/authStore';

interface MainAppProps {
  onPlanGenerated: (id: string) => void;
  showTutorial?: boolean;
  onTutorialFinished: () => void;
  onLogoutComplete: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ 
  onPlanGenerated, 
  showTutorial = false, 
  onTutorialFinished, 
  onLogoutComplete 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('recommendation');
  const [isTutorialOpen, setIsTutorialOpen] = useState(showTutorial);
  
  // ✅ ZUSTAND: Solo usamos Auth (Firestore no tiene nombres por privacidad)
  const { user, isLoading, isAuthenticated } = useAuthStore();

  // El nombre viene de Firebase Auth (displayName), no de Firestore
  const userName = user?.displayName?.split(' ')[0] || '';
  const userUid = user?.uid || null;

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
    onTutorialFinished(); 
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      onLogoutComplete();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };
  
  // ✅ Actualiza el nombre en Firebase Auth (no en Firestore por protección de datos)
  const handleProfileUpdate = async (newFirstName: string) => {
    if (user) {
      try {
        await updateProfile(user, {
          displayName: `${newFirstName} ${user.displayName?.split(' ').slice(1).join(' ') || ''}`
        });
        // Forzamos actualización del store de auth
        useAuthStore.getState().setUser(user);
      } catch (error) {
        console.error("Error actualizando nombre:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bocado-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-bocado-green font-bold animate-pulse">Sincronizando Bocado...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated || !userUid) return null;

  return (
    <div className="flex-1 flex flex-col relative bg-bocado-background overflow-hidden">
      
      {isTutorialOpen && (
        <TutorialModal onClose={handleTutorialClose} userName={userName} />
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
        <div className="max-w-md mx-auto">
          {activeTab === 'recommendation' && (
            <RecommendationScreen 
              key={userUid}
              userName={userName}
              onPlanGenerated={onPlanGenerated}
            />
          )}
          {activeTab === 'pantry' && (
            <div className="p-4 animate-fade-in">
              <PantryScreen userUid={userUid} />
            </div>
          )}
          {activeTab === 'saved' && (
            <div className="p-4 animate-fade-in">
              <SavedRecipesScreen />
            </div>
          )}
          {activeTab === 'restaurants' && (
            <div className="p-4 animate-fade-in">
              <SavedRestaurantsScreen />
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="p-4 animate-fade-in">
              <ProfileScreen 
                userUid={userUid}
                onLogout={handleLogout}
                onProfileUpdate={handleProfileUpdate}
              />
            </div>
          )}
        </div>
      </div>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default MainApp;