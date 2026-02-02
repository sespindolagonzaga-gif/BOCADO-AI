
import React from 'react';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

interface ConfirmationScreenProps {
  onGoHome: () => void;
}

const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({ onGoHome }) => {
  return (
    <div className="text-center flex flex-col items-center justify-center space-y-6 bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
        <CheckCircleIcon className="w-20 h-20 text-bocado-green"/>
      <h1 className="text-2xl md:text-3xl font-bold text-bocado-dark-green">¡Gracias por registrarte en Bocado!</h1>
      <p className="text-lg text-bocado-dark-gray max-w-md">
        Pronto conocerás las mejores opciones pensadas para ti.
      </p>
      <button
        onClick={onGoHome}
        className="bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg hover:bg-bocado-green-light transition-colors duration-300 transform hover:scale-105"
      >
        Volver al inicio
      </button>
    </div>
  );
};

export default ConfirmationScreen;
