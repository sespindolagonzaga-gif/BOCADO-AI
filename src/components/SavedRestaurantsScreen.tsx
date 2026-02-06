import React, { useEffect, useState } from 'react';
import { useSavedRecipesStore } from '../stores/savedRecipesStore';
import { useAuthStore } from '../stores/authStore';
import { LocationIcon } from './icons/LocationIcon';
import MealCard from './MealCard';
import { Meal } from '../types';

const SavedRestaurantsScreen: React.FC = () => {
  const [mealToConfirmDelete, setMealToConfirmDelete] = useState<Meal | null>(null);
  
  // ✅ ZUSTAND: Usamos el mismo store (maneja recetas y restaurantes internamente)
  const { 
    recipes, // Contiene tanto recetas como restaurantes (filtramos por tipo)
    isLoading, 
    removeRecipe,
    syncWithFirebase 
  } = useSavedRecipesStore();
  
  const { user } = useAuthStore();

  // Sincronizar con Firebase al montar (colección saved_restaurants)
  useEffect(() => {
    if (user?.uid) {
      // Nota: Necesitarás extender el store para soportar saved_restaurants
      // o crear un store separado useSavedRestaurantsStore similar
      syncWithFirebase(user.uid);
    }
  }, [user?.uid, syncWithFirebase]);

  // Filtrar solo restaurantes (dificultad === 'Restaurante')
  const savedRestaurants: Meal[] = recipes
    .filter(saved => saved.recipe.difficulty === 'Restaurante')
    .map(saved => ({
      mealType: saved.mealType || 'Lugar Guardado',
      recipe: saved.recipe
    }));

  const handleDeleteRequest = (meal: Meal) => {
    setMealToConfirmDelete(meal);
  };

  const confirmDelete = async () => {
    if (!mealToConfirmDelete || !user) return;

    // Generar ID igual que en el store
    const recipeId = mealToConfirmDelete.recipe.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);

    // ✅ Eliminar via Zustand
    removeRecipe(recipeId);
    
    setMealToConfirmDelete(null);
  };

  if (isLoading && recipes.length === 0) {
    return (
      <div className="flex-1 flex flex-col animate-fade-in">
        <div className="text-center mb-6 px-4 pt-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <LocationIcon className="w-6 h-6 text-bocado-green" />
            <h2 className="text-xl font-bold text-bocado-dark-green">Mis Lugares</h2>
          </div>
        </div>
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6 px-4 pt-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <LocationIcon className="w-6 h-6 text-bocado-green" />
          <h2 className="text-xl font-bold text-bocado-dark-green">Mis Lugares</h2>
        </div>
        <p className="text-xs text-bocado-gray">Restaurantes guardados</p>
        {isLoading && <p className="text-[10px] text-bocado-green mt-1">Sincronizando...</p>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 no-scrollbar">
        {savedRestaurants.length === 0 ? (
          <div className="text-center py-12 px-6 bg-bocado-background rounded-2xl border-2 border-dashed border-bocado-border mx-4">
            <p className="text-bocado-gray text-base mb-2">Aún no has guardado lugares</p>
            <p className="text-xs text-bocado-gray/70">Dale ❤️ a los restaurantes para verlos aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedRestaurants.map((meal, index) => (
              <MealCard 
                key={index} 
                meal={meal}
                onInteraction={(type) => {
                  if (type === 'save') handleDeleteRequest(meal);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {mealToConfirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-bocado w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">🗑️</span>
            </div>
            <h3 className="text-lg font-bold text-bocado-text mb-2">¿Eliminar lugar?</h3>
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
                disabled={isLoading}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-full text-sm hover:bg-red-600 active:scale-95 transition-colors disabled:opacity-50"
              >
                {isLoading ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedRestaurantsScreen;