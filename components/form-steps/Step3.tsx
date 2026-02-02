import React from 'react';
import { FormStepProps } from './FormStepProps';
import { DISEASES, ALLERGIES, GOALS } from '../../constants';

const MultiSelectButton: React.FC<{
  option: string;
  selected: boolean;
  onToggle: () => void;
}> = ({ option, selected, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors duration-200 ${
      selected 
      ? 'bg-bocado-green text-white border-bocado-green' 
      : 'bg-white text-gray-700 border-gray-300 hover:border-bocado-green'
    }`}
  >
    {option}
  </button>
);


const Step3: React.FC<FormStepProps> = ({ data, updateData, errors }) => {
    const toggleSelection = (field: 'diseases' | 'allergies', value: string) => {
        const currentValues = data[field] as string[];
        const newValues = currentValues.includes(value)
            ? currentValues.filter(item => item !== value)
            : [...currentValues, value];
        updateData(field, newValues);

        if (field === 'allergies' && value === 'Otro' && !newValues.includes('Otro')) {
            updateData('otherAllergies', '');
        }
    };

    const toggleNutritionalGoal = (goal: string) => {
        let currentGoals = Array.isArray(data.nutritionalGoal) ? [...data.nutritionalGoal] : [];
        const isSelected = currentGoals.includes(goal);
        
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
    <div className="space-y-8 animate-fade-in">
      <h2 className="text-2xl font-bold text-bocado-dark-green text-center">Datos de salud</h2>

      <div>
        <label className="block text-lg font-medium text-gray-700 mb-3">¿Tienes alguna de estas enfermedades crónicas? <span className="text-sm font-normal text-gray-500">(opcional)</span></label>
        <div className="flex flex-wrap gap-2">
          {DISEASES.map(disease => (
            <MultiSelectButton key={disease} option={disease} selected={data.diseases.includes(disease)} onToggle={() => toggleSelection('diseases', disease)} />
          ))}
        </div>
      </div>
      
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-3">¿Tienes alguna intolerancia, preferencia o alergia? <span className="text-sm font-normal text-gray-500">(opcional)</span></label>
        <div className="flex flex-wrap gap-2">
          {ALLERGIES.map(allergy => (
            <MultiSelectButton key={allergy} option={allergy} selected={data.allergies.includes(allergy)} onToggle={() => toggleSelection('allergies', allergy)} />
          ))}
        </div>
        {data.allergies.includes('Otro') && (
            <div className="w-full mt-4">
                <label htmlFor="otherAllergies" className="block text-sm font-medium text-gray-700">
                  Por favor, especifica cuáles:
                </label>
                <input
                  type="text"
                  id="otherAllergies"
                  name="otherAllergies"
                  value={data.otherAllergies || ''}
                  onChange={(e) => updateData('otherAllergies', e.target.value)}
                  placeholder="Ej: Mariscos, carne de res, frutas..."
                  className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.otherAllergies ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`}
                />
                {errors.otherAllergies && <p className="text-red-500 text-xs mt-1">{errors.otherAllergies}</p>}
            </div>
        )}
      </div>

      <div>
        <label className="block text-lg font-medium text-gray-700 mb-3">Objetivo nutricional <span className="text-sm font-normal text-gray-500">(Puedes seleccionar más de uno)</span></label>
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
        {errors.nutritionalGoal && <p className="text-red-500 text-xs mt-2">{errors.nutritionalGoal}</p>}
      </div>

    </div>
  );
};

export default Step3;