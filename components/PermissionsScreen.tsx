import React, { useState } from 'react';
import { LockIcon } from './icons/LockIcon';

interface PermissionsScreenProps {
  onAccept: () => void;
  onGoHome: () => void;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onAccept, onGoHome }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-lg animate-fade-in">
      <div className="text-center mb-6">
        <LockIcon className="w-16 h-16 text-bocado-green mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-bocado-dark-green">Tu Privacidad es Importante</h1>
        <p className="text-bocado-dark-gray mt-2">Antes de empezar, necesitamos tu consentimiento.</p>
      </div>
      <div className="text-sm text-gray-700 space-y-4">
        <p>
          En Bocado, usamos la información que nos proporcionas (como tus hábitos, objetivos y condiciones de salud) con un único propósito: <strong>crear recomendaciones nutricionales personalizadas y perfectas para ti.</strong>
        </p>
        <p>
          <strong>Tu confianza es nuestra prioridad.</strong> Nos comprometemos a proteger tus datos. No serán compartidos con terceros y solo se utilizarán para mejorar tu experiencia dentro de la aplicación.
        </p>
      </div>
      <div className="mt-8">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
            className="h-5 w-5 rounded border-gray-300 text-bocado-green focus:ring-bocado-green-light"
          />
          <span className="ml-3 text-sm text-gray-700 select-none">
            He leído y acepto el uso de mis datos para la personalización de mi experiencia en Bocado.
          </span>
        </label>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row-reverse gap-4">
        <button
          onClick={onAccept}
          disabled={!agreed}
          className="w-full bg-bocado-green text-white font-bold py-3 px-8 rounded-full shadow-md hover:bg-bocado-green-light transition-colors duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
        <button
          onClick={onGoHome}
          className="w-full bg-gray-200 text-bocado-dark-gray font-semibold py-3 px-8 rounded-full hover:bg-gray-300 transition-colors"
        >
          Volver
        </button>
      </div>
    </div>
  );
};

export default PermissionsScreen;