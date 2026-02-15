import React, { useState, useCallback, useMemo, memo } from 'react';
import type { Meal } from '../types';
import { ChevronDown, Heart } from './icons';
import FeedbackModal from './FeedbackModal';
import PortionSelector from './PortionSelector';
import { useToggleSavedItem, useIsItemSaved } from '../hooks/useSavedItems';
import { useAuthStore } from '../stores/authStore';
import { trackEvent } from '../firebaseConfig';
import { logger } from '../utils/logger';
import { scaleIngredientsSimple, detectBaseServings } from '../utils/portionScaler';
import { Tooltip } from './ui/Tooltip';

interface MealCardProps {
  meal: Meal;
  onInteraction?: (type: 'expand' | 'save' | 'feedback', data?: any) => void;
}

// ============================================
// UTILIDADES MEMOIZADAS (definidas fuera del componente)
// ============================================

const EMOJI_MAP: Record<string, string> = {
  pollo: '🍗',
  pescado: '🐟',
  salmón: '🐟',
  salmon: '🐟',
  carne: '🥩',
  ensalada: '🥗',
  pasta: '🍝',
  taco: '🌮',
  huevo: '🍳',
  sopa: '🍲',
};

const getSmartEmoji = (title: string): string => {
  const lower = title.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(key)) return emoji;
  }
  return '🍽️';
};

const DIFFICULTY_STYLES: Record<string, string> = {
  'Fácil': 'bg-bocado-green/10 text-bocado-green',
  'Media': 'bg-amber-100 text-amber-700',
  'Difícil': 'bg-red-100 text-red-600',
};

const getDifficultyStyle = (difficulty: string): string => {
  return DIFFICULTY_STYLES[difficulty] || 'bg-bocado-background text-bocado-dark-gray';
};

// ============================================
// COMPONENTES HIJO MEMOIZADOS
// ============================================

interface RestaurantInfoSectionProps {
  recipe: Meal['recipe'];
  onOpenMaps: (e: React.MouseEvent) => void;
  onSearchMapsFallback: (e: React.MouseEvent) => void;
  onCopyAddress: (e: React.MouseEvent) => void;
  copiedAddress: boolean;
}

const RestaurantInfoSection = memo<RestaurantInfoSectionProps>(({
  recipe,
  onOpenMaps,
  onSearchMapsFallback,
  onCopyAddress,
  copiedAddress,
}) => {
  const hasPreciseLocation = !!recipe.link_maps;

  return (
    <div className="space-y-3">
      {hasPreciseLocation ? (
        <div className="mb-3">
          <button
            onClick={onOpenMaps}
            className="w-full py-3 rounded-xl bg-blue-50 text-blue-600 font-semibold text-sm border border-blue-200 hover:bg-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>📍</span>
            <span>Ver ubicación en Google Maps</span>
          </button>
          {recipe.direccion_aproximada && (
            <p className="text-xs text-bocado-gray text-center mt-2 px-2 flex items-center justify-center gap-1">
              {recipe.direccion_aproximada}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-xs text-amber-700 mb-3 text-center font-medium">
            ⚠️ Ubicación aproximada (guardado antes de la actualización)
          </p>
          
          {recipe.direccion_aproximada && recipe.direccion_aproximada !== `En ${recipe.title}` && (
            <p className="text-sm font-medium text-bocado-text mb-3 text-center bg-white p-2 rounded-lg border border-amber-100">
              {recipe.direccion_aproximada}
            </p>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={onSearchMapsFallback}
              className="flex-1 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-600 hover:bg-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-1 font-medium"
            >
              <span>🔍</span>
              <span>Buscar en Maps</span>
            </button>
            <button
              onClick={onCopyAddress}
              className={`flex-1 py-2.5 border rounded-lg text-xs transition-all flex items-center justify-center gap-1 font-medium ${
                copiedAddress 
                  ? 'bg-green-50 border-green-200 text-green-600' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{copiedAddress ? '✓' : '📋'}</span>
              <span>{copiedAddress ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[10px] text-amber-600/70 text-center mt-2">
            Tip: Guarda el restaurante nuevamente desde "Fuera" para obtener la ubicación exacta
          </p>
        </div>
      )}

      {recipe.plato_sugerido && (
        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
          <h4 className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">
            🍽️ Plato sugerido
          </h4>
          <p className="text-sm text-bocado-text">{recipe.plato_sugerido}</p>
        </div>
      )}

      {recipe.por_que_es_bueno && (
        <div className="bg-green-50 p-3 rounded-xl border border-green-100">
          <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">
            ✨ Por qué es bueno
          </h4>
          <p className="text-sm text-bocado-text">{recipe.por_que_es_bueno}</p>
        </div>
      )}

      {recipe.hack_saludable && (
        <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
          <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">
            💡 Hack saludable
          </h4>
          <p className="text-sm text-bocado-text">{recipe.hack_saludable}</p>
        </div>
      )}
      
      {!recipe.plato_sugerido && !recipe.por_que_es_bueno && !recipe.hack_saludable && (
        <div className="text-center py-4 px-4 bg-bocado-background rounded-xl">
          <p className="text-xs text-bocado-gray">
            Información detallada no disponible para este lugar guardado anteriormente
          </p>
        </div>
      )}
    </div>
  );
});

RestaurantInfoSection.displayName = 'RestaurantInfoSection';

// ============================================
// COMPONENTE PRINCIPAL MEMOIZADO
// ============================================

const MealCard: React.FC<MealCardProps> = memo(({
  meal,
  onInteraction,
}) => {
  const { recipe } = meal;
  
  // Estados locales
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  
  // Estado para escalar porciones (solo recetas, no restaurantes)
  const [servings, setServings] = useState(2);
  const baseServings = useMemo(() => detectBaseServings(recipe), [recipe]);
  
  // 🔴 FIX #1: Mover isRestaurant ANTES de usarlo en hasMacros
  const isRestaurant = useMemo(() => recipe.difficulty === 'Restaurante', [recipe.difficulty]);
  
  // 🔴 FIX #2: Validar que recipe.ingredients sea array antes de .map()
  const scaledIngredients = useMemo(() => {
    if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) {
      return [];
    }
    return scaleIngredientsSimple(recipe.ingredients, { 
      baseServings, 
      targetServings: servings 
    });
  }, [recipe, baseServings, servings]);
  
  // ✅ FIX: Validar recipe antes de acceder a propiedades
  const hasMacros = useMemo(() => 
    recipe && !isRestaurant && 
    recipe.protein_g !== undefined && 
    recipe.carbs_g !== undefined && 
    recipe.fat_g !== undefined,
    [recipe, isRestaurant]
  );
  
  // Calculamos el "multiplicador aparente" para mostrar info al usuario
  const displayMultiplier = servings / baseServings;

  // Hooks de autenticación y datos
  const { user } = useAuthStore();
  const toggleMutation = useToggleSavedItem();
  const saved = useIsItemSaved(user?.uid, recipe.difficulty === 'Restaurante' ? 'restaurant' : 'recipe', recipe.title);
  const type = useMemo(() => isRestaurant ? 'restaurant' : 'recipe', [isRestaurant]);
  const emoji = useMemo(() => getSmartEmoji(recipe.title), [recipe.title]);
  const showSavings = useMemo(() => 
    recipe.savingsMatch && recipe.savingsMatch !== 'Ninguno', 
    [recipe.savingsMatch]
  );

  // ============================================
  // HANDLERS MEMOIZADOS CON useCallback
  // ============================================

  const handleSaveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    trackEvent(saved ? 'recipe_unsaved' : 'recipe_saved', {
      item_title: recipe.title,
      type,
      userId: user.uid
    });

    toggleMutation.mutate({
      userId: user.uid,
      type,
      recipe,
      mealType: meal.mealType,
      isSaved: saved,
    });
    
    onInteraction?.('save', { 
      recipe: recipe.title, 
      isSaved: !saved, 
      isRestaurant 
    });
  }, [user, saved, recipe, type, meal.mealType, toggleMutation, onInteraction, isRestaurant]);

  const handleExpand = useCallback(() => {
    setIsExpanded(prev => {
      const newState = !prev;
      if (newState) {
        trackEvent('recipe_expanded', {
          item_title: recipe.title,
          type,
          is_restaurant: isRestaurant
        });
        onInteraction?.('expand', { recipe: recipe.title });
      }
      return newState;
    });
  }, [recipe.title, type, isRestaurant, onInteraction]);

  const handleFeedbackOpen = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (showFeedback) return;
    trackEvent('feedback_button_click', {
      item_title: recipe.title,
      type,
    });
    setShowFeedback(true);
    onInteraction?.('feedback', { recipe: recipe.title });
  }, [recipe.title, type, onInteraction, showFeedback]);

  const handleFeedbackClose = useCallback(() => {
    setShowFeedback(false);
  }, []);

  const handleOpenMaps = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (recipe.link_maps) {
      trackEvent('restaurant_maps_clicked', {
        restaurant: recipe.title,
        url: recipe.link_maps
      });
      // 🟡 FIX #6: Validar que window.open no retorne null (popup blocker)
      const newWindow = window.open(recipe.link_maps, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        alert('Por favor permite ventanas emergentes para abrir Google Maps');
      }
    }
  }, [recipe.link_maps, recipe.title]);

  const handleSearchMapsFallback = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const searchParts = [recipe.title];
    
    if (recipe.direccion_aproximada && recipe.direccion_aproximada !== `En ${recipe.title}`) {
      searchParts.push(recipe.direccion_aproximada);
    }
    
    const searchTerm = searchParts.join(' ');
    const query = encodeURIComponent(searchTerm);
    
    trackEvent('restaurant_maps_fallback_search', {
      restaurant: recipe.title,
      query: searchTerm,
      has_address: !!recipe.direccion_aproximada
    });
    
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  }, [recipe.title, recipe.direccion_aproximada]);

  const handleCopyAddress = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const textToCopy = recipe.direccion_aproximada && recipe.direccion_aproximada !== `En ${recipe.title}`
      ? `${recipe.title} - ${recipe.direccion_aproximada}`
      : recipe.title;
    
    try {
      // ✅ FIX: Intento 1 - Clipboard API moderna
      await navigator.clipboard.writeText(textToCopy);
      setCopiedAddress(true);
      trackEvent('restaurant_address_copied', { 
        restaurant: recipe.title,
        address: recipe.direccion_aproximada 
      });
      
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (clipboardError) {
      logger.warn('Clipboard API failed, trying fallback:', clipboardError);
      
      // ✅ FIX: Fallback mejorado con validación
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999); // Para móviles
        
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        
        if (success) {
          setCopiedAddress(true);
          trackEvent('restaurant_address_copied_fallback', { 
            restaurant: recipe.title 
          });
          setTimeout(() => setCopiedAddress(false), 2000);
        } else {
          // 🟡 FIX #7: Agregar logging cuando execCommand falla
          logger.warn('[MealCard] execCommand copy returned false');
          throw new Error('Copy command returned false');
        }
      } catch (fallbackError) {
        logger.error('All copy methods failed:', fallbackError);
        // Mostrar mensaje al usuario
        alert('No se pudo copiar automáticamente. Por favor copia manualmente:\n' + textToCopy);
      }
    }
  }, [recipe.title, recipe.direccion_aproximada]);

  // Cleanup de timeout al desmontar
  // (El timeout se maneja dentro de handleCopyAddress)

  return (
    <div className="group relative border border-bocado-border rounded-2xl bg-white transition-all duration-200 hover:shadow-bocado active:scale-[0.99]">
      
      {/* HEADER */}
      <div
        className="p-4 cursor-pointer"
        onClick={handleExpand}
      >
        <div className="flex justify-between items-start gap-3">
          
          <div className="flex gap-3 flex-1 min-w-0">
            <span className="text-2xl shrink-0 leading-none" role="img" aria-label="Tipo de comida">
              {emoji}
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-bocado-text leading-tight group-hover:text-bocado-green transition-colors line-clamp-2">
                {recipe.title}
              </h3>

              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {isRestaurant && recipe.cuisine && (
                  <span className="px-2 py-1 bg-bocado-green/10 text-bocado-green rounded-lg font-bold">
                    {recipe.cuisine}
                  </span>
                )}

                {!isRestaurant && (
                  <span className="px-2 py-1 bg-bocado-background text-bocado-dark-gray rounded-lg font-medium">
                    ⏱️ {recipe.time}
                  </span>
                )}

                {recipe.calories !== 'N/A' && (
                  <span className="px-2 py-1 bg-bocado-background text-bocado-dark-gray rounded-lg font-medium">
                    🔥 {recipe.calories}
                  </span>
                )}

                {!isRestaurant && recipe.difficulty && recipe.difficulty !== 'N/A' && (
                  <span className={`px-2 py-1 rounded-lg font-medium ${getDifficultyStyle(recipe.difficulty)}`}>
                    {recipe.difficulty}
                  </span>
                )}
              </div>

              {showSavings && (
                <span className="inline-block mt-2 text-xs font-medium text-bocado-green bg-bocado-green/10 px-2 py-1 rounded-lg">
                  ✨ Usa ingredientes que ya tienes
                </span>
              )}

              {/* Macros expandibles (solo si existen) */}
              {hasMacros && recipe.calories !== 'N/A' && (
                <div className="mt-3 pt-3 border-t border-bocado-background">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMacros(!showMacros);
                      if (!showMacros) {
                        trackEvent('macros_expanded', {
                          item_title: recipe.title,
                        });
                      }
                    }}
                    className="flex items-center justify-between w-full text-left text-xs font-semibold text-bocado-dark-gray hover:text-bocado-green transition-colors"
                  >
                    <span>📊 Información nutricional</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showMacros ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showMacros && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-blue-50 p-2 rounded-lg text-center">
                        <div className="font-bold text-blue-600">{recipe.protein_g}g</div>
                        <div className="text-blue-500 text-[10px] mt-0.5">Proteínas</div>
                      </div>
                      <div className="bg-amber-50 p-2 rounded-lg text-center">
                        <div className="font-bold text-amber-600">{recipe.carbs_g}g</div>
                        <div className="text-amber-500 text-[10px] mt-0.5">Carbohidratos</div>
                      </div>
                      <div className="bg-rose-50 p-2 rounded-lg text-center">
                        <div className="font-bold text-rose-600">{recipe.fat_g}g</div>
                        <div className="text-rose-500 text-[10px] mt-0.5">Grasas</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <Tooltip text={saved ? "Guardado ❤️" : "Guardar para después"} position="left">
              <button
                onClick={handleSaveClick}
                disabled={toggleMutation.isPending}
                className={`p-2 rounded-full transition-all active:scale-90 disabled:opacity-50 ${
                  saved ? 'text-red-500' : 'text-bocado-gray hover:text-red-400'
                }`}
              >
                <Heart className="w-6 h-6" fill={saved ? "currentColor" : "none"} />
              </button>
            </Tooltip>

            <ChevronDown
              className={`w-5 h-5 text-bocado-gray transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-bocado-border space-y-4 animate-fade-in">
          
          {/* SECCIÓN PARA RESTAURANTES */}
          {isRestaurant && (
            <RestaurantInfoSection
              recipe={recipe}
              onOpenMaps={handleOpenMaps}
              onSearchMapsFallback={handleSearchMapsFallback}
              onCopyAddress={handleCopyAddress}
              copiedAddress={copiedAddress}
            />
          )}

          {/* Selector de porciones (solo para recetas) */}
          {!isRestaurant && recipe.ingredients && recipe.ingredients.length > 0 && (
            <PortionSelector
              value={servings}
              onChange={(val) => {
                setServings(val);
                trackEvent('recipe_servings_changed', {
                  item_title: recipe.title,
                  from: servings,
                  to: val,
                });
              }}
              baseServings={baseServings}
              className="mb-4"
            />
          )}

          {/* Ingredientes (solo para recetas en casa) */}
          {!isRestaurant && recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-bocado-dark-gray uppercase tracking-wider mb-2">
                Ingredientes {servings !== baseServings && `(${servings} pers.)`}
              </h4>
              <ul className="space-y-1.5">
                {scaledIngredients.map((ing, index) => (
                  <li key={index} className="text-sm text-bocado-text flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-bocado-green rounded-full mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preparación (solo para recetas en casa) */}
          {!isRestaurant && recipe.instructions && recipe.instructions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-bocado-dark-gray uppercase tracking-wider mb-2">
                Preparación
              </h4>
              <div className="space-y-2">
                {recipe.instructions.map((step, i) => (
                  <div key={i} className="flex gap-2 text-sm text-bocado-text">
                    <span className="text-bocado-green font-bold shrink-0">{i + 1}.</span>
                    <p className="leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón de feedback */}
          <button
            onClick={handleFeedbackOpen}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="w-full py-3 rounded-xl bg-bocado-dark-green text-white font-semibold text-sm shadow-bocado hover:bg-bocado-green active:scale-[0.98] transition-all"
            type="button"
          >
            {isRestaurant ? '📍 Fui al lugar' : '🍳 La preparé'}
          </button>
        </div>
      )}

      {/* Feedback Modal - Renderizado fuera del flujo del card para evitar problemas de propagación */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={handleFeedbackClose}
        itemTitle={recipe.title}
        type={isRestaurant ? 'away' : 'home'}
        originalData={recipe}
      />
    </div>
  );
});

MealCard.displayName = 'MealCard';

export default MealCard;
