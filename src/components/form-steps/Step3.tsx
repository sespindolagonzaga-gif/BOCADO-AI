import React, { useState, useMemo } from 'react';
import { FormStepProps } from './FormStepProps';
import { ACTIVITY_LEVELS, ACTIVITY_FREQUENCIES, FOOD_CATEGORIES } from '../../constants';
import { FormData } from '../../types';
import { MeatIcon, FishIcon, DairyIcon, VegetableIcon, FruitIcon, GrainsIcon, NutsIcon, SpicesIcon } from '../icons';
import { trackEvent } from '../../firebaseConfig'; // ✅ Importado trackEvent
import { useTranslation } from '../../contexts/I18nContext';

// Funciones de traducción para las opciones
const translateActivityLevel = (level: string, t: (key: string) => string): string => {
  const map: Record<string, string> = {
    '🪑 Sedentario': `🪑 ${t('activityLevels.sedentary')}`,
    '🚶‍♂️ Activo ligero': `🚶‍♂️ ${t('activityLevels.lightlyActive')}`,
    '🏋️‍♀️ Fuerza': `🏋️‍♀️ ${t('activityLevels.strength')}`,
    '🏃‍♂️ Cardio': `🏃‍♂️ ${t('activityLevels.cardio')}`,
    '⚽ Deportivo': `⚽ ${t('activityLevels.athletic')}`,
    '🥇 Atleta': `🥇 ${t('activityLevels.athlete')}`,
    'Otro': t('activityLevels.other')
  };
  return map[level] || level;
};

const translateActivityFrequency = (freq: string, t: (key: string) => string): string => {
  const map: Record<string, string> = {
    'Diario': t('activityFrequencies.daily'),
    '3-5 veces por semana': t('activityFrequencies.frequent'),
    '1-2 veces': t('activityFrequencies.occasional'),
    'Rara vez': t('activityFrequencies.rarely')
  };
  return map[freq] || freq;
};

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

const Step3: React.FC<FormStepProps> = ({ data, updateData, errors }) => {
  const { t } = useTranslation();
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customFoodInput, setCustomFoodInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const dislikedFoods: string[] = (Array.isArray(data.dislikedFoods) ? data.dislikedFoods : [])
    .filter((item): item is string => typeof item === 'string');

  const handleSelect = (field: keyof FormData, value: string) => {
    // ✅ ANALÍTICA: Tracking de actividad física
    trackEvent(`registration_${field}_select`, { value });
    
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
    const isAdding = !dislikedFoods.includes(food);
    
    // ✅ ANALÍTICA: Tracking de alimentos rechazados
    trackEvent('registration_disliked_food_toggle', { 
      food, 
      action: isAdding ? 'add' : 'remove' 
    });

    const newDislikes = isAdding
      ? [...dislikedFoods, food]
      : dislikedFoods.filter(item => item !== food);
    updateData('dislikedFoods', newDislikes);
  };
  
  const handleAddCustomFood = () => {
    const trimmedInput = customFoodInput.trim();
    if (trimmedInput && !dislikedFoods.find(food => food.toLowerCase() === trimmedInput.toLowerCase())) {
      // ✅ ANALÍTICA: Tracking de alimentos añadidos manualmente
      trackEvent('registration_custom_dislike_added', { food: trimmedInput });
      
      handleToggleDislike(trimmedInput);
      setCustomFoodInput('');
      setShowCustomInput(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return FOOD_CATEGORIES;
    
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered: Record<string, string[]> = {};

    for (const category in FOOD_CATEGORIES) {
      const matchingFoods = FOOD_CATEGORIES[category].filter(food =>
        food.toLowerCase().includes(lowercasedFilter)
      );
      if (matchingFoods.length > 0) filtered[category] = matchingFoods;
    }
    return filtered;
  }, [searchTerm]);
  
  const customDislikes = dislikedFoods.filter(food => 
    !Object.values(FOOD_CATEGORIES).reduce((acc, val) => acc.concat(val), []).includes(food)
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Actividad */}
      <div>
        <label className="block text-2xs font-bold text-bocado-dark-gray mb-2 uppercase tracking-wider">
          {t('step3.activityLevel')}
        </label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_LEVELS.map(level => (
            <button 
              key={level} 
              type="button" 
              onClick={() => handleSelect('activityLevel', level)} 
              className={`px-3 py-2 rounded-full border text-xs font-bold transition-all duration-200 active:scale-95 ${
                data.activityLevel === level 
                  ? 'bg-bocado-green text-white border-bocado-green shadow-sm' 
                  : 'bg-white text-bocado-dark-gray border-bocado-border hover:border-bocado-green/50'
              }`}
            >
              {translateActivityLevel(level, t)}
            </button>
          ))}
        </div>
        
        {data.activityLevel === 'Otro' && (
          <div className="mt-3">
            <input
              type="text"
              value={data.otherActivityLevel || ''}
              onChange={(e) => updateData('otherActivityLevel', e.target.value)}
              onBlur={() => trackEvent('registration_custom_activity_input')} // ✅ Analítica
              placeholder={t('step3.activityPlaceholder')}
              className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                errors.otherActivityLevel ? 'border-red-300 bg-red-50' : 'border-bocado-border focus:border-bocado-green focus:outline-none'
              }`}
            />
          </div>
        )}
      </div>

      {/* Frecuencia */}
      <div>
        <label className={`block text-2xs font-bold mb-2 uppercase tracking-wider transition-colors ${
          data.activityLevel === '🪑 Sedentario' ? 'text-bocado-gray' : 'text-bocado-dark-gray'
        }`}>
          {t('step3.frequency')}
        </label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_FREQUENCIES.map(freq => (
            <button 
              key={freq} 
              type="button" 
              onClick={() => handleSelect('activityFrequency', freq)} 
              disabled={data.activityLevel === '🪑 Sedentario'}
              className={`px-3 py-2 rounded-full border text-xs font-bold transition-all duration-200 active:scale-95 ${
                data.activityFrequency === freq 
                  ? 'bg-bocado-green text-white border-bocado-green shadow-sm' 
                  : 'bg-white text-bocado-dark-gray border-bocado-border hover:border-bocado-green/50'
              } disabled:bg-bocado-background disabled:text-bocado-gray disabled:border-bocado-border disabled:cursor-not-allowed`}
            >
              {translateActivityFrequency(freq, t)}
            </button>
          ))}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredientes que no le gustan */}
      <div>
        <label className="block text-2xs font-bold text-bocado-dark-gray uppercase tracking-wider mb-1">
          {t('step3.dislikedFoods')}
        </label>
        <p className="text-2xs text-bocado-gray mb-3">{t('step3.dislikedFoodsHelp')}</p>
        
        {/* Buscador */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder={t('step3.searchFood')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => trackEvent('registration_dislike_search_focus')} // ✅ Analítica
            className="w-full px-4 py-2.5 rounded-xl border-2 border-bocado-border text-sm focus:outline-none focus:border-bocado-green"
          />
        </div>
        
        {/* Grid de categorías */}
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(filteredCategories).map(category => {
            const Icon = categoryIcons[category];
            const dislikedCount = dislikedFoods.filter(food => FOOD_CATEGORIES[category]?.includes(food)).length;
            
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  trackEvent('registration_dislike_category_open', { category }); // ✅ Analítica
                  setModalCategory(category);
                }}
                className="relative flex flex-col items-center justify-center p-3 text-center bg-white border-2 border-bocado-border rounded-xl hover:border-bocado-green active:scale-95 transition-all duration-200 aspect-[4/3]"
              >
                {Icon && <Icon className="w-8 h-8 text-bocado-green mb-1"/>}
                <span className="font-bold text-[10px] text-bocado-text leading-tight">{category}</span>
                {dislikedCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {dislikedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Custom dislikes */}
        <div className="mt-3 space-y-2">
          {customDislikes.length > 0 && (
            <div className="p-3 bg-bocado-background rounded-xl">
              <p className="text-2xs font-bold text-bocado-dark-gray mb-2 uppercase">{t('step3.addedManually')}</p>
              <div className="flex flex-wrap gap-2">
                {customDislikes.map(food => (
                  <button 
                    key={food} 
                    type="button" 
                    onClick={() => handleToggleDislike(food)} 
                    className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white active:scale-95 transition-transform"
                  >
                    {food} ×
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
                placeholder={t('step3.ingredientPlaceholder')}
                className="flex-1 px-3 py-2 rounded-xl border-2 border-bocado-border text-sm focus:outline-none focus:border-bocado-green"
              />
              <button 
                type="button" 
                onClick={handleAddCustomFood} 
                className="px-4 py-2 bg-bocado-green text-white font-bold text-sm rounded-xl hover:bg-bocado-dark-green active:scale-95 transition-all"
              >
                {t('step3.add')}
              </button>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={() => {
                trackEvent('registration_custom_dislike_click'); // ✅ Analítica
                setShowCustomInput(true);
              }} 
              className="text-xs text-bocado-green font-bold hover:text-bocado-dark-green transition-colors"
            >
              {t('step3.addAnother')}
            </button>
          )}
        </div>
      </div>

      {/* Modal de categoría */}
      {modalCategory && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl shadow-bocado w-full max-w-sm max-h-[80vh] flex flex-col">
            <h3 className="text-base font-bold text-bocado-dark-green mb-3">{modalCategory}</h3>
            
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="flex flex-wrap gap-2">
                {FOOD_CATEGORIES[modalCategory].map(food => (
                  <button 
                    key={food} 
                    type="button" 
                    onClick={() => handleToggleDislike(food)} 
                    className={`px-3 py-2 rounded-full border text-xs font-bold transition-all duration-200 active:scale-95 ${
                      dislikedFoods.includes(food) 
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-white text-bocado-text border-bocado-border hover:border-red-400 hover:text-red-500'
                    }`}
                  >
                    {food}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setModalCategory(null)} 
              className="mt-4 w-full py-3 rounded-xl font-bold bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95 transition-all"
            >
              {t('step3.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3;