
import React, { useState, useEffect } from 'react';
import { FormData } from '../types';
import { EATING_HABITS, MEALS, CRAVINGS } from '../constants';
import BocadoLogo from './BocadoLogo';
import { auth, db, serverTimestamp } from '../firebaseConfig';
import { collection, doc, setDoc, addDoc } from 'firebase/firestore';
import Step4 from './form-steps/Step4';
import { PencilIcon } from './icons/PencilIcon';
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

const getProfileDataFromStorage = (): FormData | null => {
  const savedData = localStorage.getItem('bocado-profile-data');
  return savedData ? sanitizeProfileData(JSON.parse(savedData)) : null;
};

const RecommendationScreen: React.FC<RecommendationScreenProps> = ({ userName, onPlanGenerated }) => {
  const [formData, setFormData] = useState<FormData | null>(null);
  
  const [recommendationType, setRecommendationType] = useState<'En casa' | 'Fuera' | null>(null); 
  const [selectedMeal, setSelectedMeal] = useState('');
  const [selectedCravings, setSelectedCravings] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState(30);

  const [isGenerating, setIsGenerating] = useState(false);
  
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityData, setActivityData] = useState<Partial<FormData>>({});
  const [modalIsLoading, setModalIsLoading] = useState(false);

  useEffect(() => {
    const data = getProfileDataFromStorage();
    setFormData(data);
    if (data) {
        setActivityData({
            activityLevel: data.activityLevel || '',
            otherActivityLevel: data.otherActivityLevel || '',
            activityFrequency: data.activityFrequency || '',
            dislikedFoods: data.dislikedFoods || [],
        });
    }
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
        alert('Tu sesión ha expirado. Por favor, recarga la página.');
        return;
    }

    setIsGenerating(true);

    const cravingsList = recommendationType === 'Fuera' 
      ? (selectedCravings.length > 0 ? selectedCravings.map(stripEmoji) : ['Ninguno']) 
      : ['Ninguno'];

    const interactionData = {
      user_id: user.uid,
      type: recommendationType,
      meal: recommendationType === 'En casa' ? stripEmoji(selectedMeal) : "Fuera de casa", // Regla 2: Clasificar como "Fuera de casa" si es nulo
      cookingTime: recommendationType === 'En casa' ? cookingTime : 0, // Regla 2: Tiempo de cocina es 0 si es nulo
      cravings: cravingsList, // Regla 3: Usar valor centinela ["Ninguno"] para listas vacías
      dislikedFoods: formData.dislikedFoods, // Ya está normalizado por getProfileDataFromStorage
      createdAt: serverTimestamp(),
      procesado: false, // Regla 2: Si falta, es False
    };

    try {
      const newInteractionDoc = await addDoc(collection(db, 'user_interactions'), interactionData);

      const webhookPayload = {
        ...interactionData,
        _id: newInteractionDoc.id,
        createdAt: new Date().toISOString() 
      };

      const webhookUrls = [
        'https://egarciav.app.n8n.cloud/webhook-test/cc7fe0c8-47da-4a3a-ad03-39b02ca28780',
        'https://egarciav.app.n8n.cloud/webhook/cc7fe0c8-47da-4a3a-ad03-39b02ca28780'
      ];

      const webhookPromises = webhookUrls.map(url => 
        fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(webhookPayload),
        })
        .then(() => console.log(`Señal enviada a ${url.includes('-test') ? 'test' : 'prod'} (modo no-cors).`))
        .catch(err => console.error(`Error enviando señal a ${url.includes('-test') ? 'test' : 'prod'}:`, err))
      );

      Promise.all(webhookPromises);


      onPlanGenerated(newInteractionDoc.id);
    } catch (error) {
      console.error("Error saving interaction:", error);
      alert('Hubo un error al crear tu plan.');
      setIsGenerating(false);
    }
  };

  const toggleCraving = (craving: string) => {
    setSelectedCravings(prev => 
      prev.includes(craving) 
      ? prev.filter(c => c !== craving) 
      : [...prev, craving]
    );
  };
  
  const updateActivityData = (field: keyof FormData, value: any) => {
    setActivityData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveActivityData = async () => {
    const user = auth.currentUser;
    if (!formData || !user) return;
    if (!activityData.activityLevel) {
        alert("Por favor, selecciona tu nivel de actividad física.");
        return;
    }
    setModalIsLoading(true);
    const dataToSave = {
        activityLevel: stripEmoji(activityData.activityLevel || ''),
        activityFrequency: activityData.activityFrequency,
        otherActivityLevel: activityData.otherActivityLevel,
        dislikedFoods: activityData.dislikedFoods,
    };
    const updatedFormData = { ...formData, ...dataToSave };

    try {
        await setDoc(doc(db, 'users', user.uid), dataToSave, { merge: true });
        localStorage.setItem('bocado-profile-data', JSON.stringify(updatedFormData));
        setFormData(updatedFormData);
        setShowActivityModal(false);
    } catch (error) {
        console.error("Error saving activity data:", error);
    } finally {
        setModalIsLoading(false);
    }
  };

  if (!formData) return <div className="p-10 text-center text-gray-400">Cargando perfil...</div>;

  const renderCookingTime = () => cookingTime >= 65 ? '60+ min' : `${cookingTime} min`;
  const needsActivityInfo = !formData.activityLevel || formData.activityLevel === 'Sedentario';
  const isSelectionMade = (recommendationType === 'En casa' && selectedMeal) || (recommendationType === 'Fuera' && selectedCravings.length > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 animate-fade-in flex flex-col min-h-[calc(100vh-80px)] sm:min-h-0">
        
        <div className="text-center mb-4 shrink-0">
            <BocadoLogo className="w-48 -my-6 mx-auto"/>
        </div>
        
        <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-6 w-full max-w-md mx-auto">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-bocado-dark-green">¡Hola, {userName || 'Usuario'}! 👋</h1>
                    <p className="text-bocado-gray mt-2">¿Dónde y qué quieres comer hoy?</p>
                </div>

                {needsActivityInfo && (
                    <button 
                        onClick={() => setShowActivityModal(true)} 
                        className="w-full bg-yellow-50 border-2 border-yellow-200 rounded-xl px-4 py-3 flex items-center justify-between group transform hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-lg"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-400 p-2 rounded-full">
                                <PencilIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-yellow-900">¡Completa tu Perfil!</p>
                                <p className="text-xs text-yellow-700 leading-tight">Mejora mucho tus recomendaciones.</p>
                            </div>
                        </div>
                        <span className="text-yellow-500 font-bold text-xl group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {EATING_HABITS.map(habit => (
                        <button key={habit} onClick={() => handleTypeChange(habit as 'En casa' | 'Fuera')} className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 transform active:scale-95 ${recommendationType === habit ? 'bg-bocado-green text-white border-bocado-green shadow-lg' : 'bg-white text-gray-700 border-gray-200 hover:border-bocado-green/50'}`}>
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
                             <p className="text-center text-sm text-bocado-gray font-medium">¿Qué vas a preparar?</p>
                             <div className="grid grid-cols-2 gap-3">
                                {MEALS.map(meal => <button key={meal} type="button" onClick={() => setSelectedMeal(meal)} className={`py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${selectedMeal === meal ? 'bg-bocado-green text-white border-bocado-green' : 'bg-white text-gray-600 border-gray-100 hover:border-bocado-green/30'}`}>{meal}</button>)}
                            </div>
                            <div className={`transition-opacity duration-300 ${selectedMeal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2">
                                    <div className="flex justify-between items-end mb-2"><label htmlFor="cookingTime" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tiempo de Cocina</label><span className="text-lg font-bold text-bocado-green">{renderCookingTime()}</span></div>
                                    <input id="cookingTime" type="range" min="10" max="65" step="5" value={cookingTime} onChange={(e) => setCookingTime(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-bocado-green" />
                               </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-center text-sm text-bocado-gray font-medium">¿Qué se te antoja?</p>
                            <div className="grid grid-cols-2 gap-2.5">
                                {CRAVINGS.map(craving => <button key={craving} type="button" onClick={() => toggleCraving(craving)} className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all duration-200 ${selectedCravings.includes(craving) ? 'bg-bocado-green text-white border-bocado-green' : 'bg-white text-gray-600 border-gray-100 hover:border-bocado-green/30'}`}>{craving}</button>)}
                            </div>
                        </div>
                    )}

                    <div className={`transition-opacity duration-500 ${isSelectionMade ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                         <div className="mt-8 pt-6 border-t border-gray-100">
                            <button onClick={handleGenerateRecommendation} disabled={isGenerating} className="w-full bg-bocado-green text-white font-bold py-4 rounded-xl text-lg shadow-lg hover:bg-bocado-green-light transition-all duration-300 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {isGenerating ? "Cocinando..." : "¡A comer! 🍽️"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        {isGenerating && (<div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-20 rounded-2xl backdrop-blur-sm"><div className="relative w-16 h-16"><div className="absolute inset-0 border-4 border-bocado-green/20 rounded-full"></div><div className="absolute inset-0 border-4 border-t-bocado-green rounded-full animate-spin"></div></div><p className="text-lg font-bold text-bocado-dark-green mt-4 animate-pulse">Creando tu plan...</p></div>)}

        {showActivityModal && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in backdrop-blur-sm"><div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col"><div className="flex-1"><Step4 data={{ ...formData, ...activityData } as FormData} updateData={updateActivityData} errors={{}} /></div><div className="mt-6 flex gap-3 border-t border-gray-100 pt-4"><button onClick={() => setShowActivityModal(false)} className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" disabled={modalIsLoading}>Cancelar</button><button onClick={handleSaveActivityData} className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl shadow-md hover:bg-bocado-green-light disabled:bg-gray-400 transition-colors" disabled={modalIsLoading}>{modalIsLoading ? 'Guardando...' : 'Guardar'}</button></div></div></div>)}
    </div>
  );
};

export default RecommendationScreen;
