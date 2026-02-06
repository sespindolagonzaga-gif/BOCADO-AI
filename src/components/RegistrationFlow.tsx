import React, { useState, useCallback } from 'react';
import { useProfileDraftStore } from '../stores/profileDraftStore';
import { FormData, UserProfile } from '../types';
import ProgressBar from './ProgressBar';
import Step1 from './form-steps/Step1';
import Step2 from './form-steps/Step2';
import Step3 from './form-steps/Step3';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification 
} from 'firebase/auth';
import { separateUserData } from '../utils/profileSanitizer';
import { env } from '../environment/env';

const TOTAL_STEPS = 3;

interface RegistrationFlowProps {
  onRegistrationComplete: () => void;
  onGoHome: () => void;
}

const RegistrationFlow: React.FC<RegistrationFlowProps> = ({ onRegistrationComplete, onGoHome }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [cityOptions, setCityOptions] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);

  // ✅ ZUSTAND: Obtenemos datos y funciones del store
  const formData = useProfileDraftStore((state) => state);
  const updateField = useProfileDraftStore((state) => state.updateField);
  const clearDraft = useProfileDraftStore((state) => state.clearDraft);
  const isHydrated = useProfileDraftStore((state) => state.isHydrated);

  // Ya NO necesitamos useEffect para localStorage, Zustand lo maneja automáticamente
  
  const validateStep = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    setSubmissionError('');
    
    switch (currentStep) {
      case 1:
        if (!formData.firstName) newErrors.firstName = 'Nombre requerido';
        if (!formData.lastName) newErrors.lastName = 'Apellido requerido';
        if (!formData.gender) newErrors.gender = 'Género requerido';
        if (!formData.age) newErrors.age = 'Edad requerida';
        if (!formData.country) newErrors.country = 'País requerido';
        if (!formData.city) newErrors.city = 'Ciudad requerida';
        if (!formData.email) newErrors.email = 'Email requerido';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido';
        if (!formData.password) newErrors.password = 'Contraseña requerida';
        else if (formData.password.length < 8) newErrors.password = 'Mínimo 8 caracteres';
        if (!formData.confirmPassword) newErrors.confirmPassword = 'Confirma contraseña';
        else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'No coinciden';
        break;
        
      case 2:
        if (formData.allergies.includes('Otro') && !formData.otherAllergies.trim()) {
          newErrors.otherAllergies = 'Especifica tus alergias';
        }
        if (formData.nutritionalGoal.length === 0) {
          newErrors.nutritionalGoal = 'Selecciona al menos un objetivo';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, formData]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmissionError('');

    try {
      const { auth: authData, profile } = separateUserData(formData);
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        authData.email,
        authData.password!
      );
      const user = userCredential.user;

      const displayName = `${authData.firstName} ${authData.lastName}`;
      await updateProfile(user, { displayName });

      const userProfile: UserProfile = {
        uid: user.uid,
        gender: profile.gender,
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        country: profile.country.toUpperCase(),
        city: profile.city,
        diseases: profile.diseases,
        allergies: profile.allergies,
        otherAllergies: profile.otherAllergies,
        eatingHabit: profile.eatingHabit,
        activityLevel: profile.activityLevel,
        otherActivityLevel: profile.otherActivityLevel,
        activityFrequency: profile.activityFrequency,
        nutritionalGoal: profile.nutritionalGoal,
        cookingAffinity: profile.cookingAffinity,
        dislikedFoods: profile.dislikedFoods,
        emailVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, userProfile);

      await sendEmailVerification(user);
      
      // ✅ LIMPIAMOS DRAFT DE ZUSTAND (elimina de localStorage también)
      clearDraft();
      
      setRegisteredEmail(authData.email);
      setShowVerificationModal(true);

    } catch (error: any) {
      console.error("Error en registro:", error);
      
      if (error.code === 'auth/email-already-in-use') {
        setSubmissionError("Este correo ya está registrado");
        setCurrentStep(1);
      } else if (error.code === 'auth/weak-password') {
        setSubmissionError("Contraseña muy débil");
      } else if (error.code === 'auth/invalid-email') {
        setSubmissionError("Email inválido");
      } else {
        setSubmissionError("Error al crear cuenta. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    setShowVerificationModal(false);
    onRegistrationComplete();
  };

  const nextStep = async () => {
    if (await validateStep()) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      } else {
        await handleSubmit();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setSubmissionError('');
      setCurrentStep(currentStep - 1);
    }
  };

  // Wrapper para mantener compatibilidad con Steps existentes
  const updateFormData = (field: keyof FormData, value: any) => {
    updateField(field, value);
  };

  const handleSearchCity = async (query: string) => {
    if (!formData.country || query.length < 3) {
      setCityOptions([]);
      return;
    }
    setIsSearchingCity(true);
    try {
      const username = env.api.geonamesUsername;
      const response = await fetch(
        `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(query)}&country=${formData.country}&maxRows=10&username=${username}&lang=es`
      );
      const data = await response.json();
      setCityOptions(data.geonames || []);
    } catch (error) {
      console.error('Error buscando ciudades:', error);
      setCityOptions([]);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleClearCityOptions = () => {
    setCityOptions([]);
  };

  const handleCountryChange = (code: string) => {
    updateField('country', code);
    updateField('city', '');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1 
            data={formData} 
            updateData={updateFormData} 
            errors={errors}
            cityOptions={cityOptions}
            isSearchingCity={isSearchingCity}
            onSearchCity={handleSearchCity}
            onClearCityOptions={handleClearCityOptions}
            onCountryChange={handleCountryChange}
          />
        );
      case 2:
        return <Step2 data={formData} updateData={updateFormData} errors={errors} />;
      case 3:
        return <Step3 data={formData} updateData={updateFormData} errors={errors} />;
      default:
        return null;
    }
  };

  // ✅ ESPERAR REHIDRATACIÓN: Evita que el formulario se resetee al recargar
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bocado-cream">
        <div className="w-12 h-12 border-4 border-bocado-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Modal de verificación...
  if (showVerificationModal) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-6 pt-safe pb-safe">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-bocado w-full max-w-sm text-center animate-fade-in">
          <div className="w-14 h-14 bg-bocado-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-bocado-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-bocado-dark-green mb-2">¡Verifica tu correo!</h2>
          <p className="text-sm text-bocado-gray mb-4">
            Enviado a <strong className="text-bocado-text break-all">{registeredEmail}</strong>
          </p>
          <p className="text-xs text-bocado-gray/70 mb-6">
            Revisa tu bandeja de entrada y spam.
          </p>
          <button
            onClick={handleVerificationComplete}
            className="w-full bg-bocado-green text-white font-bold py-3 px-6 rounded-full text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all"
          >
            Ya verifiqué mi correo
          </button>
          <p className="text-[10px] text-bocado-gray mt-4">
            ¿No lo recibiste? Revisa spam o contacta soporte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 pt-safe pb-safe overflow-y-auto no-scrollbar">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <div className="mb-6">
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
        
        <div className="flex-1">
          {renderStep()}
          {submissionError && (
            <p className="text-red-500 text-xs text-center bg-red-50 p-3 rounded-xl mt-4 animate-fade-in">
              {submissionError}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex justify-between gap-3">
            <button
              onClick={prevStep}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                currentStep === 1 
                  ? 'invisible' 
                  : 'bg-bocado-background text-bocado-dark-gray hover:bg-bocado-border active:scale-95'
              }`}
              disabled={isLoading}
            >
              Anterior
            </button>
            <button
              onClick={nextStep}
              className="flex-1 bg-bocado-green text-white font-bold py-3 rounded-xl text-sm shadow-bocado hover:bg-bocado-dark-green active:scale-95 transition-all disabled:bg-bocado-gray"
              disabled={isLoading}
            >
              {isLoading ? '...' : (currentStep === TOTAL_STEPS ? 'Finalizar' : 'Siguiente')}
            </button>
          </div>
          
          <button 
            onClick={onGoHome} 
            className="w-full text-xs text-bocado-gray font-medium hover:text-bocado-dark-gray transition-colors py-2"
            disabled={isLoading}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationFlow;