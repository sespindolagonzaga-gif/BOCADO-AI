import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Recipe } from '../types';

interface SavedItem {
  id: string;
  recipe: Recipe;
  savedAt: number;
  mealType: string;
  userId: string;
}

interface SavedRecipesState {
  recipes: SavedItem[];      // saved_recipes
  restaurants: SavedItem[];  // saved_restaurants
  isLoading: boolean;
  isHydrated: boolean;
  
  // Acciones unificadas (con type)
  addItem: (type: 'recipe' | 'restaurant', recipe: Recipe, mealType: string, userId: string) => void;
  removeItem: (type: 'recipe' | 'restaurant', id: string) => void;
  toggleItem: (type: 'recipe' | 'restaurant', recipe: Recipe, mealType: string, userId: string) => boolean;
  isSaved: (type: 'recipe' | 'restaurant', id: string) => boolean;
  
  // Acciones específicas (compatibilidad hacia atrás)
  addRecipe: (recipe: Recipe, mealType: string, userId: string) => void;
  removeRecipe: (id: string) => void;
  toggleRecipe: (recipe: Recipe, mealType: string, userId: string) => boolean;
  
  // Nuevas acciones para restaurantes
  addRestaurant: (recipe: Recipe, mealType: string, userId: string) => void;
  removeRestaurant: (id: string) => void;
  toggleRestaurant: (recipe: Recipe, mealType: string, userId: string) => boolean;
  
  // Sincronización
  syncWithFirebase: (userId: string, type?: 'recipes' | 'restaurants' | 'both') => Promise<void>;
  clearItems: () => void;
}

const generateId = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
};

export const useSavedRecipesStore = create<SavedRecipesState>()(
  persist(
    (set, get) => ({
      recipes: [],
      restaurants: [],
      isLoading: false,
      isHydrated: false,

      // Método genérico interno
      addItem: (type, recipe, mealType, userId) => {
        const id = generateId(recipe.title);
        const key = type === 'recipe' ? 'recipes' : 'restaurants';
        const items = get()[key];
        
        const exists = items.find((r: SavedItem) => r.id === id);
        
        if (!exists) {
          const newItem: SavedItem = {
            id,
            recipe,
            mealType,
            userId,
            savedAt: Date.now(),
          };
          set((state) => ({
            [key]: [newItem, ...state[key]],
          }));
        }
      },

      removeItem: (type, id) => {
        const key = type === 'recipe' ? 'recipes' : 'restaurants';
        set((state) => ({
          [key]: state[key].filter((r: SavedItem) => r.id !== id),
        }));
      },

      toggleItem: (type, recipe, mealType, userId) => {
        const id = generateId(recipe.title);
        const isCurrentlySaved = get().isSaved(type, id);
        
        if (isCurrentlySaved) {
          get().removeItem(type, id);
          return false;
        } else {
          get().addItem(type, recipe, mealType, userId);
          return true;
        }
      },

      isSaved: (type, id) => {
        const key = type === 'recipe' ? 'recipes' : 'restaurants';
        return get()[key].some((r: SavedItem) => r.id === id);
      },

      // Compatibilidad hacia atrás para recetas
      addRecipe: (recipe, mealType, userId) => {
        get().addItem('recipe', recipe, mealType, userId);
      },

      removeRecipe: (id) => {
        get().removeItem('recipe', id);
      },

      toggleRecipe: (recipe, mealType, userId) => {
        return get().toggleItem('recipe', recipe, mealType, userId);
      },

      // Métodos para restaurantes
      addRestaurant: (recipe, mealType, userId) => {
        get().addItem('restaurant', recipe, mealType, userId);
      },

      removeRestaurant: (id) => {
        get().removeItem('restaurant', id);
      },

      toggleRestaurant: (recipe, mealType, userId) => {
        return get().toggleItem('restaurant', recipe, mealType, userId);
      },

      syncWithFirebase: async (userId, type = 'both') => {
        set({ isLoading: true });
        
        try {
          // Sincronizar recetas
          if (type === 'both' || type === 'recipes') {
            const recipesRef = collection(db, 'saved_recipes');
            const recipesSnapshot = await getDocs(query(recipesRef, where('user_id', '==', userId)));
            const firebaseRecipeIds = new Set(recipesSnapshot.docs.map(d => d.id));
            
            // Subir las que faltan en Firebase
            for (const item of get().recipes.filter(r => r.userId === userId)) {
              if (!firebaseRecipeIds.has(item.id)) {
                await setDoc(doc(recipesRef, item.id), {
                  user_id: userId,
                  recipe: item.recipe,
                  mealType: item.mealType,
                  savedAt: serverTimestamp(),
                });
              }
            }
            
            // Descargar las que faltan en local
            for (const docSnap of recipesSnapshot.docs) {
              const data = docSnap.data();
              const exists = get().recipes.find(r => r.id === docSnap.id);
              if (!exists) {
                set((state) => ({
                  recipes: [...state.recipes, {
                    id: docSnap.id,
                    recipe: data.recipe,
                    mealType: data.mealType,
                    userId,
                    savedAt: data.savedAt?.seconds ? data.savedAt.seconds * 1000 : Date.now(),
                  }],
                }));
              }
            }
          }

          // Sincronizar restaurantes
          if (type === 'both' || type === 'restaurants') {
            const restaurantsRef = collection(db, 'saved_restaurants');
            const restaurantsSnapshot = await getDocs(query(restaurantsRef, where('user_id', '==', userId)));
            const firebaseRestaurantIds = new Set(restaurantsSnapshot.docs.map(d => d.id));
            
            // Subir las que faltan
            for (const item of get().restaurants.filter(r => r.userId === userId)) {
              if (!firebaseRestaurantIds.has(item.id)) {
                await setDoc(doc(restaurantsRef, item.id), {
                  user_id: userId,
                  recipe: item.recipe,
                  mealType: item.mealType,
                  savedAt: serverTimestamp(),
                });
              }
            }
            
            // Descargar las que faltan
            for (const docSnap of restaurantsSnapshot.docs) {
              const data = docSnap.data();
              const exists = get().restaurants.find(r => r.id === docSnap.id);
              if (!exists) {
                set((state) => ({
                  restaurants: [...state.restaurants, {
                    id: docSnap.id,
                    recipe: data.recipe,
                    mealType: data.mealType,
                    userId,
                    savedAt: data.savedAt?.seconds ? data.savedAt.seconds * 1000 : Date.now(),
                  }],
                }));
              }
            }
          }
          
        } catch (error) {
          console.error('Error syncing:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      clearItems: () => set({ recipes: [], restaurants: [], isLoading: false }),
    }),
    {
      name: 'bocado-saved-items',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        recipes: state.recipes, 
        restaurants: state.restaurants 
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);