
import React, { useState } from 'react';
import HomeScreen from './components/HomeScreen';
import RegistrationFlow from './components/RegistrationFlow';
import ConfirmationScreen from './components/ConfirmationScreen';
import LoginScreen from './components/LoginScreen';
import PermissionsScreen from './components/PermissionsScreen';
import PlanScreen from './components/PlanScreen';
import MainApp from './components/MainApp';

export type AppScreen = 'home' | 'register' | 'confirmation' | 'login' | 'recommendation' | 'permissions' | 'plan';

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [planId, setPlanId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'permissions':
        return <PermissionsScreen onAccept={() => setCurrentScreen('register')} onGoHome={() => setCurrentScreen('home')} />;
      case 'register':
        return <RegistrationFlow 
                  onRegistrationComplete={() => {
                    setIsNewUser(true); // Set flag for tutorial
                    setCurrentScreen('recommendation');
                  }} 
                  onGoHome={() => setCurrentScreen('home')} 
               />;
      case 'confirmation':
        return <ConfirmationScreen onGoHome={() => setCurrentScreen('home')} />;
      case 'login':
        return <LoginScreen 
                  onLoginSuccess={() => {
                    setIsNewUser(false); // Standard login, no tutorial
                    setCurrentScreen('recommendation');
                  }} 
                  onGoHome={() => setCurrentScreen('home')} 
               />;
      case 'recommendation':
        // Aquí usamos el nuevo MainApp que contiene los Tabs
        return <MainApp 
                  showTutorial={isNewUser} // Pass the flag
                  onPlanGenerated={(id) => {
                    setPlanId(id);
                    setCurrentScreen('plan');
                  }}
                  onTutorialFinished={() => setIsNewUser(false)} // Add this callback
                  onLogoutComplete={() => setCurrentScreen('home')} // Restore the logout callback
               />;
      case 'plan':
        return <PlanScreen planId={planId!} onStartNewPlan={() => {
          setPlanId(null);
          setCurrentScreen('recommendation');
        }} />;
      case 'home':
      default:
        return <HomeScreen 
                  onStartRegistration={() => setCurrentScreen('permissions')} 
                  onGoToApp={() => setCurrentScreen('recommendation')} 
                  onGoToLogin={() => setCurrentScreen('login')}
                />;
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-0 sm:p-4 font-sans bg-bocado-background">
      <main className="w-full max-w-2xl mx-auto bg-bocado-background">
        {renderScreen()}
      </main>
    </div>
  );
}

export default App;
