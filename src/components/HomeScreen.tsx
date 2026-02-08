import React from 'react';
import BocadoLogo from './BocadoLogo';
import { signOut } from 'firebase/auth';
import { auth, trackEvent } from '../firebaseConfig'; // ✅ Importado trackEvent
import { useAuthStore } from '../stores/authStore';
import { useUserProfile } from '../hooks/useUser';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onGoToApp: () => void;
  onGoToLogin: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartRegistration, onGoToApp, onGoToLogin }) => {
  const { isAuthenticated, user } = useAuthStore();
  const { data: profile } = useUserProfile(user?.uid);

  const hasSession = isAuthenticated || !!profile;

  // --- HANDLERS CON ANALÍTICA ---

  const handleEnterApp = () => {
    trackEvent('home_enter_app', { userId: user?.uid }); // ✅ Analítica
    onGoToApp();
  };

  const handleStartRegistration = () => {
    trackEvent('home_start_registration'); // ✅ Analítica
    onStartRegistration();
  };

  const handleGoToLogin = () => {
    trackEvent('home_go_to_login'); // ✅ Analítica
    onGoToLogin();
  };

  const handleLogout = async () => {
    try {
      trackEvent('home_logout', { userId: user?.uid }); // ✅ Analítica
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 pt-safe">
      {/* Logo */}
      <div className="w-48 sm:w-72 md:w-84 mb-8">
        <BocadoLogo className="w-full h-auto" />
      </div>

      {/* Texto */}
      <div className="text-center max-w-sm mb-10">
        <h1 className="text-xl sm:text-xl font-bold text-bocado-dark-gray mb-3">
          ¿Qué comer hoy?{' '}
          <span className="underline decoration-bocado-green decoration-4 underline-offset-4">
            Ya no es problema
          </span>
        </h1>
        <p className="text-sm sm:text-base text-bocado-gray">
          Sé parte de Bocado, donde tú decides y la IA te acompaña.
        </p>
      </div>

      {/* Botones */}
      <div className="flex flex-col w-full max-w-xs gap-3">
        {hasSession ? (
          <>
            <button
              onClick={handleEnterApp} // ✅ Handler con analítica
              className="w-full bg-bocado-green text-white font-bold py-4 px-8 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              Entrar
            </button>
            <button
              onClick={handleLogout} // ✅ Handler con analítica
              className="w-full bg-white text-bocado-green border-2 border-bocado-green font-bold py-4 px-8 rounded-full text-base hover:bg-bocado-background active:scale-95 transition-all"
            >
              Cerrar Sesión
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleStartRegistration} // ✅ Handler con analítica
              className="w-full bg-bocado-green text-white font-bold py-4 px-8 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              Registrarse
            </button>
            <button
              onClick={handleGoToLogin} // ✅ Handler con analítica
              className="w-full bg-white text-bocado-green border-2 border-bocado-green font-bold py-4 px-8 rounded-full text-base hover:bg-bocado-background active:scale-95 transition-all"
            >
              Iniciar Sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;