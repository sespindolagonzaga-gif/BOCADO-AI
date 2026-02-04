import React, { useState, useEffect } from 'react';
import { EATING_HABITS, MEALS, CRAVINGS } from '../constants';
import BocadoLogo from './BocadoLogo';
import { auth, db, serverTimestamp } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { sanitizeProfileData } from '../utils/profileSanitizer';

interface RecommendationScreenProps {
  userName: string;
  onPlanGenerated: (interactionId: string) => void;
}

const stripEmoji = (str: string) => {
    if (!str) return str;
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
    const parts = str.split(' ');
    if (parts.length > 0 && emojiRegex.test(parts[0])) {
        return parts.slice(1).join(' ');
    }
    return str;
};

const getProfileDataFromStorage = () => {
  const savedData = localStorage.getItem('bocado-profile-data');
  return savedData ? sanitizeProfileData(JSON.parse(savedData)) : null;
};

const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ userName, onPlanGenerated }) => {
  const [formData, setFormData] = useState<any>(null);
  const [recommendationType, setRecommendationType] = useState<'En casa' | 'Fuera' | null>(null); 
  const [selectedMeal, setSelectedMeal] = useState('');
  const [selectedCravings, setSelectedCravings] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activityData, setActivityData] = useState<any>({});

  useEffect(() => {
    // Función para cargar datos con reintento
    const loadProfileData = () => {
      const data = getProfileDataFromStorage();
      if (data) {
        setFormData(data);
        setActivityData({
          activityLevel: data.activityLevel || '',
          otherActivityLevel: data.otherActivityLevel || '',
          activityFrequency: data.activityFrequency || '',
          dislikedFoods: data.dislikedFoods || [],
        });
      }
    };

    loadProfileData();
    
    // Seguridad: Reintentar a los 300ms por si hay lag en el almacenamiento
    const timer = setTimeout(loadProfileData, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleTypeChange = (type: 'En casa' | 'Fuera') => {
      setRecommendationType(type);
      if (type === 'En casa') setSelectedCravings([]);
      else {
          setSelectedMeal('');
          setCookingTime(30);
      }
  };

  const handleGenerateRecommendation = async () => {
    const isHomeSelectionComplete = recommendationType === 'En casa' && selectedMeal;
    const isAwaySelectionComplete = recommendationType === 'Fuera' && selectedCravings.length > 0;
    
    if (!formData || (!isHomeSelectionComplete && !isAwaySelectionComplete)) return;
    
    const user = auth.currentUser;
    if (!user) {
        alert('Sesión expirada. Por favor, inicia sesión de nuevo.');
        return;
    }

    setIsGenerating(true);

    const cravingsList = recommendationType === 'Fuera' 
      ? (selectedCravings.length > 0 ? selectedCravings.map(stripEmoji) : ['Ninguno']) 
      : ['Ninguno'];

    const interactionData = {
      userId: user.uid,
      type: recommendationType,
      mealType: recommendationType === 'En casa' ? stripEmoji(selectedMeal) : "Fuera de casa",
      cookingTime: recommendationType === 'En casa' ? cookingTime : 0,
      cravings: cravingsList,
      dislikedFoods: formData.dislikedFoods || [],
      createdAt: serverTimestamp(),
      procesado: false,
    };

    try {
      const newDoc = await addDoc(collection(db, 'user_interactions'), interactionData);

      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...interactionData, _id: newDoc.id })
      });

      if (!response.ok) throw new Error("Error en la IA");

      onPlanGenerated(newDoc.id);
    } catch (error) {
      console.error("Error:", error);
      alert('Tuvimos un problema con la IA. Inténtalo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCraving = (craving: string) => {
    setSelectedCravings(prev => 
      prev.includes(craving) ? prev.filter(c => c !== craving) : [...prev, craving]
    );
  };

  const renderCookingTime = () => cookingTime >= 65 ? '60+ min' : `${cookingTime} min`;
  const isSelectionMade = (recommendationType === 'En casa' && selectedMeal) || (recommendationType === 'Fuera' && selectedCravings.length > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 animate-fade-in flex flex-col min-h-[calc(100vh-80px)] sm:min-h-0 relative">
        <div className="text-center mb-4 shrink-0">
            <BocadoLogo className="w-48 -my-6 mx-auto"/>
        </div>
        
        {!formData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4">
             <div className="w-10 h-10 border-4 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
             <p className="text-bocado-gray animate-pulse font-medium">Sincronizando perfil...</p>
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col justify-center">
                <div className="space-y-6 w-full max-w-md mx-auto">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-bocado-dark-green tracking-tight">¡Hola, {userName || 'Comensal'}! 👋</h1>
                        <p className="text-bocado-gray mt-1">¿Dónde y qué quieres comer hoy?</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {EATING_HABITS.map(habit => (
                            <button 
                                key={habit} 
                                onClick={() => handleTypeChange(habit as any)} 
                                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 transform active:scale-95 ${recommendationType === habit ? 'bg-bocado-green text-white border-bocado-green shadow-lg' : 'bg-white text-gray-700 border-gray-100 hover:border-bocado-green/50'}`}
                            >
                                <span className="text-4xl mb-2">{habit === 'En casa' ? '🏡' : '🍽️'}</span>
                                <span className="font-bold">{habit}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-end">
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${recommendationType ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="overflow-y-auto no-scrollbar pt-4">
                        {recommendationType === 'En casa' ? (
                            <div className="space-y-4 animate-fade-in">
                                 <p className="text-center text-sm text-bocado-gray font-medium uppercase tracking-widest">¿Qué vas a preparar?</p>
                                 <div className="grid grid-cols-2 gap-3">
                                    {MEALS.map(meal => (
                                        <button 
                                            key={meal} 
                                            type="button" 
                                            onClick={() => setSelectedMeal(meal)} 
                                            className={`py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all ${selectedMeal === meal ? 'bg-bocado-green text-white border-bocado-green shadow-md' : 'bg-white text-gray-600 border-gray-50'}`}
                                        >
                                            {meal}
                                        </button>
                                    ))}
                                </div>
                                {selectedMeal && (
                                   <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-2 animate-slide-up">
                                        <div className="flex justify-between items-end mb-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tiempo de Cocina</label>
                                            <span className="text-lg font-bold text-bocado-green">{renderCookingTime()}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="10" 
                                            max="65" 
                                            step="5" 
                                            value={cookingTime} 
                                            onChange={(e) => setCookingTime(Number(e.target.value))} 
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-bocado-green" 
                                        />
                                   </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <p className="text-center text-sm text-bocado-gray font-medium uppercase tracking-widest">¿Qué se te antoja?</p>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {CRAVINGS.map(craving => (
                                        <button 
                                            key={craving} 
                                            type="button" 
                                            onClick={() => toggleCraving(craving)} 
                                            className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all ${selectedCravings.includes(craving) ? 'bg-bocado-green text-white border-bocado-green shadow-md' : 'bg-white text-gray-600 border-gray-50'}`}
                                        >
                                            {craving}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={`mt-8 pt-6 border-t border-gray-50 transition-opacity duration-500 ${isSelectionMade ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <button 
                                onClick={handleGenerateRecommendation} 
                                disabled={isGenerating} 
                                className="w-full bg-bocado-green text-white font-bold py-4 rounded-2xl text-lg shadow-xl shadow-green-100 hover:bg-bocado-dark-green transition-all active:scale-95 disabled:bg-gray-200 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? "Cocinando..." : "¡A comer! 🍽️"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          </>
        )}

        {isGenerating && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-50 rounded-2xl backdrop-blur-sm animate-fade-in">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-bocado-green/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-bocado-green rounded-full animate-spin"></div>
                </div>
                <p className="text-lg font-bold text-bocado-dark-green mt-4 animate-pulse">Creando tu plan clínico...</p>
            </div>
        )}
    </div>
  );
};

export default RecommendationScreen;