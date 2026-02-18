import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth, trackEvent } from './firebaseConfig';
import { env } from './environment/env';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import { SentryErrorBoundary } from './components/SentryErrorBoundary';
import PWABanner from './components/PWABanner';
import NetworkStatusToast from './components/NetworkStatusToast';
import { captureError, setUserContext, addBreadcrumb } from './utils/sentry';
import { I18nProvider, useTranslation } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer } from './components/ui/Toast';
import { FeedbackModalProvider } from './components/FeedbackModal';

// ✅ IMPORTACIÓN ESTÁTICA (sin lazy loading)
import HomeScreen from './components/HomeScreen';
import RegistrationMethodScreen from './components/RegistrationMethodScreen';
import RegistrationFlow from './components/RegistrationFlow';
import LoginScreen from './components/LoginScreen';
import PermissionsScreen from './components/PermissionsScreen';
import PlanScreen from './components/PlanScreen';
import MainApp from './components/MainApp';

export type AppScreen = 'home' | 'registerMethod' | 'register' | 'login' | 'recommendation' | 'permissions' | 'plan';

// Configuración de TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const [currentScreen, setCurrentScreen] = React.useState<AppScreen>('home');
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [isNewUser, setIsNewUser] = React.useState(false);
  const [authTimeout, setAuthTimeout] = React.useState(false);
  const [renderError, setRenderError] = React.useState<Error | null>(null);
  
  const { setUser, isLoading, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();



  // Timeout de seguridad: si Firebase no responde en 5s, forzar continuar
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setAuthTimeout(true);
        useAuthStore.getState().setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      trackEvent('exception', { description: event.message, fatal: true });
      captureError(event.error || new Error(event.message), {
        type: 'global_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };
    const handlePromiseError = (event: PromiseRejectionEvent) => {
      trackEvent('promise_error', { reason: String(event.reason) });
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      captureError(error, { type: 'unhandled_promise_rejection' });
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseError);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseError);
    };
  }, []);

  useEffect(() => {
    trackEvent('screen_view', { screen_name: currentScreen });
  }, [currentScreen]);

  useEffect(() => {
    // Verificar que Firebase esté configurado
    if (!env.firebase.apiKey || env.firebase.apiKey === '') {
      console.error('[App] Firebase API Key no configurada');
      setAuthTimeout(true);
      useAuthStore.getState().setLoading(false);
      return;
    }
    
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        // Sincronizar usuario con Sentry para tracking de errores
        setUserContext(user?.uid || null, user?.email || undefined);
        if (user) {
          addBreadcrumb('User authenticated', 'auth');
          setCurrentScreen('recommendation');
        } else {
          addBreadcrumb('User logged out', 'auth');
          setCurrentScreen('home');
        }
      }, (error) => {
        captureError(error, { type: 'auth_state_change_error' });
        setAuthTimeout(true);
        useAuthStore.getState().setLoading(false);
      });
    } catch (error) {
      captureError(error as Error, { type: 'auth_setup_error' });
      setAuthTimeout(true);
      useAuthStore.getState().setLoading(false);
      return;
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setUser]);

  if (isLoading && !authTimeout) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-bocado-green font-bold animate-pulse">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Si hay timeout, mostrar error de configuración
  if (authTimeout) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚙️</div>
          <h1 className="text-xl font-bold text-bocado-dark-green dark:text-gray-200 mb-2">
            {t('errors.configError')}
          </h1>
          <p className="text-bocado-gray dark:text-gray-400 mb-4">
            {t('errors.configErrorDesc')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-bocado-green text-white px-6 py-3 rounded-full font-bold hover:bg-bocado-dark-green transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Si hay error de renderizado
  if (renderError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">💥</div>
          <h1 className="text-xl font-bold text-bocado-dark-green dark:text-gray-200 mb-2">
            {t('errors.renderError')}
          </h1>
          <p className="text-bocado-gray dark:text-gray-400 mb-4">
            {renderError.message}
          </p>
          <pre className="text-xs text-left bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
            {renderError.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-bocado-green text-white px-6 py-3 rounded-full font-bold hover:bg-bocado-dark-green transition-colors"
          >
            {t('errors.reload')}
          </button>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    try {
      switch (currentScreen) {
        case 'permissions':
          return <PermissionsScreen onAccept={() => setCurrentScreen('registerMethod')} onGoHome={() => setCurrentScreen('home')} />;
        case 'registerMethod':
          return (
            <RegistrationMethodScreen 
              onGoogleSuccess={(uid, email) => {
                // Usuario se registró con Google, ir al flujo de completar perfil
                setIsNewUser(true);
                setCurrentScreen('register');
              }}
              onChooseEmail={() => setCurrentScreen('register')}
              onGoHome={() => setCurrentScreen('home')}
            />
          );
        case 'register':
          return <RegistrationFlow onRegistrationComplete={() => { setIsNewUser(true); setCurrentScreen('recommendation'); }} onGoHome={() => setCurrentScreen('home')} />;
        case 'login':
          return <LoginScreen onLoginSuccess={() => { setIsNewUser(false); setCurrentScreen('recommendation'); }} onGoHome={() => setCurrentScreen('home')} />;
        case 'recommendation':
          return <MainApp showTutorial={isNewUser} onPlanGenerated={(id) => { setPlanId(id); setCurrentScreen('plan'); }} onTutorialFinished={() => setIsNewUser(false)} onLogoutComplete={() => setCurrentScreen('home')} />;
        case 'plan':
          return <PlanScreen planId={planId!} onStartNewPlan={() => { setPlanId(null); setCurrentScreen('recommendation'); }} />;
        case 'home':
        default:
          return <HomeScreen onStartRegistration={() => setCurrentScreen('permissions')} onGoToApp={() => setCurrentScreen('recommendation')} onGoToLogin={() => setCurrentScreen('login')} />;
      }
    } catch (error) {
      setRenderError(error as Error);
      throw error;
    }
  };

  return (
    <SentryErrorBoundary>
      <div className="min-h-[100dvh] bg-bocado-cream dark:bg-gray-900 flex justify-center items-start md:items-center md:p-8 lg:p-10 2xl:p-12">
        <div className="w-full h-[100dvh] md:h-[min(900px,calc(100dvh-4rem))] md:min-h-[640px] bg-bocado-background dark:bg-gray-800 
            md:max-w-app lg:max-w-app-lg xl:max-w-app-xl
            md:rounded-4xl md:shadow-bocado-lg 
            md:border-8 md:border-white dark:md:border-gray-700
            overflow-visible relative flex flex-col">
          {/* PWA Banner dentro del contenedor del teléfono */}
          <PWABanner showInstall={currentScreen === 'home' || currentScreen === 'recommendation'} />
          
          {/* Notificaciones de estado de red */}
          <NetworkStatusToast />
          
          {/* ✅ FIX: Toast notifications for better mobile UX */}
          <ToastContainer />
          
          {/* Renderizado con Error Boundary - ocupa todo el espacio disponible */}
          <div className="flex-1 min-h-0">
            <ErrorBoundary>
              {renderScreen()}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </SentryErrorBoundary>
  );
}

// ✅ WRAPPER CON PROVIDERS Y ERROR BOUNDARY GLOBAL
function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <FeedbackModalProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </FeedbackModalProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
