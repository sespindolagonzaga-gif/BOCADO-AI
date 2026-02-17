import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSavedItems, useToggleSavedItem } from '../hooks/useSavedItems';
import { useAuthStore } from '../stores/authStore';
import { trackEvent } from '../firebaseConfig';
import { MapPin } from './icons';
import MealCard from './MealCard';
import { Meal } from '../types';
import { RecipeListSkeleton } from './skeleton';
import { useTranslation } from '../contexts/I18nContext';

const SavedRestaurantsScreen: React.FC = () => {
  const { t } = useTranslation();
  const [mealToConfirmDelete, setMealToConfirmDelete] = useState<Meal | null>(null);
  
  const { user } = useAuthStore();
  
  // ✅ TANSTACK QUERY + PAGINACIÓN
  const savedItems = useSavedItems(user?.uid, 'restaurant');
  const restaurants = savedItems.data || [];
  const isLoading = savedItems.isLoading;
  const fetchNextPage = savedItems.fetchNextPage;
  const hasNextPage = savedItems.hasNextPage;
  const isFetchingNextPage = savedItems.isFetchingNextPage;
  const totalLoaded = savedItems.totalLoaded;
  
  const toggleMutation = useToggleSavedItem();

  // ✅ ANALÍTICA: Trackear cuando se carga la pantalla
  useEffect(() => {
    if (user) {
      trackEvent('saved_restaurants_screen_viewed', {
        count: restaurants.length,
        userId: user.uid
      });
    }
  }, [user, restaurants.length]);

  // Mapear a Meal[] (preserva todos los campos incluyendo link_maps)
  const savedRestaurants: Meal[] = restaurants.map((saved: any) => ({
    mealType: saved.mealType,
    recipe: saved.recipe // Ahora incluye link_maps, direccion_aproximada, etc.
  }));

  const handleDeleteRequest = (meal: Meal) => {
    // ✅ ANALÍTICA: Intención de eliminar
    trackEvent('saved_restaurant_delete_initiated', {
      restaurant: meal.recipe.title
    });
    setMealToConfirmDelete(meal);
  };

  const confirmDelete = () => {
    if (!mealToConfirmDelete || !user) return;

    const isSaved = restaurants.some((r: any) => r.recipe.title === mealToConfirmDelete.recipe.title);
    
    // ✅ ANALÍTICA: Confirmación de eliminación
    trackEvent('saved_restaurant_deleted', {
      restaurant: mealToConfirmDelete.recipe.title
    });
    
    toggleMutation.mutate({
      userId: user.uid,
      type: 'restaurant',
      recipe: mealToConfirmDelete.recipe,
      mealType: mealToConfirmDelete.mealType,
      isSaved: true,
    });
    
    setMealToConfirmDelete(null);
  };

  // ✅ Manejar expansión para analytics
  const handleInteraction = (type: string, data?: any) => {
    if (type === 'expand' && data?.recipe) {
      trackEvent('saved_restaurant_expanded', {
        restaurant: data.recipe
      });
    }
    if (type === 'save') {
      handleDeleteRequest(data);
    }
  };

  if (isLoading) {
    return <RecipeListSkeleton count={4} />;
  }

  return (
    <div className="flex-1 flex flex-col animate-fade-in relative">
      <div className="text-center mb-6 px-4 pt-2">
        <MapPin className="w-6 h-6 text-bocado-green mx-auto mb-2" />
        <h2 className="text-xl font-bold text-bocado-dark-green">{t('saved.title')}</h2>
        <p className="text-xs text-bocado-gray">
          {totalLoaded === 1 ? t('saved.count', { count: totalLoaded }) : t('saved.countPlural', { count: totalLoaded })}
        </p>
      </div>

      <div className="flex-1 px-4 pb-8 min-h-0">
        {savedRestaurants.length === 0 ? (
          <div className="text-center py-12 px-6 bg-bocado-background rounded-2xl border-2 border-dashed border-bocado-border">
            <p className="text-bocado-gray text-base mb-2">{t('saved.emptyState')}</p>
            <p className="text-xs text-bocado-gray/70">{t('saved.emptyStateSubtitle')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedRestaurants.map((meal, index) => (
              <MealCard 
                key={meal.recipe.title + index} 
                meal={meal}
                onInteraction={handleInteraction}
              />
            ))}
            
            {/* Botón Cargar Más */}
            {hasNextPage && (
              <div className="pt-4 pb-2">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full py-3 px-4 bg-bocado-background text-bocado-dark-gray font-medium rounded-xl border border-bocado-border hover:bg-bocado-border/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">{t('saved.loading')}</span>
                    </>
                  ) : (
                    <span className="text-sm">{t('saved.loadMore')}</span>
                  )}
                </button>
              </div>
            )}
            
            {/* Mensaje de fin */}
            {!hasNextPage && savedRestaurants.length > 0 && (
              <p className="text-center text-xs text-bocado-gray/60 py-4">
                {t('saved.noMore')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {mealToConfirmDelete && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-bocado w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🗑️</span>
            </div>
            <h3 className="text-lg font-bold text-bocado-text mb-2">{t('saved.deleteTitle')}</h3>
            <p className="text-sm text-bocado-gray mb-2">
              "{mealToConfirmDelete.recipe.title}"
            </p>
            {/* ✅ Mostrar dirección si existe para confirmar cuál es */}
            {mealToConfirmDelete.recipe.direccion_aproximada && (
              <p className="text-xs text-bocado-gray/60 mb-6">
                📍 {mealToConfirmDelete.recipe.direccion_aproximada}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setMealToConfirmDelete(null)}
                className="flex-1 bg-bocado-background text-bocado-dark-gray font-bold py-3 rounded-full text-sm"
              >
                {t('saved.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={toggleMutation.isPending}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-full text-sm disabled:opacity-50"
              >
                {toggleMutation.isPending ? '...' : t('saved.delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SavedRestaurantsScreen;
