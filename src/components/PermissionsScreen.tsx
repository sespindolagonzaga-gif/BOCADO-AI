import React, { useState } from 'react';
import { trackEvent } from '../firebaseConfig';
import { LockIcon } from './icons/LockIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { EyeIcon } from './icons/EyeIcon';
import { TrashIcon } from './icons/TrashIcon';

interface PermissionsScreenProps {
  onAccept: () => void;
  onGoHome: () => void;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onAccept, onGoHome }) => {
  const [agreed, setAgreed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleAccept = () => {
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

  const dataItems = [
    { icon: '📊', label: 'Perfil nutricional', desc: 'Edad, peso, altura, objetivos' },
    { icon: '🍎', label: 'Preferencias', desc: 'Alergias, alimentos que no te gustan' },
    { icon: '📍', label: 'Ubicación', desc: 'Solo tu país y ciudad para precios locales' },
  ];

  const benefits = [
    { icon: <ShieldCheckIcon className="w-5 h-5" />, text: 'Tus datos nunca se venden a terceros' },
    { icon: <EyeIcon className="w-5 h-5" />, text: 'Puedes ver y descargar tus datos cuando quieras' },
    { icon: <TrashIcon className="w-5 h-5" />, text: 'Puedes eliminar tu cuenta y datos en cualquier momento' },
  ];

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-8 pt-safe pb-safe">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-bocado-green/20 to-bocado-green/5 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <LockIcon className="w-8 h-8 text-bocado-green" />
          </div>
          <h1 className="text-2xl font-bold text-bocado-dark-green mb-2">
            Protegemos tu privacidad
          </h1>
          <p className="text-sm text-bocado-gray">
            Para darte recomendaciones personalizadas, necesitamos usar algunos datos tuyos.
          </p>
        </div>

        {/* Qué datos usamos */}
        <div className="mb-5">
          <h2 className="text-xs font-bold text-bocado-dark-gray uppercase tracking-wider mb-3">
            ¿Qué datos usamos?
          </h2>
          <div className="space-y-2">
            {dataItems.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 p-3 bg-bocado-background/50 rounded-xl"
              >
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-bocado-text">{item.label}</p>
                  <p className="text-xs text-bocado-gray">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tus derechos */}
        <div className="mb-5">
          <h2 className="text-xs font-bold text-bocado-dark-gray uppercase tracking-wider mb-3">
            Tienes el control total
          </h2>
          <div className="space-y-2">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-bocado-text">
                <span className="text-bocado-green mt-0.5 flex-shrink-0">{benefit.icon}</span>
                <span>{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expandible: Más detalles */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-xs text-bocado-green font-medium mb-5 hover:underline flex items-center justify-center gap-1"
        >
          {showDetails ? 'Ver menos' : 'Ver política de privacidad completa'}
          <span className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showDetails && (
          <div className="mb-5 p-4 bg-gray-50 rounded-xl text-xs text-bocado-gray space-y-2 animate-fade-in">
            <p>
              <strong>Responsable:</strong> Bocado AI
            </p>
            <p>
              <strong>Finalidad:</strong> Personalizar recomendaciones de recetas y restaurantes según tu perfil nutricional.
            </p>
            <p>
              <strong>Legitimación:</strong> Tu consentimiento explícito.
            </p>
            <p>
              <strong>Conservación:</strong> Hasta que elimines tu cuenta.
            </p>
            <p>
              <strong>Derechos:</strong> Acceder, rectificar, eliminar tus datos.
            </p>
          </div>
        )}

        {/* Checkbox mejorado */}
        <div 
          onClick={() => setAgreed(!agreed)}
          className={`mb-5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            agreed 
              ? 'border-bocado-green bg-bocado-green/5' 
              : 'border-bocado-border hover:border-bocado-green/50'
          }`}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <div className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              agreed 
                ? 'bg-bocado-green border-bocado-green' 
                : 'border-bocado-border'
            }`}>
              {agreed && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-bocado-text leading-relaxed select-none">
              Entiendo y acepto que Bocado use mis datos para crear recomendaciones personalizadas. He leído y acepto la{' '}
              <a 
                href="/privacy" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-bocado-green hover:underline font-medium"
              >
                política de privacidad
              </a>.
            </span>
          </label>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={!agreed}
            className="w-full bg-bocado-green text-white font-bold py-3.5 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray/50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
          >
            <span>Continuar</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <button
            onClick={handleGoHome}
            className="w-full bg-white border-2 border-bocado-border text-bocado-gray font-semibold py-3 px-6 rounded-full text-sm hover:border-bocado-dark-gray hover:text-bocado-dark-gray transition-all"
          >
            No acepto, volver al inicio
          </button>
        </div>

        {/* Footer de confianza */}
        <div className="mt-6 flex items-center justify-center gap-1 text-xs text-bocado-gray">
          <ShieldCheckIcon className="w-4 h-4 text-bocado-green" />
          <span>Tus datos están encriptados y protegidos</span>
        </div>
      </div>
    </div>
  );
};

export default PermissionsScreen;
