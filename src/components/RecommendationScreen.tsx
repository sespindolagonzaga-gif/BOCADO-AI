import React, { useState } from 'react';
import { EATING_HABITS, MEALS, CRAVINGS } from '../constants';
import BocadoLogo from './BocadoLogo';
import { auth, db, serverTimestamp, trackEvent } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { CurrencyService } from '../data/budgets';
import { useUserProfile } from '../hooks/useUser';
import { useAuthStore } from '../stores/authStore';
import { env } from '../environment/env';

interface RecommendationScreenProps {
  userName: string;
  onPlanGenerated: (interactionId: string) => void;
}

const stripEmoji = (str: string) => {
    if (!str) return str;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    const parts = str.split(' ');
    if (parts.length > 0 && emojiRegex.test(parts[0])) {
        return parts.slice(1).join(' ');
    }
    return str;
};

const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ userName, onPlanGenerated }) => {
  const [recommendationType, setRecommendationType] = useState<'En casa' | 'Fuera' | null>(null); 
  const [selectedMeal, setSelectedMeal] = useState('');
  const [selectedCravings, setSelectedCravings] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState('');
  const [cookingTime, setCookingTime] = useState(30);
  const [servings, setServings] = useState(1); // ✅ Nuevo: Estado para comensales
  const [isGenerating, setIsGenerating] = useState(false);

  const { user } = useAuthStore();
  const { data: profile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const countryCode = (profile?.country || 'MX').toUpperCase().trim(); 
  const currencyConfig = CurrencyService.fromCountryCode(countryCode);
  const budgetOptions = CurrencyService.getBudgetOptions(countryCode);

  const handleTypeChange = (type: 'En casa' | 'Fuera') => {
      trackEvent('recommendation_type_selected', { type });
      setRecommendationType(type);
      setSelectedBudget('');
      if (type === 'En casa') {
        setSelectedCravings([]);
      } else {
        setSelectedMeal('');
        setCookingTime(30);
        setServings(1); // Reset servings si sale a comer fuera
      }
  };

  const handleGenerateRecommendation = async () => {
    const isHomeSelectionComplete = recommendationType === 'En casa' && selectedMeal;
    const isAwaySelectionComplete = recommendationType === 'Fuera' && selectedCravings.length > 0 && selectedBudget;
    
    if (!profile || (!isHomeSelectionComplete && !isAwaySelectionComplete)) return;
    if (!user) {
      console.error("No hay usuario autenticado");
      return;
    }

    setIsGenerating(true);

    const cravingsList = recommendationType === 'Fuera' && selectedCravings.length > 0
      ? selectedCravings.map(stripEmoji)
      : ['Saludable', 'Recomendación del chef'];

    const interactionData = {
      userId: user.uid,
      type: recommendationType,
      mealType: recommendationType === 'En casa' ? stripEmoji(selectedMeal) : "Fuera de casa",
      cookingTime: recommendationType === 'En casa' ? cookingTime : 0,
      servings: recommendationType === 'En casa' ? servings : 1, // ✅ Enviado a la IA
      cravings: cravingsList,
      budget: selectedBudget, 
      currency: currencyConfig.code, 
      dislikedFoods: profile.dislikedFoods || [],
      createdAt: serverTimestamp(),
      procesado: false,
    };

    trackEvent('recommendation_generation_start', {
      type: recommendationType,
      meal: interactionData.mealType,
      servings: interactionData.servings,
      budget: selectedBudget,
      cravings_count: cravingsList.length
    });

    try {
      const newDoc = await addDoc(collection(db, 'user_interactions'), interactionData);
      
      onPlanGenerated(newDoc.id);
      
      fetch(env.api.recommendationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...interactionData, _id: newDoc.id })
      })
      .then(() => {
          trackEvent('recommendation_api_success', { type: recommendationType });
      })
      .catch(error => {
        console.error("Background fetch error:", error);
        trackEvent('recommendation_api_error', { error: 'fetch_failed' });
      });
      
    } catch (error) {
      console.error("Error generating recommendation:", error);
      trackEvent('recommendation_generation_error', { error: 'firestore_save_failed' });
      alert('Tuvimos un problema. Por favor, intenta de nuevo.');
      setIsGenerating(false);
    }
  };

  const toggleCraving = (craving: string) => {
    const isSelecting = !selectedCravings.includes(craving);
    trackEvent('recommendation_craving_toggle', { 
        craving: stripEmoji(craving),
        action: isSelecting ? 'select' : 'deselect'
    });
    setSelectedCravings(prev => 
      prev.includes(craving) ? prev.filter(c => c !== craving) : [...prev, craving]
    );
  };

  const handleMealSelect = (meal: string) => {
    trackEvent('recommendation_meal_selected', { meal: stripEmoji(meal) });
    setSelectedMeal(meal);
  };

  const isSelectionMade = (recommendationType === 'En casa' && selectedMeal) || 
                          (recommendationType === 'Fuera' && selectedCravings.length > 0 && selectedBudget);

  if (isProfileLoading || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 py-4 overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="text-center mb-4 shrink-0">
        <div className="w-32 h-20 mx-auto mb-2">
          <BocadoLogo className="w-full h-full" />
        </div>
        <h1 className="text-xl font-bold text-bocado-dark-green">¡Hola, {userName || 'Comensal'}! 👋</h1>
        <p className="text-sm text-bocado-gray mt-1">¿Dónde y qué quieres comer hoy?</p>
      </div>

      {/* Selector principal */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {EATING_HABITS.map(habit => (
          <button 
            key={habit} 
            onClick={() => handleTypeChange(habit as any)} 
            className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
              recommendationType === habit 
                ? 'bg-bocado-green text-white border-bocado-green shadow-bocado' 
                : 'bg-white text-bocado-text border-bocado-border hover:border-bocado-green/50'
            }`}
          >
            <span className="text-3xl mb-1">{habit === 'En casa' ? '🏡' : '🍽️'}</span>
            <span className="font-bold text-sm">{habit}</span>
          </button>
        ))}
      </div>

      {/* Opciones condicionales */}
      {recommendationType && (
        <div className="flex-1 animate-fade-in">
          {recommendationType === 'En casa' ? (
            <div className="space-y-4">
              <p className="text-center text-xs font-bold text-bocado-gray uppercase tracking-wider">¿Qué vas a preparar?</p>
              <div className="grid grid-cols-2 gap-2">
                {MEALS.map(meal => (
                  <button 
                    key={meal} 
                    onClick={() => handleMealSelect(meal)} 
                    className={`py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.98] ${
                      selectedMeal === meal 
                        ? 'bg-bocado-green text-white border-bocado-green shadow-sm' 
                        : 'bg-white text-bocado-dark-gray border-bocado-border'
                    }`}
                  >
                    {meal}
                  </button>
                ))}
              </div>
              
              {selectedMeal && (
                <div className="space-y-3">
                  {/* Selector de Porciones/Comensales */}
                  <div className="bg-bocado-background p-4 rounded-2xl animate-fade-in">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-bocado-gray uppercase tracking-wide">¿Para cuántos?</label>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => {
                            const val = Math.max(1, servings - 1);
                            setServings(val);
                            trackEvent('recommendation_servings_change', { count: val });
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-bocado-border text-bocado-green font-bold active:scale-90"
                        >-</button>
                        <span className="text-lg font-bold text-bocado-green w-4 text-center">{servings}</span>
                        <button 
                          onClick={() => {
                            const val = servings + 1;
                            setServings(val);
                            trackEvent('recommendation_servings_change', { count: val });
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-bocado-border text-bocado-green font-bold active:scale-90"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  {/* Selector de Tiempo */}
                  <div className="bg-bocado-background p-4 rounded-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-bocado-gray uppercase tracking-wide">Tiempo</label>
                      <span className="text-lg font-bold text-bocado-green">{cookingTime >= 65 ? '60+' : cookingTime} min</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="65" 
                      step="5" 
                      value={cookingTime} 
                      onChange={(e) => setCookingTime(Number(e.target.value))} 
                      onMouseUp={() => trackEvent('recommendation_time_adjusted', { time: cookingTime })}
                      className="w-full h-2 bg-bocado-border rounded-lg appearance-none cursor-pointer accent-bocado-green" 
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sección Fuera de casa (igual que antes) */}
              <div>
                <p className="text-center text-xs font-bold text-bocado-gray uppercase tracking-wider mb-3">¿Qué se te antoja?</p>
                <div className="grid grid-cols-2 gap-2">
                  {CRAVINGS.map(craving => (
                    <button 
                      key={craving} 
                      onClick={() => toggleCraving(craving)} 
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all active:scale-[0.98] ${
                        selectedCravings.includes(craving) 
                          ? 'bg-bocado-green text-white border-bocado-green shadow-sm' 
                          : 'bg-white text-bocado-dark-gray border-bocado-border'
                      }`}
                    >
                      {craving}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-center text-xs font-bold text-bocado-gray uppercase tracking-wider mb-3">
                  Presupuesto ({currencyConfig.name})
                </p>
                <div className="space-y-2">
                  {budgetOptions.map(option => (
                    <button 
                      key={option.value} 
                      onClick={() => {
                          trackEvent('recommendation_budget_selected', { budget: option.value });
                          setSelectedBudget(option.value);
                      }} 
                      className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all flex justify-between items-center active:scale-[0.98] ${
                        selectedBudget === option.value 
                          ? 'bg-bocado-green text-white border-bocado-green shadow-sm' 
                          : 'bg-white text-bocado-dark-gray border-bocado-border'
                      }`}
                    >
                      <span>{option.label}</span>
                      {selectedBudget === option.value && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Botón acción */}
          <div className={`mt-6 transition-all duration-300 ${isSelectionMade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <button 
              onClick={handleGenerateRecommendation} 
              disabled={isGenerating} 
              className="w-full bg-bocado-green text-white font-bold py-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Cocinando...</span>
                </>
              ) : "¡A comer! 🍽️"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationScreen;