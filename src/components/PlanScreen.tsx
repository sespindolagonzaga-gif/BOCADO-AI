import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, DocumentSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plan, Meal } from '../types';
import MealCard from './MealCard';
import { useSavedRecipesStore } from '../stores/savedRecipesStore';

interface PlanScreenProps {
  planId: string;
  onStartNewPlan: () => void;
}

const loadingMessages = [
  "Contactando a nuestros chefs...",
  "Buscando los mejores lugares cercanos...",
  "Consultando tu perfil nutricional...",
  "Analizando menús saludables...",
  "Creando recomendaciones para ti...",
  "¡Casi listo! Preparando la mesa...",
];

// Iconos inline (para evitar dependencias de archivos externos)
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const processFirestoreDoc = (doc: DocumentSnapshot): Plan | null => {
  try {
    const data = doc.data();
    if (!data) return null;
    
    const interactionId = data.interaction_id || data.user_interactions;
    const rawDate = data.fecha_creacion || data.createdAt;

    let recipesArray: any[] = [];
    let greeting = data.saludo_personalizado || "Aquí tienes tu plan";
    
    if (data.receta && Array.isArray(data.receta.recetas)) {
        recipesArray = data.receta.recetas;
        if (data.saludo_personalizado) greeting = data.saludo_personalizado;
    } 
    else if (Array.isArray(data.recetas)) {
        recipesArray = data.recetas;
    }

    if (recipesArray.length === 0) return null;

    const meals: Meal[] = recipesArray.map((rec: any, index: number) => ({
      mealType: `Opción ${index + 1}`,
      recipe: {
        title: rec.titulo || rec.nombre || 'Receta',
        time: rec.tiempo_estimado || rec.tiempo_preparacion || 'N/A',
        difficulty: rec.dificultad || 'N/A',
        calories: rec.macros_por_porcion?.kcal || rec.kcal || 'N/A',
        savingsMatch: rec.coincidencia_despensa || 'Ninguno',
        ingredients: Array.isArray(rec.ingredientes) ? rec.ingredientes : [],
        instructions: Array.isArray(rec.pasos_preparacion) ? rec.pasos_preparacion : (Array.isArray(rec.instrucciones) ? rec.instrucciones : [])
      },
    }));

    return {
      planTitle: "Recetas Sugeridas", 
      greeting, 
      meals, 
      _id: doc.id,
      _createdAt: rawDate, 
      interaction_id: interactionId,
    };
  } catch (e) { 
    console.error("Error procesando doc:", e);
    return null; 
  }
};

const processRecommendationDoc = (doc: DocumentSnapshot): Plan | null => {
  try {
    const data = doc.data();
    if (!data) return null;
    
    const interactionId = data.interaction_id || data.user_interactions;
    const rawDate = data.fecha_creacion || data.createdAt;

    let items = data.recomendaciones || [];
    let greeting = data.saludo_personalizado || "Opciones fuera de casa";

    if (!Array.isArray(items) || items.length === 0) return null;

    const meals: Meal[] = items.map((rec: any, index: number) => ({
      mealType: `Sugerencia ${index + 1}`,
      recipe: {
        title: rec.nombre_restaurante || 'Restaurante',
        time: 'N/A', 
        difficulty: 'Restaurante', 
        calories: 'N/A', 
        savingsMatch: 'Ninguno',
        cuisine: rec.tipo_comida || '',
        ingredients: [rec.direccion_aproximada, rec.link_maps].filter(Boolean),
        instructions: [rec.plato_sugerido, rec.por_que_es_bueno, rec.hack_saludable].filter(Boolean)
      }
    }));

    return {
      planTitle: "Lugares Recomendados", 
      greeting, 
      meals, 
      _id: doc.id,
      _createdAt: rawDate, 
      interaction_id: interactionId,
    };
  } catch (e) { 
    console.error("Error procesando recomendación:", e);
    return null; 
  }
};

const usePlanQuery = (planId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: ['plan', planId, userId],
    queryFn: () => {
      return new Promise<Plan>((resolve, reject) => {
        if (!planId || !userId) {
          reject(new Error('Faltan parámetros'));
          return;
        }

        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            reject(new Error('Timeout: No se encontró el plan'));
          }
        }, 45000);

        const unsubRec = onSnapshot(
          query(collection(db, "historial_recetas"), where("user_id", "==", userId)),
          (snap) => {
            const plans = snap.docs.map(processFirestoreDoc).filter((p): p is Plan => p !== null);
            const found = plans.find(p => p.interaction_id === planId || p._id === planId);
            
            if (found && !resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              unsubRec();
              unsubRem();
              resolve(found);
            }
          },
          (err) => {
            if (!resolved) {
              clearTimeout(timeoutId);
              reject(err);
            }
          }
        );

        const unsubRem = onSnapshot(
          query(collection(db, "historial_recomendaciones"), where("user_id", "==", userId)),
          (snap) => {
            const plans = snap.docs.map(processRecommendationDoc).filter((p): p is Plan => p !== null);
            const found = plans.find(p => p.interaction_id === planId || p._id === planId);
            
            if (found && !resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              unsubRec();
              unsubRem();
              resolve(found);
            }
          },
          (err) => {
            if (!resolved) {
              clearTimeout(timeoutId);
              reject(err);
            }
          }
        );

        return () => {
          clearTimeout(timeoutId);
          unsubRec();
          unsubRem();
        };
      });
    },
    enabled: !!planId && !!userId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
};

const PlanScreen: React.FC<PlanScreenProps> = ({ planId, onStartNewPlan }) => {
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);
  const messageIndexRef = useRef(0);
  
  const { toggleRecipe, toggleRestaurant, isSaved } = useSavedRecipesStore();
  const user = auth.currentUser;

  const { 
    data: selectedPlan, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = usePlanQuery(planId, user?.uid);

  useEffect(() => {
    if (!isLoading) return;
    
    const intervalId = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % loadingMessages.length;
      setCurrentLoadingMessage(loadingMessages[messageIndexRef.current]);
    }, 4000);
    
    return () => clearInterval(intervalId);
  }, [isLoading]);

  useEffect(() => {
    if (user?.uid) {
      useSavedRecipesStore.getState().syncWithFirebase(user.uid);
    }
  }, [user?.uid]);

  const handleToggleSave = async (meal: Meal) => {
    if (!user) return;
    
    const { recipe } = meal;
    const isRestaurant = recipe.difficulty === 'Restaurante';
    
    // ✅ CORREGIDO: Generar ID y determinar tipo primero
    const recipeId = recipe.title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
    const type = isRestaurant ? 'restaurant' : 'recipe';
    
    // Toggle en Zustand
    if (isRestaurant) {
      toggleRestaurant(recipe, meal.mealType, user.uid);
    } else {
      toggleRecipe(recipe, meal.mealType, user.uid);
    }
    
    // Sincronización manual con Firebase (colecciones antiguas)
    const collectionName = isRestaurant ? 'saved_restaurants' : 'saved_recipes';
    const docId = `${user.uid}_${recipe.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    
    try {
      // ✅ CORREGIDO: Llamar isSaved con 2 argumentos
      const currentlySaved = isSaved(type, recipeId);
      
      if (currentlySaved) {
        await setDoc(doc(db, collectionName, docId), { 
          user_id: user.uid, 
          recipe, 
          savedAt: serverTimestamp(), 
          mealType: meal.mealType 
        });
      } else {
        await deleteDoc(doc(db, collectionName, docId));
      }
    } catch (e) { 
      console.error("Error sincronizando guardado:", e);
      // Revertir en Zustand si falla
      if (isRestaurant) {
        toggleRestaurant(recipe, meal.mealType, user.uid);
      } else {
        toggleRecipe(recipe, meal.mealType, user.uid);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 bg-bocado-background">
        <div className="w-16 h-16 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-bold text-bocado-dark-green mb-3">Preparando tu mesa... 🧑‍🍳</h2>
        <p className="text-sm text-bocado-gray text-center max-w-xs animate-pulse">{currentLoadingMessage}</p>
      </div>
    );
  }

  if (isError || !selectedPlan) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-6 bg-bocado-background">
        <div className="bg-white p-6 rounded-3xl shadow-bocado text-center w-full max-w-sm animate-fade-in">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-red-500 mb-2">Ocurrió un problema</h2>
          <p className="text-sm text-bocado-gray mb-6">
            {error instanceof Error ? error.message : 'No se pudo cargar el plan'}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => refetch()} 
              className="flex-1 bg-bocado-background text-bocado-dark-gray font-bold py-3 px-4 rounded-full border-2 border-bocado-border hover:bg-bocado-cream active:scale-95 transition-all"
            >
              Reintentar
            </button>
            <button 
              onClick={onStartNewPlan} 
              className="flex-1 bg-bocado-green text-white font-bold py-3 px-4 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
            >
              Nuevo plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bocado-background animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bocado-background/95 backdrop-blur-sm border-b border-bocado-border px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={onStartNewPlan}
            className="p-2 -ml-2 rounded-full hover:bg-bocado-cream transition-colors active:scale-95 text-bocado-dark-gray"
            aria-label="Volver"
          >
            <ArrowLeftIcon />
          </button>
          
          <div className="text-center">
            <h1 className="text-lg font-bold text-bocado-dark-gray line-clamp-1">
              {selectedPlan.planTitle || 'Tu Plan'}
            </h1>
            <p className="text-xs text-bocado-gray">
              {selectedPlan.meals?.length || 0} opciones
            </p>
          </div>

          <button
            onClick={onStartNewPlan}
            className="p-2 -mr-2 rounded-full bg-bocado-green/10 text-bocado-green hover:bg-bocado-green hover:text-white transition-all active:scale-95"
            aria-label="Nuevo plan"
          >
            <SparklesIcon />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-32 no-scrollbar">
        <div className="text-center mb-6">
          <div className="p-4 bg-bocado-green/10 rounded-2xl border border-bocado-green/20">
            <p className="text-bocado-dark-green italic text-sm leading-relaxed">"{selectedPlan.greeting}"</p>
          </div>
        </div>
        
        <div className="space-y-4 max-w-md mx-auto">
          {selectedPlan.meals.map((meal, index) => (
            <div key={index} className="relative animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="absolute -left-2 top-4 z-10">
                <span className="bg-bocado-dark-green text-white text-[10px] font-bold px-2 py-1 rounded-r-lg shadow-sm uppercase tracking-wider">
                  {meal.mealType}
                </span>
              </div>
              
              <MealCard
                meal={meal}
                onInteraction={(type, data) => {
                  if (type === 'save') handleToggleSave(meal);
                  console.log(`[Analytics] ${type}:`, data);
                }}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t border-bocado-border bg-white/95 backdrop-blur-sm">
        <div className="max-w-md mx-auto">
          <button 
            onClick={onStartNewPlan} 
            className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
          >
            Crear nuevo plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanScreen;