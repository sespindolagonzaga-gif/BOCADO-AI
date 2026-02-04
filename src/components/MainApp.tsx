import React, { useState, useEffect } from 'react';
import BottomTabBar, { Tab } from './BottomTabBar';
import RecommendationScreen from './RecommendationScreen';
import PantryScreen from './PantryScreen';
import ProfileScreen from './ProfileScreen';
import SavedRecipesScreen from './SavedRecipesScreen';
import SavedRestaurantsScreen from './SavedRestaurantsScreen';
import TutorialModal from './TutorialModal';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

interface MainAppProps {
  onPlanGenerated: (id: string) => void;
  showTutorial?: boolean;
  onTutorialFinished: () => void;
  onLogoutComplete: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ onPlanGenerated, showTutorial = false, onTutorialFinished, onLogoutComplete }) => {
  const [activeTab, setActiveTab] = useState<Tab>('recommendation');
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isTutorialOpen, setIsTutorialOpen] = useState(showTutorial);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUid(user.uid);
        
        // Intentar obtener el nombre desde Firebase o LocalStorage inmediatamente
        let foundName = '';
        if (user.displayName) {
          foundName = user.displayName.split(' ')[0];
        } else {
          const savedData = localStorage.getItem('bocado-profile-data');
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);
              foundName = parsed.firstName || '';
            } catch (e) {
              console.error("Error al parsear datos locales", e);
            }
          }
        }
        
        setUserName(foundName);
        
        // Pequeño delay para asegurar que RecommendationScreen encuentre el localStorage al montarse
        setTimeout(() => {
          setIsLoading(false);
        }, 150);

      } else {
        setUserUid(null); 
        localStorage.removeItem('bocado-profile-data');
        onLogoutComplete();
      }
    });

    return () => unsubscribe();
  }, [onLogoutComplete]);

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
    onTutorialFinished(); 
  };

  const handleLogout = () => {
    auth.signOut();
  };
  
  const handleProfileUpdate = (newFirstName: string) => {
      setUserName(newFirstName);
  };

  if (isLoading) {
      return (
          <div className="w-full min-h-screen flex items-center justify-center bg-bocado-background">
              <div className="text-center">
                  <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-bocado-green font-bold animate-pulse">Sincronizando Bocado...</p>
              </div>
          </div>
      );
  }
  
  if (!userUid) return null;

  return (
    <div className="w-full min-h-screen bg-bocado-background relative pb-24">
      
      {isTutorialOpen && (
        <TutorialModal onClose={handleTutorialClose} userName={userName} />
      )}

      <div className="max-w-2xl mx-auto pt-4">
        {activeTab === 'recommendation' && (
          <RecommendationScreen 
            key={userUid} // Forzamos el reinicio del componente al detectar el UID
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

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default MainApp;