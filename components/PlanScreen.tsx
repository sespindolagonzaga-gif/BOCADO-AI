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
  "Contactando a nuestros chefs de IA...",
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
    let instructions: React.ReactNode = null;
    let icon = "⚠️";

    switch(errorCode) {
        case 'permission-denied':
            title = "Acceso Denegado";
            icon = "🔒";
            instructions = <p className="text-left mt-4">Tus reglas de seguridad de Firebase impiden que la app lea tus datos. Asegúrate de haber actualizado las reglas en la consola de Firebase.</p>;
            break;
        case 'no-docs-found':
            title = "No se encontraron planes";
            icon = "🤷";
            instructions = (
                <>
                    <p className="mt-4">Nos conectamos a tu base de datos, pero no encontramos ningún plan.</p>
                    <p className="text-sm bg-gray-100 p-2 rounded-md mt-2">{errorMessage}</p>
                </>
            );
            break;
        case 'timeout':
             title = "La preparación está tardando";
             icon = "⏳";
             instructions = <p className="mt-4">El servidor tardó más de lo normal. Por favor, intenta de nuevo en un momento.</p>;
             break;
        case 'recovery-failed':
             title = "No encontramos tu plan";
             icon = "😕";
             instructions = (
                <p className="mt-4">No pudimos encontrar el plan exacto que solicitaste. Intenta crear uno nuevo.</p>
             );
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
            <button
                onClick={onRetry}
                className="mt-8 bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg hover:bg-bocado-green-light"
            >
                {errorCode === 'recovery-failed' ? 'Crear un Nuevo Plan' : 'Intentar de nuevo'}
            </button>
        </div>
    );
};

// ... Procesadores de documentos (sin cambios) ...
const processFirestoreDoc = (doc: DocumentSnapshot): Plan | null => {
  try {
    const data = doc.data();
    if (!data) return null;
    const interactionId = data.user_interactions || data.user_interaction || data.interaction_id;
    let recipesArray: any[] = [];
    let greeting = "Aquí tienes tu plan";
    if (data.receta && !Array.isArray(data.receta) && typeof data.receta === 'object') {
        if (Array.isArray(data.receta.recetas)) recipesArray = data.receta.recetas;
        if (data.receta.saludo_personalizado) greeting = data.receta.saludo_personalizado;
    } else if (Array.isArray(data.receta)) {
        recipesArray = data.receta;
        if (data.saludo_personalizado) greeting = data.saludo_personalizado;
    }
    if (recipesArray.length === 0) return null;
    const meals: Meal[] = recipesArray.map((rec: any, index: number) => {
      const macros = rec.macros_por_porcion || {};
      return {
        mealType: `Opción ${index + 1}`,
        recipe: {
          title: rec.titulo || 'Receta sin título', time: rec.tiempo_estimado || 'N/A',
          difficulty: rec.dificultad || 'N/A', calories: macros.kcal || 'N/A', 
          savingsMatch: rec.coincidencia_despensa || 'Ninguno', 
          ingredients: Array.isArray(rec.ingredientes) ? rec.ingredientes : [],
          instructions: Array.isArray(rec.pasos_preparacion) ? rec.pasos_preparacion : (Array.isArray(rec.instructions) ? rec.instructions : [])
        },
      };
    });
    return {
      planTitle: "Recetas Sugeridas", greeting: greeting, meals: meals, _id: doc.id,
      _createdAt: data.createdAt || data.fecha_creacion, interaction_id: interactionId,
    };
  } catch (e) { return null; }
};
const processRecommendationDoc = (doc: DocumentSnapshot): Plan | null => {
  try {
    const data = doc.data();
    if (!data) return null;
    const interactionId = data.user_interactions || data.user_interactiones || data.interaction_id || data.user_interaction;
    let recommendationsArray: any[] = [];
    let greeting = "¡Aquí tienes excelentes opciones para comer fuera!";
    if (data.recomendaciones && typeof data.recomendaciones === 'object' && !Array.isArray(data.recomendaciones)) {
        if (Array.isArray(data.recomendaciones.recomendaciones)) recommendationsArray = data.recomendaciones.recomendaciones;
        if (data.recomendaciones.saludo_personalizado) greeting = data.recomendaciones.saludo_personalizado;
    } else if (Array.isArray(data.recomendaciones)) {
        recommendationsArray = data.recomendaciones;
    }
    if (recommendationsArray.length === 0) return null;
    const meals: Meal[] = recommendationsArray.map((rec: any, index: number) => {
      const restaurantName = rec.nombre_restaurante || rec.lugar || 'Restaurante';
      const foodType = rec.tipo_comida || '';
      const dish = rec.plato_sugerido || '';
      let title = restaurantName;
      const details = [];
      if (rec.direccion_aproximada) details.push(`📍 ${rec.direccion_aproximada}`);
      if (rec.link_maps) details.push(`🗺️ Link: ${rec.link_maps}`);
      if (rec.precio) details.push(`💰 Precio aprox: ${rec.precio}`);
      const instructions = [];
      if (dish) instructions.push(`🍽️ Sugerencia: ${dish}`);
      if (rec.por_que_es_bueno) instructions.push(`✅ Por qué: ${rec.por_que_es_bueno}`);
      if (rec.hack_saludable) instructions.push(`💡 Hack: ${rec.hack_saludable}`);
      return {
        mealType: `Opción ${index + 1}`,
        recipe: {
          title: title, time: 'N/A', difficulty: 'Restaurante', calories: 'N/A', savingsMatch: 'Ninguno',
          cuisine: foodType, ingredients: details, instructions: instructions
        }
      };
    });
    return {
      planTitle: "Lugares Recomendados", greeting: greeting, meals: meals, _id: doc.id,
      _createdAt: data.createdAt || data.fecha_creacion, interaction_id: interactionId,
    };
  } catch (e) { return null; }
};


const PlanScreen: React.FC<PlanScreenProps> = ({ planId, onStartNewPlan }) => {
  // Estados de la UI
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string, code: string } | null>(null);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);
  const [isRecovering, setIsRecovering] = useState(false);
  
  // Estados de datos
  const [recipePlans, setRecipePlans] = useState<Plan[]>([]);
  const [restaurantPlans, setRestaurantPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  
  // Nuevos estados para gestionar favoritos
  const [savedRecipeTitles, setSavedRecipeTitles] = useState<Set<string>>(new Set());
  const [savedRestaurantTitles, setSavedRestaurantTitles] = useState<Set<string>>(new Set());
  const [savingCardTitle, setSavingCardTitle] = useState<string | null>(null);
  
  const planFoundRef = useRef(false);
  const snapshotProcessedRef = useRef(false);

  useEffect(() => {
    if (!isLoading) return;
    const intervalId = setInterval(() => {
      setCurrentLoadingMessage(prev => {
        const currentIndex = loadingMessages.indexOf(prev);
        const nextIndex = (currentIndex + 1) % loadingMessages.length;
        return loadingMessages[nextIndex];
      });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  // useEffect para cargar la lista de favoritos una sola vez
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubRecipes = onSnapshot(query(collection(db, 'saved_recipes'), where('user_id', '==', user.uid)), (snapshot) => {
        const titles = new Set(snapshot.docs.map(doc => doc.data().recipe.title));
        setSavedRecipeTitles(titles);
    });

    const unsubRestaurants = onSnapshot(query(collection(db, 'saved_restaurants'), where('user_id', '==', user.uid)), (snapshot) => {
        const titles = new Set(snapshot.docs.map(doc => doc.data().recipe.title));
        setSavedRestaurantTitles(titles);
    });

    return () => {
        unsubRecipes();
        unsubRestaurants();
    };
  }, []);

  // useEffect para encontrar el plan
  useEffect(() => {
    if (!planId) {
        setError({ message: 'No se ha proporcionado un ID de plan.', code: 'no-plan-id'});
        setIsLoading(false);
        return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError({ message: "No se pudo verificar el usuario.", code: 'no-auth' });
      setIsLoading(false);
      return;
    }
    planFoundRef.current = false;
    snapshotProcessedRef.current = false;
    setIsLoading(true);

    const recoveryTimeout = setTimeout(() => {
      if (!planFoundRef.current) { 
        if(snapshotProcessedRef.current) setIsRecovering(true);
        else setError({ message: 'El servidor tardó demasiado en responder.', code: 'timeout' });
        setIsLoading(false);
      }
    }, 70000);

    const qRecetas = query(collection(db, "historial_recetas"), where("user_id", "==", user.uid));
    const unsubRecetas = onSnapshot(qRecetas, (snapshot) => {
        snapshotProcessedRef.current = true;
        const plans = snapshot.docs.map(processFirestoreDoc).filter((p): p is Plan => p !== null);
        setRecipePlans(plans);
    }, (err) => console.error("Error leyendo recetas:", err));

    const qRecomendaciones = query(collection(db, "historial_recomendaciones"), where("user_id", "==", user.uid));
    const unsubRecomendaciones = onSnapshot(qRecomendaciones, (snapshot) => {
        snapshotProcessedRef.current = true;
        const plans = snapshot.docs.map(processRecommendationDoc).filter((p): p is Plan => p !== null);
        setRestaurantPlans(plans);
    }, (err) => console.error("Error leyendo recomendaciones:", err));

    return () => {
      unsubRecetas();
      unsubRecomendaciones();
      clearTimeout(recoveryTimeout);
    };
  }, [planId]);

  const recentPlans = useMemo(() => {
      const all = [...recipePlans, ...restaurantPlans];
      return all.sort((a, b) => {
             const timeA = a._createdAt?.seconds || (typeof a._createdAt === 'string' ? new Date(a._createdAt).getTime() / 1000 : 0);
             const timeB = b._createdAt?.seconds || (typeof b._createdAt === 'string' ? new Date(b._createdAt).getTime() / 1000 : 0);
             return timeB - timeA;
      });
  }, [recipePlans, restaurantPlans]);

  useEffect(() => {
      if (recentPlans.length > 0 && !selectedPlan) {
          const found = recentPlans.find(p => p.interaction_id === planId);
          if (found) {
              planFoundRef.current = true;
              setSelectedPlan(found);
              setIsLoading(false);
              setIsRecovering(false);
              setError(null);
          }
      }
  }, [recentPlans, planId, selectedPlan]);

  // Nueva función para manejar el guardado, delegada por MealCard
  const handleToggleSave = async (meal: Meal) => {
    const { recipe } = meal;
    const user = auth.currentUser;
    if (!user) return;
    
    setSavingCardTitle(recipe.title);

    const isRestaurant = recipe.difficulty === 'Restaurante';
    const collectionName = isRestaurant ? 'saved_restaurants' : 'saved_recipes';
    const savedSet = isRestaurant ? savedRestaurantTitles : savedRecipeTitles;
    
    const sanitizedTitle = recipe.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const docId = `${user.uid}_${sanitizedTitle}`;
    const docRef = doc(db, collectionName, docId);

    try {
        if (savedSet.has(recipe.title)) {
            await deleteDoc(docRef);
        } else {
            await setDoc(docRef, {
                user_id: user.uid,
                recipe,
                savedAt: serverTimestamp(),
                mealType: meal.mealType
            });
        }
    } catch (error) {
        console.error("Error toggling save:", error);
    } finally {
        setSavingCardTitle(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <svg className="animate-spin h-12 w-12 text-bocado-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <h2 className="text-2xl font-bold text-bocado-dark-green">Estamos preparando tu plan... 🧑‍🍳</h2>
        <p className="text-bocado-dark-gray transition-opacity duration-500 ease-in-out">{currentLoadingMessage}</p>
      </div>
    );
  }

  if (error) return <ErrorDisplay errorCode={error.code} errorMessage={error.message} onRetry={onStartNewPlan} />

  if (isRecovering) {
     if (recentPlans.length > 0) {
        return (
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg text-center animate-fade-in">
                <h2 className="text-2xl font-bold text-bocado-dark-green mt-4">No encontramos tu plan exacto...</h2>
                <p className="text-bocado-dark-gray mt-2">Pero encontramos estos planes recientes. ¿Es uno de estos?</p>
                <div className="mt-6 space-y-3">
                    {recentPlans.slice(0, 3).map(p => (
                        <button key={p._id} onClick={() => { setSelectedPlan(p); setIsRecovering(false); }} className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-bocado-green hover:shadow-md">
                            <p className="font-bold text-bocado-dark-green">{p.planTitle}</p>
                             <p className="text-xs text-gray-500">{new Date((p._createdAt?.seconds || 0) * 1000).toLocaleString()}</p>
                        </button>
                    ))}
                </div>
                <button onClick={onStartNewPlan} className="mt-8 text-sm text-bocado-green font-semibold hover:underline">No, quiero crear un plan nuevo</button>
            </div>
        );
     } else return <ErrorDisplay errorCode="recovery-failed" errorMessage="No pudimos encontrar tu plan." onRetry={onStartNewPlan} />
  }

  if (!selectedPlan) return <ErrorDisplay errorCode="not-found" errorMessage="No se pudo cargar el plan." onRetry={onStartNewPlan} />

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg w-full animate-fade-in pb-20">
        <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-4">
            <div className="text-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-bocado-dark-green">¡Listo! 🥗</h1>
                <div className="mt-3 p-4 bg-bocado-green/10 rounded-xl">
                    <p className="text-bocado-dark-green italic text-lg">"{selectedPlan.greeting}"</p>
                </div>
            </div>
            
            <div className="space-y-4">
                {selectedPlan.meals.map((meal, index) => {
                    const isRestaurant = meal.recipe.difficulty === 'Restaurante';
                    const isSaved = isRestaurant 
                        ? savedRestaurantTitles.has(meal.recipe.title) 
                        : savedRecipeTitles.has(meal.recipe.title);
                    const isSaving = savingCardTitle === meal.recipe.title;

                    return (
                        <MealCard 
                            key={index} 
                            meal={meal} 
                            isSaved={isSaved}
                            isSaving={isSaving}
                            onToggleSave={() => handleToggleSave(meal)}
                        />
                    );
                })}
            </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
             <button onClick={onStartNewPlan} className="bg-bocado-green text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg hover:bg-bocado-green-light">
                Crear Nuevo Plan
            </button>
        </div>
    </div>
  );
};

export default PlanScreen;