import React, { useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { env } from '../environment/env';
import { FormData } from '../types';
import Step1 from './form-steps/Step1';
// Importa Step2, Step3, Step4...

const RegistrationFlow: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [cityOptions, setCityOptions] = useState([]);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    gender: '',
    age: '',
    country: '',
    city: '',
    email: '',
    password: '',
    confirmPassword: '',
    diseases: [] as string[],
    allergies: [] as string[],
    otherAllergies: '',
    eatingHabit: '',
    activityLevel: 'Sedentario',
    otherActivityLevel: '',
    activityFrequency: '',
    nutritionalGoal: [] as string[], 
    cookingAffinity: 'Normal',
    dislikedFoods: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Usamos 'any' en el value para que acepte tanto strings como arrays
  const updateData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCountryChange = (code: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      country: code,
      countryName: name,
      city: '' 
    }));
  };

  const fetchCities = async (query: string) => {
    if (query.trim().length < 3) {
      setCityOptions([]);
      return;
    }
    setIsSearchingCity(true);
    try {
      const countryCode = formData.country || 'MX';
      const username = env.api.geonamesUsername;
      const res = await fetch(
        `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(query)}&country=${countryCode}&maxRows=10&username=${username}`
      );
      const data = await res.json();
      setCityOptions(data.geonames || []);
    } catch (error) {
      console.error("Error GeoNames:", error);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password!);
      await updateProfile(userCredential.user, {
        displayName: `${formData.firstName} ${formData.lastName}`
      });

      const userRef = doc(db, 'users', userCredential.user.uid);
      
      // Separamos los datos para no guardar passwords en la base de datos
      const { password, confirmPassword, ...profileToSave } = formData;

      const finalData = {
        ...profileToSave,
        uid: userCredential.user.uid,
        createdAt: serverTimestamp(),
        setupComplete: true
      };

      await setDoc(userRef, finalData);
      localStorage.setItem('bocado-profile-data', JSON.stringify(finalData));
      onComplete();
    } catch (error: any) {
      setErrors({ auth: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {step === 1 && (
          <Step1 
            data={formData} 
            updateData={updateData}
            onCountryChange={handleCountryChange}
            errors={errors}
            cityOptions={cityOptions}
            isSearchingCity={isSearchingCity}
            onSearchCity={fetchCities}
            onClearCityOptions={() => setCityOptions([])}
          />
        )}
        
        {/* Aquí renderizas los demás pasos: Step2, Step3... */}

        <div className="mt-8 flex gap-4">
          {step > 1 && (
            <button 
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
            >
              Atrás
            </button>
          )}
          <button 
            onClick={() => step === 4 ? handleFinalSubmit() : setStep(s => s + 1)}
            className="flex-[2] bg-bocado-green text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-bocado-green-light transition-all"
          >
            {step === 4 ? 'Finalizar' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationFlow;