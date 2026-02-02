
import React, { useState } from 'react';
import BocadoLogo from './BocadoLogo';
import { db, auth } from '../firebaseConfig';
import { EMAIL_DOMAINS } from '../constants';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { sanitizeProfileData } from '../utils/profileSanitizer';

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, introduce tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    const lowercasedEmail = email.toLowerCase();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, lowercasedEmail, password);
      const user = userCredential.user;

      // Fetch user profile from Firestore using UID
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const firestoreData = userDoc.data();
        const displayName = user.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const combinedData = { ...firestoreData, firstName, lastName, email: user.email };
        const fullProfileData = sanitizeProfileData(combinedData); // Usar la utilidad centralizada

        localStorage.setItem('bocado-profile-data', JSON.stringify(fullProfileData));
        onLoginSuccess();
      } else {
        // This case might happen if registration via cloud function fails after auth creation
        setError('No se encontró un perfil asociado a este usuario. Por favor, intenta registrarte de nuevo.');
        auth.signOut();
      }
    } catch (err: any) {
      console.error("Error logging in:", err.code);
      if (['auth/network-request-failed', 'auth/unavailable'].includes(err.code)) {
        setError('Error de red. No pudimos conectar con el servidor. Por favor, revisa tu conexión a internet.');
      } else if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(err.code)) {
        setError('Correo electrónico o contraseña incorrectos.');
      } else {
        setError('Hubo un problema al iniciar sesión. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
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
          <label htmlFor="password" a--="block text-sm font-medium text-gray-700">
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
