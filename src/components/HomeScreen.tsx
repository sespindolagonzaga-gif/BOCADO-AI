import React from 'react';
import BocadoLogo from './BocadoLogo';
import { signOut } from 'firebase/auth';
import { auth, trackEvent } from '../firebaseConfig'; // ✅ Importado trackEvent
import { useAuthStore } from '../stores/authStore';
import { useUserProfile } from '../hooks/useUser';
import { logger } from '../utils/logger';
import { useTranslation } from '../contexts/I18nContext';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onGoToApp: () => void;
  onGoToLogin: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartRegistration, onGoToApp, onGoToLogin }) => {
  const { isAuthenticated, user } = useAuthStore();
  const { data: profile } = useUserProfile(user?.uid);
  const { t } = useTranslation();

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
      logger.error("Error signing out: ", error);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12 pt-safe">
      {/* Logo */}
      <div className="w-64 sm:w-72 md:w-80 mb-8">
        <BocadoLogo className="w-full h-auto" />
      </div>

      {/* Texto */}
      <div className="text-center max-w-sm mb-10">
        <h1 className="text-xl font-bold text-bocado-dark-gray dark:text-gray-200 mb-3">
          {t('home.title')}{' '}
          <span className="underline decoration-bocado-green decoration-4 underline-offset-4">
            {t('home.titleHighlight')}
          </span>
        </h1>
        <p className="text-base text-bocado-gray dark:text-gray-400">
          {t('home.subtitle')}
        </p>
      </div>

      {/* Botones */}
      <div className="flex flex-col w-full max-w-xs gap-4">
        {hasSession ? (
          <>
            <button
              data-testid="enter-app-button"
              onClick={handleEnterApp}
              className="w-full bg-bocado-green text-white font-bold py-3.5 px-8 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              {t('home.enterButton')}
            </button>
            <button
              data-testid="logout-button"
              onClick={handleLogout}
              className="w-full bg-white dark:bg-gray-800 text-bocado-green dark:text-bocado-green-light border-2 border-bocado-green font-bold py-3.5 px-8 rounded-full text-base hover:bg-bocado-background dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              {t('home.logoutButton')}
            </button>
          </>
        ) : (
          <>
            <button
              data-testid="start-button"
              onClick={handleStartRegistration}
              className="w-full bg-bocado-green text-white font-bold py-3.5 px-8 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              {t('home.startButton')}
            </button>
            <button
              data-testid="login-button"
              onClick={handleGoToLogin}
              className="w-full bg-white dark:bg-gray-800 text-bocado-green dark:text-bocado-green-light border-2 border-bocado-green font-bold py-3.5 px-8 rounded-full text-base hover:bg-bocado-background dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              {t('home.loginButton')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
