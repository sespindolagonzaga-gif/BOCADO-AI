import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, BookOpen, User, MapPin, Home } from './icons';
import BocadoLogo from './BocadoLogo';
import { trackEvent } from '../firebaseConfig'; // ✅ Importado trackEvent
import { useTranslation } from '../contexts/I18nContext';

interface TutorialModalProps {
  onClose: () => void;
  userName?: string;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ onClose, userName }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: t('tutorial.welcome', { userName: userName ? `, ${userName}` : '' }),
      description: t('tutorial.subtitle'),
      icon: <div className="w-40 mx-auto"><BocadoLogo className="w-full" /></div>,
      color: "bg-white",
      textColor: "text-bocado-green",
      id: "welcome"
    },
    {
      title: t('tutorial.slides.rateLimit.title'),
      description: t('tutorial.slides.rateLimit.description'),
      icon: <div className="text-5xl">⏱️</div>,
      color: "bg-amber-50",
      textColor: "text-amber-900",
      id: "ratelimit"
    },
    {
      title: t('tutorial.slides.budget.title'),
      description: t('tutorial.slides.budget.description'),
      icon: <div className="text-5xl">💱</div>,
      color: "bg-green-50",
      textColor: "text-green-900",
      id: "budget"
    },
    {
      title: t('tutorial.slides.favorites.title'),
      description: t('tutorial.slides.favorites.description'),
      icon: <div className="text-5xl">❤️</div>,
      color: "bg-red-50",
      textColor: "text-red-900",
      id: "favorites"
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-safe animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="bg-white rounded-3xl shadow-bocado w-full max-w-sm overflow-visible flex flex-col max-h-[90vh]">
        
        {/* Visual Area */}
        <div className={`${content.color} h-48 flex items-center justify-center transition-colors duration-300 shrink-0`}>
          <div className={`text-white transform transition-transform duration-300 ${currentStep === 0 ? 'scale-100' : 'scale-110'}`}>
            {content.icon}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 text-center flex-1 flex flex-col justify-between overflow-y-auto">
          <div>
            <h2 id="tutorial-title" className={`text-xl font-bold mb-3 ${content.textColor}`}>{content.title}</h2>
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
              {currentStep === steps.length - 1 ? t('tutorial.start') : t('tutorial.next')}
            </button>
            
            {currentStep < steps.length - 1 && (
              <button 
                onClick={handleSkip}
                className="mt-3 text-xs text-bocado-gray font-medium hover:text-bocado-dark-gray transition-colors"
              >
                {t('tutorial.skip')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
