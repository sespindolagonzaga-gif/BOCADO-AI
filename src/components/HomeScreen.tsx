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
  const { t, locale, setLocale } = useTranslation();

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

  const toggleLanguage = () => {
    const newLocale = locale === 'es' ? 'en' : 'es';
    setLocale(newLocale);
    trackEvent('home_change_language', { from: locale, to: newLocale });
  };

  return (
    <div className="h-full flex flex-col items-center px-6 pt-safe">
      {/* Selector de idioma en la esquina superior derecha */}
      <div className="fixed top-4 right-4 z-10">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow border border-bocado-green/20"
          aria-label={t('home.changeLanguage')}
        >
          <span className="text-lg">{locale === 'es' ? '🇪🇸' : '🇺🇸'}</span>
          <span className="text-sm font-medium text-bocado-dark-gray dark:text-gray-200">
            {locale === 'es' ? 'ES' : 'EN'}
          </span>
        </button>
      </div>

      {/* Spacer superior — empuja el contenido hacia el centro-bajo */}
      <div className="flex-[2]" />

      {/* Card con contenido principal */}
      <div className="w-full max-w-sm rounded-3xl bg-white/5 dark:bg-white/[0.04] border border-white/10 dark:border-white/[0.08] backdrop-blur-sm p-8 flex flex-col items-center">
        {/* Logo */}
        <div className="w-56 sm:w-64 md:w-72 mb-6">
          <BocadoLogo className="w-full h-auto" />
        </div>

        {/* Texto */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-bocado-dark-gray dark:text-gray-200 mb-2">
            {t('home.title')}{' '}
            <span className="underline decoration-bocado-green decoration-4 underline-offset-4">
              {t('home.titleHighlight')}
            </span>
          </h1>
          <p className="text-sm text-bocado-gray dark:text-gray-400">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Botones */}
        <div className="flex flex-col w-full gap-3">
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

      {/* Spacer inferior — más pequeño para que el card quede ligeramente arriba del centro */}
      <div className="flex-[3]" />
    </div>
  );
};

export default HomeScreen;
