
import React, { useState, useMemo } from 'react';
import { FormStepProps } from './FormStepProps';
import { ACTIVITY_LEVELS, ACTIVITY_FREQUENCIES, FOOD_CATEGORIES } from '../../constants';
import { FormData } from '../../types';
import { MeatIcon } from '../icons/MeatIcon';
import { FishIcon } from '../icons/FishIcon';
import { DairyIcon } from '../icons/DairyIcon';
import { VegetableIcon } from '../icons/VegetableIcon';
import { FruitIcon } from '../icons/FruitIcon';
import { GrainsIcon } from '../icons/GrainsIcon';
import { NutsIcon } from '../icons/NutsIcon';
import { SpicesIcon } from '../icons/SpicesIcon';

const categoryIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'Carnes y Aves': MeatIcon,
  'Pescados y Mariscos': FishIcon,
  'Lácteos y Huevos': DairyIcon,
  'Vegetales y Hortalizas': VegetableIcon,
  'Frutas': FruitIcon,
  'Legumbres, Granos y Tubérculos': GrainsIcon,
  'Frutos Secos y Semillas': NutsIcon,
  'Hierbas, Especias y Condimentos': SpicesIcon,
};

const Step4: React.FC<FormStepProps> = ({ data, updateData, errors }) => {
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customFoodInput, setCustomFoodInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const dislikedFoods: string[] = (Array.isArray(data.dislikedFoods) ? data.dislikedFoods : [])
    .filter((item): item is string => typeof item === 'string');

  const handleSelect = (field: keyof FormData, value: string) => {
    updateData(field, value);
    if (field === 'activityLevel') {
        if (value === '🪑 Sedentario') {
          updateData('activityFrequency', '');
        }
        if (value !== 'Otro') {
          updateData('otherActivityLevel', '');
        }
    }
  };

  const handleToggleDislike = (food: string) => {
    const newDislikes = dislikedFoods.includes(food)
      ? dislikedFoods.filter(item => item !== food)
      : [...dislikedFoods, food];
    updateData('dislikedFoods', newDislikes);
  };
  
  const handleAddCustomFood = () => {
    const trimmedInput = customFoodInput.trim();
    if (trimmedInput && !dislikedFoods.find(food => food.toLowerCase() === trimmedInput.toLowerCase())) {
        handleToggleDislike(trimmedInput);
        setCustomFoodInput('');
        setShowCustomInput(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) {
      return FOOD_CATEGORIES;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered: Record<string, string[]> = {};

    for (const category in FOOD_CATEGORIES) {
      const matchingFoods = FOOD_CATEGORIES[category].filter(food =>
        food.toLowerCase().includes(lowercasedFilter)
      );
      if (matchingFoods.length > 0) {
        filtered[category] = matchingFoods;
      }
    }
    return filtered;
  }, [searchTerm]);
  
  const customDislikes = dislikedFoods.filter(food => 
    !Object.values(FOOD_CATEGORIES).reduce((acc, val) => acc.concat(val), []).includes(food)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <h2 className="text-2xl font-bold text-bocado-dark-green text-center">Actividad y Preferencias</h2>
      
      {/* Activity Sections */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-3">Actividad física</label>
        <div className="flex flex-wrap gap-2">
            {ACTIVITY_LEVELS.map(level => (
                <button key={level} type="button" onClick={() => handleSelect('activityLevel', level)} className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors duration-200 ${data.activityLevel === level ? 'bg-bocado-green text-white border-bocado-green' : 'bg-white text-gray-700 border-gray-300 hover:border-bocado-green'}`}>
                    {level}
                </button>
            ))}
        </div>
        {data.activityLevel === 'Otro' && (
            <div className="w-full mt-4">
                <input
                  type="text"
                  value={data.otherActivityLevel || ''}
                  onChange={(e) => updateData('otherActivityLevel', e.target.value)}
                  placeholder="Ej: Yoga, Crossfit, Baile..."
                  className={`mt-1 block w-full px-3 py-2 bg-white border ${errors.otherActivityLevel ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green`}
                />
            </div>
        )}
      </div>

      <div>
        <label className={`block text-lg font-medium mb-3 transition-colors ${data.activityLevel === '🪑 Sedentario' ? 'text-gray-400' : 'text-gray-700'}`}>Frecuencia</label>
        <div className="flex flex-wrap gap-2">
            {ACTIVITY_FREQUENCIES.map(freq => (
                <button 
                    key={freq} 
                    type="button" 
                    onClick={() => handleSelect('activityFrequency', freq)} 
                    disabled={data.activityLevel === '🪑 Sedentario'}
                    className={`px-4 py-2 rounded-full border text-sm font-semibold transition-colors duration-200 ${data.activityFrequency === freq ? 'bg-bocado-green text-white border-bocado-green' : 'bg-white text-gray-700 border-gray-300 hover:border-bocado-green'} disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200`}
                >
                    {freq}
                </button>
            ))}
        </div>
      </div>

      {/* Disliked Foods Section */}
      <div>
        <label className="block text-lg font-bold text-gray-800">Ingredientes que NO te gustan 🚫</label>
        <p className="text-sm text-gray-500 mb-3">Selecciona los alimentos que quieres que evitemos en tus planes.</p>
        
        <div className="relative mb-4">
            <input
                type="text"
                placeholder="Busca un alimento para filtrar categorías..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-full focus:ring-bocado-green focus:border-bocado-green"
            />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.keys(filteredCategories).map(category => {
            const Icon = categoryIcons[category];
            const dislikedCount = dislikedFoods.filter(food => FOOD_CATEGORIES[category]?.includes(food)).length;
            
            return (
              <button
                key={category}
                type="button"
                onClick={() => setModalCategory(category)}
                className="relative flex flex-col items-center justify-center p-4 text-center bg-white border-2 border-gray-200 rounded-xl hover:border-bocado-green hover:shadow-md transition-all duration-200 aspect-square"
              >
                {Icon && <Icon className="w-10 h-10 text-bocado-green mb-2"/>}
                <span className="font-semibold text-sm text-bocado-dark-gray">{category}</span>
                {dislikedCount > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {dislikedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        <div className="mt-4">
            {customDislikes.length > 0 && (
                 <div className="mb-2 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Añadidos manualmente:</p>
                    <div className="flex flex-wrap gap-2">
                    {customDislikes.map(food => (
                        <button key={food} type="button" onClick={() => handleToggleDislike(food)} className="px-3 py-1.5 rounded-full border text-sm font-medium bg-red-500 text-white border-red-500">
                            {food} &times;
                        </button>
                    ))}
                    </div>
                </div>
            )}
            {showCustomInput ? (
                 <div className="flex gap-2">
                    <input
                        type="text"
                        value={customFoodInput}
                        onChange={(e) => setCustomFoodInput(e.target.value)}
                        placeholder="Escribe un ingrediente..."
                        className="flex-grow block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-bocado-green focus:border-bocado-green"
                    />
                    <button type="button" onClick={handleAddCustomFood} className="px-4 py-2 bg-bocado-green text-white font-semibold rounded-md hover:bg-bocado-green-light">Añadir</button>
                 </div>
            ) : (
                <button type="button" onClick={() => setShowCustomInput(true)} className="text-sm text-bocado-green font-semibold hover:underline">
                    + Añadir otro...
                </button>
            )}
        </div>
      </div>

      {modalCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg">
                <h3 className="text-xl font-bold text-bocado-dark-green mb-4">{modalCategory}</h3>
                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-2">
                    {FOOD_CATEGORIES[modalCategory].map(food => (
                         <button key={food} type="button" onClick={() => handleToggleDislike(food)} className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors duration-200 ${dislikedFoods.includes(food) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-800 border-gray-300 hover:border-red-400 hover:text-red-500'}`}>
                            {food}
                        </button>
                    ))}
                </div>
                <div className="text-right mt-6">
                    <button onClick={() => setModalCategory(null)} className="px-6 py-2 rounded-full font-semibold bg-gray-200 text-bocado-dark-gray hover:bg-gray-300">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Step4;