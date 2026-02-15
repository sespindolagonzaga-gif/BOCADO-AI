import React, { useState } from 'react';
import { useSavedItems, useToggleSavedItem } from '../hooks/useSavedItems';
import { useAuthStore } from '../stores/authStore';
import { BookOpen } from './icons';
import MealCard from './MealCard';
import { Meal } from '../types';
import { RecipeListSkeleton } from './skeleton';

const SavedRecipesScreen: React.FC = () => {
  const [mealToConfirmDelete, setMealToConfirmDelete] = useState<Meal | null>(null);
  
  const { user } = useAuthStore();
  
  // ✅ TANSTACK QUERY + PAGINACIÓN
  const savedItems = useSavedItems(user?.uid, 'recipe');
  const recipes = savedItems.data || [];
  const isLoading = savedItems.isLoading;
  const fetchNextPage = savedItems.fetchNextPage;
  const hasNextPage = savedItems.hasNextPage;
  const isFetchingNextPage = savedItems.isFetchingNextPage;
  const totalLoaded = savedItems.totalLoaded;
  
  const toggleMutation = useToggleSavedItem();

  const savedMeals: Meal[] = recipes.map((saved: any) => ({
    mealType: saved.mealType,
    recipe: saved.recipe
  }));

  const handleDeleteRequest = (meal: Meal) => {
    setMealToConfirmDelete(meal);
  };

  const confirmDelete = () => {
    if (!mealToConfirmDelete || !user) return;

    toggleMutation.mutate({
      userId: user.uid,
      type: 'recipe',
      recipe: mealToConfirmDelete.recipe,
      mealType: mealToConfirmDelete.mealType,
      isSaved: true,
    });
    
    setMealToConfirmDelete(null);
  };

  if (isLoading) {
    return <RecipeListSkeleton count={4} />;
  }

  return (
    <div className="flex-1 flex flex-col animate-fade-in relative">
      {/* Header */}
      <div className="text-center mb-6 px-4 pt-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <BookOpen className="w-6 h-6 text-bocado-green" />
          <h2 className="text-xl font-bold text-bocado-dark-green">Mis Recetas</h2>
        </div>
        <p className="text-xs text-bocado-gray">
          Tus platos favoritos guardados
          {totalLoaded > 0 && (
            <span className="ml-1 text-bocado-green font-medium">({totalLoaded})</span>
          )}
        </p>
        {toggleMutation.isPending && <p className="text-[10px] text-bocado-green mt-1">Sincronizando...</p>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
        {savedMeals.length === 0 ? (
          <div className="text-center py-12 px-6 bg-bocado-background rounded-2xl border-2 border-dashed border-bocado-border">
            <p className="text-bocado-gray text-base mb-2">Aún no has guardado recetas</p>
            <p className="text-xs text-bocado-gray/70">Dale ❤️ a las recetas para verlas aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedMeals.map((meal, index) => (
              <MealCard 
                key={meal.recipe.title + index} 
                meal={meal}
                onInteraction={(type) => {
                  if (type === 'save') handleDeleteRequest(meal);
                }}
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
                      <span className="text-sm">Cargando...</span>
                    </>
                  ) : (
                    <span className="text-sm">Cargar más recetas</span>
                  )}
                </button>
              </div>
            )}
            
            {/* Mensaje de fin */}
            {!hasNextPage && savedMeals.length > 0 && (
              <p className="text-center text-xs text-bocado-gray/60 py-4">
                No hay más recetas guardadas
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {mealToConfirmDelete && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-bocado w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🗑️</span>
            </div>
            <h3 className="text-lg font-bold text-bocado-text mb-2">¿Eliminar receta?</h3>
            <p className="text-sm text-bocado-gray mb-6">
              Se eliminará <span className="font-semibold text-bocado-text">"{mealToConfirmDelete.recipe.title}"</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMealToConfirmDelete(null)}
                className="flex-1 bg-bocado-background text-bocado-dark-gray font-bold py-3 rounded-full text-sm hover:bg-bocado-border transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={toggleMutation.isPending}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-full text-sm hover:bg-red-600 active:scale-95 transition-colors disabled:opacity-50"
              >
                {toggleMutation.isPending ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedRecipesScreen;
