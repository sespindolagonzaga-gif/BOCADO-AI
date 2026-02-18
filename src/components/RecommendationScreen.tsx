import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EATING_HABITS, MEALS, CRAVINGS } from '../constants';
import BocadoLogo from './BocadoLogo';
import { db, serverTimestamp, trackEvent } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { CurrencyService } from '../data/budgets';
import { useUserProfile, useGeolocation, useSmartNotifications } from '../hooks';
import { useAuthStore } from '../stores/authStore';
import { useRateLimit } from '../hooks/useRateLimit';
import { env, SEARCH_RADIUS } from '../environment/env';
import { logger } from '../utils/logger';
import { MapPin, Bell } from './icons';
import { ProfileSkeleton } from './skeleton';
import { Tooltip } from './ui/Tooltip';
import { useTranslation } from '../contexts/I18nContext';

interface RecommendationScreenProps {
  userName: string;
  onPlanGenerated: (interactionId: string) => void;
  isNewUser?: boolean; // Nuevo prop para detectar usuarios recién registrados
}

const stripEmoji = (str: string) => {
  if (!str) return str;
  // Regex mejorada para emoji
  return str.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|\s)+/g, ' ').trim();
};

// Helper para traducir comidas manteniendo el emoji original
const translateMealWithEmoji = (meal: string, t: (key: string) => string): string => {
  const mealMap: Record<string, string> = {
    'Desayuno': 'desayuno',
    'Comida': 'comida', 
    'Cena': 'cena',
    'Snack': 'snack'
  };
  const text = stripEmoji(meal);
  const emoji = meal.replace(text, '').trim();
  const key = mealMap[text];
  return key ? `${emoji} ${t(`meals.${key}`)}` : meal;
};

// Helper para traducir cravings manteniendo el emoji original
const translateCravingWithEmoji = (craving: string, t: (key: string) => string): string => {
  const cravingMap: Record<string, string> = {
    'Italiana / Pizza': 'italiana',
    'Japonesa / Sushi': 'japonesa',
    'Saludable o fit': 'saludable',
    'Asiática / China': 'asiatica',
    'Mexicana': 'mexicana',
    'Americana / Fast food': 'americana',
    'Mediterránea': 'mediterranea',
    'Otros': 'otros'
  };
  const text = stripEmoji(craving);
  const emoji = craving.replace(text, '').trim();
  const key = cravingMap[text];
  return key ? `${emoji} ${t(`cravings.${key}`)}` : craving;
};

// Helper para traducir budget labels
const translateBudgetLabel = (label: string, value: 'low' | 'medium' | 'high', t: (key: string) => string): string => {
  // Extraer la parte del rango de precios (lo que está entre paréntesis)
  const rangeMatch = label.match(/\((.*)\)/);
  const range = rangeMatch ? `(${rangeMatch[1]})` : '';
  
  // Traducir el nombre del budget
  const translatedName = t(`budget.${value}`);
  
  // Retornar nombre traducido + rango original
  return `${translatedName} ${range}`.trim();
};

const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ userName, onPlanGenerated, isNewUser = false }) => {
  const { t, locale } = useTranslation();
  const [recommendationType, setRecommendationType] = useState<'En casa' | 'Fuera' | null>(null); 
  const [selectedMeal, setSelectedMeal] = useState('');
  const [selectedCravings, setSelectedCravings] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState('');
  const [cookingTime, setCookingTime] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyPantryIngredients, setOnlyPantryIngredients] = useState(false);
  
  // Prevenir clicks múltiples
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { user } = useAuthStore();
  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useUserProfile(user?.uid);
  
  // Track si el perfil no se encuentra después de cargar
  const [profileNotFound, setProfileNotFound] = useState(false);
  
  useEffect(() => {
    if (!isProfileLoading && !profile && !isProfileError) {
      // Para usuarios nuevos, dar más tiempo (Firestore eventual consistency)
      const timeoutMs = isNewUser ? 15000 : 8000;
      const timer = setTimeout(() => {
        setProfileNotFound(true);
      }, timeoutMs);
      return () => clearTimeout(timer);
    }
  }, [isProfileLoading, profile, isProfileError, isNewUser]);
  
  // Geolocalización del usuario (solo para "Fuera")
  const { 
    position: userPosition, 
    detectedLocation,
    loading: locationLoading, 
    error: locationError, 
    permission: locationPermission,
    requestLocation,
    getCountryCodeForCurrency,
  } = useGeolocation();

  // Notificaciones - mostrar banner si no están activadas
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
  } = useSmartNotifications(user?.uid);
  
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  
  const [locationRequested, setLocationRequested] = useState(false);
  
  // Rate limit status para mostrar al usuario
  const { 
    canRequest, 
    isDisabled: isRateLimited, 
    message: rateLimitMessage,
    formattedTimeLeft,
    refreshStatus 
  } = useRateLimit(user?.uid);

  // 🟠 FIX #3: Validar que getCountryCodeForCurrency no retorne null antes de .toUpperCase()
  const detectedCountryCode = getCountryCodeForCurrency(profile?.country);
  const countryCode = (detectedCountryCode || 'MX').toUpperCase().trim();
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
    setOnlyPantryIngredients(false);
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
    if (recommendationType === 'Fuera' && !userPosition && locationLoading) {
      setError(t('recommendation.waitForLocation'));
      resetProcessingState();
      return;
    }
    if (!user) {
      logger.error("No hay usuario autenticado");
      return;
    }

    // Bloquear inmediatamente
    isProcessingRef.current = true;
    setIsGenerating(true);
    setError(null);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cravingsList = recommendationType === 'Fuera' && selectedCravings.length > 0
      ? selectedCravings.map(stripEmoji)
      : ['Saludable', 'Recomendación del chef'];

    const interactionData = {
      userId: user.uid,
      type: recommendationType,
      mealType: recommendationType === 'En casa' ? stripEmoji(selectedMeal) : "Fuera de casa",
      cookingTime: recommendationType === 'En casa' ? cookingTime : null,
      cravings: cravingsList,
      budget: selectedBudget,
      currency: currencyConfig.code,
      dislikedFoods: profile.dislikedFoods || [],
      onlyPantryIngredients: recommendationType === 'En casa' && onlyPantryIngredients,
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
      const requestBody: any = {
        ...interactionData,
        _id: newDoc.id,
        language: locale, // Agregar idioma actual
        onlyPantryIngredients: recommendationType === 'En casa' && onlyPantryIngredients
      };
      
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
      
      // Timeout de 30s para evitar esperas indefinidas
      const timeoutId = setTimeout(() => {
        controller.abort();
        setError('La solicitud tardó demasiado. Por favor intenta de nuevo.');
        resetProcessingState();
      }, 30000); // 30 segundos
      
      const response = await fetch(env.api.recommendationUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // ✅ CORREGIDO: Manejar 429 sin quedar bloqueado
      if (response.status === 429) {
        // 🟠 FIX #5: Try-catch para response.json() con defaults robustos
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (jsonError) {
          logger.warn('[RecommendationScreen] Failed to parse 429 error JSON:', jsonError);
          errorData = { error: 'Demasiadas solicitudes. Por favor espera.', retryAfter: 60 };
        }
        
        trackEvent('recommendation_rate_limited', { 
          retryAfter: errorData.retryAfter || 30,
          type: recommendationType 
        });
        
        // Mostrar mensaje y refreschar status del rate limit
        const fallbackSeconds = typeof errorData.retryAfter === 'number' ? errorData.retryAfter : 30;
        const fallbackMessage = `Espera ${fallbackSeconds}s antes de generar otra recomendación.`;
        setError(errorData.error || fallbackMessage);
        refreshStatus();
        resetProcessingState();
        return;
      }

      if (!response.ok) {
        // 🟠 FIX #9: Limitar tamaño de response.text() para evitar OOM en móviles
        const errorText = await response.text();
        const truncatedError = errorText.substring(0, 10000); // Max 10KB
        throw new Error(`Error ${response.status}: ${truncatedError}`);
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
      setError(error.message || t('recommendation.connectionError'));
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

  const isLocationReady = recommendationType !== 'Fuera' || locationPermission === 'denied' || !!userPosition;
  const isSelectionMade = (recommendationType === 'En casa' && selectedMeal) || 
                          (recommendationType === 'Fuera' && selectedCravings.length > 0 && selectedBudget && isLocationReady);

  // Mostrar error si el perfil no se encuentra
  if (profileNotFound || isProfileError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-500 text-lg mb-2">⚠️ No se encontró tu perfil</p>
          <p className="text-bocado-gray text-sm mb-4">
            Parece que hubo un problema al cargar tu perfil. Intenta recargar la página o contacta soporte.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-bocado-green text-white rounded-lg hover:bg-bocado-dark-green transition-colors"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  if (isProfileLoading || !profile) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col px-4 py-4 min-h-0 overflow-y-auto" role="main">
      {/* Header */}
      <div className="text-center mb-4 shrink-0">
        <div className="w-40 mx-auto mb-2">
          <BocadoLogo className="w-full" />
        </div>
        <h1 className="text-xl font-bold text-bocado-dark-green">{t('recommendation.welcome', { userName: userName || 'Comensal' })}</h1>
        <p className="text-sm text-bocado-gray mt-1">{t('recommendation.subtitle')}</p>
      </div>

      {/* ✅ NUEVO: Mensaje de error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in" role="alert" aria-live="assertive">
          <p className="font-medium">⚠️ {error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-xs underline mt-1 hover:text-red-700"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Banner de notificaciones (solo si no están activadas y el usuario no lo cerró) */}
      {showNotificationBanner && notificationPermission !== 'granted' && (
        <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-lg shadow-sm animate-fade-in shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900">
                {t('recommendation.notificationBanner.title')}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {t('recommendation.notificationBanner.description')}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={async () => {
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    trackEvent('notification_banner_activated');
                    setShowNotificationBanner(false);
                  }
                }}
                className="text-xs bg-amber-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-amber-700 active:scale-95 transition-all whitespace-nowrap"
              >
                {t('recommendation.notificationBanner.activate')}
              </button>
              <button
                onClick={() => {
                  setShowNotificationBanner(false);
                  trackEvent('notification_banner_dismissed');
                }}
                className="text-xs text-amber-700 hover:text-amber-900 transition-colors"
              >
                {t('recommendation.notificationBanner.later')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selector principal */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {EATING_HABITS.map(habit => (
          <button
            key={habit}
            onClick={() => handleTypeChange(habit as any)}
            disabled={isGenerating}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
              recommendationType === habit
                ? 'bg-bocado-green text-white border-bocado-green shadow-bocado'
                : 'bg-white text-bocado-text border-bocado-border hover:border-bocado-green/50'
            }`}
          >
            <span className="text-3xl mb-2">{habit === 'En casa' ? '🏡' : '🍽️'}</span>
            <span className="font-bold text-sm text-center">
              {habit === 'En casa' ? t('recommendation.homeButton') : t('recommendation.outButton')}
            </span>
            <span className={`text-2xs mt-1 text-center leading-tight ${
              recommendationType === habit
                ? 'text-white/80'
                : 'text-bocado-gray'
            }`}>
              {habit === 'En casa' ? t('recommendation.useIngredients') : t('recommendation.findPlace')}
            </span>
          </button>
        ))}
      </div>

      {/* Opciones condicionales */}
      {recommendationType && (
        <div className="flex-1 animate-fade-in">
          {recommendationType === 'En casa' ? (
            <div className="space-y-4">
              <p className="text-center text-2xs font-bold text-bocado-gray uppercase tracking-wider">{t('recommendation.whatToCook')}</p>
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
                    {translateMealWithEmoji(meal, t)}
                  </button>
                ))}
              </div>
              
              {selectedMeal && (
                <div className="bg-bocado-background p-4 rounded-2xl mt-2 animate-fade-in space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-2xs font-bold text-bocado-gray uppercase tracking-wide">{t('recommendation.cookingTime')}</label>
                      <span className="text-lg font-bold text-bocado-green bg-white px-3 py-1 rounded-full">{cookingTime >= 65 ? '60+' : cookingTime} min</span>
                    </div>

                    {/* Slider con marcas visuales */}
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="10"
                        max="65"
                        step="5"
                        value={cookingTime}
                        disabled={isGenerating}
                        onChange={(e) => {
                          // ✅ FIX: Validar NaN en conversión numérica
                          const newValue = Number(e.target.value);
                          if (!isNaN(newValue) && newValue >= 10 && newValue <= 65) {
                            setCookingTime(newValue);
                            trackEvent('recommendation_time_adjusted', { time: newValue });
                          }
                        }}
                        className="w-full h-3 bg-bocado-border rounded-lg appearance-none cursor-pointer accent-bocado-green disabled:opacity-50 slider-with-ticks"
                      />

                      {/* Marcas de referencia */}
                      <div className="flex justify-between text-2xs text-bocado-gray font-medium px-1">
                        <span>🚀 10m</span>
                        <span>⚡ 30m</span>
                        <span>🍽️ 60m</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle: Solo ingredientes de la despensa */}
                  <div className="border-t border-bocado-border pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={onlyPantryIngredients}
                        onChange={(e) => {
                          setOnlyPantryIngredients(e.target.checked);
                          trackEvent('pantry_only_toggle', { enabled: e.target.checked });
                        }}
                        disabled={isGenerating}
                        className="w-5 h-5 rounded border-2 border-bocado-border bg-white cursor-pointer checked:bg-bocado-green checked:border-bocado-green accent-bocado-green disabled:opacity-50"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-bocado-dark-gray group-hover:text-bocado-green transition-colors">
                          {t('recommendation.onlyMyIngredients')}
                        </p>
                        <p className="text-2xs text-bocado-gray mt-0.5">
                          {onlyPantryIngredients
                            ? t('recommendation.onlyMyIngredientsHelp')
                            : t('recommendation.onlyMyIngredientsHelpOff')}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-center text-2xs font-bold text-bocado-gray uppercase tracking-wider mb-3">{t('recommendation.whatCraving')}</p>
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
                      {translateCravingWithEmoji(craving, t)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-center text-2xs font-bold text-bocado-gray uppercase tracking-wider mb-3">
                  {t('recommendation.budget', { currency: currencyConfig.name })}
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
                      <span>{translateBudgetLabel(option.label, option.value, t)}</span>
                      {selectedBudget === option.value && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Indicador de ubicación */}
              <div className="bg-bocado-background/50 p-3 rounded-xl border border-bocado-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Tooltip text="Ubica restaurantes más cercanos" position="right">
                      <MapPin className={`w-4 h-4 flex-shrink-0 ${
                        userPosition ? 'text-bocado-green' :
                        locationPermission === 'denied' ? 'text-red-600' :
                        'text-bocado-gray'
                      }`} />
                    </Tooltip>
                    <span className="text-xs text-bocado-dark-gray">
                      {userPosition ? (
                        <span className="text-bocado-green font-medium">{t('recommendation.locationActive')}</span>
                      ) : locationPermission === 'denied' ? (
                        <span className="text-red-600">{t('recommendation.locationDenied')}</span>
                      ) : locationLoading ? (
                        <span className="text-bocado-gray">{t('recommendation.gettingLocation')}</span>
                      ) : (
                        <span className="text-bocado-gray">{t('recommendation.useCurrentLocation')}</span>
                      )}
                    </span>
                  </div>
                  {!userPosition && locationPermission !== 'denied' && (
                    <button
                      onClick={requestLocation}
                      disabled={locationLoading || isGenerating}
                      className="text-xs font-bold text-white bg-bocado-green px-3 py-1.5 rounded-full hover:bg-bocado-dark-green active:scale-95 disabled:bg-bocado-gray disabled:cursor-not-allowed transition-all flex-shrink-0 ml-2 whitespace-nowrap"
                    >
                      {locationLoading ? '...' : t('recommendation.activateLocation')}
                    </button>
                  )}
                </div>
                <p className="text-2xs text-bocado-gray mt-2 ml-6">
                  {userPosition
                    ? `${t('recommendation.searchingIn')} ${SEARCH_RADIUS.label} ${detectedLocation?.city || t('recommendation.yourLocation')}`
                    : `${t('recommendation.noLocationSearching')} ${profile?.city || t('recommendation.yourCity')}`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Botón acción con rate limit - siempre visible */}
          <div className="mt-6 transition-all duration-300">
            <button
              data-testid="generate-recommendation"
              aria-label={t('recommendation.generateAria', { default: 'Generar recomendación' })}
              onClick={handleGenerateRecommendation}
              disabled={!isSelectionMade || isGenerating || isRateLimited}
              className="w-full bg-bocado-green text-white font-bold py-4 rounded-full text-base shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('recommendation.generating')}</span>
                </>
              ) : isRateLimited ? (
                <>
                  <span className="text-lg">⏱️</span>
                  <span>Espera {formattedTimeLeft}s</span>
                </>
              ) : (
                t('recommendation.generateRecommendation')
              )}
            </button>

            {/* Microcopy cuando no está listo aún */}
            {!isSelectionMade && (
              <p className="text-center text-2xs text-bocado-gray mt-2">
                {recommendationType === 'En casa'
                  ? t('recommendation.chooseCravingTip')
                  : t('recommendation.chooseCravingAndBudgetTip')}
              </p>
            )}

            {/* Contador de requests restantes */}
            {canRequest && !isGenerating && !isRateLimited && rateLimitMessage && isSelectionMade && (
              <p className="text-center text-xs text-bocado-gray mt-2">
                💡 {rateLimitMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationScreen;
