import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EATING_HABITS, MEALS, CRAVINGS } from '../constants';
import BocadoLogo from './BocadoLogo';
import { auth, db, serverTimestamp, trackEvent } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { CurrencyService } from '../data/budgets';
import { useUserProfile, useGeolocation } from '../hooks';
import { useAuthStore } from '../stores/authStore';
import { useRateLimit } from '../hooks/useRateLimit';
import { env, SEARCH_RADIUS } from '../environment/env';
import { logger } from '../utils/logger';
import { LocationIcon } from './icons/LocationIcon';

interface RecommendationScreenProps {
  userName: string;
  onPlanGenerated: (interactionId: string) => void;
}

const stripEmoji = (str: string) => {
  if (!str) return str;
  // Regex mejorada para emoji
  return str.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|\s)+/g, ' ').trim();
};

const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ userName, onPlanGenerated }) => {
  const [recommendationType, setRecommendationType] = useState<'En casa' | 'Fuera' | null>(null); 
  const [selectedMeal, setSelectedMeal] = useState('');
  const [selectedCravings, setSelectedCravings] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState('');
  const [cookingTime, setCookingTime] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null); // ✅ Nuevo: estado de error local
  
  // Prevenir clicks múltiples
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { user } = useAuthStore();
  const { data: profile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  
  // Geolocalización del usuario (solo para "Fuera")
  const { 
    position: userPosition, 
    loading: locationLoading, 
    error: locationError, 
    permission: locationPermission,
    requestLocation 
  } = useGeolocation();
  
  const [locationRequested, setLocationRequested] = useState(false);
  
  // Rate limit status para mostrar al usuario
  const { 
    canRequest, 
    isDisabled: isRateLimited, 
    message: rateLimitMessage,
    formattedTimeLeft,
    refreshStatus 
  } = useRateLimit(user?.uid);

  const countryCode = (profile?.country || 'MX').toUpperCase().trim(); 
  const currencyConfig = CurrencyService.fromCountryCode(countryCode);
  const budgetOptions = CurrencyService.getBudgetOptions(countryCode);

  // Limpiar abort controller al desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ✅ NUEVO: Resetear estados cuando cambia el tipo (evita quedar bloqueado)
  useEffect(() => {
    setError(null);
    isProcessingRef.current = false;
    setIsGenerating(false);
  }, [recommendationType]);

  const handleTypeChange = (type: 'En casa' | 'Fuera') => {
    trackEvent('recommendation_type_selected', { type });
    setRecommendationType(type);
    setSelectedBudget('');
    setError(null);
    
    if (type === 'En casa') {
      setSelectedCravings([]);
    } else {
      setSelectedMeal('');
      setCookingTime(30);
      // Solicitar ubicación automáticamente cuando selecciona "Fuera" (solo una vez)
      if (!locationRequested && locationPermission !== 'granted' && locationPermission !== 'denied') {
        requestLocation();
        setLocationRequested(true);
      }
    }
  };

  const resetProcessingState = useCallback(() => {
    isProcessingRef.current = false;
    setIsGenerating(false);
    abortControllerRef.current = null;
  }, []);

  const handleGenerateRecommendation = async () => {
    if (isProcessingRef.current || isGenerating) return;
    
    const isHomeSelectionComplete = recommendationType === 'En casa' && selectedMeal;
    const isAwaySelectionComplete = recommendationType === 'Fuera' && selectedCravings.length > 0 && selectedBudget;
    
    if (!profile || (!isHomeSelectionComplete && !isAwaySelectionComplete)) return;
    if (!user) {
      logger.error("No hay usuario autenticado");
      return;
    }

    // Bloquear inmediatamente
    isProcessingRef.current = true;
    setIsGenerating(true);
    setError(null);
    
    abortControllerRef.current = new AbortController();

    const cravingsList = recommendationType === 'Fuera' && selectedCravings.length > 0
      ? selectedCravings.map(stripEmoji)
      : ['Saludable', 'Recomendación del chef'];

    const interactionData = {
      userId: user.uid,
      type: recommendationType,
      mealType: recommendationType === 'En casa' ? stripEmoji(selectedMeal) : "Fuera de casa",
      cookingTime: recommendationType === 'En casa' ? cookingTime : 0,
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
      budget: selectedBudget,
      cravings_count: cravingsList.length
    });

    try {
      const newDoc = await addDoc(collection(db, 'user_interactions'), interactionData);
      
      const token = await user.getIdToken();
      
      // Preparar datos con ubicación si está disponible (solo para "Fuera")
      const requestBody: any = { ...interactionData, _id: newDoc.id };
      
      if (recommendationType === 'Fuera' && userPosition) {
        requestBody.userLocation = {
          lat: userPosition.lat,
          lng: userPosition.lng,
          accuracy: userPosition.accuracy,
        };
        trackEvent('recommendation_using_geolocation', {
          accuracy: userPosition.accuracy,
        });
      }
      
      const response = await fetch(env.api.recommendationUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      // ✅ CORREGIDO: Manejar 429 sin quedar bloqueado
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        
        trackEvent('recommendation_rate_limited', { 
          retryAfter: errorData.retryAfter || 30,
          type: recommendationType 
        });
        
        // Mostrar mensaje y refrescar status del rate limit
        const fallbackSeconds = typeof errorData.retryAfter === 'number' ? errorData.retryAfter : 30;
        const fallbackMessage = `Espera ${fallbackSeconds}s antes de generar otra recomendación.`;
        setError(errorData.error || fallbackMessage);
        refreshStatus();
        resetProcessingState();
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      // Éxito
      trackEvent('recommendation_api_success', { type: recommendationType });
      refreshStatus(); // 🔄 Actualizar rate limit después de éxito
      resetProcessingState(); // ✅ Limpieza antes de navegar
      onPlanGenerated(newDoc.id);
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        resetProcessingState();
        return;
      }
      
      logger.error("Error generating recommendation:", error);
      
      trackEvent('recommendation_generation_error', { 
        error: error.message,
        type: recommendationType 
      });
      
      // ✅ NUEVO: Mostrar error en UI en lugar de alert()
      setError(error.message || 'Error de conexión. Intenta de nuevo.');
      resetProcessingState();
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
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-10 h-10 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-bocado-gray text-sm animate-pulse font-medium">Sincronizando perfil...</p>
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

      {/* ✅ NUEVO: Mensaje de error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in">
          <p className="font-medium">⚠️ {error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-xs underline mt-1 hover:text-red-700"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Selector principal */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {EATING_HABITS.map(habit => (
          <button 
            key={habit} 
            onClick={() => handleTypeChange(habit as any)} 
            disabled={isGenerating}
            className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
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
              <p className="text-center text-2xs font-bold text-bocado-gray uppercase tracking-wider">¿Qué vas a preparar?</p>
              <div className="grid grid-cols-2 gap-2">
                {MEALS.map(meal => (
                  <button 
                    key={meal} 
                    onClick={() => handleMealSelect(meal)} 
                    disabled={isGenerating}
                    className={`py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
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
                <div className="bg-bocado-background p-4 rounded-2xl mt-2 animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-2xs font-bold text-bocado-gray uppercase tracking-wide">Tiempo</label>
                    <span className="text-lg font-bold text-bocado-green">{cookingTime >= 65 ? '60+' : cookingTime} min</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="65" 
                    step="5" 
                    value={cookingTime} 
                    disabled={isGenerating}
                    onChange={(e) => {
                        setCookingTime(Number(e.target.value));
                    }} 
                    onMouseUp={() => trackEvent('recommendation_time_adjusted', { time: cookingTime })}
                    className="w-full h-2 bg-bocado-border rounded-lg appearance-none cursor-pointer accent-bocado-green disabled:opacity-50" 
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-center text-2xs font-bold text-bocado-gray uppercase tracking-wider mb-3">¿Qué se te antoja?</p>
                <div className="grid grid-cols-2 gap-2">
                  {CRAVINGS.map(craving => (
                    <button 
                      key={craving} 
                      onClick={() => toggleCraving(craving)} 
                      disabled={isGenerating}
                      className={`py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
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
                <p className="text-center text-2xs font-bold text-bocado-gray uppercase tracking-wider mb-3">
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
                      disabled={isGenerating}
                      className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all flex justify-between items-center active:scale-[0.98] disabled:opacity-50 ${
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

              {/* Indicador de ubicación */}
              <div className="bg-bocado-background/50 p-3 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LocationIcon className={`w-4 h-4 ${
                      userPosition ? 'text-bocado-green' : 
                      locationPermission === 'denied' ? 'text-red-400' : 
                      'text-bocado-gray'
                    }`} />
                    <span className="text-xs text-bocado-dark-gray">
                      {userPosition ? (
                        <span className="text-bocado-green font-medium">📍 Ubicación activa</span>
                      ) : locationPermission === 'denied' ? (
                        <span className="text-red-400">Ubicación denegada</span>
                      ) : locationLoading ? (
                        <span className="text-bocado-gray">Obteniendo ubicación...</span>
                      ) : (
                        <span className="text-bocado-gray">Usando ciudad del perfil</span>
                      )}
                    </span>
                  </div>
                  {!userPosition && locationPermission !== 'denied' && (
                    <button
                      onClick={requestLocation}
                      disabled={locationLoading || isGenerating}
                      className="text-xs font-medium text-bocado-green hover:text-bocado-dark-green disabled:text-bocado-gray transition-colors"
                    >
                      {locationLoading ? '...' : 'Activar'}
                    </button>
                  )}
                </div>
                <p className="text-2xs text-bocado-gray mt-1 ml-6">
                  {userPosition 
                    ? `Buscando restaurantes en ${SEARCH_RADIUS.label}` 
                    : `Las recomendaciones serán de ${profile?.city || 'tu ciudad'}`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Botón acción con rate limit */}
          <div className={`mt-6 transition-all duration-300 ${isSelectionMade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            {/* Indicador de rate limit */}
            {!isGenerating && !canRequest && (
              <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <p className="text-xs text-amber-700">
                  ⏱️ <span className="font-medium">{rateLimitMessage}</span>
                </p>
              </div>
            )}
            
            <button 
              onClick={handleGenerateRecommendation} 
              disabled={isGenerating || isRateLimited} 
              className="w-full bg-bocado-green text-white font-bold py-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Cocinando...</span>
                </>
              ) : isRateLimited ? (
                <>
                  <span>⏱️ Espera {formattedTimeLeft}</span>
                </>
              ) : (
                "¡A comer! 🍽️"
              )}
            </button>
            
            {/* Contador de requests restantes */}
            {canRequest && !isGenerating && rateLimitMessage && (
              <p className="text-center text-xs text-bocado-gray mt-2">
                {rateLimitMessage} en los últimos 10 min
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationScreen;
