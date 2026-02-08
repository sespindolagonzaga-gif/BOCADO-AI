import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db, auth, trackEvent } from '../firebaseConfig';
import { collection, query, where, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { Plan, Meal } from '../types';
import MealCard from './MealCard';
import { useToggleSavedItem } from '../hooks/useSavedItems';

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

// --- PROCESAMIENTO DE RECETAS (EN CASA) ---
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
    } else if (Array.isArray(data.recetas)) {
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

    return { planTitle: "Recetas Sugeridas", greeting, meals, _id: doc.id, _createdAt: rawDate, interaction_id: interactionId };
  } catch (e) { return null; }
};

// --- PROCESAMIENTO DE RESTAURANTES (FUERA) ---
const processRecommendationDoc = (doc: DocumentSnapshot): Plan | null => {
  try {
    const data = doc.data();
    if (!data) return null;
    const interactionId = data.interaction_id || data.user_interactions;
    const rawDate = data.fecha_creacion || data.createdAt;
    
    let items = data.recomendaciones?.recomendaciones || data.recomendaciones || [];
    let greeting = data.saludo_personalizado || "Opciones fuera de casa";
    if (!Array.isArray(items) || items.length === 0) return null;

    const meals: Meal[] = items.map((rec: any, index: number) => ({
      mealType: `Sugerencia ${index + 1}`,
      recipe: {
        title: rec.nombre_restaurante || rec.nombre || 'Restaurante',
        cuisine: rec.tipo_comida || rec.cuisine || rec.tipo || 'Gastronomía', 
        time: 'N/A', 
        difficulty: 'Restaurante', 
        calories: 'N/A', 
        savingsMatch: 'Ninguno',
        
        // Campos separados para restaurantes
        link_maps: rec.link_maps || null,
        direccion_aproximada: rec.direccion_aproximada || null,
        plato_sugerido: rec.plato_sugerido || null,
        por_que_es_bueno: rec.por_que_es_bueno || null,
        hack_saludable: rec.hack_saludable || null,
        
        // Arrays vacíos para restaurantes
        ingredients: [],
        instructions: []
      }
    }));

    return { planTitle: "Lugares Recomendados", greeting, meals, _id: doc.id, _createdAt: rawDate, interaction_id: interactionId };
  } catch (e) { return null; }
};

// --- HOOK DE CONSULTA ---
const usePlanQuery = (planId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: ['plan', planId, userId],
    queryFn: () => {
      return new Promise<Plan>((resolve, reject) => {
        if (!planId || !userId) return reject(new Error('Faltan parámetros'));
        let resolved = false;
        const timeoutId = setTimeout(() => { if (!resolved) reject(new Error('Timeout: No se encontró el plan')); }, 90000);

        const unsubRec = onSnapshot(query(collection(db, "historial_recetas"), where("user_id", "==", userId)), (snap) => {
          const found = snap.docs.map(processFirestoreDoc).find(p => p?.interaction_id === planId || p?._id === planId);
          if (found && !resolved) { resolved = true; clearTimeout(timeoutId); unsubRec(); unsubRem(); resolve(found); }
        }, (err) => { if (!resolved) reject(err); });

        const unsubRem = onSnapshot(query(collection(db, "historial_recomendaciones"), where("user_id", "==", userId)), (snap) => {
          const found = snap.docs.map(processRecommendationDoc).find(p => p?.interaction_id === planId || p?._id === planId);
          if (found && !resolved) { resolved = true; clearTimeout(timeoutId); unsubRec(); unsubRem(); resolve(found); }
        }, (err) => { if (!resolved) reject(err); });

        return () => { clearTimeout(timeoutId); unsubRec(); unsubRem(); };
      });
    },
    enabled: !!planId && !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

const PlanScreen: React.FC<PlanScreenProps> = ({ planId, onStartNewPlan }) => {
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);
  const user = auth.currentUser;
  const { data: selectedPlan, isLoading, isError, error, refetch } = usePlanQuery(planId, user?.uid);
  const toggleMutation = useToggleSavedItem();

  useEffect(() => {
    if (selectedPlan) {
      trackEvent('plan_viewed', {
        plan_id: planId,
        plan_type: selectedPlan.planTitle,
        userId: user?.uid
      });
    }
  }, [selectedPlan, planId, user]);

  useEffect(() => {
    if (isError) {
      trackEvent('plan_error', {
        plan_id: planId,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [isError, error, planId]);

  useEffect(() => {
    if (!isLoading) return;
    const intervalId = setInterval(() => {
      setCurrentLoadingMessage(prev => {
        const idx = loadingMessages.indexOf(prev);
        return loadingMessages[(idx + 1) % loadingMessages.length];
      });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  const handleToggleSave = (meal: Meal) => {
    if (!user) return;
    const isRestaurant = meal.recipe.difficulty === 'Restaurante';
    
    trackEvent('plan_item_saved', {
        item_title: meal.recipe.title,
        type: isRestaurant ? 'restaurant' : 'recipe'
    });

    toggleMutation.mutate({
      userId: user.uid,
      type: isRestaurant ? 'restaurant' : 'recipe',
      recipe: meal.recipe,
      mealType: meal.mealType,
      isSaved: false, 
    });
  };

  const handleStartNew = () => {
    trackEvent('plan_return_home');
    onStartNewPlan();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-bocado-dark-green mb-2">Preparando tu mesa... 🧑‍🍳</h2>
        <p className="text-sm text-bocado-gray text-center max-w-xs">{currentLoadingMessage}</p>
      </div>
    );
  }

  if (isError || !selectedPlan) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="bg-white p-6 rounded-3xl shadow-bocado text-center w-full max-w-sm animate-fade-in">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-red-500 mb-2">Ocurrió un problema</h2>
          <p className="text-sm text-bocado-gray mb-6">{error instanceof Error ? error.message : 'No se pudo cargar el plan'}</p>
          <button onClick={() => refetch()} className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all">
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    // ✅ CORREGIDO: h-full y min-h-0 para forzar el scroll correcto
    <div className="flex-1 flex flex-col h-full min-h-0 animate-fade-in">
      {/* ✅ CORREGIDO: overflow-y-auto con flex-1 y min-h-0 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 no-scrollbar min-h-0">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-bocado-dark-green mb-3">¡Listo! 🥗</h1>
          <div className="p-4 bg-bocado-green/10 rounded-2xl">
            <p className="text-bocado-dark-green italic text-sm leading-relaxed">"{selectedPlan.greeting}"</p>
          </div>
        </div>
        
        {/* ✅ Agregado max-w-2xl mx-auto para mejor lectura en desktop */}
        <div className="space-y-3 max-w-2xl mx-auto">
          {selectedPlan.meals.map((meal, index) => (
            <MealCard 
              key={index} 
              meal={meal} 
              onInteraction={(type) => {
                if (type === 'save') handleToggleSave(meal);
              }} 
            />
          ))}
        </div>
        
        {/* Espacio adicional al final para asegurar que todo sea visible */}
        <div className="h-20"></div>
      </div>
      
      {/* ✅ Botón fijo abajo con z-index */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t border-bocado-border bg-white z-10 md:relative md:bottom-auto md:border-t-0 md:bg-transparent md:px-4 md:py-2">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={handleStartNew}
            className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanScreen;