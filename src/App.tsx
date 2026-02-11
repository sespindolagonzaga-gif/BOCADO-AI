import React, { useEffect, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth, trackEvent } from './firebaseConfig';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import { SentryErrorBoundary } from './components/SentryErrorBoundary';
import PWABanner from './components/PWABanner';
import { captureError, setUserContext, addBreadcrumb } from './utils/sentry';

// ✅ IMPORTACIÓN DINÁMICA (Lazy Loading)
const HomeScreen = lazy(() => import('./components/HomeScreen'));
const RegistrationFlow = lazy(() => import('./components/RegistrationFlow'));
const ConfirmationScreen = lazy(() => import('./components/ConfirmationScreen'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const PermissionsScreen = lazy(() => import('./components/PermissionsScreen'));
const PlanScreen = lazy(() => import('./components/PlanScreen'));
const MainApp = lazy(() => import('./components/MainApp'));

export type AppScreen = 'home' | 'register' | 'confirmation' | 'login' | 'recommendation' | 'permissions' | 'plan';

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
  
  const { setUser, isLoading, isAuthenticated } = useAuthStore();

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
    });
    return () => unsubscribe();
  }, [setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bocado-cream">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-bocado-green font-bold animate-pulse">Cargando Bocado...</p>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'permissions':
        return <PermissionsScreen onAccept={() => setCurrentScreen('register')} onGoHome={() => setCurrentScreen('home')} />;
      case 'register':
        return <RegistrationFlow onRegistrationComplete={() => { setIsNewUser(true); setCurrentScreen('recommendation'); }} onGoHome={() => setCurrentScreen('home')} />;
      case 'confirmation':
        return <ConfirmationScreen onGoHome={() => setCurrentScreen('home')} />;
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
          
          {/* ✅ ENVOLVEMOS EL RENDER EN SUSPENSE */}
          <Suspense fallback={<ScreenLoader />}>
            {renderScreen()}
          </Suspense>
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
