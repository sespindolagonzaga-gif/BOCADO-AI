import React from 'react';
import { FormStepProps } from './FormStepProps';
import { DISEASES, ALLERGIES, GOALS } from '../../constants';
import { trackEvent } from '../../firebaseConfig'; // ✅ Importado trackEvent

const MultiSelectButton: React.FC<{
  option: string;
  selected: boolean;
  onToggle: () => void;
}> = ({ option, selected, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`px-3 py-2 rounded-full border text-xs font-bold transition-all duration-200 active:scale-95 ${
      selected 
        ? 'bg-bocado-green text-white border-bocado-green shadow-sm' 
        : 'bg-white text-bocado-dark-gray border-bocado-border hover:border-bocado-green/50'
    }`}
  >
    {option}
  </button>
);

const Step2: React.FC<FormStepProps> = ({ data, updateData, errors }) => {
  const toggleSelection = (field: 'diseases' | 'allergies', value: string) => {
    const currentValues = data[field] as string[];
    const isSelecting = !currentValues.includes(value);

    // ✅ ANALÍTICA: Tracking de selección de salud
    trackEvent(`registration_${field}_toggle`, { 
      value, 
      action: isSelecting ? 'select' : 'deselect' 
    });

    const newValues = isSelecting
      ? [...currentValues, value]
      : currentValues.filter(item => item !== value);
    
    updateData(field, newValues);

    if (field === 'allergies' && value === 'Otro' && !newValues.includes('Otro')) {
      updateData('otherAllergies', '');
    }
  };

  const toggleNutritionalGoal = (goal: string) => {
    let currentGoals = Array.isArray(data.nutritionalGoal) ? [...data.nutritionalGoal] : [];
    const isSelected = currentGoals.includes(goal);

    // ✅ ANALÍTICA: Tracking de objetivos
    trackEvent('registration_goal_toggle', { 
      goal, 
      action: !isSelected ? 'select' : 'deselect' 
    });
    
    if (isSelected) {
      currentGoals = currentGoals.filter(item => item !== goal);
    } else {
      currentGoals.push(goal);
      if (goal === 'Bajar de peso') {
        currentGoals = currentGoals.filter(item => item !== 'Subir de peso');
      } else if (goal === 'Subir de peso') {
        currentGoals = currentGoals.filter(item => item !== 'Bajar de peso');
      }
    }
    updateData('nutritionalGoal', currentGoals);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Enfermedades */}
      <div>
        <label className="block text-[10px] font-bold text-bocado-dark-gray mb-2 uppercase tracking-wider">
          ¿Enfermedades crónicas? <span className="text-bocado-gray font-normal normal-case">(opcional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DISEASES.map(disease => (
            <MultiSelectButton 
              key={disease} 
              option={disease} 
              selected={data.diseases.includes(disease)} 
              onToggle={() => toggleSelection('diseases', disease)} 
            />
          ))}
        </div>
      </div>
      
      {/* Alergias */}
      <div>
        <label className="block text-[10px] font-bold text-bocado-dark-gray mb-2 uppercase tracking-wider">
          ¿Alergias o intolerancias? <span className="text-bocado-gray font-normal normal-case">(opcional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ALLERGIES.map(allergy => (
            <MultiSelectButton 
              key={allergy} 
              option={allergy} 
              selected={data.allergies.includes(allergy)} 
              onToggle={() => toggleSelection('allergies', allergy)} 
            />
          ))}
        </div>
        
        {data.allergies.includes('Otro') && (
          <div className="mt-3">
            <label className="block text-[10px] font-medium text-bocado-dark-gray mb-1">
              Especifica:
            </label>
            <input
              type="text"
              value={data.otherAllergies || ''}
              onChange={(e) => updateData('otherAllergies', e.target.value)}
              onBlur={() => trackEvent('registration_other_allergies_input')} // ✅ Analítica
              placeholder="Mariscos, frutos secos..."
              className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                errors.otherAllergies ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              }`}
            />
            {errors.otherAllergies && <p className="text-red-500 text-[10px] mt-1">{errors.otherAllergies}</p>}
          </div>
        )}
      </div>

      {/* Objetivos */}
      <div>
        <label className="block text-[10px] font-bold text-bocado-dark-gray mb-2 uppercase tracking-wider">
          Objetivo nutricional *
        </label>
        <div className="flex flex-wrap gap-2">
          {GOALS.map(goal => (
            <MultiSelectButton 
              key={goal} 
              option={goal} 
              selected={data.nutritionalGoal.includes(goal)} 
              onToggle={() => toggleNutritionalGoal(goal)} 
            />
          ))}
        </div>
        {errors.nutritionalGoal && <p className="text-red-500 text-[10px] mt-2">{errors.nutritionalGoal}</p>}
        <p className="text-[10px] text-bocado-gray mt-2">Puedes seleccionar varios (excepto subir/bajar peso juntos)</p>
      </div>
    </div>
  );
};

export default Step2;