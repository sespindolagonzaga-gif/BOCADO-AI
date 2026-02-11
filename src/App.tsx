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

// ✅ IMPORTACIÓN ESTÁTICA (temporalmente para debugging)
import HomeScreen from './components/HomeScreen';
import RegistrationFlow from './components/RegistrationFlow';
import LoginScreen from './components/LoginScreen';
import PermissionsScreen from './components/PermissionsScreen';
import PlanScreen from './components/PlanScreen';
import MainApp from './components/MainApp';

export type AppScreen = 'home' | 'register' | 'login' | 'recommendation' | 'permissions' | 'plan';

// Configuración de TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

// ✅ Componente de Carga Simple para el Suspense
const ScreenLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-bocado-background">
    <div className="w-8 h-8 border-3 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function AppContent() {
  const [currentScreen, setCurrentScreen] = React.useState<AppScreen>('home');
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [isNewUser, setIsNewUser] = React.useState(false);
  const [authTimeout, setAuthTimeout] = React.useState(false);
  const [renderError, setRenderError] = React.useState<Error | null>(null);
  
  const { setUser, isLoading, isAuthenticated } = useAuthStore();

  // Log de renderizado para debugging
  React.useEffect(() => {
    console.log('[App] AppContent mounted, currentScreen:', currentScreen);
    console.log('[App] isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
  }, []);

  // Timeout de seguridad: si Firebase no responde en 5s, forzar continuar
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('[App] Auth timeout - Firebase no respondió, forzando continuar');
        setAuthTimeout(true);
        // Forzar el estado de carga a falso
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
    console.log('[App] Iniciando onAuthStateChanged...');
    
    // Verificar que Firebase esté configurado
    if (!env.firebase.apiKey || env.firebase.apiKey === '') {
      console.error('[App] ERROR: Firebase API Key no configurada');
      setAuthTimeout(true);
      useAuthStore.getState().setLoading(false);
      return;
    }
    
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('[App] Auth state changed:', user ? 'authenticated' : 'not authenticated');
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
        console.error('[App] Auth state error:', error);
        captureError(error, { type: 'auth_state_change_error' });
        setAuthTimeout(true);
        useAuthStore.getState().setLoading(false);
      });
    } catch (error) {
      console.error('[App] Error setting up auth listener:', error);
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
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-bocado-green font-bold animate-pulse">Cargando Bocado...</p>
        </div>
      </div>
    );
  }

  // Si hay timeout, mostrar error de configuración
  if (authTimeout) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚙️</div>
          <h1 className="text-xl font-bold text-bocado-dark-green mb-2">
            Error de configuración
          </h1>
          <p className="text-bocado-gray mb-4">
            No se pudieron cargar las credenciales de Firebase. Verifica que las variables de entorno estén configuradas en Vercel.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-bocado-green text-white px-6 py-3 rounded-full font-bold hover:bg-bocado-dark-green transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Si hay error de renderizado
  if (renderError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">💥</div>
          <h1 className="text-xl font-bold text-bocado-dark-green mb-2">
            Error al renderizar
          </h1>
          <p className="text-bocado-gray mb-4">
            {renderError.message}
          </p>
          <pre className="text-xs text-left bg-gray-100 p-2 rounded overflow-auto max-h-40">
            {renderError.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-bocado-green text-white px-6 py-3 rounded-full font-bold hover:bg-bocado-dark-green transition-colors"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    console.log('[App] Rendering screen:', currentScreen);
    
    try {
      switch (currentScreen) {
        case 'permissions':
          return <PermissionsScreen onAccept={() => setCurrentScreen('register')} onGoHome={() => setCurrentScreen('home')} />;
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
          console.log('[App] Rendering HomeScreen');
          return <HomeScreen onStartRegistration={() => setCurrentScreen('permissions')} onGoToApp={() => setCurrentScreen('recommendation')} onGoToLogin={() => setCurrentScreen('login')} />;
      }
    } catch (error) {
      console.error('[App] Error rendering screen:', error);
      setRenderError(error as Error);
      throw error;
    }
  };

  return (
    <SentryErrorBoundary>
      <div className="min-h-screen bg-bocado-cream flex justify-center items-start md:items-center md:p-8 lg:p-10 2xl:p-12">
        <div className="w-full min-h-full bg-bocado-background 
                        md:max-w-app lg:max-w-app-lg xl:max-w-app-xl
                        md:h-[min(900px,calc(100vh-4rem))] md:min-h-[640px]
                        md:rounded-4xl md:shadow-bocado-lg 
                        md:border-8 md:border-white
                        overflow-hidden relative flex flex-col">
          {/* PWA Banner dentro del contenedor del teléfono */}
          <PWABanner />
          
          {/* Notificaciones de estado de red */}
          <NetworkStatusToast />
          
          {/* Renderizado sin lazy loading para debugging */}
          <ErrorBoundary>
            {renderScreen()}
          </ErrorBoundary>
        </div>
      </div>
    </SentryErrorBoundary>
  );
}

// ✅ WRAPPER CON PROVIDERS Y ERROR BOUNDARY GLOBAL
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
