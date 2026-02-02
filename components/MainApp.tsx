
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
  onLogoutComplete: () => void; // Add this prop
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
        
        if (user.displayName) {
          setUserName(user.displayName.split(' ')[0]);
        } else {
          const savedData = localStorage.getItem('bocado-profile-data');
          if (savedData) {
              const parsed = JSON.parse(savedData);
              if (parsed.firstName) setUserName(parsed.firstName);
          }
        }
        setIsLoading(false);
      } else {
        // If user logs out, clear UID and local storage, then call the callback to redirect
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
    // Just sign out. The onAuthStateChanged listener will handle the rest.
    auth.signOut();
  };
  
  const handleProfileUpdate = (newFirstName: string) => {
      setUserName(newFirstName);
  };

  if (isLoading) {
      return (
          <div className="w-full min-h-screen flex items-center justify-center">
              <p className="text-bocado-green font-bold animate-pulse">Cargando...</p>
          </div>
      );
  }
  
  // Don't render if user is logged out, parent will redirect
  if (!userUid) {
      return (
           <div className="w-full min-h-screen flex items-center justify-center">
              <p className="text-bocado-green font-bold animate-pulse">Cerrando sesión...</p>
          </div>
      );
  }


  return (
    <div className="w-full min-h-screen bg-bocado-background relative pb-24">
      
      {isTutorialOpen && (
        <TutorialModal onClose={handleTutorialClose} userName={userName} />
      )}

      <div className="max-w-2xl mx-auto pt-4">
        {activeTab === 'recommendation' && (
          <RecommendationScreen 
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
