import React, { useState } from 'react';
import BocadoLogo from './BocadoLogo';
import { db, auth, trackEvent } from '../firebaseConfig'; // ✅ Importado trackEvent
import { EMAIL_DOMAINS } from '../constants';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeProfileData } from '../utils/profileSanitizer';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onGoHome: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onGoHome }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);

  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);

    if (!email || !password) {
      setError('Por favor, introduce tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    const lowercasedEmail = email.toLowerCase();
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, lowercasedEmail, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        // ✅ ANALÍTICA: Intento de login con correo no verificado
        trackEvent('login_unverified_attempt', { userId: user.uid });
        
        setNeedsVerification(true);
        setUnverifiedUser(user);
        setIsLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        
        if (!firestoreData.emailVerified) {
          await updateDoc(userDocRef, { emailVerified: true });
        }
        
        const sanitizedProfile = sanitizeProfileData(firestoreData) as UserProfile;
        queryClient.setQueryData(['userProfile', user.uid], sanitizedProfile);
        
        // ✅ ANALÍTICA: Login exitoso
        trackEvent('login_success', { userId: user.uid });
        
        onLoginSuccess();
      } else {
        // ✅ ANALÍTICA: Login exitoso pero sin perfil en Firestore (error de datos)
        trackEvent('login_missing_profile', { userId: user.uid });
        setError('Perfil incompleto. Por favor contacta soporte.');
        auth.signOut();
      }
    } catch (err: any) {
      console.error("Error logging in:", err.code);
      
      // ✅ ANALÍTICA: Error en login
      trackEvent('login_error', { 
        error_code: err.code || 'unknown',
        email_provided: email.includes('@') // Para saber si es error de formato o credenciales
      });

      if (['auth/network-request-failed', 'auth/unavailable'].includes(err.code)) {
        setError('Error de red. No pudimos conectar con el servidor.');
      } else if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(err.code)) {
        setError('Correo electrónico o contraseña incorrectos.');
      } else {
        setError('Hubo un problema al iniciar sesión. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    
    setIsLoading(true);
    try {
      await sendEmailVerification(unverifiedUser);
      // ✅ ANALÍTICA: Reenvío de verificación
      trackEvent('login_resend_verification_success');
      setSuccessMessage('Correo de verificación reenviado. Revisa tu bandeja de entrada.');
    } catch (err) {
      // ✅ ANALÍTICA: Error al reenviar
      trackEvent('login_resend_verification_error');
      setError('No se pudo reenviar el correo. Inténtalo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutUnverified = () => {
    trackEvent('login_unverified_switch_account'); // ✅ Analítica
    auth.signOut();
    setNeedsVerification(false);
    setUnverifiedUser(null);
    setError('');
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email) {
      setError('Por favor, introduce tu correo electrónico.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      // ✅ ANALÍTICA: Solicitud de reset exitosa
      trackEvent('password_reset_requested', { success: true });
      setSuccessMessage(`Se ha enviado un correo a ${email} con instrucciones.`);
    } catch (err: any) {
      console.error("Error sending password reset email:", err.code);
      // ✅ ANALÍTICA: Error en solicitud de reset
      trackEvent('password_reset_requested', { success: false, error: err.code });
      
      if (err.code === 'auth/user-not-found') {
        setError('No se encontró ningún usuario con este correo electrónico.');
      } else {
        setError('Hubo un problema al enviar el correo. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setError('');
    setSuccessMessage('');
    setNeedsVerification(false);

    const atIndex = value.indexOf('@');
    if (atIndex > -1) {
      const textBeforeAt = value.substring(0, atIndex);
      const textAfterAt = value.substring(atIndex + 1);

      const filtered = EMAIL_DOMAINS
        .filter(domain => domain.startsWith(textAfterAt))
        .map(domain => `${textBeforeAt}@${domain}`);

      setEmailSuggestions(filtered);
      setShowEmailSuggestions(filtered.length > 0);
    } else {
      setShowEmailSuggestions(false);
    }
  };

  const handleEmailSuggestionClick = (suggestion: string) => {
    // ✅ ANALÍTICA: Uso de sugerencia de dominio
    trackEvent('login_email_suggestion_used');
    setEmail(suggestion);
    setShowEmailSuggestions(false);
  };

  const handleGoBack = () => {
    trackEvent('login_go_home_click'); // ✅ Analítica
    onGoHome();
  };

  if (needsVerification && unverifiedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-safe pb-safe">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm text-center animate-fade-in">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-bocado-dark-green mb-2">Correo no verificado</h2>
          <p className="text-sm text-bocado-dark-gray mb-4">
            Para continuar usando Bocado, debes verificar tu correo electrónico.
          </p>
          <p className="text-xs text-bocado-gray mb-6 break-all">
            Hemos enviado un enlace a <strong>{unverifiedUser.email}</strong>
          </p>
          
          {successMessage && (
            <p className="text-green-600 text-xs mb-3 bg-green-50 p-2 rounded-lg">{successMessage}</p>
          )}
          {error && (
            <p className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={isLoading}
              className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray"
            >
              {isLoading ? 'Enviando...' : 'Reenviar correo'}
            </button>
            <button
              onClick={handleLogoutUnverified}
              className="w-full text-bocado-gray font-medium py-2 text-sm hover:text-bocado-dark-gray transition-colors"
            >
              Usar otra cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderLoginView = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-32 h-32 mx-auto mb-2">
          <BocadoLogo className="w-full h-full" />
        </div>
        <h1 className="text-xl font-bold text-bocado-dark-green">Iniciar Sesión</h1>
        <p className="text-sm text-bocado-gray mt-1">Accede a tu perfil</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="relative">
          <label htmlFor="email" className="block text-xs font-medium text-bocado-dark-gray mb-1">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
            autoComplete="email"
            className={`w-full px-4 py-3 bg-bocado-background border-2 ${error ? 'border-red-400' : 'border-transparent'} rounded-xl text-sm text-bocado-text placeholder-bocado-gray/50 focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20 transition-all`}
            placeholder="tu@correo.com"
            disabled={isLoading}
          />
          {showEmailSuggestions && emailSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-bocado-border rounded-xl shadow-lg overflow-hidden">
              <ul className="max-h-48 overflow-auto">
                {emailSuggestions.map((suggestion) => (
                  <li 
                    key={suggestion}
                    onMouseDown={() => handleEmailSuggestionClick(suggestion)}
                    className="px-4 py-2 text-sm text-bocado-text cursor-pointer hover:bg-bocado-background active:bg-bocado-green/10"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-bocado-dark-gray mb-1">
            Contraseña
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            className={`w-full px-4 py-3 bg-bocado-background border-2 ${error ? 'border-red-400' : 'border-transparent'} rounded-xl text-sm text-bocado-text placeholder-bocado-gray/50 focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20 transition-all`}
            placeholder="••••••••"
            disabled={isLoading}
          />
        </div>
        
        {error && <p className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</p>}
        
        <button
          type="submit"
          className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray mt-2"
          disabled={isLoading}
        >
          {isLoading ? 'Cargando...' : 'Entrar'}
        </button>
        
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              trackEvent('login_forgot_password_click'); // ✅ Analítica
              setView('reset');
            }}
            className="text-xs text-bocado-green font-semibold hover:underline"
          >
            Olvidé mi contraseña
          </button>
        </div>
      </form>
    </>
  );

  const renderResetView = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-32 h-32 mx-auto mb-2">
          <BocadoLogo className="w-full h-full" />
        </div>
        <h1 className="text-xl font-bold text-bocado-dark-green">Restablecer Contraseña</h1>
        <p className="text-sm text-bocado-gray mt-1">Te enviaremos un enlace</p>
      </div>
      
      <form onSubmit={handlePasswordReset} className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="block text-xs font-medium text-bocado-dark-gray mb-1">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="reset-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-bocado-background border-2 border-transparent rounded-xl text-sm text-bocado-text placeholder-bocado-gray/50 focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20 transition-all"
            placeholder="tu@correo.com"
            disabled={isLoading}
          />
        </div>
        
        {error && <p className="text-red-500 text-xs text-center bg-red-50 p-2 rounded-lg">{error}</p>}
        {successMessage && <p className="text-green-600 text-xs text-center bg-green-50 p-2 rounded-lg">{successMessage}</p>}

        <button
          type="submit"
          className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray mt-2"
          disabled={isLoading}
        >
          {isLoading ? 'Enviando...' : 'Enviar enlace'}
        </button>
        
        <div className="text-center">
          <button
            type="button"
            onClick={() => setView('login')}
            className="text-xs text-bocado-green font-semibold hover:underline"
          >
            Volver a Iniciar Sesión
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-safe pb-safe">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm animate-fade-in">
        {view === 'login' ? renderLoginView() : renderResetView()}
        <div className="mt-6 text-center pt-4 border-t border-bocado-border">
          <button 
            onClick={handleGoBack} 
            className="text-xs text-bocado-gray hover:text-bocado-dark-gray transition-colors" 
            disabled={isLoading}
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;