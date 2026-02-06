import React from 'react';
import BocadoLogo from './BocadoLogo';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useAuthStore } from '../stores/authStore';
import { useUserProfileStore } from '../stores/userProfileStore';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onGoToApp: () => void;
  onGoToLogin: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartRegistration, onGoToApp, onGoToLogin }) => {
  // ✅ ZUSTAND: Obtenemos estado de autenticación y perfil
  const { isAuthenticated, user } = useAuthStore();
  const { profile } = useUserProfileStore();

  // Determinamos si hay una sesión activa con perfil completo
  const hasSession = isAuthenticated || !!profile;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // ✅ Limpiar stores de Zustand (el auth se limpia automáticamente por onAuthStateChanged en App.tsx)
      useUserProfileStore.getState().clearProfile();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 pt-safe">
      {/* Logo */}
      <div className="w-48 sm:w-64 md:w-80 mb-8">
        <BocadoLogo className="w-full h-auto" />
      </div>

      {/* Texto */}
      <div className="text-center max-w-sm mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-bocado-dark-gray mb-3">
          ¿Qué comer hoy?{' '}
          <span className="underline decoration-bocado-green decoration-4 underline-offset-4">
            Ya no es problema
          </span>
        </h1>
        <p className="text-sm sm:text-base text-bocado-gray">
          Sé parte de Bocado, donde tú decides y la IA te acompaña.
        </p>
      </div>

      {/* Botones: Condicionales basados en autenticación */}
      <div className="flex flex-col w-full max-w-xs gap-3">
        {hasSession ? (
          <>
            <button
              onClick={onGoToApp}
              className="w-full bg-bocado-green text-white font-bold py-4 px-8 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              Entrar
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-white text-bocado-green border-2 border-bocado-green font-bold py-4 px-8 rounded-full text-base hover:bg-bocado-background active:scale-95 transition-all"
            >
              Cerrar Sesión
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onStartRegistration}
              className="w-full bg-bocado-green text-white font-bold py-4 px-8 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              Registrarse
            </button>
            <button
              onClick={onGoToLogin}
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