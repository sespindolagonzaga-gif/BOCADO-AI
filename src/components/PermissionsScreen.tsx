import React, { useState } from 'react';
import { trackEvent } from '../firebaseConfig'; // ✅ Importar helper
import { LockIcon } from './icons/LockIcon';

interface PermissionsScreenProps {
  onAccept: () => void;
  onGoHome: () => void;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onAccept, onGoHome }) => {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    // ✅ Usar el helper trackEvent (maneja automáticamente si analytics existe o no)
    trackEvent('accept_privacy_policy', { 
      timestamp: new Date().toISOString(),
      screen: 'permissions' 
    });
    
    onAccept();
  };

  const handleGoHome = () => {
    trackEvent('reject_privacy_policy', { 
      timestamp: new Date().toISOString(),
      screen: 'permissions'
    });
    
    onGoHome();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-safe pb-safe bg-bocado-cream/50">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-bocado-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockIcon className="w-7 h-7 text-bocado-green" />
          </div>
          <h1 className="text-xl font-bold text-bocado-dark-green">Tu Privacidad</h1>
          <p className="text-sm text-bocado-gray mt-1">Antes de empezar, necesitamos tu consentimiento.</p>
        </div>
        
        <div className="text-sm text-bocado-text space-y-3 bg-bocado-background p-4 rounded-xl">
          <p>
            Usamos tu información <strong>solo para crear recomendaciones personalizadas</strong>.
          </p>
          <p className="text-bocado-gray">
            Tus datos no se comparten con terceros y están protegidos.
          </p>
        </div>

        <div className="mt-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
              className="mt-0.5 h-5 w-5 rounded border-bocado-border text-bocado-green focus:ring-bocado-green/20 transition-all"
            />
            <span className="text-xs text-bocado-text leading-relaxed select-none group-hover:text-bocado-dark-gray transition-colors">
              Acepto el uso de mis datos para personalizar mi experiencia en Bocado.
            </span>
          </label>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={handleAccept}
            disabled={!agreed}
            className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray disabled:cursor-not-allowed disabled:shadow-none"
          >
            Continuar
          </button>
          <button
            onClick={handleGoHome}
            className="w-full bg-transparent text-bocado-gray font-semibold py-3 px-6 rounded-full text-sm hover:text-bocado-dark-gray hover:bg-bocado-background/50 transition-all"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionsScreen;