import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, auth, serverTimestamp } from '../firebaseConfig';
import { collection, query, where, onSnapshot, DocumentSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Plan, Meal } from '../types';
import MealCard from './MealCard';

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

const ErrorDisplay: React.FC<{ errorCode: string; errorMessage: string; onRetry: () => void; }> = ({ errorCode, errorMessage, onRetry }) => (
    <div className="bg-white p-8 rounded-2xl shadow-lg text-center animate-fade-in">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
             <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold text-red-600 mt-4">Ocurrió un problema</h2>
        <p className="mt-4 text-bocado-dark-gray">{errorMessage}</p>
        <button onClick={onRetry} className="mt-8 bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg hover:bg-bocado-green-light">
            Intentar de nuevo
        </button>
    </div>
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
      planTitle: "Recetas Sugeridas", greeting, meals, _id: doc.id,
      _createdAt: rawDate, interaction_id: interactionId,
    };
  } catch (e) { return null; }
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
        time: 'N/A', difficulty: 'Restaurante', calories: 'N/A', savingsMatch: 'Ninguno',
        cuisine: rec.tipo_comida || '',
        ingredients: [rec.direccion_aproximada, rec.link_maps].filter(Boolean),
        instructions: [rec.plato_sugerido, rec.por_que_es_bueno, rec.hack_saludable].filter(Boolean)
      }
    }));

    return {
      planTitle: "Lugares Recomendados", greeting, meals, _id: doc.id,
      _createdAt: rawDate, interaction_id: interactionId,
    };
  } catch (e) { return null; }
};

const PlanScreen: React.FC<PlanScreenProps> = ({ planId, onStartNewPlan }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);
  const [recipePlans, setRecipePlans] = useState<Plan[]>([]);
  const [restaurantPlans, setRestaurantPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [savedRecipeTitles, setSavedRecipeTitles] = useState<Set<string>>(new Set());
  const [savedRestaurantTitles, setSavedRestaurantTitles] = useState<Set<string>>(new Set());
  const [savingCardTitle, setSavingCardTitle] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const planFoundRef = useRef(false);

  useEffect(() => {
    if (!isLoading) return;
    const intervalId = setInterval(() => {
      setCurrentLoadingMessage(prev => {
        const currentIndex = loadingMessages.indexOf(prev);
        return loadingMessages[(currentIndex + 1) % loadingMessages.length];
      });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsubR = onSnapshot(query(collection(db, 'saved_recipes'), where('user_id', '==', user.uid)), (snap) => {
        setSavedRecipeTitles(new Set(snap.docs.map(d => d.data().recipe.title)));
    });
    const unsubRes = onSnapshot(query(collection(db, 'saved_restaurants'), where('user_id', '==', user.uid)), (snap) => {
        setSavedRestaurantTitles(new Set(snap.docs.map(d => d.data().recipe.title)));
    });
    return () => { unsubR(); unsubRes(); };
  }, []);

  useEffect(() => {
    if (!planId) return;
    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    setHasError(false);
    
    const unsubRec = onSnapshot(query(collection(db, "historial_recetas"), where("user_id", "==", user.uid)), (snap) => {
        setRecipePlans(snap.docs.map(processFirestoreDoc).filter((p): p is Plan => p !== null));
    });

    const unsubRem = onSnapshot(query(collection(db, "historial_recomendaciones"), where("user_id", "==", user.uid)), (snap) => {
        setRestaurantPlans(snap.docs.map(processRecommendationDoc).filter((p): p is Plan => p !== null));
    });

    // Timeout de 45 segundos para mostrar error si no llegan datos
    const timeout = setTimeout(() => {
        if (!planFoundRef.current) {
            setHasError(true);
            setIsLoading(false);
        }
    }, 45000);

    return () => { 
        unsubRec(); 
        unsubRem(); 
        clearTimeout(timeout);
    };
  }, [planId]);

  const recentPlans = useMemo(() => {
      const all = [...recipePlans, ...restaurantPlans];
      return all.sort((a, b) => {
             const getTime = (date: any) => {
                if (date && typeof date === 'object' && 'seconds' in date) return date.seconds * 1000;
                return new Date(date).getTime() || 0;
             };
             return getTime(b._createdAt) - getTime(a._createdAt);
      });
  }, [recipePlans, restaurantPlans]);

  useEffect(() => {
      if (recentPlans.length > 0) {
          const found = recentPlans.find(p => p.interaction_id === planId);
          if (found) {
              setSelectedPlan(found);
              setIsLoading(false);
              planFoundRef.current = true;
          }
      }
  }, [recentPlans, planId]);

  const handleToggleSave = async (meal: Meal) => {
    const { recipe } = meal;
    const user = auth.currentUser;
    if (!user) return;
    setSavingCardTitle(recipe.title);
    const isRestaurant = recipe.difficulty === 'Restaurante';
    const collectionName = isRestaurant ? 'saved_restaurants' : 'saved_recipes';
    const savedSet = isRestaurant ? savedRestaurantTitles : savedRecipeTitles;
    const docId = `${user.uid}_${recipe.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    try {
        if (savedSet.has(recipe.title)) await deleteDoc(doc(db, collectionName, docId));
        else await setDoc(doc(db, collectionName, docId), { user_id: user.uid, recipe, savedAt: serverTimestamp(), mealType: meal.mealType });
    } catch (e) { console.error(e); } finally { setSavingCardTitle(null); }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-bocado-green border-t-transparent rounded-full"></div>
        <h2 className="text-2xl font-bold text-bocado-dark-green">Preparando tu mesa... 🧑‍🍳</h2>
        <p className="text-bocado-dark-gray">{currentLoadingMessage}</p>
      </div>
    );
  }

  if (hasError || !selectedPlan) {
    return <ErrorDisplay errorCode="recovery-failed" errorMessage="No se pudo cargar el plan. El chef tardó demasiado o hubo un error." onRetry={onStartNewPlan} />
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg w-full animate-fade-in pb-20">
        <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-4 no-scrollbar">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-bocado-dark-green">¡Listo! 🥗</h1>
                <div className="mt-3 p-4 bg-bocado-green/10 rounded-xl text-bocado-dark-green italic text-lg">
                    "{selectedPlan.greeting}"
                </div>
            </div>
            <div className="space-y-4">
                {selectedPlan.meals.map((meal, index) => (
                    <MealCard 
                        key={index} 
                        meal={meal} 
                        isSaved={meal.recipe.difficulty === 'Restaurante' ? savedRestaurantTitles.has(meal.recipe.title) : savedRecipeTitles.has(meal.recipe.title)} 
                        isSaving={savingCardTitle === meal.recipe.title} 
                        onToggleSave={() => handleToggleSave(meal)} 
                    />
                ))}
            </div>
        </div>
        <div className="mt-6 pt-6 border-t text-center">
             <button onClick={onStartNewPlan} className="bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg">
                Volver al inicio
            </button>
        </div>
    </div>
  );
};

export default PlanScreen;