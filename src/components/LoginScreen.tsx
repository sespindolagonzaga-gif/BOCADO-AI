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
import { logger } from '../utils/logger';
import { useTranslation } from '../contexts/I18nContext';
import { signInWithGoogle } from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onGoHome: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onGoHome }) => {
  const { t } = useTranslation();
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
      setError(t('login.errors.missingFields'));
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
        // Invalidar y actualizar cache del perfil
        queryClient.invalidateQueries({ queryKey: ['userProfile', user.uid] });
        queryClient.setQueryData(['userProfile', user.uid], sanitizedProfile);
        
        // ✅ ANALÍTICA: Login exitoso
        trackEvent('login_success', { userId: user.uid });
        
        onLoginSuccess();
      } else {
        // ✅ ANALÍTICA: Login exitoso pero sin perfil en Firestore (error de datos)
        trackEvent('login_missing_profile', { userId: user.uid });
        setError(t('login.success.profileIncomplete'));
        auth.signOut();
      }
    } catch (err: any) {
      logger.error("Error logging in:", err.code);
      
      // ✅ ANALÍTICA: Error en login
      trackEvent('login_error', { 
        error_code: err.code || 'unknown',
        email_provided: email.includes('@') // Para saber si es error de formato o credenciales
      });

      if (['auth/network-request-failed', 'auth/unavailable'].includes(err.code)) {
        setError(t('login.errors.networkError'));
      } else if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(err.code)) {
        setError(t('login.errors.invalidCredentials'));
      } else {
        setError(t('login.errors.genericError'));
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
      setSuccessMessage(t('login.success.emailResent'));
    } catch (err) {
      // ✅ ANALÍTICA: Error al reenviar
      trackEvent('login_resend_verification_error');
      setError(t('login.errors.resendFailed'));
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
      setError(t('login.errors.emailRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      // ✅ ANALÍTICA: Solicitud de reset exitosa
      trackEvent('password_reset_requested', { success: true });
      setSuccessMessage(t('login.success.resetEmailSent', { email }));
    } catch (err: any) {
      logger.error("Error sending password reset email:", err.code);
      // ✅ ANALÍTICA: Error en solicitud de reset
      trackEvent('password_reset_requested', { success: false, error: err.code });
      
      if (err.code === 'auth/user-not-found') {
        setError(t('login.errors.userNotFound'));
      } else {
        setError(t('login.errors.resetFailed'));
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

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await signInWithGoogle();
      
      trackEvent('login_google_success', { 
        userId: result.uid,
        isNewUser: result.isNewUser 
      });

      if (result.isNewUser) {
        // Usuario nuevo - necesita completar perfil
        setError('Por favor completa tu registro primero');
        auth.signOut();
        setIsLoading(false);
        return;
      }

      // Usuario existente - verificar perfil en Firestore
      const userDocRef = doc(db, 'users', result.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        const sanitizedProfile = sanitizeProfileData(firestoreData) as UserProfile;
        
        queryClient.invalidateQueries({ queryKey: ['userProfile', result.uid] });
        queryClient.setQueryData(['userProfile', result.uid], sanitizedProfile);
        
        onLoginSuccess();
      } else {
        trackEvent('login_google_missing_profile', { userId: result.uid });
        setError('Perfil no encontrado. Por favor regístrate.');
        auth.signOut();
      }
    } catch (err: any) {
      logger.error("Error con Google Sign-In:", err.code);
      trackEvent('login_google_error', { error_code: err.code || 'unknown' });
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesión cancelado');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Error de red. Verifica tu conexión.');
      } else {
        setError('Error al iniciar sesión con Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (needsVerification && unverifiedUser) {
    return (
      <div className="min-h-full flex items-center justify-center px-4 py-8 pt-safe pb-safe">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm text-center animate-fade-in">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-bocado-dark-green mb-2">{t('login.emailNotVerified')}</h2>
          <p className="text-base text-bocado-dark-gray mb-4">
            {t('login.verificationRequired')}
          </p>
          <p className="text-sm text-bocado-gray mb-6 break-all">
            {t('login.linkSentTo')} <strong>{unverifiedUser.email}</strong>
          </p>
          
          {successMessage && (
            <p className="text-green-600 text-sm mb-3 bg-green-50 p-2 rounded-lg">{successMessage}</p>
          )}
          {error && (
            <p className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={isLoading}
              className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray"
            >
              {isLoading ? t('common.sending') : t('login.resendEmail')}
            </button>
            <button
              onClick={handleLogoutUnverified}
              className="w-full text-bocado-gray font-medium py-2 text-sm hover:text-bocado-dark-gray transition-colors"
            >
              {t('login.useOtherAccount')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderLoginView = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-40 mx-auto mb-2">
          <BocadoLogo className="w-full" />
        </div>
        <h1 className="text-xl font-bold text-bocado-dark-green">{t('login.title')}</h1>
        <p className="text-sm text-bocado-gray mt-1">{t('login.subtitle')}</p>
      </div>
      
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full bg-white border-2 border-bocado-border text-bocado-text font-bold py-3 px-4 rounded-full text-base shadow-sm hover:bg-bocado-background hover:border-bocado-dark-gray active:scale-95 transition-all disabled:bg-bocado-gray disabled:text-white flex items-center justify-center gap-2 mb-4"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {t('login.continueWithGoogle') || 'Continuar con Google'}
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-bocado-border"></div>
        <span className="text-xs text-bocado-gray font-medium">O</span>
        <div className="flex-1 h-px bg-bocado-border"></div>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="relative">
          <label htmlFor="email" className="block text-xs font-medium text-bocado-dark-gray mb-1">
            {t('login.email')}
          </label>
          <input
            type="email"
            id="email"
            name="email"
            data-testid="email-input"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
            autoComplete="email"
            className={`w-full px-4 py-3 bg-bocado-background border-2 ${error ? 'border-red-400' : 'border-transparent'} rounded-xl text-sm text-bocado-text placeholder-bocado-gray/50 focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20 transition-all`}
            placeholder={t('login.placeholders.email')}
            disabled={isLoading}
          />
          {showEmailSuggestions && emailSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-bocado-border rounded-xl shadow-lg overflow-hidden" role="listbox" aria-label={t('login.emailSuggestions')}>
              <ul className="max-h-48 overflow-auto">
                {emailSuggestions.map((suggestion) => (
                  <li 
                    key={suggestion}
                    role="option"
                    tabIndex={0}
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
          <label htmlFor="password" className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">
            {t('login.password')}
          </label>
          <input
            type="password"
            id="password"
            name="password"
            data-testid="password-input"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            className={`w-full px-4 py-3 bg-bocado-background border-2 ${error ? 'border-red-400' : 'border-transparent'} rounded-xl text-sm text-bocado-text placeholder-bocado-gray/50 focus:outline-none focus:border-bocado-green focus:ring-2 focus:ring-bocado-green/20 transition-all`}
            placeholder="••••••••"
            disabled={isLoading}
          />
        </div>
        
        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}
        
        <button
          type="submit"
          data-testid="login-submit-button"
          className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray mt-2"
          disabled={isLoading}
        >
          {isLoading ? t('common.loading') : t('login.loginButton')}
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
            {t('login.forgotPassword')}
          </button>
        </div>
      </form>
    </>
  );

  const renderResetView = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-32 mx-auto mb-2">
          <BocadoLogo className="w-full h-auto" />
        </div>

        <h1 className="text-xl font-bold text-bocado-dark-green">{t('login.resetPassword')}</h1>
        <p className="text-sm text-bocado-gray mt-1">{t('login.resetSubtitle')}</p>
      </div>
      
      <form onSubmit={handlePasswordReset} className="space-y-4">
        <div>
          <label htmlFor="reset-email" className="block text-2xs font-bold text-bocado-dark-gray mb-1.5 uppercase tracking-wider">
            {t('login.email')}
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
        
        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}
        {successMessage && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg">{successMessage}</p>}

        <button
          type="submit"
          className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray mt-2"
          disabled={isLoading}
        >
          {isLoading ? t('login.sending') : t('login.sendLink')}
        </button>
        
        <div className="text-center">
          <button
            type="button"
            onClick={() => setView('login')}
            className="text-xs text-bocado-green font-semibold hover:underline"
          >
            {t('login.backToLogin')}
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-8 pt-safe pb-safe">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm animate-fade-in">
        {view === 'login' ? renderLoginView() : renderResetView()}
        <div className="mt-6 text-center pt-4 border-t border-bocado-border">
          <button 
            onClick={handleGoBack} 
            className="text-xs text-bocado-gray hover:text-bocado-dark-gray transition-colors" 
            disabled={isLoading}
          >
            {t('home.backToHome')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
