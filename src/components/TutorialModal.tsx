import React, { useState, useEffect } from 'react';
import { RestaurantIcon } from './icons/RestaurantIcon';
import { BookIcon } from './icons/BookIcon';
import { UserIcon } from './icons/UserIcon';
import { LocationIcon } from './icons/LocationIcon';
import { HomeIcon } from './icons/HomeIcon';
import BocadoLogo from './BocadoLogo';
import { trackEvent } from '../firebaseConfig'; // ✅ Importado trackEvent

interface TutorialModalProps {
  onClose: () => void;
  userName?: string;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ onClose, userName }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: `¡Bienvenido${userName ? ', ' + userName : ''}!`,
      description: "Tu asistente inteligente de nutrición. Te mostramos cómo usar la app en 5 pasos.",
      icon: <div className="w-32 h-20"><BocadoLogo className="w-full h-full" /></div>,
      color: "bg-white",
      textColor: "text-bocado-green",
      id: "welcome"
    },
    {
      title: "1. Inicio",
      description: "Elige si comes en casa o fuera. La IA genera tu plan personalizado al instante.",
      icon: <HomeIcon className="w-16 h-16" />,
      color: "bg-bocado-green",
      textColor: "text-white",
      id: "home"
    },
    {
      title: "2. Mi Cocina",
      description: "Gestiona tu inventario. Toca ingredientes para su estado de frescura: 🟢 fresco, 🟡 por caducar, y 🔴 urgente.",
      icon: <RestaurantIcon className="w-16 h-16" />,
      color: "bg-bocado-dark-green",
      textColor: "text-white",
      id: "pantry"
    },
    {
      title: "3. Mis Recetas",
      description: "Guarda recetas con ❤️ para cocinarlas cuando quieras.",
      icon: <BookIcon className="w-16 h-16" />,
      color: "bg-bocado-green-light",
      textColor: "text-white",
      id: "recipes"
    },
    {
      title: "4. Mis Lugares",
      description: "Guarda restaurantes saludables recomendados al comer fuera.",
      icon: <LocationIcon className="w-16 h-16" />,
      color: "bg-bocado-dark-gray",
      textColor: "text-white",
      id: "restaurants"
    },
    {
      title: "5. Perfil",
      description: "Mantén tus datos actualizados para mejores recomendaciones.",
      icon: <UserIcon className="w-16 h-16" />,
      color: "bg-bocado-background",
      textColor: "text-bocado-dark-green",
      id: "profile"
    }
  ];

  // ✅ ANALÍTICA: Trackeo de inicio y progreso de pasos
  useEffect(() => {
    trackEvent('tutorial_step_view', {
      step_index: currentStep,
      step_id: steps[currentStep].id
    });
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // ✅ ANALÍTICA: Tutorial completado hasta el final
      trackEvent('tutorial_finished');
      onClose();
    }
  };

  const handleSkip = () => {
    // ✅ ANALÍTICA: Usuario saltó el tutorial
    trackEvent('tutorial_skipped', {
      at_step: currentStep,
      step_id: steps[currentStep].id
    });
    onClose();
  };

  const handleDotClick = (index: number) => {
    // ✅ ANALÍTICA: Navegación manual por puntos
    trackEvent('tutorial_dot_navigation', {
      from_step: currentStep,
      to_step: index
    });
    setCurrentStep(index);
  };

  const content = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-bocado w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Visual Area */}
        <div className={`${content.color} h-48 flex items-center justify-center transition-colors duration-300 shrink-0`}>
          <div className={`text-white transform transition-transform duration-300 ${currentStep === 0 ? 'scale-100' : 'scale-110'}`}>
            {content.icon}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 text-center flex-1 flex flex-col justify-between overflow-y-auto">
          <div>
            <h2 className={`text-xl font-bold mb-3 ${content.textColor}`}>{content.title}</h2>
            <p className="text-bocado-gray leading-relaxed text-sm">
              {content.description}
            </p>
          </div>

          <div className="mt-6">
            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mb-4">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`h-2 rounded-full transition-all duration-200 ${index === currentStep ? 'w-6 bg-bocado-green' : 'w-2 bg-bocado-border hover:bg-bocado-gray'}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              {currentStep === steps.length - 1 ? '¡Comenzar!' : 'Siguiente'}
            </button>
            
            {currentStep < steps.length - 1 && (
              <button 
                onClick={handleSkip}
                className="mt-3 text-xs text-bocado-gray font-medium hover:text-bocado-dark-gray transition-colors"
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