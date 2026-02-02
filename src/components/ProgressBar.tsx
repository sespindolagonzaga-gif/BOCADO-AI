
import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
  const percentage = ((currentStep - 1) / (totalSteps -1)) * 100;

  return (
    <div>
      <div className="flex justify-between mb-1 text-sm text-bocado-dark-gray font-semibold">
        <span>Paso {currentStep} de {totalSteps}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="h-2.5 rounded-full transition-all duration-500 ease-out bg-bocado-green" 
          style={{ width: `${percentage}%` }}>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
