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
  "Verificando opciones deliciosas...",
  "Ajustando las porciones a tus necesidades...",
  "¡Unos segundos más, vale la pena la espera! 🕰️",
];

const ErrorDisplay: React.FC<{
  errorCode: string;
  errorMessage: string;
  onRetry: () => void;
}> = ({ errorCode, errorMessage, onRetry }) => {
    let title = "Ocurrió un problema";
    let icon = "⚠️";
    let instructions: React.ReactNode = null;

    switch(errorCode) {
        case 'timeout':
             title = "La preparación está tardando";
             icon = "⏳";
             instructions = <p className="mt-4">El servidor tardó más de lo normal. Por favor, intenta de nuevo.</p>;
             break;
        case 'recovery-failed':
             title = "No encontramos tu plan";
             icon = "😕";
             instructions = <p className="mt-4">No pudimos encontrar el plan solicitado. Intenta crear uno nuevo.</p>;
             break;
        default:
            instructions = <p className="mt-4">{errorMessage}</p>;
            break;
    }

    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg text-center animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                 <span className="text-2xl">{icon}</span>
            </div>
            <h2 className="text-2xl font-bold text-red-600 mt-4">{title}</h2>
            <div className="text-bocado-dark-gray max-w-md mx-auto">{instructions}</div>
            <button onClick={onRetry} className="mt-8 bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg hover:bg-bocado-green-light">
                {errorCode === 'recovery-failed' ? 'Crear un Nuevo Plan' : 'Intentar de nuevo'}
            </button>
        </div>
    );
};

// --- PROCESADORES DE DOCUMENTOS ---
const processFirestoreDoc = (doc: DocumentSnapshot): Plan | null => {
  try {
    const data = doc.data();
    if (!data) return null;
    
    const interactionId = data.interaction_id || data.user_interactions || data.user_interaction;
    const rawDate = data.fecha_creacion || data.createdAt;

    let recipesArray: any[] = [];
    let greeting = "Aquí tienes tu plan";
    
    const recetaObj = data.receta || data.recetas;
    if (recetaObj && typeof recetaObj === 'object' && !Array.isArray(recetaObj)) {
        recipesArray = recetaObj.recetas || [];
        greeting = recetaObj.saludo_personalizado || greeting;
    } else if (Array.isArray(recetaObj)) {
        recipesArray = recetaObj;
    }

    if (recipesArray.length === 0) return null;

    const meals: Meal[] = recipesArray.map((rec: any, index: number) => ({
      mealType: `Opción ${index + 1}`,
      recipe: {
        title: rec.titulo || 'Receta',
        time: rec.tiempo_estimado || 'N/A',
        difficulty: rec.dificultad || 'N/A',
        calories: rec.macros_por_porcion?.kcal || 'N/A',
        savingsMatch: rec.coincidencia_despensa || 'Ninguno',
        ingredients: Array.isArray(rec.ingredientes) ? rec.ingredientes : [],
        instructions: Array.isArray(rec.pasos_preparacion) ? rec.pasos_preparacion : []
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
    
    const interactionId = data.interaction_id || data.user_interactions || data.user_interaction;
    const rawDate = data.fecha_creacion || data.createdAt;

    let items = data.recomendaciones?.recomendaciones || data.recomendaciones || [];
    let greeting = data.recomendaciones?.saludo_personalizado || "Opciones fuera de casa";

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
  const [error, setError] = useState<{ message: string, code: string } | null>(null);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);
  const [isRecovering, setIsRecovering] = useState(false);
  
  const [recipePlans, setRecipePlans] = useState<Plan[]>([]);
  const [restaurantPlans, setRestaurantPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  
  const [savedRecipeTitles, setSavedRecipeTitles] = useState<Set<string>>(new Set());
  const [savedRestaurantTitles, setSavedRestaurantTitles] = useState<Set<string>>(new Set());
  const [savingCardTitle, setSavingCardTitle] = useState<string | null>(null);
  
  const planFoundRef = useRef(false);

  // Ciclo de mensajes de carga
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

  // Carga de favoritos
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

  // Escucha de planes en tiempo real
  useEffect(() => {
    if (!planId) return;
    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    const recoveryTimeout = setTimeout(() => {
      if (!planFoundRef.current) { 
        setIsRecovering(true);
        setIsLoading(false);
      }
    }, 45000);

    const unsubRec = onSnapshot(query(collection(db, "historial_recetas"), where("user_id", "==", user.uid)), (snap) => {
        setRecipePlans(snap.docs.map(processFirestoreDoc).filter((p): p is Plan => p !== null));
    });

    const unsubRem = onSnapshot(query(collection(db, "historial_recomendaciones"), where("user_id", "==", user.uid)), (snap) => {
        setRestaurantPlans(snap.docs.map(processRecommendationDoc).filter((p): p is Plan => p !== null));
    });

    return () => { unsubRec(); unsubRem(); clearTimeout(recoveryTimeout); };
  }, [planId]);

  // CORRECCIÓN TYPESCRIPT Y ORDENAMIENTO
  const recentPlans = useMemo(() => {
      const all = [...recipePlans, ...restaurantPlans];
      return all.sort((a, b) => {
             const getTime = (date: any) => {
                if (date && typeof date === 'object' && 'seconds' in date) return date.seconds * 1000;
                if (date instanceof Date) return date.getTime();
                if (typeof date === 'string' || typeof date === 'number') return new Date(date).getTime();
                return 0;
             };
             return getTime(b._createdAt) - getTime(a._createdAt);
      });
  }, [recipePlans, restaurantPlans]);

  // Selección automática por ID
  useEffect(() => {
      if (recentPlans.length > 0 && !selectedPlan) {
          const found = recentPlans.find(p => p.interaction_id === planId);
          if (found) {
              planFoundRef.current = true;
              setSelectedPlan(found);
              setIsLoading(false);
              setIsRecovering(false);
          }
      }
  }, [recentPlans, planId, selectedPlan]);

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
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <div className="animate-spin h-12 w-12 border-4 border-bocado-green border-t-transparent rounded-full"></div>
        <h2 className="text-2xl font-bold text-bocado-dark-green">Preparando tu mesa... 🧑‍🍳</h2>
        <p className="text-bocado-dark-gray">{currentLoadingMessage}</p>
      </div>
    );
  }

  if (isRecovering) {
     return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg text-center animate-fade-in">
            <h2 className="text-2xl font-bold text-bocado-dark-green">Planes Recientes</h2>
            <p className="text-bocado-dark-gray mt-2">No encontramos el plan solicitado, pero aquí tienes tus últimos planes:</p>
            <div className="mt-6 space-y-3">
                {recentPlans.slice(0, 5).map(p => (
                    <button key={p._id} onClick={() => { setSelectedPlan(p); setIsRecovering(false); }} className="w-full text-left p-4 border border-gray-100 rounded-xl hover:border-bocado-green transition-all">
                        <p className="font-bold text-bocado-dark-green">{p.planTitle}</p>
                        <p className="text-xs text-gray-400">
                           {p._createdAt && typeof p._createdAt === 'object' && 'seconds' in p._createdAt 
                             ? new Date(p._createdAt.seconds * 1000).toLocaleString() 
                             : new Date(p._createdAt as any).toLocaleString()}
                        </p>
                    </button>
                ))}
            </div>
            <button onClick={onStartNewPlan} className="mt-8 text-sm text-bocado-green font-bold">Crear un plan nuevo</button>
        </div>
     );
  }

  if (!selectedPlan) return <ErrorDisplay errorCode="recovery-failed" errorMessage="No se pudo cargar el plan." onRetry={onStartNewPlan} />

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg w-full animate-fade-in pb-20">
        <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-4 no-scrollbar">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-bocado-dark-green">¡Listo! 🥗</h1>
                <div className="mt-3 p-4 bg-bocado-green/10 rounded-xl">
                    <p className="text-bocado-dark-green italic text-lg">"{selectedPlan.greeting}"</p>
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
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
             <button onClick={onStartNewPlan} className="bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg">
                Volver al inicio
            </button>
        </div>
    </div>
  );
};

export default PlanScreen;