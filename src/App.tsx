import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; // Importación necesaria
import { auth } from './firebaseConfig'; // Importación necesaria
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
  const [initializing, setInitializing] = useState(true); // Para no mostrar el home mientras carga el auth

  // --- NUEVO: useEffect para Persistencia de Sesión ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Si hay usuario, vamos a la app
        setCurrentScreen('recommendation');
      } else {
        // Si no hay usuario, vamos al home
        setCurrentScreen('home');
      }
      setInitializing(false);
    });

    return () => unsubscribe(); // Limpieza del listener
  }, []);

  // Mientras Firebase verifica la sesión, mostramos un estado de carga simple
  if (initializing) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-background">
        <div className="animate-pulse text-bocado-green font-bold">Cargando Bocado IA...</div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'permissions':
        return <PermissionsScreen onAccept={() => setCurrentScreen('register')} onGoHome={() => setCurrentScreen('home')} />;
      case 'register':
        return <RegistrationFlow 
                  onRegistrationComplete={() => {
                    setIsNewUser(true);
                    setCurrentScreen('recommendation');
                  }} 
                  onGoHome={() => setCurrentScreen('home')} 
               />;
      case 'confirmation':
        return <ConfirmationScreen onGoHome={() => setCurrentScreen('home')} />;
      case 'login':
        return <LoginScreen 
                  onLoginSuccess={() => {
                    setIsNewUser(false);
                    setCurrentScreen('recommendation');
                  }} 
                  onGoHome={() => setCurrentScreen('home')} 
               />;
      case 'recommendation':
        return <MainApp 
                  showTutorial={isNewUser}
                  onPlanGenerated={(id) => {
                    setPlanId(id);
                    setCurrentScreen('plan');
                  }}
                  onTutorialFinished={() => setIsNewUser(false)}
                  onLogoutComplete={() => {
                    // El listener de onAuthStateChanged se encargará de mandar a 'home'
                    // pero forzamos aquí por seguridad visual
                    setCurrentScreen('home');
                  }}
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