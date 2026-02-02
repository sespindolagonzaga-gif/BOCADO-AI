import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { LocationIcon } from './icons/LocationIcon';
import MealCard from './MealCard';
import { Meal } from '../types';

const SavedRestaurantsScreen: React.FC = () => {
  const [savedRestaurants, setSavedRestaurants] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [mealToConfirmDelete, setMealToConfirmDelete] = useState<Meal | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
        setIsLoading(false);
        return;
    }

    const q = query(
        collection(db, 'saved_restaurants'),
        where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const rawDocs = snapshot.docs.map(doc => doc.data());
        
        rawDocs.sort((a, b) => {
            const timeA = a.savedAt?.seconds || 0;
            const timeB = b.savedAt?.seconds || 0;
            return timeB - timeA;
        });

        const meals: Meal[] = rawDocs.map(data => ({
            mealType: data.mealType || 'Lugar Guardado',
            recipe: data.recipe
        }));

        setSavedRestaurants(meals);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching saved restaurants:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteRequest = (meal: Meal) => {
    setMealToConfirmDelete(meal);
  };

  const confirmDelete = async () => {
    if (!mealToConfirmDelete) return;

    const { recipe } = mealToConfirmDelete;
    const user = auth.currentUser;
    if (!user) return;

    setIsDeleting(recipe.title);
    
    const sanitizedTitle = recipe.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const docId = `${user.uid}_${sanitizedTitle}`;
    const docRef = doc(db, 'saved_restaurants', docId);

    try {
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting restaurant:", error);
    } finally {
        setIsDeleting(null);
        setMealToConfirmDelete(null);
    }
  };


  return (
    <div className="animate-fade-in pb-24">
      <div className="text-center mb-8 px-4">
        <h2 className="text-2xl font-bold text-bocado-dark-green flex items-center justify-center gap-2">
          <LocationIcon className="w-8 h-8" />
          Mis Lugares
        </h2>
        <p className="text-bocado-gray mt-1 text-sm">Lugares recomendados que has guardado.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
            <svg className="animate-spin h-10 w-10 text-bocado-green" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
      ) : savedRestaurants.length === 0 ? (
        <div className="text-center py-12 px-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 mx-4">
            <p className="text-gray-400 text-lg mb-2">Aún no has guardado lugares.</p>
            <p className="text-sm text-gray-500">Cuando veas una recomendación de "Comer Fuera" que te guste, guárdala para verla aquí.</p>
        </div>
      ) : (
        <div className="space-y-4 px-4">
            {savedRestaurants.map((meal, index) => (
                <MealCard 
                    key={index} 
                    meal={meal}
                    isSaved={true}
                    isSaving={isDeleting === meal.recipe.title}
                    onToggleSave={() => handleDeleteRequest(meal)}
                />
            ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {mealToConfirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-bocado-dark-green">¿Estás seguro?</h3>
            <p className="text-sm text-bocado-dark-gray mt-2">
              Se eliminará "<span className="font-semibold">{mealToConfirmDelete.recipe.title}</span>" de tus lugares guardados.
            </p>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setMealToConfirmDelete(null)}
                className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-full hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-full hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedRestaurantsScreen;