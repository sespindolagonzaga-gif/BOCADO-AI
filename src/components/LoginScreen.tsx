import React, { useState } from 'react';
import BocadoLogo from './BocadoLogo';
import { db, auth } from '../firebaseConfig';
import { EMAIL_DOMAINS } from '../constants';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { sanitizeProfileData } from '../utils/profileSanitizer';
import { FormData } from '../types';

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
  
  // NUEVO: Estado para verificación de correo
  const [needsVerification, setNeedsVerification] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);

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

      // NUEVO: Verificar si el correo está verificado
      if (!user.emailVerified) {
        setNeedsVerification(true);
        setUnverifiedUser(user);
        setIsLoading(false);
        return;
      }

      // Si está verificado, continuar con el flujo normal
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        
        // Actualizar estado de verificación en Firestore
        if (!firestoreData.emailVerified) {
          await updateDoc(userDocRef, { emailVerified: true });
        }
        
        const displayName = user.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const sanitizedProfile = sanitizeProfileData(firestoreData);
        
        const fullProfileData: FormData = Object.assign(
          {},
          sanitizedProfile,
          {
            firstName,
            lastName,
            email: user.email || lowercasedEmail,
            password: '',
            confirmPassword: '',
          }
        );

        localStorage.setItem('bocado-profile-data', JSON.stringify(fullProfileData));
        onLoginSuccess();
      } else {
        setError('Perfil incompleto. Por favor contacta soporte.');
        auth.signOut();
      }
    } catch (err: any) {
      console.error("Error logging in:", err.code);
      if (['auth/network-request-failed', 'auth/unavailable'].includes(err.code)) {
        setError('Error de red. No pudimos conectar con el servidor.');
      } else if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(err.code)) {
        setError('Correo electrónico o contraseña incorrectos.');
      } else {
        setError('Hubo un problema al iniciar sesión. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // NUEVO: Reenviar correo de verificación
  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    
    setIsLoading(true);
    try {
      await sendEmailVerification(unverifiedUser);
      setSuccessMessage('Correo de verificación reenviado. Revisa tu bandeja de entrada.');
    } catch (err) {
      setError('No se pudo reenviar el correo. Inténtalo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  // NUEVO: Cerrar sesión del usuario no verificado
  const handleLogoutUnverified = () => {
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
      setSuccessMessage(`Se ha enviado un correo a ${email} con instrucciones. Revisa tu bandeja de entrada.`);
    } catch (err: any) {
      console.error("Error sending password reset email:", err.code);
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
    setEmail(suggestion);
    setShowEmailSuggestions(false);
  };

  // NUEVO: Vista de verificación de correo
  if (needsVerification && unverifiedUser) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md animate-fade-in text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-bocado-dark-green mb-2">Correo no verificado</h2>
        <p className="text-gray-600 mb-4">
          Para continuar usando Bocado, debes verificar tu correo electrónico.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Hemos enviado un enlace a <strong>{unverifiedUser.email}</strong>. Revisa tu bandeja de entrada y spam.
        </p>
        
        {successMessage && (
          <p className="text-green-600 text-sm mb-4 bg-green-50 p-2 rounded">{successMessage}</p>
        )}
        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>
        )}

        <div className="space-y-3">
          <button
            onClick={handleResendVerification}
            disabled={isLoading}
            className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full shadow-lg hover:bg-bocado-green-light transition-colors disabled:bg-gray-400"
          >
            {isLoading ? 'Enviando...' : 'Reenviar correo de verificación'}
          </button>
          <button
            onClick={handleLogoutUnverified}
            className="w-full text-gray-500 font-medium py-2 hover:text-gray-700 transition-colors"
          >
            Usar otra cuenta
          </button>
        </div>
      </div>
    );
  }

  const renderLoginView = () => (
    <>
      <div className="text-center mb-6">
        <BocadoLogo className="w-full max-w-sm -my-16 mx-auto" />
        <h1 className="text-2xl font-bold text-bocado-dark-green mt-4">Iniciar Sesión</h1>
        <p className="text-bocado-dark-gray mt-1">Accede a tu perfil para ver tu información.</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="relative">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
            autoComplete="email"
            className={`mt-1 block w-full px-3 py-2 bg-white border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`}
            placeholder="tu@correo.com"
            disabled={isLoading}
          />
          {showEmailSuggestions && emailSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
              <ul className="max-h-60 overflow-auto">
                {emailSuggestions.map((suggestion) => (
                  <li 
                    key={suggestion}
                    onMouseDown={() => handleEmailSuggestionClick(suggestion)}
                    className="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100"
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            className={`mt-1 block w-full px-3 py-2 bg-white border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`}
            placeholder="••••••••••"
            disabled={isLoading}
          />
        </div>
        
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        
        <div>
          <button
            type="submit"
            className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-lg shadow-lg hover:bg-bocado-green-light transition-colors duration-300 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? 'Cargando...' : 'Entrar'}
          </button>
        </div>
        <div className="text-center">
            <button
                type="button"
                onClick={() => setView('reset')}
                className="text-sm text-bocado-green font-semibold hover:underline"
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
        <BocadoLogo className="w-full max-w-sm -my-16 mx-auto" />
        <h1 className="text-2xl font-bold text-bocado-dark-green mt-4">Restablecer Contraseña</h1>
        <p className="text-bocado-dark-gray mt-1">Introduce tu correo para enviarte un enlace de recuperación.</p>
      </div>
      <form onSubmit={handlePasswordReset} className="space-y-6">
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="reset-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green"
            placeholder="tu@correo.com"
            disabled={isLoading}
          />
        </div>
        
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {successMessage && <p className="text-green-600 text-sm text-center">{successMessage}</p>}

        <div>
          <button
            type="submit"
            className="w-full bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-lg shadow-lg hover:bg-bocado-green-light transition-colors duration-300 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </div>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setView('login')}
            className="text-sm text-bocado-green font-semibold hover:underline"
          >
            Volver a Iniciar Sesión
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-md animate-fade-in">
        {view === 'login' ? renderLoginView() : renderResetView()}
        <div className="mt-6 text-center">
            <button onClick={onGoHome} className="text-sm text-bocado-dark-gray hover:underline" disabled={isLoading}>
                Volver al inicio
            </button>
        </div>
    </div>
  );
};

export default LoginScreen;