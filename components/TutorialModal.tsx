import React, { useState } from 'react';
import { RestaurantIcon } from './icons/RestaurantIcon';
import { BookIcon } from './icons/BookIcon';
import { UserIcon } from './icons/UserIcon';
import { LocationIcon } from './icons/LocationIcon';
import { HomeIcon } from './icons/HomeIcon';
import BocadoLogo from './BocadoLogo';

interface TutorialModalProps {
  onClose: () => void;
  userName?: string;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ onClose, userName }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: `¡Bienvenido a Bocado${userName ? ', ' + userName : ''}!`,
      description: "Tu asistente inteligente de nutrición. Déjanos mostrarte cómo moverte por la app en 5 sencillos pasos.",
      icon: <BocadoLogo className="w-40 -my-4 mx-auto" />,
      color: "bg-white",
      textColor: "text-bocado-green",
      iconColor: "text-bocado-green"
    },
    {
      title: "1. Inicio (Tu Plan)",
      description: "Al centro encontrarás la casita. Aquí eliges si comerás en casa o fuera y la IA generará tu plan personalizado al instante.",
      icon: <HomeIcon className="w-20 h-20" />,
      color: "bg-bocado-green",
      textColor: "text-white",
      iconColor: "text-white"
    },
    {
      title: "2. Mi Cocina",
      description: "Aquí gestionas tu inventario (Despensa, Nevera, Congelador). Toca cada ingrediente para cambiar su estado de frescura: 🟢 fresco, 🟡 por caducar, y 🔴 urgente.",
      icon: <RestaurantIcon className="w-20 h-20" />,
      color: "bg-bocado-dark-green",
      textColor: "text-white",
      iconColor: "text-white"
    },
    {
      title: "3. Mis Recetas",
      description: "¿Te gustó una receta del plan? Guárdala con el corazón ❤️. Aparecerá aquí para que puedas cocinarla cuando quieras.",
      icon: <BookIcon className="w-20 h-20" />,
      color: "bg-bocado-green-light",
      textColor: "text-white",
      iconColor: "text-white"
    },
    {
      title: "4. Mis Lugares",
      description: "Guarda las recomendaciones de restaurantes saludables que descubras al elegir 'Comer Fuera'. ¡Ten a la mano tus sitios favoritos!",
      icon: <LocationIcon className="w-20 h-20" />,
      color: "bg-bocado-dark-gray",
      textColor: "text-white",
      iconColor: "text-white"
    },
    {
      title: "5. Tu Perfil",
      description: "Mantén tus datos actualizados aquí para que las recomendaciones sigan ajustándose a tus objetivos o cambios de salud.",
      icon: <UserIcon className="w-20 h-20" />,
      color: "bg-gray-100",
      textColor: "text-bocado-dark-green",
      iconColor: "text-bocado-green"
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const content = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative flex flex-col">
        
        {/* Header / Visual Area */}
        <div className={`${content.color} h-64 flex items-center justify-center transition-colors duration-500 ease-in-out`}>
            <div className={`transform transition-transform duration-500 scale-110 ${content.iconColor || 'text-white'}`}>
                {content.icon}
            </div>
        </div>

        {/* Content Area */}
        <div className="p-8 text-center flex-1 flex flex-col justify-between">
            <div>
                <h2 className={`text-2xl font-bold mb-4 ${currentStep === 0 ? 'text-bocado-green' : 'text-bocado-dark-green'}`}>{content.title}</h2>
                <p className="text-gray-600 leading-relaxed text-sm">
                    {content.description}
                </p>
            </div>

            <div className="mt-8">
                {/* Progress Dots */}
                <div className="flex justify-center gap-2 mb-6">
                    {steps.map((_, index) => (
                        <div 
                            key={index} 
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentStep ? 'w-6 bg-bocado-green' : 'w-2 bg-gray-300'}`}
                        />
                    ))}
                </div>

                <button
                    onClick={handleNext}
                    className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-bocado-green-light transition-transform transform hover:scale-105"
                >
                    {currentStep === steps.length - 1 ? '¡Comenzar!' : 'Siguiente'}
                </button>
                
                {currentStep < steps.length - 1 && (
                    <button 
                        onClick={onClose}
                        className="mt-3 text-sm text-gray-400 font-medium hover:text-gray-600"
                    >
                        Saltar tutorial
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;